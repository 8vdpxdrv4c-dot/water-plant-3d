/**
 * pipe-flow.js — Bright blue product-viz pipes + subtle inner flow
 */
import * as THREE from 'three';

const MEDIUM = {
  water: { color: new THREE.Color(0x4db8ff), emissive: new THREE.Color(0x1a70c0), opacity: 0.55, energy: 0.35 },
  liquid: { color: new THREE.Color(0x2b9fff), emissive: new THREE.Color(0x1560a8), opacity: 0.5, energy: 0.3 },
};

const FlowShader = {
  uniforms: {
    uTime: { value: 0 },
    uSpeed: { value: 1.5 },
    uColor: { value: new THREE.Color(0x4db8ff) },
    uEmissive: { value: new THREE.Color(0x1a70c0) },
    uOpacity: { value: 0.55 },
    uEnergy: { value: 0.35 },
    uValve: { value: 1.0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      vUv = uv;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vNormal = normalize(mat3(modelMatrix) * normal);
      vView = cameraPosition - wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: /* glsl */`
    uniform float uTime;
    uniform float uSpeed;
    uniform vec3 uColor;
    uniform vec3 uEmissive;
    uniform float uOpacity;
    uniform float uEnergy;
    uniform float uValve;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vView;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
      f = f*f*(3.0-2.0*f);
      return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x),
                 mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0; float a = 0.5;
      for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.11; a *= 0.5; }
      return v;
    }
    void main() {
      float spd = uSpeed * max(0.04, uValve);
      vec2 uv = vUv * vec2(6.0, 2.0);
      uv.x -= uTime * spd * 1.2;
      float bands = smoothstep(0.4, 0.8, fbm(uv));
      vec3 N = normalize(vNormal);
      vec3 V = normalize(vView);
      float fres = pow(1.0 - max(dot(N, V), 0.0), 2.5);
      vec3 col = uColor * (0.55 + bands * 0.55);
      col += uEmissive * uEnergy * 0.35;
      col += vec3(0.75, 0.9, 1.0) * fres * 0.4;
      float alpha = uOpacity * (0.5 + bands * 0.5) * mix(0.3, 1.0, uValve);
      gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.85));
    }
  `,
};

function makeShell(curve, radial, tubular, shellColor) {
  const geo = new THREE.TubeGeometry(curve, tubular, radial, 20, false);
  const mat = new THREE.MeshPhysicalMaterial({
    color: shellColor,
    metalness: 0.06,
    roughness: 0.36,
    clearcoat: 0.55,
    clearcoatRoughness: 0.32,
    envMapIntensity: 1.05,
    side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function makeFlow(curve, radial, flowSpeed, tubular) {
  const geo = new THREE.TubeGeometry(curve, tubular, radial * 0.55, 12, false);
  const med = MEDIUM.water;
  const uniforms = THREE.UniformsUtils.clone(FlowShader.uniforms);
  uniforms.uColor.value = med.color.clone();
  uniforms.uEmissive.value = med.emissive.clone();
  uniforms.uOpacity.value = med.opacity;
  uniforms.uEnergy.value = med.energy;
  uniforms.uSpeed.value = flowSpeed;
  return new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: FlowShader.vertexShader,
      fragmentShader: FlowShader.fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
}

export function createPipeSegment(curve, opts = {}) {
  const radius = opts.radius ?? 0.22;
  const flowSpeed = opts.flowSpeed ?? 1.4;
  const tubular = opts.tubular ?? 64;
  const shellColor = opts.shellColor ?? 0x2a8fd4;
  const group = new THREE.Group();
  group.name = 'pipeSegment';

  const shell = makeShell(curve, radius, tubular, shellColor);
  const flow = makeFlow(curve, radius, flowSpeed, tubular);
  group.add(shell, flow);

  if (opts.flanges !== false) {
    for (const t of [0.02, 0.98]) {
      const p = curve.getPointAt(t);
      const flange = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 1.35, radius * 1.35, 0.12, 16),
        new THREE.MeshPhysicalMaterial({ color: 0x1a86e0, metalness: 0.1, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.2 })
      );
      flange.position.copy(p);
      const tan = curve.getTangentAt(t);
      flange.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan.clone().normalize());
      group.add(flange);
    }
  }

  const n = opts.particleCount ?? 16;
  const progresses = new Float32Array(n);
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    progresses[i] = Math.random();
    pos[i * 3 + 1] = -50;
  }
  const pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const particles = new THREE.Points(
    pgeo,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.07,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      sizeAttenuation: true,
    })
  );
  group.add(particles);

  const api = {
    group,
    flow,
    shell,
    curve,
    setFlowSpeed(s) {
      if (flow.material.uniforms) flow.material.uniforms.uSpeed.value = s;
      api._speed = s;
    },
    _speed: flowSpeed,
    update(dt, elapsed) {
      if (flow.material.uniforms) flow.material.uniforms.uTime.value = elapsed;
      const spd = api._speed * 0.1;
      const arr = particles.geometry.attributes.position.array;
      if (!curve.points || curve.points.length < 2) return;
      const tmp = api._tmp || (api._tmp = new THREE.Vector3());
      for (let i = 0; i < n; i++) {
        progresses[i] = (progresses[i] + dt * spd) % 1;
        try {
          curve.getPointAt(Math.min(0.999999, Math.max(0, progresses[i])), tmp);
        } catch (_) {
          continue;
        }
        arr[i * 3] = tmp.x;
        arr[i * 3 + 1] = tmp.y;
        arr[i * 3 + 2] = tmp.z;
      }
      particles.geometry.attributes.position.needsUpdate = true;
    },
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
        }
      });
    },
  };
  return api;
}

export function createPipeNetwork(polylines, opts = {}) {
  const root = new THREE.Group();
  root.name = 'pipeNetwork';
  const segments = [];
  for (const pts of polylines) {
    if (!pts || pts.length < 2) continue;
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => p.clone()), false, 'catmullrom', 0.15);
    curve.updateArcLengths();
    const seg = createPipeSegment(curve, opts);
    root.add(seg.group);
    segments.push(seg);
  }
  return {
    root,
    segments,
    setFlowSpeed(s) { segments.forEach((seg) => seg.setFlowSpeed(s)); },
    update(dt, elapsed) { segments.forEach((seg) => seg.update(dt, elapsed)); },
    dispose() {
      segments.forEach((seg) => seg.dispose());
      if (root.parent) root.parent.remove(root);
    },
  };
}

export { MEDIUM, FlowShader };
