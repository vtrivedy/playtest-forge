/** Shared route buttons. The encoder is built once; each tick returns a pooled key list. */
export type RouteButtons = { jump?: boolean; dash?: boolean; interact?: boolean };

export function createRouteKeyEncoder() {
  const keys = [[], ['Space'], ['ShiftLeft'], ['Space', 'ShiftLeft'],
    ['KeyE'], ['Space', 'KeyE'], ['ShiftLeft', 'KeyE'], ['Space', 'ShiftLeft', 'KeyE']];
  for (let i = 0; i < keys.length; i++) Object.freeze(keys[i]);
  Object.freeze(keys);
  return function encodeRouteKeys(input: RouteButtons): readonly string[] {
    return keys[(input.jump ? 1 : 0) | (input.dash ? 2 : 0) | (input.interact ? 4 : 0)]!;
  };
}
