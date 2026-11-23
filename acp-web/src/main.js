import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.183.0/examples/jsm/loaders/GLTFLoader.js';

const canvas = document.querySelector('#world');
const loadingScreen = document.querySelector('#loading');
const transitionScreen = document.querySelector('#transition');
const introCard = document.querySelector('#introCard');
const hud = document.querySelector('#hud');
const crosshair = document.querySelector('#crosshair');
const gateHint = document.querySelector('#gateHint');
const centerMessage = document.querySelector('#centerMessage');
const zoneName = document.querySelector('#zoneName');
const zoneCaption = document.querySelector('#zoneCaption');
const avatarInput = document.querySelector('#avatarInput');
const avatarStatus = document.querySelector('#avatarStatus');
const toast = document.querySelector('#toast');

const scene = new THREE.Scene();
scene.background = new THREE.Color('#f4f5f2');
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.06, 180);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
renderer.setClearColor('#f4f5f2');

scene.add(new THREE.HemisphereLight(0xffffff, 0xb7c5c2, 2.15));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
keyLight.position.set(-7, 15, 8);
scene.add(keyLight);
const fillLight = new THREE.PointLight(0x85c9d1, 120, 100, 2);
fillLight.position.set(4, 4, -23);
scene.add(fillLight);
const rimLight = new THREE.PointLight(0xe7b6d1, 90, 90, 2);
rimLight.position.set(-12, -2, -8);
scene.add(rimLight);

const portalRoot = new THREE.Group();
const worldRoot = new THREE.Group();
worldRoot.visible = false;
scene.add(portalRoot, worldRoot);

const player = new THREE.Group();
player.position.set(0, 2.45, 16);
scene.add(player);
const avatarAnchor = new THREE.Group();
player.add(avatarAnchor);

// A quiet stand-in keeps the flight link visible until a personal GLB is supplied.
const proxy = new THREE.Group();
proxy.scale.setScalar(0.58);
const proxyMat = new THREE.MeshStandardMaterial({ color: 0x8de7e6, emissive: 0x42b8c8, emissiveIntensity: 0.48, roughness: 0.33, metalness: 0.25 });
const proxyDark = new THREE.MeshStandardMaterial({ color: 0x19243b, emissive: 0x182b50, emissiveIntensity: 0.32, roughness: 0.4, metalness: 0.35 });
const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.48, 5, 10), proxyMat);
torso.position.y = -0.05;
proxy.add(torso);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), proxyMat);
head.position.y = 0.49;
proxy.add(head);
const visor = new THREE.Mesh(new THREE.SphereGeometry(0.205, 20, 14, 0, Math.PI * 2, 0.38, 0.7), proxyDark);
visor.position.set(0, 0.5, -0.04);
proxy.add(visor);
const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.34, 4, 8), proxyDark);
leftArm.position.set(-0.31, 0.01, 0);
leftArm.rotation.z = -0.34;
proxy.add(leftArm);
const rightArm = leftArm.clone();
rightArm.position.x = 0.31;
rightArm.rotation.z = 0.34;
proxy.add(rightArm);
const aura = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.012, 8, 48), new THREE.MeshBasicMaterial({ color: 0x7ee9ed, transparent: true, opacity: 0.62 }));
aura.rotation.x = Math.PI / 2;
aura.position.y = -0.17;
proxy.add(aura);
avatarAnchor.add(proxy);

const loader = new GLTFLoader();
let avatarObject = null;
let avatarUrl = null;
let avatarLabel = 'WAYFINDER';
let activeZone = 'portal';
let isPlaying = false;
let isLocked = false;
let yaw = 0;
let pitch = 0;
let lookPointer = null;
let pointerStart = null;
let transitionLock = false;
let soundEnabled = false;
let audioContext = null;
let ambience = null;
const keys = new Set();
const clock = new THREE.Clock();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const movement = new THREE.Vector3();
const cameraOffset = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const logoPivot = { object: null };
const animatedRings = [];
const orbitPivots = [];
const orbitalGuides = [];

function fitAvatar(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const height = Math.max(size.y, 0.01);
  const scale = 0.92 / height;
  model.scale.setScalar(scale);
  const fitted = new THREE.Box3().setFromObject(model);
  model.position.y -= fitted.min.y;
  model.rotation.y = Math.PI;
}

function flashToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(flashToast.timer);
  flashToast.timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function setAvatar(model, label) {
  if (avatarObject) avatarAnchor.remove(avatarObject);
  proxy.visible = false;
  avatarObject = model;
  fitAvatar(model);
  avatarAnchor.add(model);
  avatarLabel = label.replace(/\.[^.]+$/, '').slice(0, 20).toUpperCase() || 'MY AVATAR';
  document.querySelector('#hudAvatarName').textContent = avatarLabel;
  document.querySelector('#hudAvatarType').textContent = 'PERSONAL AVATAR';
  avatarStatus.textContent = `${label} · ACP World를 함께 탐험해요.`;
  avatarStatus.classList.add('avatar-ready');
}

async function loadAvatarFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.glb')) {
    flashToast('아바타 파일은 GLB 형식으로 불러와 주세요.');
    return;
  }
  try {
    const url = URL.createObjectURL(file);
    const gltf = await loader.loadAsync(url);
    if (avatarUrl) URL.revokeObjectURL(avatarUrl);
    avatarUrl = url;
    setAvatar(gltf.scene, file.name);
    flashToast('아바타를 Flight Link에 연결했어요.');
  } catch (error) {
    console.error(error);
    flashToast('아바타를 열 수 없어요. GLB 파일인지 확인해 주세요.');
  }
}

function prepareImportedScene(root) {
  const orbitCandidates = [];
  root.traverse((object) => {
    if (object.name.includes('central rotating emblem controller')) logoPivot.object = object;
    if (object.name.includes('rotating halo') || object.name.includes('tilted orbit ring')) animatedRings.push(object);
    if (!object.isMesh) return;
    object.frustumCulled = true;
    const bounds = new THREE.Box3().setFromObject(object);
    const dimensions = bounds.getSize(new THREE.Vector3());
    if (object.name.includes('dark inner digital sphere') || object.name.includes('vast spherical enclosure')) object.visible = false;
    if (/orbiting interface fragment|floating data shard|luminous data node|Network node/i.test(object.name)) {
      const longestSide = Math.max(dimensions.x, dimensions.y, dimensions.z, 0.001);
      const scaleBoost = Math.min(20, 4.2 / longestSide);
      object.scale.multiplyScalar(scaleBoost);
      orbitCandidates.push(object);
    }
  });

  if (!logoPivot.object) return;
  root.updateMatrixWorld(true);
  const center = logoPivot.object.getWorldPosition(new THREE.Vector3());
  logoPivot.object.scale.multiplyScalar(2.2);

  const orbitGroups = [
    { speed: 0.018, names: /Network node|luminous data node/i },
    { speed: -0.012, names: /orbiting interface fragment|floating data shard/i },
  ];
  orbitGroups.forEach(({ speed, names }) => {
    const pivot = new THREE.Group();
    pivot.position.copy(center);
    root.add(pivot);
    for (const object of orbitCandidates) {
      if (names.test(object.name) && object.parent !== pivot) pivot.attach(object);
    }
    orbitPivots.push({ object: pivot, speed });
  });

  [15, 23, 31].forEach((radius, index) => {
    const orbit = new THREE.Group();
    orbit.position.copy(center);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, index === 0 ? 0.035 : 0.022, 8, 180),
      new THREE.MeshBasicMaterial({ color: index === 1 ? 0x81b9bd : 0xd5a2bf, transparent: true, opacity: 0.24 })
    );
    ring.rotation.x = Math.PI / 2 + (index - 1) * 0.16;
    orbit.add(ring);
    root.add(orbit);
    orbitalGuides.push({ object: orbit, speed: index === 1 ? -0.025 : 0.016 });
  });
}

async function loadWorlds() {
  const [portal, world] = await Promise.all([
    loader.loadAsync('./assets/portal-space.glb'),
    loader.loadAsync('./assets/acp-world.glb'),
  ]);
  portalRoot.add(portal.scene);
  worldRoot.add(world.scene);
  prepareImportedScene(portal.scene);
  prepareImportedScene(world.scene);
  loadingScreen.classList.add('done');
}

function enterWorld() {
  if (transitionLock || activeZone === 'world') return;
  transitionLock = true;
  transitionScreen.classList.add('active');
  setTimeout(() => {
    activeZone = 'world';
    portalRoot.visible = false;
    worldRoot.visible = true;
    player.position.set(0, 2.45, -6.5);
    yaw = 0;
    pitch = 0;
    updateZoneLabels();
    introCard.classList.add('dismissed');
    hud.classList.remove('hidden');
    crosshair.classList.remove('hidden');
    gateHint.classList.add('hidden');
    centerMessage.classList.add('off');
    transitionScreen.classList.remove('active');
    transitionLock = false;
  }, 1050);
}

function returnToPortal() {
  if (activeZone !== 'world') return;
  transitionLock = true;
  transitionScreen.classList.add('active');
  setTimeout(() => {
    activeZone = 'portal';
    worldRoot.visible = false;
    portalRoot.visible = true;
    player.position.set(0, 2.45, 16);
    yaw = 0;
    pitch = 0;
    updateZoneLabels();
    gateHint.classList.remove('hidden');
    centerMessage.classList.remove('off');
    transitionScreen.classList.remove('active');
    transitionLock = false;
  }, 850);
}

function updateZoneLabels() {
  if (activeZone === 'world') {
    zoneName.textContent = 'ACP WORLD';
    zoneCaption.textContent = 'FREE FLIGHT / SECTOR 02';
    document.querySelector('#sector').textContent = 'ACP / OPEN SPACE';
  } else {
    zoneName.textContent = 'DIGITAL SPACE';
    zoneCaption.textContent = 'THE KEY IS A PORTAL';
    document.querySelector('#sector').textContent = 'GATE 01';
  }
}

function updateLookDirection() {
  const cp = Math.cos(pitch);
  forward.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp).normalize();
  right.set(Math.cos(yaw), 0, Math.sin(yaw)).normalize();
  player.rotation.y = yaw;
}

function updateHud() {
  const p = player.position;
  document.querySelector('#coordinates').innerHTML = `${p.x.toFixed(1)} <i>/</i> ${p.y.toFixed(1)} <i>/</i> ${p.z.toFixed(1)}`;
}

function update(dt, elapsed) {
  updateLookDirection();
  if (isPlaying && !transitionLock) {
    movement.set(0, 0, 0);
    if (keys.has('KeyW') || keys.has('ArrowUp')) movement.add(forward);
    if (keys.has('KeyS') || keys.has('ArrowDown')) movement.sub(forward);
    if (keys.has('KeyD') || keys.has('ArrowRight')) movement.add(right);
    if (keys.has('KeyA') || keys.has('ArrowLeft')) movement.sub(right);
    if (keys.has('Space')) movement.y += 1;
    if (keys.has('KeyC') || keys.has('ControlLeft') || keys.has('ControlRight')) movement.y -= 1;
    if (movement.lengthSq() > 0) {
      const boost = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 2.8 : 1;
      movement.normalize().multiplyScalar((activeZone === 'portal' ? 7.1 : 9.2) * boost * dt);
      player.position.add(movement);
    }

    if (activeZone === 'portal') {
      player.position.x = THREE.MathUtils.clamp(player.position.x, -18, 18);
      player.position.y = THREE.MathUtils.clamp(player.position.y, 0.6, 7.2);
      player.position.z = THREE.MathUtils.clamp(player.position.z, -1.2, 31);
      const inKeyhole = Math.abs(player.position.x) < 0.64 && player.position.y > 1.55 && player.position.y < 3.12;
      gateHint.classList.toggle('hidden', !inKeyhole);
      if (player.position.z < 0.2 && inKeyhole) enterWorld();
      if (player.position.z < 0.2 && !inKeyhole) player.position.z = 0.2;
    } else {
      player.position.x = THREE.MathUtils.clamp(player.position.x, -52, 52);
      player.position.y = THREE.MathUtils.clamp(player.position.y, -26, 35);
      player.position.z = THREE.MathUtils.clamp(player.position.z, -61, 30);
    }
    updateHud();
  }

  proxy.position.y = Math.sin(elapsed * 1.35) * 0.055;
  if (avatarObject) avatarObject.rotation.z = Math.sin(elapsed * 0.8) * 0.025;
  if (logoPivot.object && activeZone === 'world') logoPivot.object.rotation.y += dt * 0.2;
  animatedRings.forEach((ring, index) => {
    if (activeZone === 'world') ring.rotation.y += dt * (index === 0 ? 0.22 : -0.16);
  });
  if (activeZone === 'world') {
    orbitPivots.forEach(({ object, speed }) => { object.rotation.y += dt * speed; });
    orbitalGuides.forEach(({ object, speed }) => { object.rotation.y += dt * speed; });
  }
  if (activeZone === 'world') {
    fillLight.position.set(Math.sin(elapsed * 0.17) * 18, 7 + Math.cos(elapsed * 0.13) * 6, -24 + Math.cos(elapsed * 0.15) * 13);
  }

  const distance = activeZone === 'portal' ? 4.0 : 4.8;
  cameraOffset.set(0, 1.45, distance).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const cameraPosition = player.position.clone().add(cameraOffset);
  camera.position.lerp(cameraPosition, 1 - Math.exp(-8 * dt));
  cameraTarget.copy(player.position).add(new THREE.Vector3(0, 0.68, 0)).addScaledVector(forward, 1.25);
  camera.lookAt(cameraTarget);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.04);
  update(dt, clock.elapsedTime);
  renderer.render(scene, camera);
}

function requestPointerCapture() {
  if (canvas.requestPointerLock) canvas.requestPointerLock();
}

function startFlight() {
  isPlaying = true;
  introCard.classList.add('dismissed');
  hud.classList.remove('hidden');
  crosshair.classList.remove('hidden');
  gateHint.classList.remove('hidden');
  centerMessage.classList.remove('off');
  canvas.focus();
  requestPointerCapture();
}

document.querySelector('#startButton').addEventListener('click', startFlight);
document.querySelector('#portalReturn').addEventListener('click', returnToPortal);
avatarInput.addEventListener('change', (event) => loadAvatarFile(event.target.files?.[0]));
document.querySelector('#helpButton').addEventListener('click', () => document.querySelector('#helpPanel').classList.remove('hidden'));
document.querySelector('#closeHelp').addEventListener('click', () => document.querySelector('#helpPanel').classList.add('hidden'));
canvas.addEventListener('click', () => { if (isPlaying && !isLocked) requestPointerCapture(); });

document.addEventListener('pointerlockchange', () => {
  isLocked = document.pointerLockElement === canvas;
  if (!isLocked && isPlaying) {
    centerMessage.textContent = '화면을 클릭하면 계속 유영할 수 있어요';
    centerMessage.classList.remove('off');
  } else if (isLocked) {
    centerMessage.textContent = activeZone === 'world' ? 'WASD와 마우스로 ACP World를 탐험하세요' : '열쇠 구멍을 통과하면 ACP World가 열립니다';
    setTimeout(() => centerMessage.classList.add('off'), 2300);
  }
});

document.addEventListener('mousemove', (event) => {
  if (!isLocked || !isPlaying) return;
  yaw -= event.movementX * 0.0022;
  pitch = THREE.MathUtils.clamp(pitch - event.movementY * 0.0017, -1.2, 1.2);
});

document.addEventListener('keydown', (event) => {
  keys.add(event.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  if (event.code === 'Escape' && activeZone === 'world') centerMessage.textContent = '화면을 클릭하면 계속 유영할 수 있어요';
});
document.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('blur', () => keys.clear());

// Dragging on the canvas is a mouse-look fallback for browsers without pointer lock.
canvas.addEventListener('pointerdown', (event) => {
  if (!isPlaying || isLocked || event.pointerType === 'touch') return;
  lookPointer = event.pointerId;
  pointerStart = { x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (lookPointer !== event.pointerId || isLocked) return;
  yaw -= (event.clientX - pointerStart.x) * 0.0022;
  pitch = THREE.MathUtils.clamp(pitch - (event.clientY - pointerStart.y) * 0.0017, -1.2, 1.2);
  pointerStart = { x: event.clientX, y: event.clientY };
});
canvas.addEventListener('pointerup', () => { lookPointer = null; });

document.querySelector('#soundButton').addEventListener('click', async () => {
  soundEnabled = !soundEnabled;
  if (soundEnabled) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioContext ??= new AudioContextClass();
      await audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 110;
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(0.009, audioContext.currentTime, 0.45);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      ambience = { oscillator, gain };
    }
    document.querySelector('#soundButton').setAttribute('aria-label', '사운드 끄기');
    flashToast('공간의 저주파 사운드를 켰어요.');
  } else {
    if (ambience && audioContext) {
      const current = ambience;
      ambience = null;
      current.gain.gain.setTargetAtTime(0, audioContext.currentTime, 0.18);
      setTimeout(() => { try { current.oscillator.stop(); } catch {} }, 900);
    }
    document.querySelector('#soundButton').setAttribute('aria-label', '사운드 켜기');
    flashToast('사운드를 껐어요.');
  }
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
});

loadWorlds().then(() => animate()).catch((error) => {
  console.error(error);
  loadingScreen.innerHTML = '<div class="loading-title">WORLD LOAD FAILED</div><div class="loading-sub">acp-web 폴더를 로컬 서버로 실행해 주세요.</div>';
});
