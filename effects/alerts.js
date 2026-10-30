/**
 * alerts.js — Placeable highlight pulse (from demos/effects/alerts.js)
 */
import * as THREE from 'three';

const LEVEL_COLOR = { info: 0x2b9fff, warn: 0xff9944, critical: 0xff4455, select: 0x2b9fff };

const RingShader = {
  uniforms: {
    uColor: { value: new THREE.Color(0x44e0ff) },
    uOpacity: { value: 0.7 },
    uPulse: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform vec3 uColor;
    uniform float uOpacity;
    uniform float uPulse;
    varying vec2 vUv;
    void main() {
      vec2 c = vUv - 0.5;
      float d = length(c) * 2.0;
      float ring = smoothstep(0.82, 0.92, d) * (1.0 - smoothstep(0.95, 1.0, d));
      float glow = exp(-pow((d - 0.9) * 8.0, 2.0)) * 0.6;
      float a = (ring + glow) * uOpacity * (0.55 + uPulse * 0.45);
      if (a < 0.01) discard;
      gl_FragColor = vec4(uColor * (1.2 + glow * 2.0), a);
    }
  `,
};

function makeRing() {
  const uniforms = THREE.UniformsUtils.clone(RingShader.uniforms);
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: RingShader.vertexShader,
    fragmentShader: RingShader.fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.05;
  return m;
}

/**
 * @param {{ radius?: number, level?: string, intensity?: number, label?: string }} opts
 */
export function createAlertPulse(opts = {}) {
  const group = new THREE.Group();
  group.name = 'alertPulse';
  group.visible = false;

  const level = opts.level ?? 'select';
  const col = LEVEL_COLOR[level] || LEVEL_COLOR.select;
  const radius = opts.radius ?? 3.2;
  const intensity = opts.intensity ?? 1.8;

  const ring = makeRing();
  const ring2 = makeRing();
  const ring3 = makeRing();
  group.add(ring, ring2, ring3);

  const light = new THREE.PointLight(col, intensity, radius * 4);
  light.position.y = 2.2;
  group.add(light);

  const zone = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshBasicMaterial({
      color: col,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    })
  );
  zone.rotation.x = -Math.PI / 2;
  zone.position.y = 0.03;
  group.add(zone);

  let active = false;
  let pulseRate = 1.4;

  return {
    group,
    show(pos, r = radius) {
      if (pos) group.position.copy(pos);
      group.visible = true;
      active = true;
      zone.scale.setScalar(r);
    },
    hide() {
      group.visible = false;
      active = false;
      light.intensity = 0;
    },
    update(dt, elapsed) {
      if (!active) return;
      const t = elapsed ?? dt;
      const pulse = 0.5 + 0.5 * Math.sin(t * pulseRate * Math.PI * 2);
      light.intensity = intensity * (0.35 + pulse * 1.0);
      const waves = [
        { mesh: ring, phase: 0 },
        { mesh: ring2, phase: 0.33 },
        { mesh: ring3, phase: 0.66 },
      ];
      for (const w of waves) {
        const ph = (pulse + w.phase) % 1;
        const s = radius * (0.3 + ph * 0.95);
        w.mesh.scale.setScalar(s);
        w.mesh.material.uniforms.uColor.value.setHex(col);
        w.mesh.material.uniforms.uOpacity.value = 0.8 * (1 - ph);
        w.mesh.material.uniforms.uPulse.value = pulse;
      }
      zone.material.opacity = 0.05 + pulse * 0.07;
    },
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (o.material.uniforms) o.material.dispose();
          else o.material.dispose();
        }
      });
      if (group.parent) group.parent.remove(group);
    },
  };
}
