/** Generic invitation follower. The caller supplies only the drawn cue and ordinary movement feedback.
 * Transferable via toString(); no route coordinates, story state, world objects or debug controls.
 */
export function createDiscoveryPolicy() {
  let frame = 0;
  let groundFrames = 0;
  return (cue, movement) => {
    let x = 0, z = 0, jump = false, dash = false;
    groundFrames = movement.grounded ? groundFrames + 1 : 0;
    if (cue?.active && cue.action !== 'wait') {
      const dx = cue.target[0] - movement.pos[0] - (movement.vel?.[0] ?? 0) * 0.18;
      const dz = cue.target[2] - movement.pos[2] - (movement.vel?.[2] ?? 0) * 0.18;
      const distance = Math.hypot(dx, dz);
      const mag = Math.min(1, distance * 1.4);
      if (distance > 0.06) { x = dx / distance * mag; z = dz / distance * mag; }
      dash = ((cue.action === 'dash' && distance < 2.2) || (cue.action === 'unfold' && distance < 2.1)) && frame % 24 === 0;
      jump = cue.action === 'spring' || (cue.action === 'jump' && distance < 4.2) || (cue.action === 'land' && !movement.grounded);
      // Hold through spring loading; a deliberate fresh jump only after dwelling on ordinary ground.
      if (groundFrames > 24 && frame % 36 === 0) jump = false;
      const bearing = Math.atan2(dx, dz);
      const error = Math.atan2(Math.sin(bearing - movement.yaw), Math.cos(bearing - movement.yaw));
      if (dash && Math.abs(error) > 0.22) dash = false;
      if (cue.action === 'unfold' && Math.abs(error) > 0.22) { x *= 0.22; z *= 0.22; }
    }
    frame++;
    return { x, z, jump, dash };
  };
}
