/** Cut validated GPU captures into the delivery files, without a local browser.
 * node tools/gpu-trailer.mjs --run ../playtest-forge-artifacts/gpu/<ref> --out ../playtest-forge-artifacts/trailer
 * Optional --money-shot <file> replaces the route's restoration segment.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const arg = (key, fallback) => {
  const i = process.argv.indexOf(`--${key}`);
  return i < 0 ? fallback : process.argv[i + 1];
};
const run = path.resolve(arg('run', '../playtest-forge-artifacts/gpu/main'));
const out = path.resolve(arg('out', '../playtest-forge-artifacts/trailer'));
fs.mkdirSync(out, { recursive: true });
const json = name => JSON.parse(fs.readFileSync(path.join(run, name), 'utf8'));
const probe = file => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' }));
function validate(file, min, max) {
  const p = probe(file), s = p.streams.find(s => s.codec_type === 'video');
  const duration = Number(p.format.duration);
  if (!s || s.width !== 1920 || s.height !== 1080 || s.r_frame_rate !== '60/1' || !(duration >= min && duration <= max)) {
    throw Error(`Invalid delivery: ${file}: ${JSON.stringify(p)}`);
  }
  return p;
}
const source = path.join(run, 'route-assisted.mp4');
const gameplayProbe = validate(source, 45, 90);
const duration = Number(gameplayProbe.format.duration);
const route = json('route-assisted.json');
if (!route.end.restored) throw Error('Route has no shrine restoration');
const staging = json('route-staging.json');
const orbit = path.join(run, 'restored-orbit-staged.mp4');
validate(orbit, 1, 120);
const moneyShot = arg('money-shot', '');
if (moneyShot) validate(path.resolve(moneyShot), 7, 120);
const segments = [
  { label: 'sepia vista', file: source, start: 0, seconds: 5 },
  { label: 'fox traversal', file: source, start: 5, seconds: 28 },
  { label: 'shrine approach and restore bloom', file: moneyShot ? path.resolve(moneyShot) : source, start: moneyShot ? 0 : duration - 20, seconds: moneyShot ? 7 : 10 },
  { label: 'restored vista', file: orbit, start: 0, seconds: Math.min(10, Number(probe(orbit).format.duration)) },
];
const work = path.join(out, '.edit');
fs.mkdirSync(work, { recursive: true });
for (const [i, segment] of segments.entries()) {
  const file = path.join(work, `${i}.mp4`);
  const fadeOut = segment.seconds - 0.2;
  console.log('CUT', segment.label, segment.start, segment.seconds);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-threads', '1', '-ss', String(segment.start), '-i', segment.file,
    '-t', String(segment.seconds), '-an', '-vf', `setsar=1,fade=t=in:st=0:d=0.2,fade=t=out:st=${fadeOut}:d=0.2`,
    '-filter_threads', '1', '-c:v', 'libx264', '-threads', '1', '-preset', 'veryfast', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-r', '60', '-movflags', '+faststart', file], { stdio: 'inherit' });
  validate(file, segment.seconds - 0.05, segment.seconds + 0.05);
}
const list = path.join(work, 'concat.txt');
fs.writeFileSync(list, segments.map((_, i) => `file '${i}.mp4'`).join('\n') + '\n');
const pending = path.join(out, 'trailer.pending.mp4');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
  '-c', 'copy', '-movflags', '+faststart', pending], { stdio: 'inherit' });
const trailerProbe = validate(pending, 45, 75);
fs.renameSync(pending, path.join(out, 'trailer.mp4'));
fs.copyFileSync(source, path.join(out, 'gameplay.mp4'));
validate(path.join(out, 'gameplay.mp4'), 45, 90);
fs.writeFileSync(path.join(out, 'edit.json'), JSON.stringify({ run, segments, staging, gameplayProbe, trailerProbe, audio: 'Silent', runMetadata: json('run.json') }, null, 2));
const perf = json('perf.json');
const median = values => { const a = values.toSorted((a, b) => a - b); return (a[Math.floor((a.length - 1) / 2)] + a[Math.floor(a.length / 2)]) / 2; };
const rows = [];
for (const q of ['low', 'med', 'high']) for (const state of ['sepia', 'restored']) {
  const samples = Object.entries(perf).filter(([k]) => k.startsWith(`${q}-${state}-`)).map(([, v]) => v);
  if (samples.length !== 5) throw Error(`Missing perf poses: ${q} ${state}`);
  const ms = median(samples.map(v => v.msPerFrame));
  const calls = samples.map(v => v.drawCalls);
  rows.push(`| ${q} | ${state} | ${ms.toFixed(2)} | ${median(samples.map(v => v.fps)).toFixed(1)} | ${Math.min(...calls)}–${Math.max(...calls)} | ${samples[0].drawingBuffer.join('×')} |`);
}
fs.writeFileSync(path.join(out, 'PERF.md'), `# Russetvale GPU capture\n\nCommit: ${json('run.json').commit}\n\nRenderer: ${fs.readFileSync(path.join(run, 'renderer.txt'), 'utf8').trim()}\n\nMedian of five poses; each pose is the median of nine GPU-synchronized perf(4) batches, after warmup. Simulation is paused: these are render-only measurements, not interactive FPS. Low renders at half resolution. Staging warnings and raw samples are in ${path.join(run, 'report.json')}.\n\n| Tier | State | Median ms/frame | Median render FPS | Draw calls | Drawing buffer |\n|---|---|---:|---:|---:|---|\n${rows.join('\n')}\n\nGameplay is explicitly assisted and includes an editorial cut to the shrine approach. See edit.json and route-staging.json; it is not an unassisted full-route win. Videos are silent, 1920×1080, fixed 60 Hz simulation and 60 fps H.264. Both deliveries passed ffprobe.\n`);
fs.rmSync(work, { recursive: true });
console.log('DELIVERED', path.join(out, 'gameplay.mp4'), path.join(out, 'trailer.mp4'));
