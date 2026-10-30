import * as THREE from 'three';

export type FollowCamera = {
  camera: THREE.PerspectiveCamera;
  update: (dt: number, target: THREE.Vector3, facingY: number, opts?: { pullBack?: number; lookAhead?: number }) => void;
  setPullBack: (amount: number, durationS?: number) => void;
  resize: (w: number, h: number) => void;
};

export function createFollowCamera(opts: {
  fov?: number;
  distance?: number;
  height?: number;
  lookAtHeight?: number;
  yAt?: (x: number, z: number) => number;
} = {}): FollowCamera {
  const camera = new THREE.PerspectiveCamera(opts.fov ?? 55, 1, 0.1, 900);
  const distance = opts.distance ?? 7.5;
  const height = opts.height ?? 4.2;
  const lookHeight = opts.lookAtHeight ?? 0.6;
  const desired = new THREE.Vector3();
  const look = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const velocity = new THREE.Vector3();
  let initialized = false;
  let pull = 0;
  let pullStart = 0;
  let pullGoal = 0;
  let pullTime = 0;
  let pullDuration = 1.8;

  // Exact critically damped spring integration, stable across frame rates.
  function spring(dt: number) {
    const omega = 7;
    const decay = Math.exp(-omega * dt);
    for (const axis of ['x', 'y', 'z'] as const) {
      const offset = camera.position[axis] - desired[axis];
      const impulse = velocity[axis] + omega * offset;
      camera.position[axis] = desired[axis] + (offset + impulse * dt) * decay;
      velocity[axis] = (velocity[axis] - omega * impulse * dt) * decay;
    }
  }

  return {
    camera,
    setPullBack(amount, durationS = 1.8) {
      pullStart = pull;
      pullGoal = Number.isFinite(amount) ? Math.max(0, amount) : 0;
      pullTime = 0;
      pullDuration = Number.isFinite(durationS) ? Math.max(0, durationS) : 1.8;
    },
    resize(w, h) {
      if (!(w > 0 && h > 0)) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    update(dt, target, facingY, frame = {}) {
      const step = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0;
      pullTime += step;
      const t = pullDuration > 0 ? Math.min(1, pullTime / pullDuration) : 1;
      pull = THREE.MathUtils.lerp(pullStart, pullGoal, t * t * (3 - 2 * t));
      const extra = Math.max(0, frame.pullBack ?? pull);
      // World-relative chase with a slight lateral bias so the fox reads as a
      // slender quadruped (profile of legs/snout/tail) instead of a pure rear blob.
      const side = distance * 0.32;
      desired.set(
        target.x + side,
        target.y + height + extra * 0.28,
        target.z + distance + extra,
      );
      const ahead = frame.lookAhead ?? 1.1;
      aim.set(target.x + Math.sin(facingY) * ahead, target.y + lookHeight, target.z + Math.cos(facingY) * ahead);
      if (!initialized) {
        camera.position.copy(desired);
        look.copy(aim);
        initialized = true;
      } else {
        spring(step);
        look.lerp(aim, 1 - Math.exp(-6 * step));
      }
      const floor = opts.yAt?.(camera.position.x, camera.position.z);
      if (floor !== undefined && Number.isFinite(floor) && camera.position.y < floor + 0.8) {
        camera.position.y = floor + 0.8;
        velocity.y = Math.max(0, velocity.y);
      }
      camera.lookAt(look);
    },
  };
}
