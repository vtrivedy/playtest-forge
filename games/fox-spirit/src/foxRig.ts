// Spirit fox rig contract (playtest-forge-artifacts/sprint2/fox/RIG-CONTRACT.md).
// Bone names by role in assets/hero/spirit_fox.glb. glTF space: +Y up, fox faces +Z, fox's left = +X.
// Chain bones: local +Y runs head -> tail (toward the child), local +X = the fox's left at rest.
// Rest positions change as the mesh is reworked: read them from the loaded skeleton, never hard-code.

export type Side = 'l' | 'r';
export const SIDES: readonly Side[] = ['l', 'r'];

export const FOX_RIG = {
  /** Non-deforming ground origin under the body centre. Move the fox group, not this. */
  root: 'root',
  pelvis: 'pelvis',
  /** pelvis -> chest; spine[3] is the chest / withers that carries the scapulae and neck. */
  spine: ['spine_01', 'spine_02', 'spine_03', 'spine_04'],
  neck: ['neck_01', 'neck_02', 'neck_03'],
  head: 'head',
  /** base -> tip, eight bones; tail_07/08 sit inside the flame plume. */
  tail: ['tail_01', 'tail_02', 'tail_03', 'tail_04', 'tail_05', 'tail_06', 'tail_07', 'tail_08'],
  /** base -> tip */
  ear: (s: Side) => [`ear_01_${s}`, `ear_02_${s}`, `ear_03_${s}`, `ear_04_${s}`],
  /** scapula (withers -> shoulder joint), upperarm, forearm (elbow -> wrist), paw (wrist -> toe tip). */
  foreleg: (s: Side) => ({
    scapula: `scapula_${s}`,
    upper: `upperarm_${s}`,
    lower: `forearm_${s}`,
    paw: `front_paw_${s}`,
  }),
  /** hip stub, thigh (hip -> stifle), shin (stifle -> hock), foot (metatarsus, hock -> paw), paw (-> toe tip). */
  hindleg: (s: Side) => ({
    hip: `hip_${s}`,
    thigh: `thigh_${s}`,
    shin: `shin_${s}`,
    foot: `hind_foot_${s}`,
    paw: `hind_paw_${s}`,
  }),
  /** Spirit-flame card bones driven by the fox look code / clips. Locomotion must not write these. */
  fx: [
    'fx_cheek_l', 'fx_cheek_r', 'fx_ear_l', 'fx_ear_r', 'fx_nape', 'fx_bib',
    'fx_plume_a', 'fx_plume_b', 'fx_plume_c',
  ],
} as const;

export const FOX_CLIPS = ['idle', 'run', 'jump_up', 'jump_apex', 'jump_fall', 'glide', 'dash', 'land', 'burst'] as const;
export type FoxClip = (typeof FOX_CLIPS)[number];
