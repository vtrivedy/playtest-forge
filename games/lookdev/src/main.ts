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
  createAutumnParticles,
} from '../../../src/render';
import { createIslandMesh, scatterProps, createShrine, createFoxStandIn } from './island';
import { tryLoadGlb, collectStandardMats, placeGlb } from './assets';

async function main() {
  const forge = await createForgeRenderer({ container: document.body, exposure: 1.05 });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 600);
  camera.position.set(0, 8, 18);

  applyLookdevLights(scene);
  const fog = applyHeightFog(scene, { density: 0.022, color: new THREE.Color(0xd8c4a0) });
  const sky = createPaintedSky(scene, {
    zenith: new THREE.Color(0xb89268),
    horizon: new THREE.Color(0xe8d4b0),
    nadir: new THREE.Color(0x6a5040),
    sunColor: new THREE.Color(0xffd9a0),
    cloudAmount: 0.7,
    sunBloom: 0.28,
  });

  const island = createIslandMesh(12);
  scene.add(island.mesh);

  const patched: THREE.MeshStandardMaterial[] = [island.material];
  scatterProps(scene, island.yAt, patched);

  const shrine = createShrine(island.yAt);
  scene.add(shrine.group);
  patched.push(...shrine.materials);

  // Prefer authored autumn GLBs when available (assets stream)
  const [mapleGlb, shrineGlb, archGlb, foxGlb, leafPileGlb] = await Promise.all([
    tryLoadGlb('/assets/env/procedural/maple_tree.glb'),
    tryLoadGlb('/assets/env/procedural/shrine.glb'),
    tryLoadGlb('/assets/env/procedural/ruin_arch.glb'),
    tryLoadGlb('/assets/hero/spirit_fox.glb'),
    tryLoadGlb('/assets/env/procedural/leaf_pile.glb'),
  ]);

  if (shrineGlb) {
    scene.remove(shrine.group);
    const placed = placeGlb(shrineGlb, shrine.position.x, shrine.position.z, island.yAt, 3.4, 0.2);
    scene.add(placed);
    shrine.group = placed;
    collectStandardMats(placed, patched);
    // keep a named orb for pulse if present
    placed.traverse((c) => {
      if ((c as THREE.Mesh).isMesh && /orb|crystal|glow|ember/i.test(c.name)) c.name = 'shrineOrb';
    });
    shrine.materials = [];
    collectStandardMats(placed, shrine.materials);
  }

  if (mapleGlb) {
    const sites: Array<[number, number, number, number]> = [
      [3.6, -1.2, 7.2, 0.35], // hero maple (keyart right mass)
      [-5.5, -2.8, 4.8, 1.1],
      [5.8, 3.0, 4.2, 2.2],
      [-3.8, 5.0, 3.8, 0.8],
      [1.2, -6.5, 4.4, 1.6],
      [-1.5, -4.8, 3.6, -0.5],
    ];
    for (const [x, z, h, yaw] of sites) {
      if (island.yAt(x, z) < 0.25) continue;
      const tree = placeGlb(mapleGlb, x, z, island.yAt, h, yaw);
      scene.add(tree);
      collectStandardMats(tree, patched);
    }
  }

  if (archGlb) {
    const arches: Array<[number, number, number, number]> = [
      [-4.5, 2.5, 2.6, 0.6],
      [6.8, -4.2, 2.2, -0.9],
      [-7.2, -5.5, 2.0, 1.4],
    ];
    for (const [ax, az, h, yaw] of arches) {
      if (island.yAt(ax, az) < 0.15) continue;
      const arch = placeGlb(archGlb, ax, az, island.yAt, h, yaw);
      scene.add(arch);
      collectStandardMats(arch, patched);
    }
  }

  if (leafPileGlb) {
    const piles: Array<[number, number, number, number]> = [
      [1.6, -0.8, 0.55, 0.3],
      [-1.2, 1.4, 0.48, 1.1],
      [3.8, 1.2, 0.52, -0.4],
      [-2.8, -2.2, 0.42, 2.0],
      [0.4, 3.2, 0.5, 0.7],
      [4.6, -3.0, 0.4, -1.2],
      [-5.0, 0.6, 0.45, 0.2],
      [2.2, 4.5, 0.38, 1.6],
    ];
    for (const [x, z, h, yaw] of piles) {
      if (island.yAt(x, z) < 0.2) continue;
      const pile = placeGlb(leafPileGlb, x, z, island.yAt, h, yaw);
      scene.add(pile);
      collectStandardMats(pile, patched);
    }
  }

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
    color: 0xc9a84a,
    monoColor: 0x8a7358,
    ySampler: (x, z) => island.yAt(x, z),
  });

  let fox = createFoxStandIn();
  if (foxGlb) {
    const box = new THREE.Box3().setFromObject(foxGlb);
    const size = new THREE.Vector3();
    box.getSize(size);
    // scale by height so the hero reads at keyart scale (~1.35 m)
    const s = 1.35 / Math.max(size.y, 0.001);
    foxGlb.scale.setScalar(s);
    box.setFromObject(foxGlb);
    foxGlb.position.x -= (box.min.x + box.max.x) * 0.5;
    foxGlb.position.z -= (box.min.z + box.max.z) * 0.5;
    foxGlb.position.y -= box.min.y;
    // warm spirit emissive — stay saturated, never ColorField-patched
    foxGlb.traverse((c) => {
      if (!(c as THREE.Mesh).isMesh) return;
      const mats = Array.isArray((c as THREE.Mesh).material)
        ? ((c as THREE.Mesh).material as THREE.Material[])
        : [(c as THREE.Mesh).material as THREE.Material];
      for (const mat of mats) {
        const sm = mat as THREE.MeshStandardMaterial;
        if (!sm?.isMeshStandardMaterial) continue;
        const hsl = { h: 0, s: 0, l: 0 };
        sm.color.getHSL(hsl);
        // cream / light → soft gold; saturated warm → ember glow
        if (hsl.l > 0.75 && hsl.s < 0.35) {
          sm.emissive = new THREE.Color(0xffc878);
          sm.emissiveIntensity = Math.max(sm.emissiveIntensity, 0.12);
        } else if (hsl.s > 0.25 && (hsl.h < 0.12 || hsl.h > 0.9)) {
          sm.emissive = new THREE.Color(0xff6a22);
          sm.emissiveIntensity = Math.max(sm.emissiveIntensity, 0.55);
        }
        sm.needsUpdate = true;
      }
    });
    const group = new THREE.Group();
    group.add(foxGlb);
    const foxLight = new THREE.PointLight(0xff6622, 1.8, 9);
    foxLight.position.set(0, 0.55, -0.15);
    group.add(foxLight);
    fox = { group, materials: [], tail: null as unknown as THREE.Mesh };
  }
  scene.add(fox.group);
  // fox stays saturated — do NOT patch fox materials
  const wisps = createFoxWisps(scene, 56);
  const autumnFX = createAutumnParticles(scene, 200, 100);

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
    grain: 0.12,
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


  function setShrineGlow(intensity: number) {
    const orb = shrine.group.getObjectByName('shrineOrb') as THREE.Mesh | undefined;
    const mats = orb
      ? (Array.isArray(orb.material) ? (orb.material as THREE.MeshStandardMaterial[]) : [orb.material as THREE.MeshStandardMaterial])
      : shrine.materials;
    for (const m of mats) {
      if (m && (m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        const sm = m as THREE.MeshStandardMaterial;
        if (!sm.emissive) sm.emissive = new THREE.Color(0xff6622);
        else if (sm.emissive.getHex() === 0) sm.emissive.setHex(0xff6622);
        sm.emissiveIntensity = intensity;
      }
    }
  }

  function restart() {
    t = 0;
    elapsed = 0;
    restoreTriggered = false;
    shrineT = 0;
    colorField.restores.length = 0;
    colorField.trail = [];
    colorField.globalColor = 0;
    setShrineGlow(0.15);
  }

  /** Jump flythrough clock; O(1) — safe under SwiftShader. */
  function seek(timeS: number, opts: { restore?: boolean } = {}) {
    restart();
    t = timeS;
    elapsed = timeS;
    // Drop a short trail along recent path samples
    const trailN = 16;
    for (let i = trailN; i >= 0; i--) {
      const u = Math.max(0, timeS - i * 0.08);
      const sample = samplePath(u);
      const fp = sample.fox.clone();
      fp.y = island.yAt(fp.x, fp.z) + 0.3;
      colorField.trail.push({ x: fp.x, y: fp.y, z: fp.z, life: colorField.trailLife * (1 - i / (trailN + 1)) });
    }
    const now = samplePath(timeS);
    const foxNow = now.fox.clone();
    foxNow.y = island.yAt(foxNow.x, foxNow.z);
    colorField.setFox(foxNow.clone().setY(foxNow.y + 0.3));
    fox.group.position.copy(foxNow);
    camera.position.copy(now.pos);
    camera.lookAt(now.look);

    const wantRestore = opts.restore || path.some((k) => k.restore && timeS >= k.t);
    if (wantRestore) {
      triggerRestore();
      const age = Math.max(0, timeS - 9);
      shrineT = age;
      const r = colorField.restores[0];
      if (r) {
        r.age = age;
        r.t = Math.min(1, age / r.durationS);
        const e = 1 - Math.pow(1 - r.t, 3);
        r.radius = r.targetRadius * e;
        autumnFX.setWavefront(r.center, r.radius, r.t < 1 ? 1.8 : 0.4);
      }
    }
  }

  (window as unknown as { __lookdev: object }).__lookdev = {
    seek,
    restore: triggerRestore,
    restart,
    get t() { return t; },
    colorField,
  };

  function triggerRestore() {
    if (restoreTriggered) return;
    restoreTriggered = true;
    const c = shrine.position.clone().setY(island.yAt(shrine.position.x, shrine.position.z));
    colorField.restore(c, 14, 2.6);
    setShrineGlow(2.8);
    shrineT = 0;
    autumnFX.setWavefront(c, 1.5, 2.5);
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

  // URL bootstrap: ?t=12&restore=1
  const boot = new URLSearchParams(location.search);
  const bootT = Number(boot.get('t') || '');
  if (Number.isFinite(bootT) && bootT > 0) {
    seek(bootT, { restore: boot.get('restore') === '1' || bootT >= 9 });
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
    if (colorField.restores[0]) {
      const r = colorField.restores[0];
      autumnFX.setWavefront(r.center, r.radius, r.t < 1 ? 1.8 : 0.35);
    }
    autumnFX.update(dt);
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
    (window as any).__game = {
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
      hud.textContent = `Color Fox lookdev · ${(window as any).__game.status} · ${fps.toFixed(0)} fps · color@center ${colorSample.toFixed(2)}`;
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

main().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="color:#faa;padding:20px">${String(err)}</pre>`;
});
