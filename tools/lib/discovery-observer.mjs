/** Observe drawn paper fragments and the shown teach line, without reading the guide's goal/action/leg.
 * Projection bounds are checked; this is geometry observation, not pixel vision or an occlusion guarantee.
 */
export function createDiscoveryObserver(scene, camera, fox) {
  const mesh = scene.getObjectByName('page-invitation');
  if (!mesh) throw new Error('No rendered paper invitation');
  const teachPanel = camera.children.find(n => n.material?.map?.image?.width === 2560 && n.material?.map?.image?.height === 128);
  if (!teachPanel) throw new Error('No rendered teach panel');
  const matrix = fox.matrix.clone();
  const world = fox.position.clone();
  const screen = fox.position.clone();
  const target = [0, 0, 0];
  const cue = { active: false, target, action: 'follow', search: false };
  let seenAt = -Infinity;
  return (t, shown) => {
    if (!mesh.visible) { cue.active = false; cue.search = false; return cue; }
    let visible = false;
    // Prefer the furthest fragment still in the actual camera's viewport.
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      world.setFromMatrixPosition(matrix);
      mesh.localToWorld(world);
      screen.copy(world).project(camera);
      if (screen.z > -1 && screen.z < 1 && Math.abs(screen.x) < 0.94 && Math.abs(screen.y) < 0.94) {
        visible = true;
        target[0] = world.x; target[1] = world.y; target[2] = world.z;
      }
    }
    if (visible) seenAt = t;
    cue.active = visible || t - seenAt < 0.75;
    cue.search = !cue.active;
    const words = teachPanel.visible && teachPanel.material.opacity >= 0.6 ? shown : null;
    if (/land on the overlook/i.test(words ?? '')) cue.action = 'land';
    else if (/dash into/.test(words ?? '')) cue.action = 'unfold';
    else if (/dash to catch/.test(words ?? '')) cue.action = 'dash';
    else if (/hold to spring/.test(words ?? '')) cue.action = 'spring';
    else if (/jump across/.test(words ?? '')) cue.action = 'jump';
    else if (/unfold/.test(words ?? '')) cue.action = 'wait';
    else cue.action = 'follow';
    return cue;
  };
}
