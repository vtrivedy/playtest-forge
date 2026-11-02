/**
 * Real-time listening test for synthesized SFX modules (hearthsong.html): drives one for `seconds` on a live
 * AudioContext and returns the recorded output as base64 int16 (tools/hearthsong-render.mjs --sfx water).
 */
import * as THREE from 'three';
import { createWaterSounds } from '../waterSounds.hot';
import type { OpeningAudio } from '../audio';

export async function recordWater(seconds: number): Promise<{ sr: number; l: string; r: string }> {
  const ac = new AudioContext();
  await ac.resume();
  const sfx = ac.createGain();
  const rec = ac.createScriptProcessor(4096, 2, 2);
  const chunks: Float32Array[][] = [[], []];
  rec.onaudioprocess = (e) => { for (let c = 0; c < 2; c++) chunks[c]!.push(e.inputBuffer.getChannelData(c).slice()); };
  const mute = ac.createGain();
  mute.gain.value = 0;
  sfx.connect(rec).connect(mute).connect(ac.destination);
  const at = (pos: THREE.Vector3, ref = 3) => {
    const p = new PannerNode(ac, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: ref, maxDistance: 60, rolloffFactor: 1.1, positionX: pos.x, positionY: pos.y, positionZ: pos.z });
    p.connect(sfx);
    return p;
  };
  const audio = { ac, sfx, at } as unknown as OpeningAudio;
  const brook = [new THREE.Vector3(-3, 0, -2), new THREE.Vector3(0, 0, -3), new THREE.Vector3(3, 0, -4)];
  const w = createWaterSounds({ audio, brook, wheel: new THREE.Vector3(4, 1, -5) });
  const fox = new THREE.Vector3(0, 0.5, 0);
  const t0 = performance.now();
  let last = t0;
  let burst = false;
  await new Promise<void>((done) => {
    const step = () => {
      const now = performance.now();
      const t = (now - t0) / 1000;
      // dry → burst at 3 s → water rises → wheel turns from 6 s
      if (t > 3 && !burst) { burst = true; w.burst(new THREE.Vector3(-4, 1, -3)); }
      const flow = Math.min(1, Math.max(0, (t - 3.2) / 2));
      const turn = Math.min(1, Math.max(0, (t - 6) / 3));
      w.update(fox, flow, turn, (now - last) / 1000);
      last = now;
      if (t < seconds) setTimeout(step, 16); else done();
    };
    step();
  });
  const enc = (c: Float32Array[]) => {
    const n = c.reduce((a, x) => a + x.length, 0);
    const i16 = new Int16Array(n);
    let k = 0;
    for (const x of c) for (let j = 0; j < x.length; j++) i16[k++] = Math.max(-32768, Math.min(32767, Math.round(x[j]! * 32767)));
    const u8 = new Uint8Array(i16.buffer);
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    return btoa(s);
  };
  await ac.close();
  return { sr: ac.sampleRate, l: enc(chunks[0]!), r: enc(chunks[1]!), ...w.state() } as { sr: number; l: string; r: string };
}
