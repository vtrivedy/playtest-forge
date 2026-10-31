import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, cp, symlink, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import type * as THREE from 'three';
import { hubPlazaWeight, HUB_PLAZA_LIFT } from '../../games/fox-spirit/src/regionLanternhollow.ts';

// Execute the actual route/terrain construction without assets, DOM, renderer or browser.
// Compare against the immutable pre-floor source, not a second hand-written terrain path.
const sourcePath = 'games/fox-spirit/src/russetvale.ts';
const beforeRef = 'a616a54';
const before = execFileSync('git', ['show', `${beforeRef}:${sourcePath}`], { encoding: 'utf8' });
const after = await readFile(sourcePath, 'utf8');
function cpuModule(source: string): string {
  const headerEnd = source.indexOf('export async function createRussetvale(');
  const start = source.indexOf('  // Critical path, authored once;');
  const end = source.indexOf('  // ==================================================================== ISLAND UNDERSIDE');
  assert.ok(headerEnd > 0 && start > headerEnd && end > start, 'Terrain audit source markers changed');
  const tile = source.match(/^const GROUND_TILE = [^;]+;/m)?.[0];
  assert.ok(tile);
  return source.slice(0, headerEnd) + '\n' + tile + '\nexport function buildTerrainCPU() {\n' +
    'const group = new THREE.Group(); const M = {terrain:new THREE.MeshStandardMaterial()};\n' +
    source.slice(start, end) + '\nreturn {geometry:(group.getObjectByName("rv-terrain") as THREE.Mesh).geometry,route};\n}\n';
}
type CpuTerrain = { geometry: THREE.BufferGeometry; route: unknown[] };
const scratch = await mkdtemp(join(tmpdir(), 'hub-plaza-'));
const roots = ['before', 'after'].map(label => join(scratch, label));
const sourceTrees = ['games/fox-spirit/src', 'games/shared', 'src'];
try {
  for (const root of roots) await mkdir(root, {recursive:true});
  const archive = execFileSync('git', ['archive', beforeRef, ...sourceTrees, 'package.json']);
  execFileSync('tar', ['-xf', '-', '-C', roots[0]!], {input:archive});
  for (const tree of [...sourceTrees, 'package.json']) await cp(tree, join(roots[1]!, tree), {recursive:true});
  for (const root of roots) await symlink(resolve('node_modules'), join(root, 'node_modules'), 'dir');
  const paths = roots.map(root => join(root, 'games/fox-spirit/src/hub-plaza-cpu.ts'));
  await writeFile(paths[0]!, cpuModule(before));
  await writeFile(paths[1]!, cpuModule(after));
  const modules = await Promise.all(paths.map(path => import(pathToFileURL(path).href)));
  const [oldTerrain, newTerrain] = modules.map(module => module.buildTerrainCPU() as CpuTerrain);
  assert.deepEqual(newTerrain!.route, oldTerrain!.route, 'Route must stay exact');
  for (const name of ['position', 'normal', 'uv', 'leafy']) {
    assert.deepEqual(newTerrain!.geometry.getAttribute(name).array, oldTerrain!.geometry.getAttribute(name).array, name + ' must stay bit-identical');
  }
  assert.deepEqual(newTerrain!.geometry.index!.array, oldTerrain!.geometry.index!.array, 'Topology must stay exact');
  const position = newTerrain!.geometry.getAttribute('position');
  const oldColor = oldTerrain!.geometry.getAttribute('color'), color = newTerrain!.geometry.getAttribute('color');
  let outside = 0, changed = 0, maxChannelRatio = 1;
  const insideRatios: number[] = [];
  for (let i = 0; i < position.count; i++) {
    const w = hubPlazaWeight(position.getX(i), position.getZ(i));
    if (w === 0) {
      outside++;
      for (let k = 0; k < 3; k++) assert.equal(color.array[i * 3 + k], oldColor.array[i * 3 + k], `Outside color changed at vertex${i}`);
    } else {
      let vertexRatio = 1;
      for (let k = 0; k < 3; k++) {
        const current = Number(color.array[i * 3 + k]), previous = Number(oldColor.array[i * 3 + k]);
        assert.ok(Number.isFinite(current) && current >= previous, 'Floor must be a finite value lift');
        maxChannelRatio = Math.max(maxChannelRatio, current / previous);
        vertexRatio = Math.max(vertexRatio, current / previous);
      }
      insideRatios.push(vertexRatio);
      if ([0,1,2].some(k => color.array[i*3+k] !== oldColor.array[i*3+k])) changed++;
    }
  }
  assert.ok(changed > 0 && outside > position.count * .98, 'Floor must change a small bounded subset');
  for (const [x, z] of [[-6,92],[-8,85],[-12.5,89.5]]) assert.ok(hubPlazaWeight(x!,z!) > .8);
  assert.ok(hubPlazaWeight(-4.5,93.5) >= .5);
  assert.ok(hubPlazaWeight(-3.3,94.7) < .5, 'Near foreground must fall off');
  for (const [x, z] of [[-18,70],[0,0],[25,88],[57,40],[0,80],[0,12],[-18,92],[-18,84.6],[12,95],[-17,88],[0,88],[-8,78],[-8,97]]) assert.equal(hubPlazaWeight(x!,z!),0);
  assert.equal(HUB_PLAZA_LIFT,.18);
  insideRatios.sort((a,b)=>a-b);
  console.log(JSON.stringify({ vertices:position.count, unchangedOutside:outside, changedInside:changed,
    maxChannelRatio, ratioP50:insideRatios[Math.floor(insideRatios.length*.5)],
    ratioP95:insideRatios[Math.floor(insideRatios.length*.95)],
    verticesAboveScalarLift:insideRatios.filter(ratio=>ratio>1+HUB_PLAZA_LIFT+1e-5).length,
    note:'18% authored lift plus removal of prior dark wear; not an image/quality pass' },null,2));
  for (const item of [oldTerrain!, newTerrain!]) item.geometry.dispose();
} finally {
  await rm(scratch, {recursive:true,force:true});
}
