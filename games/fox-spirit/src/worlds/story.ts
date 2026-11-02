/** Earned Album testimony. Visibility is derived from mechanism facts, never visits. */
import type { WorldId, LevelId } from './progress';
export interface StoryMemory { voice: string; title: string; text: string }
export const WORLD_STORIES = {
  russetvale: {
    teach: { voice: 'The returned page', title: 'The last hearth-fox', text: 'The page holds a fox-shaped space where the ink would not settle. The autumn was pressed flat, but one small warmth escaped its edges. Yours.' },
    develop: { voice: 'A mill ledger', title: 'A year without a winter', text: 'Every entry ends on the same autumn day. The mill stopped; the date did not change. Someone kept the season, and everything living in it had to wait.' },
    combine: { voice: 'The Hearthtree page', title: 'Beyond the familiar trees', text: 'The roots reach past the village into rain-dark country. This was never the whole world. The same ink runs through the marsh and back toward the Press.' },
  },
  ashwater: {
    teach: { voice: 'A water-stained page', title: 'Rain that remembers', text: 'Under the pale surface, the old water still remembers where it used to run. The Press flattened a place; it could not erase every trace of its life.' },
    develop: { voice: 'An ink silhouette', title: 'The shape inside the stain', text: 'A Shade is an outline caught in ink. When warmth breaks its hold, the outline can move again. The darkness is holding something, not merely hiding it.' },
    combine: { voice: 'The Reed Seedwell page', title: 'Upstream', text: 'The rain carries loosened ink toward the winter country. There is a hand behind these marks. Beyond the reeds, the Scribe’s Press is still holding the year.' },
  },
  press: {
    teach: { voice: 'A scorched margin', title: 'Warmth between the lines', text: 'Even here, beneath winter ink, warmth can open a margin. The Press has not made the world lifeless. It has made the living world wait.' },
    develop: { voice: 'An Archive leaf', title: 'A world made small', text: 'The Archive keeps a place in every fold: a village, a river, a season. What was wide enough to wander has been made small enough to keep.' },
    combine: { voice: 'The Wellspring page', title: 'The year can turn', text: 'The ink no longer holds every edge. Water and warmth have found a way through. What returns will have room to change, and a season after autumn.' },
  },
} as const satisfies Record<WorldId, Record<LevelId, StoryMemory>>;
