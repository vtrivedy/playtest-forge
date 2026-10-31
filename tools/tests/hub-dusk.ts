import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHubDusk, hubDuskWeight, HUB_DUSK } from '../../games/fox-spirit/src/hubDusk';
import { applyLookdevLights, createPaintedSky } from '../../src/render/sky';

// No renderer/browser: guard against cumulative darkening and fog-density resets.
const scene = new THREE.Scene();
const lights = applyLookdevLights(scene);
lights.rim.intensity = 1.55;
const sky = createPaintedSky(scene);
const baseMist = sky.params.mist.clone();
const baseZenith = sky.params.zenith.clone();
const fog = { color: baseMist.clone(), density: .0042, height: 0, heightFalloff: .045, horizonStrength: .4 };
scene.fog = new THREE.FogExp2(fog.color, .007); // distinct live density must survive mood updates
const dusk = createHubDusk(scene, lights, sky, fog);
assert.equal(hubDuskWeight(0, 94), 1);
assert.equal(hubDuskWeight(0, 60), 0);
assert.equal(hubDuskWeight(60, 94), 0);
assert.ok(hubDuskWeight(0, 78) > 0 && hubDuskWeight(0, 78) < 1);
dusk.update(0, 94);
const heldMist = sky.params.mist.clone();
for (let i = 0; i < 1000; i++) dusk.update(0, 94);
assert.ok(sky.params.mist.equals(heldMist), 'dusk must not compound each frame');
assert.ok(scene.fog.color.equals(heldMist), 'fog and sky must keep matching');
assert.equal(scene.fog.density, .007, 'live regional fog density must survive');
assert.equal(fog.density, .0042, 'GUI fog density must survive');
dusk.update(0, 60);
assert.ok(sky.params.mist.equals(baseMist), 'realm must recover its exact original mist');
assert.ok(sky.params.zenith.equals(baseZenith), 'realm must recover its original sky');
assert.equal(lights.key.intensity, 2.5);
assert.equal(lights.rim.intensity, 1.55);
HUB_DUSK.kOverride = .5;
assert.equal(hubDuskWeight(60, 0), .5);
HUB_DUSK.kOverride = -1;
sky.dispose();
console.log('Hub dusk invariants PASS: no compounding, exact realm restoration, matched fog, density preserved, override available.');
