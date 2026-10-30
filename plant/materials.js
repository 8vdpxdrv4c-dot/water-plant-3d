import * as THREE from 'three';

/** Photoreal industrial-park palette */
export const COLORS = {
  concrete: 0xb8b9b6,
  concreteDark: 0x9a9b96,
  asphalt: 0x3a3c40,
  grass: 0x5a7a48,
  soil: 0x6a5a48,
  skyTop: 0xb8c8d8,
  skyHorizon: 0xd8e0e8,
  haze: 0xc8d0d8,
  tank: 0xe8eae8,
  tankPaint: 0xf0f2f0,
  blackTank: 0x1c1e20,
  pipe: 0x2a8fd4,
  pipePvc: 0x2b9ae0,
  pipeGrey: 0x8a929a,
  metal: 0x8a9098,
  brushed: 0x9aa2aa,
  warehouse: 0xc8c4b8,
  warehouseRoof: 0x6a7078,
  fence: 0x707880,
  accent: 0x0B6BCB,
  highlight: 0x0B6BCB,
  building: 0xd0d2d0,
  platform: 0xb0b2ae,
  platformEdge: 0x989a96,
  ground: 0xb0b2ae,
};

function makeNoiseCanvas(size = 256, opts = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const base = opts.base || [180, 181, 176];
  g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
  g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size);
  const d = img.data;
  const amp = opts.amp ?? 18;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amp;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n * 0.95));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 0.9));
  }
  // stains
  for (let s = 0; s < (opts.stains ?? 12); s++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const r = 8 + Math.random() * 28;
    const grd = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    const dark = Math.random() > 0.5;
    grd.addColorStop(0, dark ? 'rgba(60,55,45,0.22)' : 'rgba(220,215,200,0.18)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
  }
  g.putImageData(img, 0, 0);
  // fine grit on top of stains (re-get)
  const img2 = g.getImageData(0, 0, size, size);
  for (let i = 0; i < img2.data.length; i += 4) {
    if (Math.random() > 0.97) {
      const v = 40 + Math.random() * 40;
      img2.data[i] = img2.data[i + 1] = img2.data[i + 2] = v;
    }
  }
  g.putImageData(img2, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeRoughCanvas(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 90 + Math.random() * 100;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

let _concreteMap;
let _concreteRough;
let _asphaltMap;

export function getConcreteMap(repeat = 8) {
  if (!_concreteMap) _concreteMap = makeNoiseCanvas(512, { base: [176, 177, 172], amp: 22, stains: 18 });
  const t = _concreteMap.clone();
  t.repeat.set(repeat, repeat);
  t.needsUpdate = true;
  return t;
}

export function getConcreteRough(repeat = 8) {
  if (!_concreteRough) _concreteRough = makeRoughCanvas(256);
  const t = _concreteRough.clone();
  t.repeat.set(repeat, repeat);
  t.needsUpdate = true;
  return t;
}

export function getAsphaltMap(repeat = 4) {
  if (!_asphaltMap) _asphaltMap = makeNoiseCanvas(256, { base: [58, 60, 64], amp: 14, stains: 6 });
  const t = _asphaltMap.clone();
  t.repeat.set(repeat, repeat);
  t.needsUpdate = true;
  return t;
}

/** Poured concrete apron */
export function concreteMat(extras = {}) {
  const map = extras.map ?? getConcreteMap(extras.repeat ?? 6);
  const roughMap = extras.roughnessMap ?? getConcreteRough(extras.repeat ?? 6);
  return new THREE.MeshPhysicalMaterial({
    color: extras.color ?? COLORS.concrete,
    map,
    roughnessMap: roughMap,
    metalness: 0.0,
    roughness: extras.roughness ?? 0.92,
    envMapIntensity: 0.35,
    flatShading: false,
    ...strip(extras, ['color', 'map', 'roughnessMap', 'repeat', 'roughness']),
  });
}

/** Low pad / equipment plinth on apron */
export function platformMat() {
  return concreteMat({
    color: 0xb4b6b2,
    repeat: 2,
    roughness: 0.88,
  });
}

/** Painted steel tank (matte industrial enamel) */
export function whiteMat(extras = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: extras.color ?? COLORS.tankPaint,
    metalness: extras.metalness ?? 0.15,
    roughness: extras.roughness ?? 0.48,
    clearcoat: extras.clearcoat ?? 0.25,
    clearcoatRoughness: extras.clearcoatRoughness ?? 0.45,
    envMapIntensity: extras.envMapIntensity ?? 0.65,
    ...strip(extras, ['color', 'metalness', 'roughness', 'clearcoat', 'clearcoatRoughness', 'envMapIntensity']),
  });
}

export function blackMat(extras = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: extras.color ?? COLORS.blackTank,
    metalness: extras.metalness ?? 0.45,
    roughness: extras.roughness ?? 0.42,
    clearcoat: 0.2,
    clearcoatRoughness: 0.5,
    envMapIntensity: 0.8,
    ...strip(extras, ['color', 'metalness', 'roughness']),
  });
}

/** PVC / coated process pipe — industrial blue */
export function pipeMat(color = COLORS.pipePvc) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.05,
    roughness: 0.38,
    clearcoat: 0.55,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.75,
  });
}

export function metalMat(color = COLORS.metal, extras = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: extras.metalness ?? 0.85,
    roughness: extras.roughness ?? 0.4,
    envMapIntensity: extras.envMapIntensity ?? 0.9,
    ...strip(extras, ['metalness', 'roughness', 'envMapIntensity']),
  });
}

export function asphaltMat() {
  return new THREE.MeshPhysicalMaterial({
    color: COLORS.asphalt,
    map: getAsphaltMap(6),
    metalness: 0.0,
    roughness: 0.95,
    envMapIntensity: 0.2,
  });
}

export function grassMat() {
  return new THREE.MeshStandardMaterial({
    color: COLORS.grass,
    roughness: 0.95,
    metalness: 0.0,
  });
}

export function glassMat(tint = 0xa8c8e0, opacity = 0.35) {
  return new THREE.MeshPhysicalMaterial({
    color: tint,
    metalness: 0.05,
    roughness: 0.12,
    transmission: 0.7,
    thickness: 0.3,
    transparent: true,
    opacity,
    ior: 1.45,
    envMapIntensity: 1.0,
  });
}

export function waterVolumeMat(clarity = 0.7) {
  const deep = new THREE.Color(0x1a6aaa);
  const clear = new THREE.Color(0x3a9fd0);
  const c = deep.clone().lerp(clear, clarity);
  return new THREE.MeshPhysicalMaterial({
    color: c,
    metalness: 0.0,
    roughness: 0.12,
    transmission: 0.45 + clarity * 0.25,
    thickness: 1.4,
    transparent: true,
    opacity: 0.5 + clarity * 0.2,
    ior: 1.333,
    attenuationColor: c.clone().multiplyScalar(0.8),
    attenuationDistance: 2.0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.15,
    envMapIntensity: 0.9,
  });
}

export function emissiveMat(color, intensity = 0.15) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.5,
    metalness: 0.1,
  });
}

function strip(obj, keys) {
  const out = { ...obj };
  for (const k of keys) delete out[k];
  return out;
}
