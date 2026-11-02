/** In-canvas illustrated Album. Progress changes redraw once; the hot step only fits its plane. */
import * as THREE from 'three';
import { WORLD_IDS, LEVEL_IDS, SECRET_IDS, WORLD_CATALOGUE, type WorldProgress, type WorldId, type SecretId } from './progress';
import type { LetterPlane } from '../opening/lettering.hot';
import { createLetterPlane } from '../opening/lettering';
import { stepPageMap } from './pageMap.hot';
import { WORLD_STORIES, WORLD_REVELATIONS, STACKS_MEMORY, LOFT_MEMORY, ROOF_MEMORY, MOORING_MEMORY, type StoryMemory } from './story';
const SECRET_PAGES = {
  'press-stacks': { memory: STACKS_MEMORY, notice: 'A page never pressed: everyone, together, laughing.' },
  'vale-loft': { memory: LOFT_MEMORY, notice: 'The Scribe’s own house, before the rain.' },
  'ashwater-roof': { memory: ROOF_MEMORY, notice: 'A home, under the reeds.' },
  'ashwater-mooring': { memory: MOORING_MEMORY, notice: 'The last ferry never left.' },
} satisfies Record<SecretId, { memory: StoryMemory; notice: string }>;
const SPREAD_COUNT = 1 + WORLD_IDS.length + SECRET_IDS.length;
const WIDTH = 1440, HEIGHT = 880;
const FONT = 'Georgia, "DejaVu Serif", serif';
export interface PageMap {
  setOpen(value: boolean): void;
  isOpen(): boolean;
  step(): void;
  dispose(): void;
}
export function createPageMap(camera: THREE.PerspectiveCamera, progress: WorldProgress, inputTarget: Window = window): PageMap {
  const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
  const g = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.renderOrder = 12000; mesh.frustumCulled = false; mesh.visible = false; mesh.userData.forgeSkipAO = true;
  camera.add(mesh);
  const badge = createLetterPlane(400, 88, .055, .85, { panel: true });
  badge.draw([{ text: 'Tab · Album', px: 34 }]);
  camera.add(badge.mesh);
  const plane: LetterPlane = { mesh, mat: material, aspect: WIDTH / HEIGHT, heightFrac: .88, y: 0, x: 0, left: false };
  const revelation = createLetterPlane(1400, 160, .105, .60, { panel: true });
  camera.add(revelation.mesh);
  let pendingRevelation = false;
  const knownCombine = WORLD_IDS.map(world => progress.isRestored(world, 'combine'));
  const knownSecrets = SECRET_IDS.map(secret => progress.isSecretFound(secret));
  let open = false;
  let spread = 0;
  function text(value: string, x: number, y: number, size: number, color = '#382b31') {
    g.fillStyle = color; g.font = `${size}px ${FONT}`; g.fillText(value, x, y);
  }
  function landscape(world: WorldId, x: number, y: number, color: string, restored: boolean) {
    g.save(); g.translate(x, y);
    g.fillStyle = restored ? color : '#b5acaa';
    g.globalAlpha = restored ? .75 : .35;
    g.beginPath(); g.ellipse(0, 30, 172, 42, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    g.strokeStyle = restored ? color : '#8c8186'; g.lineWidth = 8; g.lineCap = 'round';
    if (world === 'russetvale') {
      for (const tx of [-95, 0, 100]) {
        g.beginPath(); g.moveTo(tx, 25); g.lineTo(tx, -58); g.stroke();
        g.beginPath(); g.ellipse(tx, -65, 44, 39, 0, 0, Math.PI * 2); g.fill();
      }
    } else if (world === 'ashwater') {
      for (const tx of [-120, -75, 55, 110]) {
        g.beginPath(); g.moveTo(tx, 28); g.quadraticCurveTo(tx + 22, -30, tx + 9, -65); g.stroke();
        g.beginPath(); g.moveTo(tx + 9, -60); g.lineTo(tx - 12, -38); g.moveTo(tx + 10, -45); g.lineTo(tx + 31, -28); g.stroke();
      }
      g.lineWidth = 3;
      for (const yy of [5, 23, 40]) { g.beginPath(); g.moveTo(-145, yy); g.bezierCurveTo(-60, yy - 15, 30, yy + 18, 145, yy); g.stroke(); }
    } else {
      for (const tx of [-110, -35, 50, 112]) {
        g.beginPath(); g.moveTo(tx - 25, 28); g.lineTo(tx - 15, -55); g.lineTo(tx + 10, -90); g.lineTo(tx + 23, 28); g.closePath(); g.stroke();
      }
      g.lineWidth = 3; g.beginPath(); g.moveTo(-145, 42); g.lineTo(140, 42); g.stroke();
    }
    g.restore();
  }
  function wrap(value: string, x: number, y: number, width: number, size: number, color: string) {
    g.font = `${size}px ${FONT}`;
    let line = '', yy = y;
    for (const word of value.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && g.measureText(next).width > width) { text(line, x, yy, size, color); yy += size * 1.4; line = word; }
      else line = next;
    }
    if (line) text(line, x, yy, size, color);
  }
  function drawStory(world: WorldId) {
    const def = WORLD_CATALOGUE[world];
    text(def.name, WIDTH / 2, 200, 34, '#302334');
    g.fillStyle = def.color; g.fillRect(630, 215, 180, 4);
    text('Memories returned to the Album', WIDTH / 2, 250, 23, '#48383c');
    g.textAlign = 'left';
    for (let li = 0; li < LEVEL_IDS.length; li++) {
      const level = LEVEL_IDS[li], recovered = progress.isRestored(world, level), memory = WORLD_STORIES[world][level], y = 300 + li * 150;
      g.fillStyle = recovered ? '#e4d4b8' : '#ded4c3';
      g.beginPath(); g.roundRect(120, y - 25, 1200, 130, 10); g.fill();
      text(recovered ? memory.title : 'A page still missing', 150, y + 9, 27, recovered ? '#241824' : '#625354');
      if (recovered) { g.textAlign = 'right'; text(memory.voice, 1290, y + 9, 22, '#48383c'); g.textAlign = 'left'; }
      wrap(recovered ? memory.text : 'Only a torn edge remains. The rest has not returned to the Album.', 150, y + 48, 1130, 25, recovered ? '#302330' : '#625354');
    }
    g.textAlign = 'center';
  }
  function draw() {
    const state = progress.snapshot();
    g.clearRect(0, 0, WIDTH, HEIGHT);
    g.fillStyle = '#201c29'; g.beginPath(); g.roundRect(0, 0, WIDTH, HEIGHT, 28); g.fill();
    g.fillStyle = '#eee1c8'; g.beginPath(); g.roundRect(12, 12, WIDTH - 24, HEIGHT - 24, 22); g.fill();
    g.strokeStyle = '#9d7f68'; g.lineWidth = 2; g.strokeRect(32, 32, WIDTH - 64, HEIGHT - 64);
    g.textAlign = 'center'; text('The Hearthfox Album', WIDTH / 2, 90, 42);
    text('Restore the three Seedwells · Find the Wellspring', WIDTH / 2, 135, 23, '#75615c');
    if (spread > 0) {
      if (spread < 4) drawStory(WORLD_IDS[spread - 1]);
      else {
        const secretIndex = spread - 4;
        const found = progress.isSecretFound(SECRET_IDS[secretIndex]);
        const memory = SECRET_PAGES[SECRET_IDS[secretIndex]].memory;
        text('Unpressed pages', WIDTH / 2, 220, 36, '#302334');
        g.fillStyle = '#e4d4b8'; g.beginPath(); g.roundRect(180, 295, 1080, 380, 16); g.fill();
        text(found ? memory.title : 'A loose binding', WIDTH / 2, 355, 32, '#302334');
        text(found ? memory.voice : 'There is room for another memory.', WIDTH / 2, 405, 24, '#625354');
        g.textAlign = 'left';
        wrap(found ? memory.text : 'Some moments were never pressed into the Album. An empty space waits between these pages.', 235, 475, 970, 28, '#302330');
        g.textAlign = 'center';
      }
      text('[ / ] · turn pages     Tab · close Album', WIDTH / 2, 844, 22);
      texture.needsUpdate = true;
      return;
    }
    for (let wi = 0; wi < WORLD_IDS.length; wi++) {
      const world = WORLD_IDS[wi], data = state.worlds[world], def = WORLD_CATALOGUE[world];
      const cx = 256 + wi * 464;
      if (wi) { g.strokeStyle = '#c8b79e'; g.beginPath(); g.moveTo(cx - 232, 177); g.lineTo(cx - 232, 750); g.stroke(); }
      if (state.activeWorld === world) { g.fillStyle = def.color; g.beginPath(); g.arc(cx - 175, 188, 5, 0, Math.PI * 2); g.fill(); }
      text(def.name, cx, 197, 29); text(def.season, cx, 233, 21, '#75615c');
      landscape(world, cx, 360, def.color, data.visited.length > 0);
      for (let li = 0; li < LEVEL_IDS.length; li++) {
        const level = LEVEL_IDS[li], solved = data.restored.includes(level), seen = data.visited.includes(level), yy = 459 + li * 64;
        if (li < 2) { g.strokeStyle = '#ab9c8e'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 168, yy + 14); g.lineTo(cx - 168, yy + 49); g.stroke(); }
        g.fillStyle = solved ? def.color : seen ? '#d4c6ae' : '#eee1c8'; g.strokeStyle = solved ? '#574c4c' : '#ab9c8e'; g.lineWidth = 2;
        g.beginPath(); g.arc(cx - 168, yy, 12, 0, Math.PI * 2); g.fill(); g.stroke();
        if (solved) { g.strokeStyle = '#fff9e7'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 174, yy); g.lineTo(cx - 169, yy + 5); g.lineTo(cx - 161, yy - 6); g.stroke(); }
        g.textAlign = 'left'; text(def.levels[level], cx - 141, yy + 7, 24, solved ? '#382b31' : '#796b68'); g.textAlign = 'center';
      }
      text(`${def.well} Seedwell`, cx, 677, 23);
      for (let i = 0; i < 3; i++) { g.fillStyle = i < data.restored.length ? def.color : '#cec1ae'; g.beginPath(); g.roundRect(cx - 120 + i * 83, 698, 74, 13, 6); g.fill(); }
      text(data.ability ? `${data.ability} learned` : `${def.ability} · undiscovered`, cx, 749, 22, data.ability ? '#483c46' : '#8d7c73');
    }
    text('Outline: undiscovered     Wash: visited     Color + tick: restored', WIDTH / 2, 805, 21, '#75615c');
    text('[ / ] · read memories     Tab · close Album', WIDTH / 2, 844, 22);
    texture.needsUpdate = true;
  }
  function setOpen(value: boolean) { open = value; if (open) pendingRevelation = false; if (open) draw(); stepPageMap(plane, camera, open, badge, revelation, pendingRevelation); }
  function keydown(event: KeyboardEvent) {
    if (event.code === 'Tab') { event.preventDefault(); if (!event.repeat) setOpen(!open); }
    else if (open && (event.code === 'BracketLeft' || event.code === 'BracketRight')) {
      event.preventDefault();
      if (!event.repeat) { spread = (spread + (event.code === 'BracketRight' ? 1 : SPREAD_COUNT - 1)) % SPREAD_COUNT; draw(); }
    }
  }
  inputTarget.addEventListener('keydown', keydown);
  const unsubscribe = progress.subscribe(() => {
    for (let wi = 0; wi < WORLD_IDS.length; wi++) {
      const world = WORLD_IDS[wi], restored = progress.isRestored(world, 'combine');
      if (restored && !knownCombine[wi]) {
        revelation.draw([{ text: WORLD_REVELATIONS[world], px: 42 }, { text: 'A page returned · Tab to read', px: 25 }]);
        pendingRevelation = !open;
        spread = wi + 1;
      }
      knownCombine[wi] = restored;
    }
    for (let si = 0; si < SECRET_IDS.length; si++) {
      const found = progress.isSecretFound(SECRET_IDS[si]);
      if (found && !knownSecrets[si]) {
        revelation.draw([{ text: SECRET_PAGES[SECRET_IDS[si]].notice, px: 42 }, { text: 'A page returned · Tab to read', px: 25 }]);
        pendingRevelation = !open;
        spread = 4 + si;
      }
      knownSecrets[si] = found;
    }
    if (open) draw();
  });
  draw();
  return { setOpen, isOpen: () => open, step: () => stepPageMap(plane, camera, open, badge, revelation, pendingRevelation), dispose() { unsubscribe(); inputTarget.removeEventListener('keydown', keydown); camera.remove(mesh); camera.remove(badge.mesh); camera.remove(revelation.mesh); revelation.mat.map?.dispose(); revelation.mat.dispose(); revelation.mesh.geometry.dispose(); badge.mat.map?.dispose(); badge.mat.dispose(); badge.mesh.geometry.dispose(); mesh.geometry.dispose(); material.dispose(); texture.dispose(); } };
}
