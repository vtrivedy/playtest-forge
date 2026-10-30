import * as THREE from 'three';
import GUI from 'lil-gui';
import {
  createForgeRenderer,
  createColorField,
  createPostStack,
  createPaintedSky,
  applyLookdevLights,
  applyHeightFog,
  syncFog,
  createStylizedWater,
  createWindGrass,
  createFoxWisps,
} from '../../../src/render';
import { createIslandMesh, scatterProps, createShrine, createFoxStandIn } from './island';

declare global {
  interface Window {
    __game: {
      status: string;
      notes: string[];
      frameMs: number;
      fps: number;
      colorSample: number;
      shrineT: number;
      backend: string;
    };
  }
}

async function main() {
  const forge = await createForgeRenderer({ container: document.body, exposure: 1.05 });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 600);
  camera.position.set(0, 8, 18);

  applyLookdevLights(scene);
  const fog = applyHeightFog(scene, { density: 0.022, color: new THREE.Color(0xb0b6be) });
  const sky = createPaintedSky(scene, {
    zenith: new THREE.Color(0x8a929c),
    horizon: new THREE.Color(0xc8ced4),
    nadir: new THREE.Color(0x5a6068),
    sunColor: new THREE.Color(0xe8eef2),
    cloudAmount: 0.75,
    sunBloom: 0.18,
  });

  const island = createIslandMesh(12);
  scene.add(island.mesh);

  const patched: THREE.MeshStandardMaterial[] = [island.material];
  scatterProps(scene, island.yAt, patched);

  const shrine = createShrine(island.yAt);
  scene.add(shrine.group);
  patched.push(...shrine.materials);

  // underside material
  island.mesh.traverse((c) => {
    if ((c as THREE.Mesh).isMesh && c !== island.mesh) {
      const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (m && !patched.includes(m)) patched.push(m);
    }
  });

  const water = createStylizedWater(scene, { size: 90, y: -1.15 });
  const grass = createWindGrass(scene, {
    count: 700,
    radius: 9.5,
    ySampler: (x, z) => island.yAt(x, z),
  });

  const fox = createFoxStandIn();
  scene.add(fox.group);
  // fox stays saturated — do NOT patch fox materials
  const wisps = createFoxWisps(scene, 56);

  const colorField = createColorField({
    auraRadius: 3.2,
    trailLife: 2.8,
    trailRadius: 2.4,
    bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    maskSize: 512,
  });
  colorField.initMask(forge.renderer);
  for (const m of patched) colorField.patchMaterial(m);

  const post = createPostStack(forge.renderer, scene, camera, {
    bloomStrength: 0.48,
    bloomThreshold: 0.78,
    vignette: 0.3,
    enableGTAO: false, // toggle via GUI — costly on SwiftShader
  });

  // --- Scripted flythrough path ---
  type Key = { t: number; pos: THREE.Vector3; look: THREE.Vector3; fox: THREE.Vector3; restore?: boolean };
  const path: Key[] = [
    {
      t: 0,
      pos: new THREE.Vector3(14, 7, 14),
      look: new THREE.Vector3(0, 1.5, 0),
      fox: new THREE.Vector3(-6, 0, 5),
    },
    {
      t: 3,
      pos: new THREE.Vector3(8, 5, 10),
      look: new THREE.Vector3(-2, 1.2, 2),
      fox: new THREE.Vector3(-3.5, 0, 3.5),
    },
    {
      t: 6,
      pos: new THREE.Vector3(4, 4.2, 7),
      look: new THREE.Vector3(0, 1.5, -1),
      fox: new THREE.Vector3(0.2, 0, 1.0),
    },
    {
      t: 9,
      pos: new THREE.Vector3(2.5, 3.8, 4.5),
      look: new THREE.Vector3(0.5, 2.0, -3),
      fox: new THREE.Vector3(0.5, 0, -2.2),
      restore: true,
    },
    {
      t: 12.5,
      pos: new THREE.Vector3(-2, 6, 8),
      look: new THREE.Vector3(0.5, 1.5, -2),
      fox: new THREE.Vector3(0.5, 0, -3.0),
    },
    {
      t: 16,
      pos: new THREE.Vector3(-8, 9, 6),
      look: new THREE.Vector3(0, 1.2, 0),
      fox: new THREE.Vector3(1.5, 0, -1.5),
    },
    {
      t: 20,
      pos: new THREE.Vector3(0, 11, 16),
      look: new THREE.Vector3(0, 1, 0),
      fox: new THREE.Vector3(-1, 0, 2),
    },
  ];

  let restoreTriggered = false;
  let shrineT = 0;
  const guiParams = {
    auraRadius: colorField.auraRadius,
    trailLife: colorField.trailLife,
    bloomStrength: post.params.bloomStrength,
    bloomThreshold: post.params.bloomThreshold,
    vignette: post.params.vignette,
    fogDensity: fog.density,
    cloudAmount: sky.params.cloudAmount,
    exposure: 1.05,
    play: true,
    restart: () => restart(),
    triggerRestore: () => triggerRestore(),
    enableGTAO: false,
  };

  const gui = new GUI({ title: 'Lookdev' });
  gui.add(guiParams, 'play');
  gui.add(guiParams, 'restart');
  gui.add(guiParams, 'triggerRestore');
  gui.add(guiParams, 'auraRadius', 0.5, 6, 0.05).onChange((v: number) => {
    colorField.auraRadius = v;
  });
  gui.add(guiParams, 'trailLife', 0.5, 6, 0.05).onChange((v: number) => {
    colorField.trailLife = v;
  });
  gui.add(guiParams, 'bloomStrength', 0, 1.5, 0.01).onChange((v: number) => {
    post.params.bloomStrength = v;
  });
  gui.add(guiParams, 'bloomThreshold', 0, 1.2, 0.01).onChange((v: number) => {
    post.params.bloomThreshold = v;
  });
  gui.add(guiParams, 'vignette', 0, 1, 0.01).onChange((v: number) => {
    post.params.vignette = v;
  });
  gui.add(guiParams, 'fogDensity', 0, 0.05, 0.001).onChange((v: number) => {
    fog.density = v;
    syncFog(scene, fog);
  });
  gui.add(guiParams, 'cloudAmount', 0, 1, 0.01).onChange((v: number) => {
    sky.params.cloudAmount = v;
  });
  gui.add(guiParams, 'exposure', 0.4, 2, 0.01).onChange((v: number) => {
    forge.renderer.toneMappingExposure = v;
  });

  let t = 0;
  let elapsed = 0;
  const clock = new THREE.Clock();
  let frameMs = 16;
  let fps = 60;
  const foxPos = new THREE.Vector3();
  const lookAt = new THREE.Vector3();

  function restart() {
    t = 0;
    elapsed = 0;
    restoreTriggered = false;
    shrineT = 0;
    colorField.restores.length = 0;
    colorField.trail = [];
    colorField.globalColor = 0;
    shrine.materials[1]!.emissiveIntensity = 0.15;
  }

  function triggerRestore() {
    if (restoreTriggered) return;
    restoreTriggered = true;
    colorField.restore(shrine.position.clone().setY(island.yAt(shrine.position.x, shrine.position.z)), 14, 2.6);
    shrine.materials[1]!.emissiveIntensity = 2.2;
    shrineT = 0;
  }

  function samplePath(time: number): { pos: THREE.Vector3; look: THREE.Vector3; fox: THREE.Vector3 } {
    const last = path[path.length - 1]!;
    if (time >= last.t) {
      return { pos: last.pos.clone(), look: last.look.clone(), fox: last.fox.clone() };
    }
    let i = 0;
    while (i < path.length - 1 && path[i + 1]!.t < time) i++;
    const a = path[i]!;
    const b = path[i + 1]!;
    const u = (time - a.t) / (b.t - a.t);
    const s = u * u * (3 - 2 * u);
    return {
      pos: a.pos.clone().lerp(b.pos, s),
      look: a.look.clone().lerp(b.look, s),
      fox: a.fox.clone().lerp(b.fox, s),
    };
  }

  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    forge.setSize(innerWidth, innerHeight);
    post.setSize(innerWidth, innerHeight);
  }
  addEventListener('resize', onResize);

  const hud = document.getElementById('hud');

  function frame() {
    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    frameMs = rawDt * 1000;
    fps = 1 / Math.max(rawDt, 1e-4);

    if (guiParams.play) {
      t += dt;
      elapsed += dt;
    }

    // trigger restore when path says so
    for (const k of path) {
      if (k.restore && t >= k.t && !restoreTriggered) triggerRestore();
    }
    if (restoreTriggered) shrineT += dt;

    const sample = samplePath(t % 22); // loop flythrough
    if (t > 22 && t % 22 < dt) restart();

    camera.position.copy(sample.pos);
    lookAt.copy(sample.look);
    camera.lookAt(lookAt);

    foxPos.copy(sample.fox);
    foxPos.y = island.yAt(foxPos.x, foxPos.z);
    fox.group.position.copy(foxPos);
    // face roughly along motion
    const next = samplePath((t % 22) + 0.15);
    const dx = next.fox.x - sample.fox.x;
    const dz = next.fox.z - sample.fox.z;
    if (Math.hypot(dx, dz) > 0.001) fox.group.rotation.y = Math.atan2(dx, dz);

    colorField.setFox(foxPos.clone().setY(foxPos.y + 0.3));
    colorField.update(dt);
    colorField.renderMask(dt);
    for (const m of patched) colorField.syncMaterial(m);

    // grass saturation follows a coarse sample at center of each — approximate via uniform
    const gMat = grass.mesh.material as THREE.ShaderMaterial;
    if (gMat.uniforms.uSat) {
      gMat.uniforms.uSat.value = colorField.sample(new THREE.Vector3(0, 1, 0));
    }

    if (fox.tail) {
      fox.tail.rotation.y = Math.sin(elapsed * 3.2) * 0.25;
      fox.tail.rotation.x = Math.sin(elapsed * 2.1) * 0.1;
    }
    wisps.update(dt, foxPos);
    sky.update(dt);
    water.update(elapsed);
    grass.update(elapsed);

    // orb pulse
    const orb = shrine.group.getObjectByName('shrineOrb') as THREE.Mesh | undefined;
    if (orb) {
      const pulse = 1 + Math.sin(elapsed * 3) * 0.05;
      orb.scale.setScalar(pulse * (restoreTriggered ? 1.25 : 1));
    }

    post.render();

    const colorSample = colorField.sample(new THREE.Vector3(0, 1, 0));
    window.__game = {
      status: restoreTriggered ? (shrineT > 2.5 ? 'restored' : 'restoring') : 'mono',
      notes: [
        `t=${t.toFixed(2)}`,
        `fps=${fps.toFixed(1)}`,
        `frameMs=${frameMs.toFixed(1)}`,
        `colorCenter=${colorSample.toFixed(3)}`,
        `shrineT=${shrineT.toFixed(2)}`,
        `trail=${colorField.trail.length}`,
        `backend=${forge.backend}`,
      ],
      frameMs,
      fps,
      colorSample,
      shrineT,
      backend: forge.backend,
    };

    if (hud) {
      hud.textContent = `Color Fox lookdev · ${window.__game.status} · ${fps.toFixed(0)} fps · color@center ${colorSample.toFixed(2)}`;
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

main().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="color:#faa;padding:20px">${String(err)}</pre>`;
});
