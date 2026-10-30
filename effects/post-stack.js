/**
 * post-stack.js — Filmic post: Bloom + optional DOF + ACES tonemap + grain
 * Adapted from demos/effects/post-dof-bloom.js (no demo subjects).
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { disposeComposer } from '../lib/dispose.js';

const QUALITY = {
  low: { pr: 0.6, bloomMul: 0.55, blurMul: 0.5, bloomRes: 0.5, dof: false },
  mid: { pr: 1.0, bloomMul: 0.45, blurMul: 0.3, bloomRes: 0.75, dof: false },
  high: {
    pr: Math.min(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1, 1.75),
    bloomMul: 0.4,
    blurMul: 0.45,
    bloomRes: 0.9,
    dof: true,
  },
  cinematic: {
    pr: Math.min(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1, 2),
    bloomMul: 0.75,
    blurMul: 0.5,
    bloomRes: 1.15,
    dof: false,
  },
};

const TonemapShader = {
  uniforms: { tDiffuse: { value: null }, uExposure: { value: 1.0 } },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uExposure;
    varying vec2 vUv;
    vec3 ACESFilm(vec3 x) {
      float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }
    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 c = ACESFilm(tex.rgb * uExposure);
      float r = length(vUv - 0.5);
      c *= 1.0 - smoothstep(0.75, 1.35, r) * 0.06;
      gl_FragColor = vec4(c, tex.a);
    }
  `,
};

const GrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    uAmount: { value: 0.05 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uAmount;
    uniform float uTime;
    varying vec2 vUv;
    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233)) + uTime * 17.0) * 43758.5453);
    }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float n = rand(vUv) * 2.0 - 1.0;
      float luma = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb += n * uAmount * (1.0 - luma * 0.5);
      gl_FragColor = c;
    }
  `,
};

export const guiSchema = [
  { key: 'quality', label: '画质 Quality', options: { 低: 'low', 中: 'mid', 高: 'high', 电影: 'cinematic' }, default: 'high' },
  { key: 'bloomStrength', label: '辉光 Bloom', min: 0, max: 2.5, step: 0.05, default: 0.12 },
  { key: 'bloomRadius', label: '辉光半径', min: 0, max: 1.2, step: 0.05, default: 0.4 },
  { key: 'grain', label: '颗粒 Grain', min: 0, max: 0.2, step: 0.005, default: 0.008 },
  { key: 'exposure', label: '曝光 Exposure', min: 0.4, max: 2.2, step: 0.05, default: 1.02 },
  { key: 'focusDistance', label: '焦距 Focus', min: 2, max: 60, step: 0.5, default: 28 },
  { key: 'aperture', label: '光圈 Aperture', min: 0.00005, max: 0.008, step: 0.00005, default: 0.0008 },
  { key: 'maxBlur', label: '最大模糊', min: 0.001, max: 0.015, step: 0.0005, default: 0.0015 },
];

/**
 * @param {{ renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera }} ctx
 * @param {Record<string, any>} params
 */
export function createPostStack(ctx, params) {
  let composer = null;
  let bloomPass = null;
  let bokehPass = null;
  let tonemapPass = null;
  let grainPass = null;
  let lastQuality = null;
  const prevTonemap = ctx.renderer.toneMapping;

  function qualityCfg(q) {
    return QUALITY[q] || QUALITY.mid;
  }

  function rebuild() {
    if (composer) {
      disposeComposer(composer);
      composer = null;
    }
    const q = qualityCfg(params.quality);
    lastQuality = params.quality;
    const canvas = ctx.renderer.domElement;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;

    ctx.renderer.setPixelRatio(q.pr);
    ctx.renderer.setSize(w, h, false);
    ctx.renderer.toneMapping = THREE.NoToneMapping;

    composer = new EffectComposer(ctx.renderer);
    composer.addPass(new RenderPass(ctx.scene, ctx.camera));

    if (q.dof) {
      bokehPass = new BokehPass(ctx.scene, ctx.camera, {
        focus: params.focusDistance,
        aperture: params.aperture,
        maxblur: params.maxBlur * q.blurMul,
      });
      composer.addPass(bokehPass);
    } else {
      bokehPass = null;
    }

    const bw = Math.max(1, Math.floor(w * q.bloomRes));
    const bh = Math.max(1, Math.floor(h * q.bloomRes));
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(bw, bh),
      params.bloomStrength * q.bloomMul,
      params.bloomRadius,
      0.78
    );
    composer.addPass(bloomPass);

    tonemapPass = new ShaderPass(TonemapShader);
    tonemapPass.uniforms.uExposure.value = params.exposure;
    composer.addPass(tonemapPass);

    grainPass = new ShaderPass(GrainShader);
    grainPass.uniforms.uAmount.value = params.grain;
    composer.addPass(grainPass);

    composer.setSize(w, h);
  }

  rebuild();

  return {
    get composer() { return composer; },
    rebuild,
    resize() { rebuild(); },
    update(elapsed) {
      if (params.quality !== lastQuality) rebuild();
      const q = qualityCfg(params.quality);
      if (bokehPass) {
        const u = bokehPass.uniforms || bokehPass.material?.uniforms;
        if (u?.focus) u.focus.value = params.focusDistance;
        if (u?.aperture) u.aperture.value = params.aperture;
        if (u?.maxblur) u.maxblur.value = params.maxBlur * q.blurMul;
      }
      if (bloomPass) {
        bloomPass.strength = params.bloomStrength * q.bloomMul;
        bloomPass.radius = params.bloomRadius;
      }
      if (tonemapPass) tonemapPass.uniforms.uExposure.value = params.exposure;
      if (grainPass) {
        grainPass.uniforms.uAmount.value = params.grain;
        grainPass.uniforms.uTime.value = elapsed;
      }
    },
    render() {
      if (composer) composer.render();
      else ctx.renderer.render(ctx.scene, ctx.camera);
    },
    dispose() {
      if (composer) disposeComposer(composer);
      composer = bloomPass = bokehPass = tonemapPass = grainPass = null;
      ctx.renderer.toneMapping = prevTonemap;
    },
  };
}
