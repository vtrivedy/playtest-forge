/** Progress gate: invalid prerequisites, corrupt saves, repeat events and storage failure. */
import assert from 'node:assert/strict';
import { createWorldProgress, PROGRESS_SAVE_KEY, WORLD_IDS, LEVEL_IDS, type ProgressStorage } from '../games/fox-spirit/src/worlds/progress';
let raw: string | null = null;
const storage: ProgressStorage = { getItem: () => raw, setItem: (_key, value) => { raw = value; }, removeItem: () => { raw = null; } };
const progress = createWorldProgress(storage);
let notifications = 0;
const unsubscribe = progress.subscribe(() => { notifications++; });
assert.equal(progress.complete('press', 'combine'), false, 'cannot finish by visiting end');
progress.enterWorld('press'); progress.visit('press', 'combine');
assert.equal(progress.snapshot().worlds.press.fill, 0, 'visiting is not a solve');
assert.equal(progress.hasAbility('press'), false);
for (const world of WORLD_IDS) for (const level of LEVEL_IDS) {
  assert.equal(progress.complete(world, level), true);
  const revision = progress.snapshot().revision;
  assert.equal(progress.complete(world, level), false, 'completion is idempotent');
  assert.equal(progress.snapshot().revision, revision);
}
assert.equal(notifications, 11);
const loaded = createWorldProgress(storage);
assert.equal(loaded.snapshot().activeWorld, 'hub', 'reload uses safe authored hub');
for (const world of WORLD_IDS) assert.equal(loaded.snapshot().worlds[world].fill, 1);
raw = JSON.stringify({ version: 1, worlds: { press: { restored: ['combine', 'develop', 'unknown'], visited: ['combine', 'unknown'] }, ashwater: { restored: ['teach', 'combine'] } } });
const normalized = createWorldProgress(storage);
assert.equal(normalized.hasAbility('press'), false, 'corrupt capstone cannot grant ability');
assert.equal(normalized.isVisited('press', 'combine'), true);
assert.equal(normalized.isRestored('ashwater', 'teach'), true);
assert.equal(normalized.isRestored('ashwater', 'combine'), false, 'missing develop strips capstone');
for (const malformed of ['{', 'null', '[]', '{"version":2,"worlds":{}}']) {
  raw = malformed; assert.equal(createWorldProgress(storage).snapshot().worlds.press.fill, 0);
}
raw = JSON.stringify({ version: 1, worlds: { press: { restored: ['teach'] } } });
assert.equal(createWorldProgress(storage, true).hasAbility('press'), false, 'fresh reset happens at boot');
assert.equal(raw, null);
const broken: ProgressStorage = { getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); }, removeItem() { throw Error('denied'); } };
assert.equal(createWorldProgress(broken).complete('press', 'teach'), true, 'storage failure preserves play');
unsubscribe(); progress.reset(); assert.equal(notifications, 11);
assert.equal(progress.snapshot().worlds.press.fill, 0);
assert.equal(PROGRESS_SAVE_KEY, 'russet-vale-worlds-v1');
console.log('PASS world progress: prerequisites, idempotence, normalization, reload, fresh, storage failure, unsubscribe');
