/**
 * soft-particles.js — Soft FBM particles for spray / mist / adsorption wisps
 * Technique adapted from demos/effects/particles-smoke.js
 */
import * as THREE from 'three';

const SoftShader = {
  uniforms: {
    uTime: { value: 0 },
    uOpacity: { value: 0.5 },
    uColor: { value: new THREE.Color(0xb0d0e8) },
    uSoftness: { value: 1.1 },
  },
  vertexShader: /* glsl */`
    attribute float aSize;
    attribute float aLife;
    attribute float aSeed;
    varying float vLife;
    varying float vSeed;
    uniform float uTime;
    uniform float uSoftness;
    float hash(float n) { return fract(sin(n) * 43758.5453); }
    void main() {
      vLife = aLife;
      vSeed = aSeed;
      vec3 pos = position;
      float t = uTime * 0.4 + aSeed * 6.28;
      pos.x += sin(t + aSeed) * 0.15 * aLife;
      pos.z += cos(t * 0.8) * 0.12 * aLife;
      vec4 mv = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = aSize * uSoftness * (180.0 / -mv.z) * (0.4 + aLife);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: /* glsl */`
    uniform float uOpacity;
    uniform vec3 uColor;
    varying float vLife;
    varying float vSeed;
    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float d = length(uv) * 2.0;
      float soft = smoothstep(1.0, 0.15, d);
      float a = soft * uOpacity * smoothstep(0.0, 0.15, vLife) * smoothstep(1.0, 0.55, vLife);
      if (a < 0.01) discard;
      vec3 col = uColor * (0.7 + 0.3 * fract(vSeed * 13.7));
      gl_FragColor = vec4(col, a);
    }
  `,
};

/**
 * Rising / drifting soft particle emitter.
 * @param {{ count?: number, color?: number|string, opacity?: number, rise?: number, spread?: number, size?: number, mode?: 'rise'|'fall'|'spray'|'wisp' }} opts
 */
export function createSoftParticles(opts = {}) {
  const count = opts.count ?? 48;
  const mode = opts.mode ?? 'rise';
  const rise = opts.rise ?? 1.2;
  const spread = opts.spread ?? 1.4;
  const baseSize = opts.size ?? 18;

  const positions = new Float32Array(count * 3);
  const aSize = new Float32Array(count);
  const aLife = new Float32Array(count);
  const aSeed = new Float32Array(count);
  const vel = new Float32Array(count * 3);

  function respawn(i, initial = false) {
    const life = initial ? Math.random() : 0;
    aLife[i] = life;
    aSeed[i] = Math.random();
    aSize[i] = baseSize * (0.5 + Math.random());
    positions[i * 3] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
    if (mode === 'fall') {
      positions[i * 3 + 1] = 0.5 + Math.random() * 1.5;
      vel[i * 3] = (Math.random() - 0.5) * 0.15;
      vel[i * 3 + 1] = -rise * (0.4 + Math.random() * 0.6);
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.15;
    } else if (mode === 'spray') {
      positions[i * 3 + 1] = 0.1 + Math.random() * 0.2;
      const a = Math.random() * Math.PI * 2;
      const sp = 0.4 + Math.random() * 0.8;
      vel[i * 3] = Math.cos(a) * sp;
      vel[i * 3 + 1] = rise * (0.6 + Math.random());
      vel[i * 3 + 2] = Math.sin(a) * sp;
    } else if (mode === 'wisp') {
      positions[i * 3 + 1] = Math.random() * 0.8;
      vel[i * 3] = (Math.random() - 0.5) * 0.25;
      vel[i * 3 + 1] = rise * (0.15 + Math.random() * 0.25);
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.25;
    } else {
      positions[i * 3 + 1] = Math.random() * 0.3;
      vel[i * 3] = (Math.random() - 0.5) * 0.2;
      vel[i * 3 + 1] = rise * (0.3 + Math.random() * 0.5);
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
    }
  }

  for (let i = 0; i < count; i++) respawn(i, true);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
  geo.setAttribute('aLife', new THREE.BufferAttribute(aLife, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));

  const uniforms = THREE.UniformsUtils.clone(SoftShader.uniforms);
  uniforms.uColor.value = new THREE.Color(opts.color ?? 0xb0d0e8);
  uniforms.uOpacity.value = opts.opacity ?? 0.28;

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: SoftShader.vertexShader,
    fragmentShader: SoftShader.fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const group = new THREE.Group();
  group.name = 'softParticles';
  group.add(points);
  if (opts.position) group.position.copy(opts.position);

  const lifeSpeed = opts.lifeSpeed ?? 0.35;

  return {
    group,
    update(dt, elapsed) {
      uniforms.uTime.value = elapsed;
      for (let i = 0; i < count; i++) {
        aLife[i] += dt * lifeSpeed;
        if (aLife[i] >= 1) {
          respawn(i);
          continue;
        }
        positions[i * 3] += vel[i * 3] * dt;
        positions[i * 3 + 1] += vel[i * 3 + 1] * dt;
        positions[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (mode === 'spray') {
          vel[i * 3 + 1] -= 1.6 * dt;
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
