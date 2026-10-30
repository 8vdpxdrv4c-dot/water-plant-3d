/**
 * buildPlant.js — Premium product-render water plant
 */
import * as THREE from 'three';
import { STAGES, stagePosition } from './stages.js';
import {
  COLORS, whiteMat, platformMat, blackMat, pipeMat, metalMat, waterVolumeMat, glassMat, concreteMat,
} from './materials.js';
import { buildIndustrialPark } from './environment.js';
import { createPipeNetwork } from '../effects/pipe-flow.js';
import { createWaterSurface } from '../effects/water-surface.js';
import { createSoftParticles } from '../effects/soft-particles.js';
import { createMotionArrows } from '../effects/motion-arrows.js';
import { createAlertPulse } from '../effects/alerts.js';

function box(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(rt, rb, h, mat, segs = 48) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segs), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Accent-ladder callout — white sheet, hairline, water-blue mark, DM Sans */
function makeCallout(label, stepNum) {
  const group = new THREE.Group();
  group.name = 'callout';

  const W = 560;
  const H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);

  // white surface card (no drop shadow at rest)
  g.fillStyle = '#ffffff';
  roundRect(g, 16, 24, 528, 80, 8);
  g.fill();

  // 1px rule border
  g.strokeStyle = '#e5e7eb';
  g.lineWidth = 2;
  roundRect(g, 16, 24, 528, 80, 8);
  g.stroke();

  // small accent mark (full hue only on the mark)
  g.fillStyle = '#0B6BCB';
  g.beginPath();
  g.arc(48, 64, 5, 0, Math.PI * 2);
  g.fill();

  // label — sentence case, no tracked caps
  g.font = '500 34px "DM Sans","PingFang SC","Noto Sans SC",sans-serif';
  g.fillStyle = '#111827';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText(label, 68, 64);

  // optional step as quiet tabular chip (not decorative 01 mono)
  if (stepNum != null) {
    const chip = `第 ${stepNum} 段`;
    g.font = '500 22px "DM Sans","PingFang SC",sans-serif';
    const tw = g.measureText(chip).width;
    const cx = 520 - tw - 28;
    g.fillStyle = '#E8F3FC';
    roundRect(g, cx - 10, 44, tw + 20, 40, 6);
    g.fill();
    g.fillStyle = '#0A3D6E';
    g.fillText(chip, cx, 64);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const spr = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    })
  );
  spr.scale.set(3.2, 0.73, 1);
  group.add(spr);
  return group;
}

function roundRect(g, x, y, w, h, r) {
  if (g.roundRect) {
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    return;
  }
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function makeContactShadow(w, d) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grd = ctx.createRadialGradient(128, 128, 20, 128, 128, 120);
  grd.addColorStop(0, 'rgba(30,40,55,0.18)');
  grd.addColorStop(0.45, 'rgba(30,40,55,0.08)');
  grd.addColorStop(1, 'rgba(30,40,55,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 1.15, d * 1.15),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      opacity: 1,
    })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.015;
  return m;
}

function makePlatform(w, d, h = 0.28) {
  const g = new THREE.Group();
  // poured concrete equipment plinth (sits on apron)
  const base = box(w, h, d, concreteMat({ color: 0xb2b4b0, repeat: 2.5, roughness: 0.9 }));
  base.position.y = h / 2;
  g.add(base);

  // chamfer lip
  const lip = box(w + 0.12, 0.06, d + 0.12, concreteMat({ color: 0xa8aaa6, repeat: 1.5, roughness: 0.88 }));
  lip.position.y = h + 0.02;
  g.add(lip);

  const edge = box(w + 0.2, 0.03, d + 0.2, new THREE.MeshStandardMaterial({
    color: COLORS.highlight,
    transparent: true,
    opacity: 0.0,
    roughness: 1,
  }));
  edge.position.y = 0.02;
  g.add(edge);

  g.add(makeContactShadow(w * 1.05, d * 1.05));

  const pick = new THREE.Mesh(
    new THREE.BoxGeometry(w, 8, d),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  pick.position.y = 4;
  pick.userData.isPickProxy = true;
  g.add(pick);

  g.userData.pad = base;
  g.userData.edge = edge;
  return g;
}

function buildBasin(w, h, d, clarity = 0.7) {
  const g = new THREE.Group();
  const wall = whiteMat({ roughness: 0.26 });
  const thick = 0.12;
  const floor = box(w, thick, d, wall);
  floor.position.y = thick / 2;
  g.add(floor);
  const specs = [
    [0, h / 2, -d / 2 + thick / 2, w, h, thick],
    [0, h / 2, d / 2 - thick / 2, w, h, thick],
    [-w / 2 + thick / 2, h / 2, 0, thick, h, d],
    [w / 2 - thick / 2, h / 2, 0, thick, h, d],
  ];
  for (const [x, y, z, ww, hh, dd] of specs) {
    const m = box(ww, hh, dd, wall);
    m.position.set(x, y, z);
    g.add(m);
  }

  // thin glass rim
  const rim = box(w - 0.04, 0.04, d - 0.04, glassMat(0xf0f7ff, 0.25));
  rim.position.y = h + 0.02;
  rim.castShadow = false;
  g.add(rim);

  const waterH = h * 0.78;
  const vol = box(w - thick * 2.5, waterH, d - thick * 2.5, waterVolumeMat(clarity));
  vol.position.y = thick + waterH / 2;
  vol.castShadow = false;
  g.add(vol);

  const water = createWaterSurface({
    width: w - thick * 2.8,
    depth: d - thick * 2.8,
    opacity: 0.7,
    wave: 0.35 + clarity * 0.2,
  });
  water.setClarity(clarity);
  water.mesh.position.y = thick + waterH + 0.015;
  g.add(water.mesh);
  g.userData.water = water;
  return g;
}

function buildBlackTower(height = 6.2, radius = 0.72) {
  const g = new THREE.Group();
  const body = cyl(radius, radius, height, blackMat(), 64);
  body.position.y = height / 2 + 0.35;
  g.add(body);
  // subtle seam rings
  for (const t of [0.25, 0.5, 0.75]) {
    const ring = cyl(radius * 1.02, radius * 1.02, 0.04, blackMat({ roughness: 0.4 }), 48);
    ring.position.y = 0.35 + height * t;
    g.add(ring);
  }
  const capTop = cyl(radius * 1.06, radius * 1.06, 0.18, whiteMat({ roughness: 0.3 }), 48);
  capTop.position.y = height + 0.35;
  g.add(capTop);
  const capBot = cyl(radius * 1.1, radius * 1.14, 0.22, whiteMat({ roughness: 0.34 }), 48);
  capBot.position.y = 0.28;
  g.add(capBot);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = cyl(0.06, 0.07, 0.4, whiteMat(), 12);
    leg.position.set(x * radius * 0.7, 0.18, z * radius * 0.7);
    g.add(leg);
  }
  return g;
}

function buildWhiteDomeTank() {
  const g = new THREE.Group();
  const body = cyl(1.0, 1.05, 2.2, whiteMat({ roughness: 0.24 }), 48);
  body.position.y = 1.5;
  g.add(body);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1.02, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2),
    whiteMat({ roughness: 0.2, clearcoat: 0.95 })
  );
  dome.position.y = 2.6;
  dome.castShadow = true;
  g.add(dome);
  // brushed metal collar
  const collar = cyl(1.06, 1.06, 0.08, metalMat(), 48);
  collar.position.y = 2.55;
  g.add(collar);
  for (const [x, z] of [[-0.65, -0.65], [0.65, -0.65], [-0.65, 0.65], [0.65, 0.65]]) {
    const leg = cyl(0.07, 0.08, 0.5, whiteMat(), 10);
    leg.position.set(x, 0.25, z);
    g.add(leg);
  }
  return g;
}

function buildFilterInternals(w, d) {
  const g = new THREE.Group();
  const sand = box(w * 0.78, 0.35, d * 0.78, new THREE.MeshPhysicalMaterial({
    color: 0xe0d4b8, roughness: 0.82, metalness: 0.0, clearcoat: 0.15,
  }));
  sand.position.y = 0.95;
  g.add(sand);
  const gravel = box(w * 0.78, 0.25, d * 0.78, new THREE.MeshPhysicalMaterial({
    color: 0xc8c4bc, roughness: 0.78, metalness: 0.05,
  }));
  gravel.position.y = 0.6;
  g.add(gravel);
  return g;
}

function buildCarbonBed(w, d) {
  const g = new THREE.Group();
  const bed = box(w * 0.72, 0.5, d * 0.72, blackMat({ roughness: 0.55 }));
  bed.position.y = 1.0;
  g.add(bed);
  const n = 60;
  const geo = new THREE.SphereGeometry(0.04, 8, 6);
  const mat = blackMat({ roughness: 0.6 });
  const inst = new THREE.InstancedMesh(geo, mat, n);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    dummy.position.set(
      (Math.random() - 0.5) * w * 0.6,
      1.25 + Math.random() * 0.2,
      (Math.random() - 0.5) * d * 0.6
    );
    dummy.scale.setScalar(0.6 + Math.random() * 0.8);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  }
  inst.instanceMatrix.needsUpdate = true;
  g.add(inst);
  return g;
}

function buildDosingUnit() {
  const g = new THREE.Group();
  const tank = cyl(0.42, 0.46, 1.7, whiteMat({ roughness: 0.22 }), 40);
  tank.position.y = 2.1;
  g.add(tank);
  const top = cyl(0.28, 0.42, 0.22, whiteMat(), 32);
  top.position.y = 3.05;
  g.add(top);
  const stand = box(0.16, 1.25, 0.16, whiteMat());
  stand.position.y = 0.62;
  g.add(stand);
  const arm = cyl(0.055, 0.055, 1.0, pipeMat(), 16);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(0.6, 1.7, 0);
  g.add(arm);
  const tip = cyl(0.04, 0.07, 0.18, metalMat(), 12);
  tip.position.set(1.05, 1.7, 0);
  tip.rotation.z = Math.PI / 2;
  g.add(tip);
  return g;
}

function buildDisinfectUnit() {
  const g = new THREE.Group();
  const body = box(2.4, 2.2, 2.0, whiteMat({ roughness: 0.3 }));
  body.position.y = 1.1;
  g.add(body);
  const roof = box(2.55, 0.1, 2.15, whiteMat({ roughness: 0.28, clearcoat: 0.6 }));
  roof.position.y = 2.25;
  g.add(roof);
  const door = box(0.65, 1.35, 0.05, metalMat(0xd0d5dc));
  door.position.set(0, 0.75, 1.05);
  g.add(door);
  const win = box(0.85, 0.45, 0.04, glassMat(0xc8e4ff, 0.35));
  win.position.set(0, 1.55, 1.04);
  g.add(win);
  return g;
}

function buildPumpUnit() {
  const g = new THREE.Group();
  const body = box(1.9, 1.6, 1.7, whiteMat({ roughness: 0.3 }));
  body.position.y = 0.8;
  g.add(body);
  const pump = cyl(0.34, 0.34, 0.75, pipeMat(0x3aa8ff), 32);
  pump.rotation.z = Math.PI / 2;
  pump.position.set(0, 0.6, 1.1);
  g.add(pump);
  const motor = cyl(0.28, 0.28, 0.42, metalMat(), 24);
  motor.rotation.z = Math.PI / 2;
  motor.position.set(0.55, 0.6, 1.1);
  g.add(motor);
  return g;
}

function buildIntake() {
  const g = new THREE.Group();
  const pier = box(1.3, 1.4, 3.4, whiteMat({ roughness: 0.32 }));
  pier.position.set(0, 0.7, 0);
  g.add(pier);
  const mouth = cyl(0.48, 0.62, 1.15, pipeMat(), 36);
  mouth.rotation.z = Math.PI / 2;
  mouth.position.set(-1.15, 0.95, 0);
  g.add(mouth);
  const grate = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.025, 8, 32),
    metalMat()
  );
  grate.rotation.y = Math.PI / 2;
  grate.position.set(-1.7, 0.95, 0);
  g.add(grate);
  const src = buildBasin(3.0, 1.3, 2.4, 0.28);
  src.position.set(-2.9, 0, 0);
  g.add(src);
  g.userData.water = src.userData.water;
  return g;
}

function buildUsers() {
  const g = new THREE.Group();
  const wall = whiteMat({ color: 0xf5f6f8, roughness: 0.36 });
  const layouts = [
    [-1.3, 0, 2.2, 4.6, 1.7],
    [1.5, 0.4, 1.9, 6.0, 1.55],
    [0.1, 2.2, 1.5, 3.6, 1.35],
  ];
  for (const [x, z, w, h, d] of layouts) {
    const b = box(w, h, d, wall);
    b.position.set(x, h / 2, z);
    g.add(b);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 2; col++) {
        const wi = box(0.26, 0.3, 0.03, glassMat(0xb8d8f0, 0.4));
        wi.position.set(x - w * 0.22 + col * 0.5, 0.85 + row * 1.05, z + d / 2 + 0.02);
        g.add(wi);
      }
    }
  }
  return g;
}

function createBubbleStream(opts = {}) {
  const count = opts.count ?? 28;
  const positions = new Float32Array(count * 3);
  const aSize = new Float32Array(count);
  const aLife = new Float32Array(count);
  const aSeed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    aLife[i] = Math.random();
    aSeed[i] = Math.random();
    aSize[i] = 4 + Math.random() * 6;
    positions[i * 3] = (Math.random() - 0.5) * 0.2;
    positions[i * 3 + 1] = Math.random() * 1.2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
  geo.setAttribute('aLife', new THREE.BufferAttribute(aLife, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0.45 },
      uColor: { value: new THREE.Color(0xffffff) },
    },
    vertexShader: /* glsl */`
      attribute float aSize; attribute float aLife;
      varying float vLife;
      void main() {
        vLife = aLife;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (110.0 / -mv.z) * (0.45 + aLife * 0.4);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uOpacity; uniform vec3 uColor; varying float vLife;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv) * 2.0;
        float ring = smoothstep(1.0, 0.6, d) * smoothstep(0.2, 0.5, d);
        float a = ring * uOpacity * smoothstep(0.0, 0.12, vLife) * smoothstep(1.0, 0.65, vLife);
        if (a < 0.02) discard;
        gl_FragColor = vec4(uColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const group = new THREE.Group();
  group.add(points);
  if (opts.position) group.position.copy(opts.position);
  const fall = opts.fall ?? 1.4;
  const originY = opts.originY ?? 2.0;

  return {
    group,
    update(dt) {
      for (let i = 0; i < count; i++) {
        aLife[i] += dt * 0.4;
        positions[i * 3 + 1] -= fall * dt;
        positions[i * 3] += Math.sin(aSeed[i] * 8 + aLife[i] * 3) * dt * 0.05;
        if (aLife[i] >= 1 || positions[i * 3 + 1] < 0.08) {
          aLife[i] = 0;
          positions[i * 3] = (Math.random() - 0.5) * 0.22;
          positions[i * 3 + 1] = originY;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 0.22;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aLife.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      if (group.parent) group.parent.remove(group);
    },
  };
}


export function buildPlant(scene, opts = {}) {
  const root = new THREE.Group();
  root.name = 'waterPlant';
  scene.add(root);

  const effects = [];
  const stageGroups = [];
  const pickables = [];
  const clarity = [0.32, 0.42, 0.55, 0.7, 0.82, 0.9, 0.96, 1.0];

  if (!opts.skipPark) {
    root.add(buildIndustrialPark());
  } else {
    // Local concrete pad so stages sit flat on Ultra-Water coastal land
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(92, 0.45, 18),
      concreteMat({ color: 0xb2b4b0, repeat: 10, roughness: 0.92 })
    );
    pad.position.y = -0.22;
    pad.receiveShadow = true;
    pad.castShadow = true;
    pad.name = 'coastalPad';
    root.add(pad);
    // thin apron lip
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(94, 0.06, 20),
      concreteMat({ color: 0xa8aaa6, repeat: 6, roughness: 0.9 })
    );
    lip.position.y = 0.06;
    lip.receiveShadow = true;
    root.add(lip);
  }

  const pipePoints = [];

  STAGES.forEach((stage, i) => {
    const pos = stagePosition(i);
    const zg = new THREE.Group();
    zg.name = stage.id;
    zg.position.set(pos.x, 0, pos.z);
    zg.userData.stageId = stage.id;
    zg.userData.stageIndex = i;
    zg.userData.stage = stage;

    const pw = i === 2 || i === 6 ? 7.8 : i === 7 ? 8.0 : i === 4 ? 6.4 : 6.4;
    const pd = i === 7 ? 6.8 : 5.4;
    const platform = makePlatform(pw, pd, 0.28);
    zg.add(platform);

    let focusY = 2.4;

    if (i === 0) {
      const unit = buildIntake();
      unit.position.y = 0.28;
      zg.add(unit);
      if (unit.userData.water) effects.push(unit.userData.water);
      focusY = 2.2;
    } else if (i === 1) {
      const dose = buildDosingUnit();
      dose.position.set(-1.6, 0.28, 0);
      zg.add(dose);
      const basin = buildBasin(4.4, 1.7, 3.4, clarity[i]);
      basin.position.set(1.1, 0.28, 0);
      zg.add(basin);
      effects.push(basin.userData.water);
      const mist = createSoftParticles({
        count: 36,
        mode: 'spray',
        color: 0xd0e8ff,
        opacity: 0.28,
        rise: 0.9,
        spread: 0.35,
        size: 8,
        lifeSpeed: 0.45,
        position: new THREE.Vector3(-0.75, 1.95, 0),
      });
      zg.add(mist.group);
      effects.push(mist);
      const bubbles = createBubbleStream({
        count: 22,
        position: new THREE.Vector3(0.4, 0.28, 0),
        originY: 2.1,
        fall: 1.2,
      });
      zg.add(bubbles.group);
      effects.push(bubbles);
      focusY = 2.5;
    } else if (i === 2) {
      const basin = buildBasin(6.4, 2.0, 4.2, clarity[i]);
      basin.position.y = 0.28;
      zg.add(basin);
      effects.push(basin.userData.water);
      const settling = createSoftParticles({
        count: 48,
        mode: 'fall',
        color: 0xd0c4a8,
        opacity: 0.22,
        rise: 0.3,
        spread: 4.2,
        size: 6,
        lifeSpeed: 0.15,
        position: new THREE.Vector3(0, 2.1, 0),
      });
      zg.add(settling.group);
      effects.push(settling);
      const bubbles = createBubbleStream({
        count: 30,
        position: new THREE.Vector3(-1.6, 0.28, 0),
        originY: 2.6,
        fall: 1.3,
      });
      zg.add(bubbles.group);
      effects.push(bubbles);
      const inflow = cyl(0.14, 0.14, 1.8, metalMat(COLORS.pipeGrey), 16);
      inflow.position.set(-1.6, 3.3, 0);
      zg.add(inflow);
      focusY = 2.7;
    } else if (i === 3) {
      const basin = buildBasin(5.0, 2.1, 3.8, clarity[i]);
      basin.position.y = 0.28;
      zg.add(basin);
      effects.push(basin.userData.water);
      const media = buildFilterInternals(4.2, 3.2);
      media.position.y = 0.28;
      zg.add(media);
      focusY = 2.5;
    } else if (i === 4) {
      const tower = buildBlackTower(6.0, 0.7);
      tower.position.set(-1.5, 0.28, 0);
      zg.add(tower);
      const basin = buildBasin(3.8, 1.9, 3.4, clarity[i]);
      basin.position.set(1.6, 0.28, 0);
      zg.add(basin);
      effects.push(basin.userData.water);
      const carbon = buildCarbonBed(3.2, 2.8);
      carbon.position.set(1.6, 0.28, 0);
      zg.add(carbon);
      const wisps = createSoftParticles({
        count: 28,
        mode: 'wisp',
        color: 0xc8d4e0,
        opacity: 0.2,
        rise: 0.28,
        spread: 1.8,
        size: 10,
        position: new THREE.Vector3(1.6, 1.8, 0),
      });
      zg.add(wisps.group);
      effects.push(wisps);
      focusY = 3.4;
    } else if (i === 5) {
      const dome = buildWhiteDomeTank();
      dome.position.set(-1.3, 0.28, 0);
      zg.add(dome);
      const house = buildDisinfectUnit();
      house.position.set(1.4, 0.28, 0);
      zg.add(house);
      const mist = createSoftParticles({
        count: 32,
        mode: 'rise',
        color: 0xe0f0ff,
        opacity: 0.22,
        rise: 0.55,
        spread: 1.4,
        size: 9,
        position: new THREE.Vector3(1.4, 1.1, 0),
      });
      zg.add(mist.group);
      effects.push(mist);
      focusY = 2.5;
    } else if (i === 6) {
      const basin = buildBasin(5.8, 2.2, 4.0, clarity[i]);
      basin.position.set(-0.9, 0.28, 0);
      zg.add(basin);
      effects.push(basin.userData.water);
      const pump = buildPumpUnit();
      pump.position.set(3.4, 0.28, 0.2);
      zg.add(pump);
      focusY = 2.6;
    } else if (i === 7) {
      const buildings = buildUsers();
      buildings.position.y = 0.28;
      zg.add(buildings);
      focusY = 3.5;
    }

    const callout = makeCallout(stage.callout || stage.short, i + 1);
    callout.position.set(0, i === 4 ? 8.0 : i === 7 ? 7.4 : 6.0, 0);
    zg.add(callout);

    zg.traverse((obj) => {
      if (obj.isMesh) {
        obj.userData.stageId = stage.id;
        obj.userData.stageIndex = i;
        pickables.push(obj);
      }
    });

    zg.userData.focusPoint = new THREE.Vector3(pos.x, focusY, pos.z);
    zg.userData.camOffset = stage.camOffset;
    zg.userData.platform = platform;

    root.add(zg);
    stageGroups.push(zg);
    pipePoints.push(new THREE.Vector3(pos.x, 1.2, 0));
  });

  const polylines = [];
  for (let i = 0; i < pipePoints.length - 1; i++) {
    const a = pipePoints[i].clone();
    const b = pipePoints[i + 1].clone();
    const zOff = (i % 2 === 0 ? -1.25 : 1.25);
    const mid1 = new THREE.Vector3(a.x + (b.x - a.x) * 0.32, a.y, a.z + zOff);
    const mid2 = new THREE.Vector3(a.x + (b.x - a.x) * 0.68, b.y, mid1.z);
    polylines.push([a, mid1, mid2, b]);
  }
  const first = pipePoints[0];
  polylines.unshift([
    new THREE.Vector3(first.x - 5.0, 0.95, 0),
    new THREE.Vector3(first.x - 2.4, 1.1, 0),
    first.clone(),
  ]);
  const last = pipePoints[pipePoints.length - 1];
  polylines.push([
    last.clone(),
    new THREE.Vector3(last.x + 1.4, 1.35, 1.3),
    new THREE.Vector3(last.x + 2.4, 1.55, 2.3),
  ]);

  const pipes = createPipeNetwork(polylines, {
    radius: 0.2,
    medium: 'water',
    flowSpeed: opts.flowSpeed ?? 1.2,
    particleCount: 14,
    flanges: true,
    tubular: 48,
    shellColor: COLORS.pipe,
  });
  root.add(pipes.root);
  effects.push(pipes);

  const spine = new THREE.CatmullRomCurve3(pipePoints, false, 'catmullrom', 0.18);
  const arrows = createMotionArrows(spine, {
    count: 5,
    speed: 0.08,
    color: 0xffffff,
    scale: 0.55,
  });
  arrows.group.position.y = 0.4;
  root.add(arrows.group);
  effects.push(arrows);

  const alert = createAlertPulse({ radius: 3.4, intensity: 0.85, level: 'info' });
  root.add(alert.group);
  effects.push(alert);

  if (opts.reflectionLayer != null) {
    root.traverse((obj) => {
      if (obj.isMesh || obj.isInstancedMesh) obj.layers.enable(opts.reflectionLayer);
    });
  }

  function setHighlight(stageIndex) {
    stageGroups.forEach((zg, i) => {
      const on = i === stageIndex;
      const platform = zg.userData.platform;
      if (platform?.userData?.edge) {
        const e = platform.userData.edge;
        e.material.opacity = on ? 0.45 : 0.0;
        e.material.color.set(COLORS.highlight);
        if (e.material.emissive) {
          e.material.emissive.set(on ? COLORS.highlight : 0x000000);
          e.material.emissiveIntensity = on ? 0.25 : 0;
        }
      }
    });
    if (stageIndex >= 0 && stageIndex < stageGroups.length) {
      alert.show(stageGroups[stageIndex].userData.focusPoint, 3.5);
    } else {
      alert.hide();
    }
  }

  return {
    root,
    stageGroups,
    pickables,
    effects,
    pipes,
    alert,
    setHighlight,
    setFlowSpeed(s) { pipes.setFlowSpeed(s); },
    update(dt, elapsed) {
      for (const fx of effects) {
        if (fx.update) fx.update(dt, elapsed);
      }
    },
    dispose() {
      for (const fx of effects) {
        if (fx.dispose) fx.dispose();
      }
      root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else {
            if (o.material.map) o.material.map.dispose();
            o.material.dispose?.();
          }
        }
      });
      if (root.parent) root.parent.remove(root);
    },
  };
}
