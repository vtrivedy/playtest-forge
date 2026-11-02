/**
 * Hearthsong: the slice's one song, as text (DESIGN-music-ember.md). A lullaby waltz in C major, 3/4 at 72 bpm.
 * The worklet plays it forever: a 16-bar tune, then a 2-bar breath, then the next tune (they alternate). Places and the story change who plays it and
 * how bright it is, never where in the tune we are, so moving between places continues the melody.
 *
 * Tune bars are six eighth-note slots: a scale degree (1–7, `'` = octave up, `,` = octave down) starts a note,
 * `-` holds it, `.` is a rest. Chords are scale degrees (1 = I, 6 = vi …) per bar.
 */
import { CANOPY, GLYPHS, HEARTH_A, KEEPING, POP_UP_RUIN, VISTA, WELL } from '../layout';

export const SONG = {
  bpm: 72,
  /** eighth-note slots per bar (3/4) */
  slots: 6,
  /** MIDI of degree 1 in the tune's middle octave (C4) */
  key: 60,
  breathBars: 2,
  /** passes alternate through these; each is 16 bars over its own chords */
  tunes: [
    {
      name: 'hearth',
      chords: '1 6 4 5  1 3 4 5  6 4 1 5  4 1 5 1',
      /** the hollow places borrow these instead (same tune on top: I→vi, IV→ii, V→iii) */
      shade: '6 4 2 3  6 3 2 3  6 2 6 3  2 6 3 6',
      bars: [
        '5 - - - 3 4', '5 - - - 6 5', '4 - - - 3 2', '2 - - - - -',
        "3 - - - 5 1'", '7 - - - 6 5', '6 - - 5 4 3', '2 - - - - .',
        "6 - - - 1' 7", '6 - - - 5 4', '5 - - - 3 5', "2' - - - 1' 7",
        '6 - - - 4 6', '5 - - - 3 2', '2 - 3 - 7, -', '1 - - - - .',
      ],
    },
    {
      name: 'lantern',
      chords: '4 1 5 6  4 1 2 5  1 5 6 3  4 1 5 1',
      shade: '2 6 3 6  2 6 2 3  6 3 6 3  2 6 3 6',
      bars: [
        '6 - - - 5 4', '3 - - - 2 1', '2 - - - 5 -', '3 - - - - .',
        "4 - - - 6 1'", '5 - - - 4 3', '4 - - - 6 4', '2 - - - - .',
        "5 - - - 1' 2'", "2' - - - 7 5", "1' - - - 7 6", '7 - - - - .',
        "6 - - - 1' 6", '5 - - - 3 1', '2 - - - 7, 2', '1 - - - - .',
      ],
    },
    {
      // Millbrook's own tune: more running eighths, like water; every other pass while the fox is in the valley
      name: 'millbrook',
      places: ['millbrook', 'orchard', 'lookout'],
      chords: '1 5 6 4  1 5 4 4  6 3 4 1  2 5 1 1',
      shade: '6 3 6 2  6 3 2 2  6 3 2 6  2 3 6 6',
      bars: [
        "1' 7 6 5 - 3", '2 - 5 - 7 -', "1' - 7 6 - 5", '6 - - - - .',
        '5 6 5 3 - 1', '2 - 5 4 3 2', '1 - 6, - 1 -', '2 - - - - .',
        "3 - 6 - 1' -", '7 - 5 - 3 -', "4 - 6 - 1' 6", '5 - - - - .',
        '4 - 2 - 6 4', "5 - 7 - 2' -", "1' 7 1' 5 3 2", '1 - - - - .',
      ],
    },
    {
      // the Scribe's Hermitage: long notes, starting on the relative minor — someone who kept every autumn
      name: 'scribe',
      places: ['hermitage', 'hillside'],
      chords: '6 4 1 5  6 4 2 3  4 5 3 6  2 5 1 1',
      shade: '6 2 6 3  6 2 2 3  2 3 3 6  2 3 6 6',
      bars: [
        '3 - - - 1 -', '6, - - - 1 2', '3 - - - 5 -', '5 - - - - .',
        "1' - - - 7 6", '6 - - - 5 4', '4 - - - 3 2', '3 - - - - .',
        "4 - - - 6 1'", "2' - - - 7 5", '7 - - - 5 3', '6 - - - - .',
        '6 - - - 4 2', '7, - - - 2 4', '3 - - - 2 -', '1 - - - - .',
      ],
    },
  ] as ReadonlyArray<{ name: string; places?: string[]; chords: string; shade: string; bars: string[] }>,
};

/** a sung swell: the lead joins for this many bars from the next bar line, then fades; ≥ gap bars between starts */
export const SWELL = { bars: 8, fade: 3, gap: 12 };

export type Colour = { harp: number; pad: number; bass: number; lead: number; bells: number; bright: number; shade: number };

/** away from every place: the open meadow between them */
export const WILD: Colour = { harp: 0.8, pad: 0.6, bass: 0.5, lead: 0.5, bells: 0, bright: 0.5, shade: 0 };

/**
 * Places the music leans into: full colour inside `r`, blending back to WILD by `2r`. Add new places here.
 * harp = arpeggio density, pad/bass/lead = level, bells = sparkle, bright = filter, shade = borrowed minor chords.
 */
export const PLACES: ReadonlyArray<{ id: string; x: number; z: number; r: number; c: Colour }> = [
  { id: 'village', x: WELL.x, z: WELL.z, r: 12, c: { harp: 1, pad: 0.9, bass: 0.8, lead: 0.7, bells: 0, bright: 0.45, shade: 0 } },
  { id: 'hearth', x: HEARTH_A.x, z: HEARTH_A.z, r: 7, c: { harp: 0.9, pad: 1, bass: 0.9, lead: 0.5, bells: 0, bright: 0.35, shade: 0 } },
  { id: 'canopy', x: CANOPY[2].x, z: CANOPY[2].z, r: 7, c: { harp: 1, pad: 0.5, bass: 0.3, lead: 0.6, bells: 0.5, bright: 0.8, shade: 0 } },
  { id: 'ruin', x: POP_UP_RUIN.entry.x - 2, z: POP_UP_RUIN.entry.z - 3, r: 8, c: { harp: 0.55, pad: 0.85, bass: 0.3, lead: 0.4, bells: 0, bright: 0.32, shade: 0.8 } },
  { id: 'glyphs', x: (GLYPHS.stones[0].x + GLYPHS.stones[2].x) / 2, z: (GLYPHS.stones[0].z + GLYPHS.stones[2].z) / 2, r: 8, c: { harp: 0.5, pad: 0.9, bass: 0.4, lead: 0.4, bells: 0.3, bright: 0.4, shade: 0.7 } },
  { id: 'keeping', x: KEEPING.hinge.x, z: KEEPING.hinge.z, r: 9, c: { harp: 1, pad: 1, bass: 0.7, lead: 0.8, bells: 0.4, bright: 0.65, shade: 0 } },
  // Bramble's Millbrook (west): the sunken lane, the mill on the brook, the orchard, and the lookout where the tune blooms
  { id: 'leaf-lane', x: -50, z: 89, r: 8, c: { harp: 0.7, pad: 0.6, bass: 0.4, lead: 0.4, bells: 0, bright: 0.4, shade: 0.4 } },
  { id: 'millbrook', x: -74, z: 94, r: 14, c: { harp: 1, pad: 0.7, bass: 0.7, lead: 0.6, bells: 0.3, bright: 0.6, shade: 0 } },
  { id: 'orchard', x: -91, z: 88, r: 8, c: { harp: 0.9, pad: 0.8, bass: 0.6, lead: 0.7, bells: 0.2, bright: 0.6, shade: 0 } },
  { id: 'lookout', x: -100, z: 71, r: 10, c: { harp: 0.8, pad: 1, bass: 0.6, lead: 1, bells: 0.5, bright: 0.8, shade: 0 } },
  // Bramble's Scribe's Hermitage (north): the hanger lane up, then the plateau with the desk and the view
  { id: 'hillside', x: -10, z: 112, r: 10, c: { harp: 0.8, pad: 0.7, bass: 0.5, lead: 0.5, bells: 0.1, bright: 0.5, shade: 0.2 } },
  { id: 'hermitage', x: -6.5, z: 133, r: 11, c: { harp: 0.7, pad: 1, bass: 0.4, lead: 0.9, bells: 0.4, bright: 0.6, shade: 0.45 } },
  // Wren's finale hollow below the far crag (the Scribe's Press)
  { id: 'hollow', x: 20, z: 42, r: 10, c: { harp: 0.6, pad: 1, bass: 0.4, lead: 0.8, bells: 0.4, bright: 0.55, shade: 0.3 } },
  { id: 'vista', x: VISTA.x + VISTA.dx * 6, z: VISTA.z + VISTA.dz * 6, r: 8, c: { harp: 0.6, pad: 1, bass: 0.5, lead: 1, bells: 0.6, bright: 0.8, shade: 0 } },
];

const SCALE = [0, 2, 4, 5, 7, 9, 11];
/** semitones above the key for a scale degree (1-based, may run past 7) */
function degree(d: number): number {
  const i = d - 1;
  return SCALE[((i % 7) + 7) % 7]! + 12 * Math.floor(i / 7);
}

/** the score flattened to numbers for the worklet (sent once, at construction) */
export function compileSong() {
  const bars = SONG.tunes[0]!.bars.length;
  const chords: number[] = [];
  const shade: number[] = [];
  // per slot: MIDI note, -1 = hold, -2 = rest (tunes back to back)
  const tune: number[] = [];
  let placed = false;
  for (const t of SONG.tunes) {
    if (placed && !t.places) throw new Error(`Hearthsong: rotation tune ${t.name} must come before place tunes`);
    placed ||= !!t.places;
    const c = t.chords.trim().split(/\s+/).map(Number);
    const sh = t.shade.trim().split(/\s+/).map(Number);
    if (t.bars.length !== bars || c.length !== bars || sh.length !== bars) throw new Error(`Hearthsong: tune ${t.name} needs ${bars} bars and chords`);
    chords.push(...c);
    shade.push(...sh);
  }
  for (const bar of SONG.tunes.flatMap((t) => t.bars)) {
    const toks = bar.trim().split(/\s+/);
    if (toks.length !== SONG.slots) throw new Error(`Hearthsong: bar "${bar}" needs ${SONG.slots} slots`);
    for (const t of toks) {
      if (t === '-') tune.push(-1);
      else if (t === '.') tune.push(-2);
      else {
        const up = (t.match(/'/g) ?? []).length - (t.match(/,/g) ?? []).length;
        tune.push(SONG.key + degree(Number(t.replace(/[',]/g, ''))) + 12 * up);
      }
    }
  }
  // per bar: triad as semitones above the key, root position
  const triad = (d: number) => [degree(d), degree(d + 2), degree(d + 4)];
  return {
    bpm: SONG.bpm,
    slots: SONG.slots,
    key: SONG.key,
    bars,
    tunes: SONG.tunes.length,
    /** tunes without places rotate everywhere; a place tune takes every other pass while its place leads */
    rotation: SONG.tunes.filter((t) => !t.places).length,
    breathBars: SONG.breathBars,
    tune,
    chords: chords.flatMap(triad),
    shadeChords: shade.flatMap(triad),
    swell: SWELL,
  };
}
export type CompiledSong = ReturnType<typeof compileSong>;

/** the tune a place asks for (index into SONG.tunes), or -1 */
export function themeOf(placeId: string): number {
  return SONG.tunes.findIndex((t) => t.places?.includes(placeId));
}
