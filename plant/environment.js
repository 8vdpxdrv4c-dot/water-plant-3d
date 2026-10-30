/**
 * environment.js — Suburban industrial-park yard (concrete apron)
 */
import * as THREE from 'three';
import {
  COLORS, concreteMat, asphaltMat, grassMat, metalMat, whiteMat,
} from './materials.js';

function box(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(rt, rb, h, mat, segs = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segs), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Procedural sky dome — soft overcast / late-afternoon haze */
function buildSky() {
  const geo = new THREE.SphereGeometry(180, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uZenith: { value: new THREE.Color(0x9eb4c8) },
      uHorizon: { value: new THREE.Color(0xd4dce4) },
      uGround: { value: new THREE.Color(0xb8c0c8) },
    },
    vertexShader: /* glsl */`
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGround;
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.75, h));
        col = mix(uGround, col, smoothstep(-0.15, 0.05, h));
        // soft sun glow (late afternoon, low)
        vec3 sunDir = normalize(vec3(0.55, 0.28, 0.35));
        float sun = pow(max(dot(normalize(vPos), sunDir), 0.0), 32.0);
        col += vec3(1.0, 0.92, 0.78) * sun * 0.35;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'sky';
  mesh.frustumCulled = false;
  return mesh;
}

function buildConcreteApron() {
  const g = new THREE.Group();
  g.name = 'concreteApron';

  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 80),
    concreteMat({ repeat: 14, roughness: 0.93 })
  );
  apron.rotation.x = -Math.PI / 2;
  apron.receiveShadow = true;
  g.add(apron);

  // expansion joints / slab seams
  const jointMat = new THREE.MeshStandardMaterial({
    color: 0x7a7c78,
    roughness: 0.95,
    metalness: 0.0,
  });
  for (let x = -50; x <= 50; x += 10) {
    const j = box(0.08, 0.02, 72, jointMat);
    j.position.set(x, 0.012, 0);
    j.receiveShadow = true;
    g.add(j);
  }
  for (let z = -35; z <= 35; z += 10) {
    const j = box(110, 0.02, 0.08, jointMat);
    j.position.set(0, 0.012, z);
    j.receiveShadow = true;
    g.add(j);
  }

  // darker stained patches
  const stainMat = new THREE.MeshStandardMaterial({
    color: 0x8a8680,
    roughness: 0.98,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  for (const [x, z, w, d] of [[-12, 4, 8, 5], [18, -6, 6, 4], [5, 10, 7, 3], [-25, -8, 5, 6]]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, d), stainMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set(x, 0.018, z);
    g.add(s);
  }

  return g;
}

function buildServiceRoad() {
  const g = new THREE.Group();
  g.name = 'serviceRoad';
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(110, 7.5),
    asphaltMat()
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.025, 14);
  road.receiveShadow = true;
  g.add(road);

  // curb
  const curbMat = concreteMat({ color: 0xa8aaa6, repeat: 2, roughness: 0.9 });
  const curb = box(110, 0.18, 0.35, curbMat);
  curb.position.set(0, 0.09, 10.1);
  g.add(curb);

  // dashed center line
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xc8c4a8 });
  for (let x = -48; x < 48; x += 6) {
    const dash = box(2.2, 0.01, 0.12, lineMat);
    dash.position.set(x, 0.04, 14);
    g.add(dash);
  }
  return g;
}

function buildWarehouse(x, z, w, d, h, rotY = 0) {
  const g = new THREE.Group();
  const wall = new THREE.MeshPhysicalMaterial({
    color: COLORS.warehouse,
    metalness: 0.08,
    roughness: 0.78,
    envMapIntensity: 0.4,
  });
  const roofMat = new THREE.MeshPhysicalMaterial({
    color: COLORS.warehouseRoof,
    metalness: 0.55,
    roughness: 0.45,
  });
  const body = box(w, h, d, wall);
  body.position.y = h / 2;
  g.add(body);
  // slight roof pitch as flat slab overhang
  const roof = box(w + 0.6, 0.2, d + 0.6, roofMat);
  roof.position.y = h + 0.05;
  g.add(roof);
  // loading bay shadow
  const door = box(w * 0.25, h * 0.55, 0.08, new THREE.MeshStandardMaterial({
    color: 0x4a5058,
    roughness: 0.7,
  }));
  door.position.set(0, h * 0.35, d / 2 + 0.04);
  g.add(door);

  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  return g;
}

function buildFence(length, segments = 20) {
  const g = new THREE.Group();
  const postMat = metalMat(0x6a7078, { roughness: 0.55 });
  const wireMat = new THREE.MeshBasicMaterial({
    color: COLORS.fence,
    transparent: true,
    opacity: 0.35,
    wireframe: false,
  });
  // simple chain-link as thin crossed planes
  const meshMat = new THREE.MeshStandardMaterial({
    color: 0x808890,
    metalness: 0.6,
    roughness: 0.5,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
  });
  const step = length / segments;
  for (let i = 0; i <= segments; i++) {
    const post = cyl(0.05, 0.05, 2.2, postMat, 6);
    post.position.set(i * step - length / 2, 1.1, 0);
    g.add(post);
  }
  const panel = box(length, 1.8, 0.04, meshMat);
  panel.position.y = 1.1;
  panel.castShadow = false;
  g.add(panel);
  // top rail
  const rail = box(length, 0.06, 0.06, postMat);
  rail.position.y = 2.15;
  g.add(rail);
  return g;
}

function buildTree(x, z, scale = 1) {
  const g = new THREE.Group();
  const trunk = cyl(0.12 * scale, 0.16 * scale, 1.4 * scale, new THREE.MeshStandardMaterial({
    color: 0x5a4030,
    roughness: 0.9,
  }), 8);
  trunk.position.y = 0.7 * scale;
  g.add(trunk);
  const foliage = new THREE.Mesh(
    new THREE.SphereGeometry(1.1 * scale, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x4a6a40, roughness: 0.88 })
  );
  foliage.position.y = 2.0 * scale;
  foliage.castShadow = true;
  g.add(foliage);
  const foliage2 = new THREE.Mesh(
    new THREE.SphereGeometry(0.75 * scale, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x5a7a48, roughness: 0.9 })
  );
  foliage2.position.set(0.4 * scale, 2.3 * scale, -0.2 * scale);
  g.add(foliage2);
  g.position.set(x, 0, z);
  return g;
}

function buildGrassStrip(x, z, w, d) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), grassMat());
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.03, z);
  m.receiveShadow = true;
  return m;
}

/**
 * Full industrial-park context around the plant line
 */
export function buildIndustrialPark() {
  const root = new THREE.Group();
  root.name = 'industrialPark';

  root.add(buildSky());
  root.add(buildConcreteApron());
  root.add(buildServiceRoad());

  // Distant warehouses / sheds
  root.add(buildWarehouse(-38, -28, 18, 10, 6.5, 0.08));
  root.add(buildWarehouse(-18, -32, 14, 8, 5.5, -0.05));
  root.add(buildWarehouse(22, -30, 16, 9, 6, 0.12));
  root.add(buildWarehouse(42, -26, 12, 8, 5, -0.1));
  root.add(buildWarehouse(48, 8, 10, 14, 5.5, Math.PI * 0.5));
  // small utility shed near plant
  root.add(buildWarehouse(-32, 8, 6, 5, 3.2, 0.2));

  // Chain-link fence perimeter hints
  const fenceN = buildFence(90, 24);
  fenceN.position.set(0, 0, -22);
  root.add(fenceN);
  const fenceS = buildFence(70, 18);
  fenceS.position.set(-10, 0, 22);
  root.add(fenceS);
  const fenceW = buildFence(40, 12);
  fenceW.rotation.y = Math.PI / 2;
  fenceW.position.set(-48, 0, -5);
  root.add(fenceW);

  // Sparse landscaping
  root.add(buildGrassStrip(-42, 16, 12, 4));
  root.add(buildGrassStrip(35, 18, 10, 3.5));
  root.add(buildGrassStrip(-30, -18, 8, 3));
  for (const [x, z, s] of [
    [-44, 18, 1.1], [-40, 20, 0.85], [38, 20, 1.0], [42, 17, 0.75],
    [-46, -18, 1.2], [45, -20, 0.9], [-50, 2, 1.0],
  ]) {
    root.add(buildTree(x, z, s));
  }

  // Distant low hills / berm
  const bermMat = new THREE.MeshStandardMaterial({ color: 0x6a7a58, roughness: 0.95 });
  for (const [x, z, sx, sy] of [[-55, -40, 12, 3], [0, -48, 20, 2.5], [50, -42, 14, 3.2]]) {
    const berm = cyl(sx, sx * 1.2, sy, bermMat, 10);
    berm.position.set(x, sy * 0.35, z);
    berm.castShadow = false;
    root.add(berm);
  }

  // Light poles along road
  const poleMat = metalMat(0x6a7078);
  for (const x of [-30, -10, 10, 30]) {
    const pole = cyl(0.08, 0.1, 6, poleMat, 8);
    pole.position.set(x, 3, 17.5);
    root.add(pole);
    const arm = box(1.8, 0.08, 0.08, poleMat);
    arm.position.set(x - 0.6, 5.8, 17.5);
    root.add(arm);
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.12, 0.25),
      new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.4, emissive: 0xf0f0e0, emissiveIntensity: 0.15 })
    );
    lamp.position.set(x - 1.4, 5.7, 17.5);
    root.add(lamp);
  }

  return root;
}
