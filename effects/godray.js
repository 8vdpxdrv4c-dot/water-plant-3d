/**
 * godray.js — Placeable volumetric shafts (from demos/effects/lighting-godray.js)
 */
import * as THREE from 'three';

const ShaftShader = {
  uniforms: {
    uColor: { value: new THREE.Color(0xffd9a0) },
    uIntensity: { value: 1.0 },
    uTime: { value: 0 },
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
    uniform vec3 uColor;
    uniform float uIntensity;
    uniform float uTime;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vView;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
      f = f*f*(3.0-2.0*f);
      return mix(mix(hash(i), hash(i+vec2(1.,0.)), f.x),
                 mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.,1.)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0; float a = 0.5;
      for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
      return v;
    }
    void main() {
      float axial = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
      float radial = pow(clamp(1.0 - abs(vUv.x - 0.5) * 2.0, 0.0, 1.0), 1.4);
      float n = fbm(vec2(vUv.x * 4.0, vUv.y * 6.0 - uTime * 0.15));
      float dens = axial * radial * (0.55 + n * 0.55);
      vec3 N = normalize(vNormal);
      vec3 V = normalize(vView);
      float rim = pow(1.0 - abs(dot(N, V)), 1.5);
      float alpha = dens * uIntensity * 0.22 * (0.7 + rim * 0.5);
      if (alpha < 0.005) discard;
      vec3 col = uColor * (0.8 + dens * 0.6) * uIntensity;
      gl_FragColor = vec4(col, alpha);
    }
  `,
};

/**
 * @param {{ position?: THREE.Vector3, count?: number, color?: number|string, intensity?: number, height?: number, angle?: number }} opts
 */
export function createGodrays(opts = {}) {
  const group = new THREE.Group();
  group.name = 'godrays';
  const count = opts.count ?? 4;
  const color = new THREE.Color(opts.color ?? 0xa8d8ff);
  const intensity = opts.intensity ?? 1.1;
  const height = opts.height ?? 10;
  const angle = opts.angle ?? -0.28;
  const meshes = [];

  for (let i = 0; i < count; i++) {
    const geo = new THREE.CylinderGeometry(0.12, 1.4, height, 18, 1, true);
    const uniforms = THREE.UniformsUtils.clone(ShaftShader.uniforms);
    uniforms.uColor.value = color.clone();
    uniforms.uIntensity.value = intensity;
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: ShaftShader.vertexShader,
      fragmentShader: ShaftShader.fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set((i - (count - 1) / 2) * 1.1, height * 0.45, 0);
    m.rotation.z = angle;
    m.rotation.x = 0.15;
    group.add(m);
    meshes.push(m);
  }

  if (opts.position) group.position.copy(opts.position);

  return {
    group,
    update(dt, elapsed) {
      const t = elapsed ?? dt;
      meshes.forEach((m, i) => {
        const u = m.material.uniforms;
        u.uTime.value = t;
        u.uIntensity.value = intensity * (0.85 + 0.15 * Math.sin(t * 1.6 + i));
      });
    },
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      if (group.parent) group.parent.remove(group);
    },
  };
}
