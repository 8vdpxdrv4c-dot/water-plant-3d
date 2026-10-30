/**
 * main.js — Water plant on Ultra-Water Lagoon ocean + island
 * Ocean / terrain / sky pipeline vendored from Humpalumps Ultra-Water (MIT).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bindGui, destroyGui } from './lib/gui.js';
import { buildPlant } from './plant/buildPlant.js';
import { STAGES } from './plant/stages.js';
import { initUI } from './ui/panel.js';

import { OceanSim, defaultOceanParams } from './vendor/ultra-water/water/OceanSim.js';
import { OceanSurface } from './vendor/ultra-water/water/OceanSurface.js';
import { bakeShoreMap } from './vendor/ultra-water/water/shoreMap.js';
import { bakeWaterTextures } from './vendor/ultra-water/water/bakeTextures.js';
import { WaveCaustics } from './vendor/ultra-water/water/Caustics.js';
import { UnderwaterPass } from './vendor/ultra-water/water/UnderwaterPass.js';
import { Spray } from './vendor/ultra-water/water/Spray.js';
import { MarineSnow } from './vendor/ultra-water/water/MarineSnow.js';
import { WaterQuery } from './vendor/ultra-water/water/WaterQuery.js';
import { SkySystem } from './vendor/ultra-water/scene/sky.js';
import { createTerrain } from './vendor/ultra-water/scene/terrain.js';
import { islandHeight } from './vendor/ultra-water/scene/islandHeight.js';
import { FloaterShadow } from './vendor/ultra-water/scene/floaterShadow.js';
import { PlanarReflection } from './vendor/ultra-water/engine/PlanarReflection.js';
import { PostFX } from './vendor/ultra-water/engine/PostFX.js';
import { FullscreenQuad, rawPass } from './vendor/ultra-water/engine/fullscreen.js';

const REFLECT_LAYER = 1;
const LAGOON = {
  elevation: 52,
  azimuth: 205,
  // calmer lagoon seas
  windSpeed: 4.5,
  waveScale: 0.45,
  swellScale: 0.35,
  choppiness: 0.55,
  timeScale: 0.85,
  fetchKm: 40,
};
const TROPICAL = {
  absorption: [0.36, 0.045, 0.06],
  scatter: [0.0, 0.085, 0.085],
  foam: [0.66, 0.86, 0.84],
  turbidity: 0.02,
};

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  depth: false,
  stencil: false,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.autoClear = false;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;

const quality = { resolution: 1, msaa: 4, reflections: true, reflectionScale: 0.5 };

const camera = new THREE.PerspectiveCamera(48, 1, 0.5, 80000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 8;
controls.maxDistance = 2500;

// —— Ultra-Water world ————————————————————————————————————————————————
const sky = new SkySystem(renderer);
Object.assign(sky.params, { elevation: LAGOON.elevation, azimuth: LAGOON.azimuth, cloudCoverage: 0.28, turbidity: 2.2 });

const shore = bakeShoreMap(islandHeight, 1800, 512);
const tex = bakeWaterTextures(renderer);
const oceanParams = defaultOceanParams();
Object.assign(oceanParams, {
  windSpeed: LAGOON.windSpeed,
  waveScale: LAGOON.waveScale,
  swellScale: LAGOON.swellScale,
  choppiness: LAGOON.choppiness,
  timeScale: LAGOON.timeScale,
  fetchKm: LAGOON.fetchKm,
});
const ocean = new OceanSim(renderer, oceanParams);
ocean.dirty = true;

const caustics = new WaveCaustics(renderer, ocean);
const floatShadow = new FloaterShadow();
const surface = new OceanSurface(ocean, shore, sky, floatShadow.uniforms);
surface.uniforms.uFoamTex.value = tex.foam;

const scene = new THREE.Scene();
scene.environment = sky.cube;
scene.add(sky.background);

const terrain = createTerrain({
  sky,
  caustics: caustics.uniforms,
  floatShadow: floatShadow.uniforms,
  water: surface.uniforms,
  absorption: surface.uniforms.uAbsorption.value,
  reflectionLayer: REFLECT_LAYER,
});
scene.add(terrain.group);

const sunLight = new THREE.DirectionalLight(0xffffff, Math.PI);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(4096, 4096);
Object.assign(sunLight.shadow.camera, {
  left: -900, right: 900, top: 900, bottom: -900, near: 10, far: 5000,
});
sunLight.shadow.bias = -0.0004;
sunLight.shadow.normalBias = 0.6;
scene.add(sunLight, sunLight.target);
surface.uniforms.uShadowMatrix.value = terrain.uniforms.uSunShadowMatrix.value = sunLight.shadow.matrix;
surface.uniforms.uShadowBias.value = 0.05 / (sunLight.shadow.camera.far - sunLight.shadow.camera.near);

// Soft fill so plant PBR materials read outdoors
const hemi = new THREE.HemisphereLight(0xb8d4f0, 0x8a8470, 0.35);
scene.add(hemi);

const query = new WaterQuery(renderer, surface, 64);
const underwater = new UnderwaterPass(surface, camera, caustics.uniforms);
let camWater = 0;
let wasSubmerged = false;
let uwComp = 1;
const look = { underwater: 0.55 };

const reflection = new PlanarReflection(REFLECT_LAYER);
surface.uniforms.uReflMatrix.value = reflection.textureMatrix;
const emptyReflection = new THREE.DataTexture(new Uint8Array(4), 1, 1);
emptyReflection.needsUpdate = true;

const waterScene = new THREE.Scene();
const restore = new FullscreenQuad(rawPass(/* glsl */`
precision highp float;
uniform sampler2D uTex;
in vec2 vUv;
out vec4 outColor;
void main() { outColor = texture(uTex, vUv); }`, { uTex: { value: null } }));
restore.mesh.renderOrder = -1;
if (/OculusBrowser/.test(navigator.userAgent)) waterScene.add(restore.mesh);

const spray = new Spray(surface, shore, 80000);
spray.params.amount = 0.55;
const snow = new MarineSnow(surface);
waterScene.add(surface.mesh, spray.mesh, spray.splash, snow.mesh);

const post = new PostFX(renderer);
post.params.bloomStrength = 0.05;
post.params.bloomThreshold = 1.5;
post.params.saturation = 1.08;

function applyTropicalPreset() {
  const su = surface.uniforms;
  su.uAbsorption.value.fromArray(TROPICAL.absorption);
  su.uScatterColor.value.fromArray(TROPICAL.scatter);
  su.uFoamTint.value.fromArray(TROPICAL.foam);
  underwater.params.scattering = TROPICAL.turbidity;
}

applyTropicalPreset();

let hdrRT = null;
function makeTargets() {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  hdrRT?.dispose();
  hdrRT = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    samples: quality.msaa,
    generateMipmaps: false,
    depthTexture: new THREE.DepthTexture(size.x, size.y, THREE.FloatType),
  });
  restore.material.uniforms.uTex.value = hdrRT.texture;
  surface.uniforms.uSceneColor.value = hdrRT.texture;
  surface.uniforms.uSceneDepth.value = hdrRT.depthTexture;
  surface.uniforms.uResolution.value.copy(size);
  reflection.scale = quality.reflectionScale;
  reflection.setSize(size.x, size.y);
  post.setSize(size.x, size.y);
  underwater.setSize(size.x, size.y);
}

function resizeToView() {
  const w = canvas.clientWidth || 1;
  const h = canvas.clientHeight || 1;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * quality.resolution);
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(h, 1);
  camera.updateProjectionMatrix();
  makeTargets();
}

function applySun() {
  sky.update();
  sunLight.position.copy(sky.sunDir).multiplyScalar(2000);
  sunLight.color.setRGB(sky.sunColor.x, sky.sunColor.y, sky.sunColor.z).multiplyScalar(1 / Math.max(sky.sunColor.x, 1e-4));
  sunLight.intensity = Math.PI * Math.max(sky.sunColor.x, 1e-4);
  renderer.shadowMap.needsUpdate = true;
}

function coast(bearingDeg) {
  const a = THREE.MathUtils.degToRad(bearingDeg);
  let r = 100;
  while (r < 800 && islandHeight(Math.cos(a) * r, Math.sin(a) * r) > 0) r += 2;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r, r, a };
}

function sunBearing() {
  return Math.atan2(sky.sunDir.z, sky.sunDir.x);
}

/** Flat-ish coastal plateau inland of Lagoon coast for the plant. */
function findPlantPad() {
  const bearing = THREE.MathUtils.radToDeg(sunBearing() + Math.PI);
  const c = coast(bearing);
  for (let f = 0.9; f >= 0.55; f -= 0.015) {
    const x = c.x * f;
    const z = c.z * f;
    const h = islandHeight(x, z);
    if (h < 2.2 || h > 16) continue;
    const offs = [[12, 0], [-12, 0], [0, 10], [0, -10], [24, 0], [-24, 0], [0, 18]];
    let minH = h;
    let maxH = h;
    let ok = true;
    for (const [dx, dz] of offs) {
      const hh = islandHeight(x + dx, z + dz);
      minH = Math.min(minH, hh);
      maxH = Math.max(maxH, hh);
      if (hh < 1.2) ok = false;
    }
    if (ok && maxH - minH < 5.5) {
      return { x, z, y: h, coast: c, bearingRad: c.a };
    }
  }
  const x = c.x * 0.78;
  const z = c.z * 0.78;
  return { x, z, y: Math.max(islandHeight(x, z), 2.5), coast: c, bearingRad: c.a };
}

applySun();
const plantPad = findPlantPad();

// Plant sits on coastal land; scale slightly for Lagoon aerial readability
const PLANT_SCALE = 1.15;
const plant = buildPlant(scene, {
  flowSpeed: 1.15,
  skipPark: true,
  reflectionLayer: REFLECT_LAYER,
});
plant.root.position.set(plantPad.x, plantPad.y + 0.15, plantPad.z);
plant.root.scale.setScalar(PLANT_SCALE);
// Align plant spine roughly along the coast (tangent)
plant.root.rotation.y = plantPad.bearingRad + Math.PI / 2;

function worldFocus(stageIndex) {
  const zg = plant.stageGroups[stageIndex];
  const local = zg.userData.focusPoint.clone();
  // focusPoint is already in root-local stage coords (includes stage x); transform by root
  return local.applyMatrix4(plant.root.matrixWorld);
}

function worldCamOffset(stageIndex) {
  const off = plant.stageGroups[stageIndex].userData.camOffset || { x: 0, y: 10, z: 13 };
  const v = new THREE.Vector3(off.x, off.y, off.z).multiplyScalar(PLANT_SCALE);
  v.applyQuaternion(plant.root.quaternion);
  return v;
}

// Lagoon camera: elevated coastal view looking past plant toward open water
function applyLagoonCamera() {
  // Three-quarter coastal view: turquoise lagoon + island land + plant on shore
  const c = plantPad.coast;
  const plantPos = plant.root.position;
  const out = new THREE.Vector3(c.x, 0, c.z).normalize();
  const side = new THREE.Vector3(-out.z, 0, out.x);
  camera.position.set(
    plantPos.x + side.x * 95 + out.x * 35,
    Math.max(plantPad.y + 28, 30),
    plantPos.z + side.z * 95 + out.z * 35,
  );
  controls.target.set(plantPos.x + out.x * 25, plantPad.y + 2, plantPos.z + out.z * 25);
  controls.update();
}

applyLagoonCamera();
resizeToView();
window.addEventListener('resize', resizeToView);

// —— HUD / stage interaction (kept) ————————————————————————————————————
const params = {
  flowSpeed: 1.15,
  autoTour: false,
  exposure: 1,
};
const guiHost = document.getElementById('gui-host');
const gui = bindGui(guiHost, [
  { key: 'flowSpeed', label: '流速 FlowSpeed', min: 0.2, max: 4, step: 0.05, default: 1.15 },
  { key: 'autoTour', label: '自动巡游 AutoTour', default: false },
  { key: 'exposure', label: '曝光 Exposure', min: 0.4, max: 2.5, step: 0.01, default: 1 },
], params, (key, value) => {
  if (key === 'flowSpeed') plant.setFlowSpeed(value);
  if (key === 'autoTour') {
    autoTour = !!value;
    ui.setTouring(autoTour);
    if (autoTour) startTour();
  }
});

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let selected = -1;
let autoTour = false;
let tourIndex = 0;
let tourTimer = 0;

const fly = {
  active: false,
  t: 0,
  duration: 1.55,
  fromPos: new THREE.Vector3(),
  toPos: new THREE.Vector3(),
  fromTarget: new THREE.Vector3(),
  toTarget: new THREE.Vector3(),
};

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function flyToStage(index) {
  if (index < 0 || index >= plant.stageGroups.length) {
    plant.setHighlight(-1);
    selected = -1;
    return;
  }
  plant.root.updateMatrixWorld(true);
  const focus = worldFocus(index);
  const off = worldCamOffset(index);
  fly.fromPos.copy(camera.position);
  fly.fromTarget.copy(controls.target);
  fly.toTarget.copy(focus);
  fly.toPos.copy(focus).add(off);
  // Keep camera above land
  const floor = islandHeight(fly.toPos.x, fly.toPos.z) + 2.5;
  if (fly.toPos.y < floor) fly.toPos.y = floor;
  fly.t = 0;
  fly.active = true;
  selected = index;
  plant.setHighlight(index);
}

function startTour() {
  tourIndex = 0;
  tourTimer = 0;
  flyToStage(0);
  ui.showStage(0);
}

const ui = initUI({
  onSelectStage(index) {
    if (index < 0) {
      plant.setHighlight(-1);
      selected = -1;
      return;
    }
    autoTour = false;
    params.autoTour = false;
    ui.setTouring(false);
    flyToStage(index);
  },
  onAutoTour(on) {
    autoTour = on;
    params.autoTour = on;
    if (on) startTour();
  },
});

function onPointer(event, isClick) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(plant.pickables, false);
  if (hits.length) {
    const stageIndex = hits[0].object.userData.stageIndex;
    if (stageIndex == null) {
      ui.hideTooltip();
      return;
    }
    const stage = STAGES[stageIndex];
    if (isClick) {
      autoTour = false;
      params.autoTour = false;
      ui.setTouring(false);
      flyToStage(stageIndex);
      ui.showStage(stageIndex);
    } else {
      ui.showTooltip(stage.name, event.clientX, event.clientY);
      canvas.style.cursor = 'pointer';
    }
  } else {
    ui.hideTooltip();
    canvas.style.cursor = 'default';
  }
}

canvas.addEventListener('pointermove', (e) => onPointer(e, false));
canvas.addEventListener('click', (e) => onPointer(e, true));
canvas.addEventListener('pointerleave', () => ui.hideTooltip());

function clampCamera() {
  const floor = islandHeight(camera.position.x, camera.position.z) + 0.8;
  if (camera.position.y < floor) camera.position.y = floor;
}

function renderFrame(dt, elapsed) {
  if (query.resultCount > 0) camWater = query.result[0];

  // No floaters — keep float shadow inactive
  floatShadow.uniforms.uFloatShadowBias.value = 0;

  ocean.update(dt);
  caustics.update(sky.sunDir);
  surface.update(camera, elapsed % 3600);
  spray.update();
  const qXZ = new Float32Array([camera.position.x, camera.position.z]);
  query.submit(qXZ, 1, 0, elapsed);

  const camY = camera.position.y;
  const submerged = camY < camWater - 0.3;
  const nearSurface = camY < camWater + 1.2;
  surface.uniforms.uCamSide.value = camY > camWater + 0.5 ? -1 : camY < camWater - 0.5 ? 1 : 0;
  snow.update(camera, hdrRT.height, nearSurface);
  uwComp += ((submerged ? look.underwater : 1) - uwComp) * Math.min(1, dt * 3);
  post.params.exposure = params.exposure * uwComp;
  post.params.droplets = wasSubmerged && !submerged ? 1 : submerged ? 0 : Math.max(0, post.params.droplets - dt / 5);
  wasSubmerged = submerged;

  if (quality.reflections && !submerged) {
    reflection.render(renderer, scene, camera);
    surface.uniforms.uReflection.value = reflection.target.texture;
  } else {
    surface.uniforms.uReflection.value = emptyReflection;
  }

  renderer.setRenderTarget(hdrRT);
  renderer.setClearColor(0x000000, 1);
  renderer.clear(true, true, false);
  renderer.render(scene, camera);

  surface.uniforms.uShadowMap.value = sunLight.shadow.map?.depthTexture ?? null;
  hdrRT.resolveDepthBuffer = nearSurface;
  renderer.render(waterScene, camera);
  hdrRT.resolveDepthBuffer = true;

  let frame = hdrRT.texture;
  if (nearSurface) {
    frame = underwater.render(renderer, hdrRT, camY < camWater - 0.8);
  }
  post.render(frame, dt);
}

let last = performance.now();
let elapsed = 0;

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  elapsed += dt;

  resizeToView();

  if (fly.active) {
    fly.t += dt / fly.duration;
    const k = easeInOut(Math.min(1, fly.t));
    camera.position.lerpVectors(fly.fromPos, fly.toPos, k);
    controls.target.lerpVectors(fly.fromTarget, fly.toTarget, k);
    if (fly.t >= 1) fly.active = false;
  }

  if (autoTour && !fly.active) {
    tourTimer += dt;
    if (tourTimer > 4.8) {
      tourTimer = 0;
      tourIndex = (tourIndex + 1) % STAGES.length;
      flyToStage(tourIndex);
      ui.showStage(tourIndex);
    }
  }

  try { plant.update(dt, elapsed); } catch (err) { console.warn('[plant.update]', err); }
  controls.update();
  clampCamera();
  renderFrame(dt, elapsed);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

window.addEventListener('beforeunload', () => {
  destroyGui(gui);
  plant.dispose();
});

window.__lagoon = {
  plantPad,
  sky,
  ocean,
  surface,
  terrain,
  plant,
  camera,
  controls,
  LAGOON,
  TROPICAL,
};

console.info(
  '[water-plant-3d] Ultra-Water Lagoon ready · plant @',
  plantPad.x.toFixed(1),
  plantPad.y.toFixed(1),
  plantPad.z.toFixed(1),
  '· stages',
  STAGES.length,
);
