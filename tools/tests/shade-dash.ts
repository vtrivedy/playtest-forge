import * as THREE from 'three';
import assert from 'node:assert/strict';
import { ShadeContact, dashContact, touchShade, crossesShade } from '../../games/fox-spirit/src/encounters/contact.ts';
// Pure contact rules against main.ts's ground kinematics (dash 20 m/s for 0.2 s, then damp to run speed).
const FEEL = { moveSpeed: 8.4, groundAccel: 5.5, dashSpeed: 20, dashDuration: 0.2 };
const HIT_RADIUS = 1.1, KNOCKBACK = 3, GRACE = 1, DT = 1 / 60;
const damp = (x: number, y: number, l: number, dt: number) => x + (y - x) * (1 - Math.exp(-l * dt));

/** Run along +z at a Shade standing at `shadeZ`; optionally dash at `dashAt` seconds. */
function run(shadeZ: number, opts: { dashAt?: number; seconds?: number; wishZ?: number } = {}) {
  const contact = new ShadeContact(), shade = { freed: false }, origin = new THREE.Vector3(0, 0, shadeZ);
  const fox = new THREE.Vector3(), prev = new THREE.Vector3();
  let vz = opts.dashAt === undefined ? FEEL.moveSpeed : 0, dashT = -1, t = 0;
  const events: Array<{ type: 'freed' | 'hit'; t: number; z: number }> = [], knockbackDuringDash: number[] = [];
  const wish = opts.wishZ ?? 1;
  while (t < (opts.seconds ?? 1.5)) {
    if (opts.dashAt !== undefined && Math.abs(t - opts.dashAt) < DT / 2 && dashT <= -0.2) {
      dashT = FEEL.dashDuration; vz = wish * FEEL.dashSpeed; contact.cancelKnockback();
    }
    const wasDashing = dashT > 0;
    dashT -= DT;
    if (dashT <= 0) vz = damp(vz, wish * FEEL.moveSpeed, FEEL.groundAccel, DT);
    prev.copy(fox);
    fox.z += vz * DT;
    const before = contact.travel;
    contact.update(DT, (dx, dz) => { fox.x += dx; fox.z += dz; return Math.hypot(dx, dz); });
    const dashing = dashContact(wasDashing, dashT, Math.abs(vz), FEEL.moveSpeed);
    if (dashing) knockbackDuringDash.push(contact.travel - before);
    const touch = touchShade(shade, prev, fox, origin, HIT_RADIUS, dashing);
    if (touch === 'freed') { contact.frees++; events.push({ type: 'freed', t, z: fox.z }); }
    else if (touch === 'hit' && contact.hit(fox, origin, KNOCKBACK, GRACE)) events.push({ type: 'hit', t, z: fox.z });
    t += DT;
  }
  return { contact, shade, events, fox, knockbackDuringDash };
}

// Pass-through: a dash whose timer, or post-dash skid, crosses the Shade frees it with zero knockback.
for (const shadeZ of [2, 3.5, 5, 6.5, 7.5]) {
  const r = run(shadeZ, { dashAt: 0, seconds: 0.6 });
  assert.equal(r.shade.freed, true, `dash should free a Shade ${shadeZ} m ahead`);
  assert.equal(r.contact.hits, 0, `dash into a Shade ${shadeZ} m ahead must not hit`);
  assert.equal(r.contact.wisps, 3);
  assert.equal(r.contact.state().knockbackTravel, 0, `no knockback travel dashing through ${shadeZ} m`);
  assert.ok(r.fox.z > shadeZ + HIT_RADIUS, `fox keeps going through the Shade at ${shadeZ} m (z=${r.fox.z.toFixed(2)})`);
}

// Past the skid the dash is spent: a Shade well beyond its reach is plain contact again.
{
  const r = run(11, { dashAt: 0, seconds: 1.2 });
  assert.equal(r.shade.freed, false);
  assert.equal(r.contact.hits, 1);
}

// Release exactly once: a freed Shade never frees or hits again, even when crossed repeatedly.
{
  const r = run(3, { dashAt: 0, seconds: 0.6 });
  assert.equal(r.events.filter(e => e.type === 'freed').length, 1);
  assert.equal(r.contact.frees, 1);
  const shade = r.shade, origin = new THREE.Vector3(0, 0, 3);
  for (const dashing of [true, false, true]) {
    assert.equal(touchShade(shade, new THREE.Vector3(0, 0, 6), new THREE.Vector3(0, 0, 0), origin, HIT_RADIUS, dashing), null);
  }
}

// Non-dash contact still knocks back and costs one wisp (grace blocks immediate re-hits).
{
  const r = run(4, { seconds: 1.2 });
  assert.equal(r.shade.freed, false);
  assert.equal(r.contact.hits, 1);
  assert.equal(r.contact.wisps, 2);
  assert.ok(r.contact.travel > 2.5, `walk-in knockback should travel ~${KNOCKBACK} m, got ${r.contact.travel}`);
  assert.equal(r.events[0]!.type, 'hit');
}

// A dash cancels knockback still in flight from an earlier hit, then frees the same Shade.
{
  const contact = new ShadeContact(), fox = new THREE.Vector3(0, 0, 3);
  contact.hit(fox, new THREE.Vector3(0, 0, 4), KNOCKBACK, GRACE);
  contact.update(DT, (dx, dz) => Math.hypot(dx, dz));
  const pushed = contact.travel;
  contact.cancelKnockback();
  contact.update(DT, (dx, dz) => Math.hypot(dx, dz));
  assert.equal(contact.travel, pushed, 'cancelled knockback must not keep moving the fox');
  // Invulnerability after a hit does not stop a dash from freeing.
  const shade = { freed: false };
  assert.equal(touchShade(shade, new THREE.Vector3(0, 0, 2), new THREE.Vector3(0, 0, 2.8), new THREE.Vector3(0, 0, 4), HIT_RADIUS, true), 'freed');
}

// Dash window: the skid only counts while faster than a run and shortly after the timer.
assert.equal(dashContact(true, -0.01, 0, 8.4), true);
assert.equal(dashContact(false, -0.1, 15, 8.4), true);
assert.equal(dashContact(false, -0.1, 8.4, 8.4), false, 'running speed is not a dash');
assert.equal(dashContact(false, -0.3, 15, 8.4), false, 'long after the dash is not a dash');
// Sweep: a fast segment through the cylinder hits even when both endpoints are outside it.
assert.equal(crossesShade(new THREE.Vector3(0, 0, -3), new THREE.Vector3(0, 0, 3), new THREE.Vector3(), 1.1), true);
assert.equal(crossesShade(new THREE.Vector3(0, 4, -3), new THREE.Vector3(0, 4, 3), new THREE.Vector3(), 1.1), false, 'over the animal');
console.log('shade-dash: ok');
