import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.0/build/three.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const canvas = document.querySelector('#avatarCanvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#f0f6f2');
scene.fog = new THREE.Fog('#f0f6f2', 12, 30);
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
camera.position.set(3.7, 3.15, 7.8);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.setClearColor('#f0f6f2');
scene.add(new THREE.HemisphereLight(0xffffff, 0xa8c8c3, 2.25));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
keyLight.position.set(-4, 8, 7);
scene.add(keyLight);
const pinkLight = new THREE.PointLight(0xf2b5cf, 85, 13, 2);
pinkLight.position.set(4, 3, -2);
scene.add(pinkLight);
const cyanLight = new THREE.PointLight(0xa5e4d8, 65, 14, 2);
cyanLight.position.set(-4, 2, 3);
scene.add(cyanLight);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.enablePan = false;
controls.minDistance = 5.4;
controls.maxDistance = 11;
controls.minPolarAngle = 0.65;
controls.maxPolarAngle = 1.95;
controls.target.set(0, 1.45, 0);

const groundHalo = new THREE.Mesh(
  new THREE.TorusGeometry(2.05, 0.012, 8, 160),
  new THREE.MeshBasicMaterial({ color: 0x6bb6a9, transparent: true, opacity: 0.34 })
);
groundHalo.rotation.x = Math.PI / 2;
groundHalo.position.y = 0.05;
scene.add(groundHalo);
const groundHalo2 = new THREE.Mesh(
  new THREE.TorusGeometry(2.5, 0.008, 6, 160),
  new THREE.MeshBasicMaterial({ color: 0xd99ab6, transparent: true, opacity: 0.22 })
);
groundHalo2.rotation.set(Math.PI / 2.12, 0.12, 0);
groundHalo2.position.y = 0.02;
scene.add(groundHalo2);

const defaultConfig = {
  name: '모모', species: 'bunny', bodyColor: '#9bded1', eyeColor: '#283f67',
  accentColor: '#f49ab5', accessory: 'none', headScale: 1,
};
let config = { ...defaultConfig };
let avatar = null;
let activeKey = '';
let tail = null;
let toastTimer;
const clock = new THREE.Clock();

const storageKey = 'acp-world-avatar-profiles-v1';
function readProfiles() {
  try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); }
  catch { return []; }
}
function writeProfiles(profiles) { localStorage.setItem(storageKey, JSON.stringify(profiles)); }

function material(color, options = {}) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: 0.24, metalness: 0.025, clearcoat: 0.9,
    clearcoatRoughness: 0.15, ...options,
  });
}
function addMesh(parent, geometry, mat, position, scale = [1, 1, 1], rotation = null) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function sphere(parent, mat, position, scale, segments = 32) {
  return addMesh(parent, new THREE.SphereGeometry(1, segments, Math.max(12, Math.round(segments * 0.65))), mat, position, scale);
}
function makeEar(parent, x, style, fur, accent) {
  const inner = material(accent, { roughness: 0.3, clearcoat: 0.7 });
  if (style === 'bear') {
    sphere(parent, fur, [x, 0.48, 0], [0.22, 0.25, 0.15]);
    sphere(parent, inner, [x, 0.49, 0.13], [0.11, 0.13, 0.035]);
  } else if (style === 'cat' || style === 'fox') {
    const length = style === 'fox' ? 0.49 : 0.38;
    addMesh(parent, new THREE.ConeGeometry(style === 'fox' ? 0.19 : 0.2, length, 5), fur, [x, 0.53, 0], [1, 1, 0.65], [0, 0, x < 0 ? 0.1 : -0.1]);
    addMesh(parent, new THREE.ConeGeometry(0.105, length * 0.58, 5), inner, [x, 0.53, 0.11], [1, 1, 0.55], [0, 0, x < 0 ? 0.1 : -0.1]);
  } else {
    const length = style === 'bunny' ? 0.58 : 0.43;
    sphere(parent, fur, [x, 0.55, 0], [0.15, length * 0.58, 0.13]);
    sphere(parent, inner, [x, 0.56, 0.105], [0.075, length * 0.42, 0.035]);
  }
}

function buildAvatar(options) {
  const root = new THREE.Group();
  root.name = 'ACP OZ Avatar';
  root.userData = { ...options };
  const fur = material(options.bodyColor);
  const accent = material(options.accentColor, { roughness: 0.22 });
  const pale = material('#fffaf3', { roughness: 0.18 });
  const dark = material(options.eyeColor, { roughness: 0.13, clearcoat: 1 });
  const black = material('#172831', { roughness: 0.1, clearcoat: 1 });
  const rosy = material(options.accentColor, { roughness: 0.28 });

  const torso = addMesh(root, new THREE.CapsuleGeometry(0.42, 0.62, 7, 24), fur, [0, 1.08, 0], [1, 1, 0.82]);
  torso.name = 'rounded glossy body';
  sphere(root, fur, [0, 0.64, 0.02], [0.54, 0.43, 0.5]);

  const armL = addMesh(root, new THREE.CapsuleGeometry(0.13, 0.48, 5, 16), fur, [-0.53, 1.14, 0.01], [1, 1, 0.9], [0, 0, -0.58]);
  const armR = addMesh(root, new THREE.CapsuleGeometry(0.13, 0.48, 5, 16), fur, [0.53, 1.14, 0.01], [1, 1, 0.9], [0, 0, 0.58]);
  armL.name = 'left rounded arm'; armR.name = 'right rounded arm';
  addMesh(root, new THREE.CapsuleGeometry(0.16, 0.28, 5, 16), fur, [-0.25, 0.34, 0.02], [1, 1, 0.88]);
  addMesh(root, new THREE.CapsuleGeometry(0.16, 0.28, 5, 16), fur, [0.25, 0.34, 0.02], [1, 1, 0.88]);
  sphere(root, accent, [-0.25, 0.14, 0.22], [0.23, 0.14, 0.32]);
  sphere(root, accent, [0.25, 0.14, 0.22], [0.23, 0.14, 0.32]);

  const head = new THREE.Group();
  head.position.set(0, 1.82, 0.02);
  head.scale.setScalar(Number(options.headScale) || 1);
  head.name = 'oversized friendly head';
  root.add(head);
  sphere(head, fur, [0, 0, 0], [0.62, 0.57, 0.54], 40);
  if (options.species === 'bird') {
    const beak = addMesh(head, new THREE.ConeGeometry(0.16, 0.32, 6), accent, [0, -0.1, 0.59], [1, 1, 0.8], [Math.PI / 2, 0, 0]);
    beak.name = 'small beak';
  } else if (options.species === 'robot') {
    addMesh(head, new THREE.BoxGeometry(0.83, 0.58, 0.11), material(options.accentColor, { metalness: 0.12, roughness: 0.19 }), [0, -0.05, 0.5], [1, 1, 1], [0, 0, 0]);
    addMesh(head, new THREE.BoxGeometry(0.58, 0.18, 0.025), dark, [0, -0.04, 0.56]);
  } else {
    sphere(head, pale, [0, -0.11, 0.48], [0.29, 0.18, 0.13]);
    sphere(head, black, [0, -0.12, 0.59], [0.07, 0.05, 0.035], 20);
  }

  for (const side of [-1, 1]) {
    const eyeX = side * 0.22;
    sphere(head, pale, [eyeX, 0.055, 0.465], [0.118, 0.147, 0.095], 24);
    sphere(head, dark, [eyeX, 0.045, 0.545], [0.061, 0.092, 0.045], 24);
    sphere(head, pale, [eyeX - 0.018, 0.082, 0.581], [0.022, 0.027, 0.014], 16);
    sphere(head, rosy, [side * 0.39, -0.17, 0.398], [0.105, 0.045, 0.025], 20);
  }
  if (options.species === 'bunny' || options.species === 'cat' || options.species === 'fox' || options.species === 'bear') {
    makeEar(head, -0.38, options.species, fur, options.accentColor);
    makeEar(head, 0.38, options.species, fur, options.accentColor);
  }
  if (options.species === 'bird') {
    sphere(head, accent, [0, 0.53, 0.02], [0.12, 0.23, 0.12]);
    addMesh(head, new THREE.ConeGeometry(0.11, 0.24, 5), accent, [0, 0.62, 0.03]);
  }
  if (options.species === 'robot') {
    addMesh(head, new THREE.CylinderGeometry(0.035, 0.035, 0.3, 12), dark, [0, 0.68, 0]);
    sphere(head, accent, [0, 0.85, 0], [0.12, 0.12, 0.12]);
    for (const side of [-1, 1]) sphere(head, accent, [side * 0.45, 0, 0], [0.1, 0.1, 0.1]);
  }

  tail = new THREE.Group();
  tail.position.set(0, 0.8, -0.42);
  root.add(tail);
  if (options.species === 'fox' || options.species === 'cat') {
    sphere(tail, fur, [0.2, 0.1, -0.18], [0.2, 0.2, 0.48]);
    sphere(tail, options.species === 'fox' ? pale : accent, [0.2, 0.1, -0.57], [0.19, 0.19, 0.2]);
  } else {
    sphere(tail, fur, [0, 0.06, -0.18], [0.2, 0.2, 0.24]);
  }

  if (options.accessory === 'halo') {
    const halo = addMesh(root, new THREE.TorusGeometry(0.48, 0.055, 12, 56), material('#fff3bc', { metalness: 0.14, roughness: 0.16, emissive: '#c48e39', emissiveIntensity: 0.15 }), [0, 2.83, 0], [1, 1, 0.82], [Math.PI / 2, 0, 0]);
    halo.name = 'floating halo accessory';
  } else if (options.accessory === 'scarf') {
    const scarf = addMesh(root, new THREE.TorusGeometry(0.44, 0.095, 14, 48), accent, [0, 1.45, 0], [1, 1, 0.82], [Math.PI / 2, 0, 0]);
    scarf.name = 'soft scarf accessory';
    addMesh(root, new THREE.CapsuleGeometry(0.075, 0.46, 4, 12), accent, [0.3, 1.24, 0.29], [1, 1, 0.72], [0, 0, -0.35]);
  } else if (options.accessory === 'wings') {
    const wingMat = material('#f8fbff', { roughness: 0.22, clearcoat: 0.85 });
    sphere(root, wingMat, [-0.68, 1.48, -0.34], [0.33, 0.54, 0.16], 28).rotation.z = -0.42;
    sphere(root, wingMat, [0.68, 1.48, -0.34], [0.33, 0.54, 0.16], 28).rotation.z = 0.42;
    for (const side of [-1, 1]) {
      for (let index = 0; index < 3; index++) sphere(root, wingMat, [side * (0.69 + index * 0.06), 1.28 - index * 0.18, -0.43], [0.15, 0.28, 0.08], 20);
    }
  }

  root.userData = { ...options };
  return root;
}

function collectConfig() {
  return {
    name: document.querySelector('#avatarName').value.trim().slice(0, 24) || '이름 없는 아바타',
    species: document.querySelector('.species-choice.selected')?.dataset.species || defaultConfig.species,
    bodyColor: document.querySelector('#bodyColor').value,
    eyeColor: document.querySelector('#eyeColor').value,
    accentColor: document.querySelector('#accentColor').value,
    accessory: document.querySelector('.accessory-choice.selected')?.dataset.accessory || 'none',
    headScale: Number(document.querySelector('#headSize').value),
  };
}
function rebuild() {
  config = collectConfig();
  document.querySelector('#previewName').textContent = config.name.toUpperCase();
  document.querySelector('#headSizeValue').textContent = config.headScale < 0.95 ? '작게' : config.headScale > 1.12 ? '크게' : '보통';
  if (avatar) scene.remove(avatar);
  avatar = buildAvatar(config);
  scene.add(avatar);
}
function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2900);
}
function generateKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let profiles = readProfiles();
  let key;
  do {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    key = `OZ-${Array.from(bytes, (value) => chars[value % chars.length]).slice(0, 4).join('')}-${Array.from(bytes, (value) => chars[value % chars.length]).slice(4).join('')}`;
  } while (profiles.some((profile) => profile.key === key));
  return key;
}
function setActiveKey(key) {
  activeKey = key;
  const badge = document.querySelector('#currentKey');
  badge.textContent = key ? `이 아바타 키  ·  ${key}` : '';
  badge.classList.toggle('hidden', !key);
  document.querySelector('#loginKey').value = key || '';
}
function renderSaved() {
  const list = document.querySelector('#savedList');
  const profiles = readProfiles();
  document.querySelector('#savedCount').textContent = String(profiles.length);
  list.replaceChildren();
  if (!profiles.length) {
    const empty = document.createElement('p');
    empty.className = 'saved-empty';
    empty.textContent = '저장한 아바타가 여기에 모여요.';
    list.append(empty);
    return;
  }
  profiles.slice().reverse().forEach((profile) => {
    const button = document.createElement('button');
    button.className = 'saved-item';
    button.textContent = `${profile.config.name} · ${profile.key}`;
    button.addEventListener('click', () => loadProfile(profile.key));
    list.append(button);
  });
}
function applyConfig(next) {
  document.querySelector('#avatarName').value = next.name || '새 아바타';
  document.querySelectorAll('.species-choice').forEach((button) => button.classList.toggle('selected', button.dataset.species === next.species));
  document.querySelector('#bodyColor').value = next.bodyColor || defaultConfig.bodyColor;
  document.querySelector('#eyeColor').value = next.eyeColor || defaultConfig.eyeColor;
  document.querySelector('#accentColor').value = next.accentColor || defaultConfig.accentColor;
  document.querySelectorAll('.swatch').forEach((button) => button.classList.toggle('selected', button.dataset.color.toLowerCase() === (next.bodyColor || '').toLowerCase()));
  document.querySelectorAll('.accessory-choice').forEach((button) => button.classList.toggle('selected', button.dataset.accessory === next.accessory));
  document.querySelector('#headSize').value = String(next.headScale || 1);
  rebuild();
}
function loadProfile(key) {
  const normalizedKey = key.trim().toUpperCase();
  const profile = readProfiles().find((item) => item.key === normalizedKey);
  if (!profile) {
    showToast('이 기기에 해당 키로 저장된 아바타가 없어요.');
    return;
  }
  applyConfig(profile.config);
  setActiveKey(profile.key);
  showToast(`${profile.config.name} 아바타를 불러왔어요.`);
}
async function saveProfile() {
  config = collectConfig();
  const profiles = readProfiles();
  const key = activeKey || generateKey();
  const next = { key, config: { ...config }, updatedAt: new Date().toISOString() };
  const existingIndex = profiles.findIndex((item) => item.key === key);
  if (existingIndex >= 0) profiles[existingIndex] = next;
  else profiles.push(next);
  writeProfiles(profiles);
  setActiveKey(key);
  renderSaved();
  try { await navigator.clipboard.writeText(key); showToast(`저장 완료 · ${key}를 복사했어요.`); }
  catch { showToast(`저장 완료 · 아바타 키는 ${key}예요.`); }
}
async function exportGlb() {
  if (!avatar) return;
  config = collectConfig();
  const previewTail = tail;
  const exportRoot = buildAvatar(config);
  tail = previewTail;
  const exporter = new GLTFExporter();
  try {
    const bytes = await exporter.parseAsync(exportRoot, { binary: true, onlyVisible: true });
    const blob = new Blob([bytes], { type: 'model/gltf-binary' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${config.name.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '-') || 'oz-avatar'}.glb`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast('GLB 아바타를 내려받았어요. ACP 공간에서 불러올 수 있어요.');
  } catch (error) {
    console.error(error);
    showToast('GLB를 만들지 못했어요. 브라우저를 새로고침해 주세요.');
  }
}

document.querySelectorAll('.species-choice').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.species-choice').forEach((item) => item.classList.remove('selected'));
  button.classList.add('selected');
  rebuild();
}));
document.querySelectorAll('.accessory-choice').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.accessory-choice').forEach((item) => item.classList.remove('selected'));
  button.classList.add('selected');
  rebuild();
}));
document.querySelectorAll('.swatch').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.swatch').forEach((item) => item.classList.remove('selected'));
  button.classList.add('selected');
  document.querySelector('#bodyColor').value = button.dataset.color;
  rebuild();
}));
document.querySelector('#bodyColor').addEventListener('input', () => {
  document.querySelectorAll('.swatch').forEach((item) => item.classList.toggle('selected', item.dataset.color.toLowerCase() === document.querySelector('#bodyColor').value.toLowerCase()));
  rebuild();
});
['#avatarName', '#eyeColor', '#accentColor', '#headSize'].forEach((selector) => document.querySelector(selector).addEventListener(selector === '#avatarName' ? 'input' : 'input', rebuild));
document.querySelector('#saveButton').addEventListener('click', saveProfile);
document.querySelector('#exportButton').addEventListener('click', exportGlb);
document.querySelector('#loadKeyButton').addEventListener('click', () => loadProfile(document.querySelector('#loginKey').value));
document.querySelector('#loginKey').addEventListener('keydown', (event) => { if (event.key === 'Enter') loadProfile(event.currentTarget.value); });

function resize() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
  renderer.setSize(rect.width, rect.height, false);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
}
new ResizeObserver(resize).observe(canvas);
window.addEventListener('resize', resize);
applyConfig(defaultConfig);
renderSaved();
resize();

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();
  if (avatar) {
    avatar.position.y = Math.sin(elapsed * 1.2) * 0.055;
    avatar.rotation.y += 0.002;
    if (tail) tail.rotation.x = Math.sin(elapsed * 2.1) * 0.12;
  }
  groundHalo.rotation.z += 0.0016;
  groundHalo2.rotation.z -= 0.0011;
  controls.update();
  renderer.render(scene, camera);
}
animate();
