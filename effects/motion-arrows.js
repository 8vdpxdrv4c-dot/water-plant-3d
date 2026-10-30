/**
 * motion-arrows.js — Path-following arrows (from demos/effects/motion-arrows.js)
 */
import * as THREE from 'three';

/**
 * @param {THREE.Curve} curve
 * @param {{ count?: number, speed?: number, color?: number|string, scale?: number }} opts
 */
export function createMotionArrows(curve, opts = {}) {
  const group = new THREE.Group();
  group.name = 'motionArrows';
  const count = opts.count ?? 6;
  const speed = opts.speed ?? 0.22;
  const scale = opts.scale ?? 0.85;
  const col = new THREE.Color(opts.color ?? 0x5bff9a);
  const arrows = [];
  const progresses = [];

  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.4, 8),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.45 })
    );
    body.rotation.x = Math.PI / 2;
    body.position.z = -0.08;
    const head = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.24, 10),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.75 })
    );
    head.rotation.x = Math.PI / 2;
    head.position.z = 0.2;
    g.add(body, head);
    g.scale.setScalar(scale);
    group.add(g);
    arrows.push(g);
    progresses.push(i / count);
  }

  const _q = new THREE.Quaternion();
  const _up = new THREE.Vector3(0, 1, 0);
  const _look = new THREE.Vector3();

  return {
    group,
    update(dt, _elapsed) {
      if (!curve.points || curve.points.length < 2) return;
      const tmpP = new THREE.Vector3();
      const tmpT = new THREE.Vector3();
      for (let i = 0; i < count; i++) {
        progresses[i] = (progresses[i] + dt * speed) % 1;
        const t = Math.min(0.999999, Math.max(0, progresses[i]));
        try {
          curve.getPointAt(t, tmpP);
          curve.getTangentAt(t, tmpT).normalize();
        } catch (_) {
          continue;
        }
        arrows[i].position.copy(tmpP);
        _look.copy(tmpP).add(tmpT);
        arrows[i].lookAt(_look);
      }
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
