/**
 * water-surface.js — Premium glass-like water (fresnel + soft caustic hint)
 */
import * as THREE from 'three';

const WaterShader = {
  uniforms: {
    uTime: { value: 0 },
    uColorDeep: { value: new THREE.Color(0x0d6fbf) },
    uColorShallow: { value: new THREE.Color(0x8ad4ff) },
    uOpacity: { value: 0.72 },
    uWave: { value: 0.4 },
  },
  vertexShader: /* glsl */`
    uniform float uTime;
    uniform float uWave;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vView;
    varying float vElev;
    void main() {
      vUv = uv;
      vec3 pos = position;
      float w1 = sin(pos.x * 1.8 + uTime * 0.85) * 0.014 * uWave;
      float w2 = cos(pos.y * 1.5 + uTime * 0.7) * 0.01 * uWave;
      pos.z += w1 + w2;
      vElev = w1 + w2;
      vec4 wp = modelMatrix * vec4(pos, 1.0);
      vNormal = normalize(mat3(modelMatrix) * normal);
      vView = cameraPosition - wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: /* glsl */`
    uniform vec3 uColorDeep;
    uniform vec3 uColorShallow;
    uniform float uOpacity;
    uniform float uTime;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vView;
    varying float vElev;
    void main() {
      vec3 N = normalize(vNormal);
      vec3 V = normalize(vView);
      float ndv = max(dot(N, V), 0.0);
      float fres = pow(1.0 - ndv, 3.0);
      // soft specular lobe (product highlight)
      float spec = pow(ndv, 48.0) * 0.55;
      float spark = 0.5 + 0.5 * sin((vUv.x * 12.0 + vUv.y * 9.0) + uTime * 1.1 + vElev * 40.0);
      spark *= fres * 0.08;
      vec3 col = mix(uColorDeep, uColorShallow, fres * 0.75 + 0.12);
      col += vec3(0.92, 0.97, 1.0) * fres * 0.65;
      col += vec3(1.0) * (spec + spark);
      float a = mix(uOpacity * 0.85, 0.92, fres);
      gl_FragColor = vec4(col, a);
    }
  `,
};

export function createWaterSurface(opts = {}) {
  const w = opts.width ?? 4;
  const d = opts.depth ?? 3;
  const geo = new THREE.PlaneGeometry(w, d, 56, 40);
  const uniforms = THREE.UniformsUtils.clone(WaterShader.uniforms);
  if (opts.colorDeep) uniforms.uColorDeep.value.set(opts.colorDeep);
  if (opts.colorShallow) uniforms.uColorShallow.value.set(opts.colorShallow);
  uniforms.uOpacity.value = opts.opacity ?? 0.72;
  uniforms.uWave.value = opts.wave ?? 0.4;

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: WaterShader.vertexShader,
    fragmentShader: WaterShader.fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;

  return {
    mesh,
    update(dt, elapsed) {
      uniforms.uTime.value = elapsed ?? dt;
    },
    setClarity(t) {
      uniforms.uColorDeep.value.setRGB(0.05 + t * 0.04, 0.38 + t * 0.12, 0.72 + t * 0.08);
      uniforms.uColorShallow.value.setRGB(0.45 + t * 0.2, 0.78 + t * 0.12, 0.98);
      uniforms.uOpacity.value = 0.78 - t * 0.1;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
