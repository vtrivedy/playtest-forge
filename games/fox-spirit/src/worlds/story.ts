/** Earned Album testimony. Visibility derives from mechanism facts, never visits. */
import type { WorldId, LevelId } from './progress';
export interface StoryMemory { voice: string; title: string; text: string }
/** The spoken page lines stay short enough to read during the staged reveal. */
export const WORLD_REVELATIONS = {
  russetvale: 'Here the Scribe kept every autumn.',
  ashwater: 'The Scribe pressed the rain first.',
  press: 'I kept autumn. It was the last season we were all here.',
} as const satisfies Record<WorldId, string>;
export const WORLD_STORIES = {
  russetvale: {
    teach: { voice: 'The returned page', title: 'A page going home', text: 'The runaway was never fleeing you. It was trying to return to the Album. Its edges settle around the valley: a whole place, pressed into one page.' },
    develop: { voice: 'A mill ledger', title: 'A moment that cannot finish', text: 'Every entry ends on the same autumn day. The mill stopped; the date did not change. The Scribe kept the season, and everything living in it had to wait.' },
    combine: { voice: 'The Hearthtree page', title: 'Here the Scribe kept every autumn', text: 'An ink-dark watcher stands beyond the trees: the Ash Warden. The Album is real, and this valley is one of its pages. Its footprints lead toward the rain.' },
  },
  ashwater: {
    teach: { voice: 'The Ferrykeeper', title: 'The last crossing', text: 'The heron has held the last ferry for years, pressed in the middle of a wade. The Warden froze the sluices. Even the water has been waiting to finish its journey.' },
    develop: { voice: 'The Ferrykeeper', title: 'Before the endless autumn', text: 'The Scribe once lived beside this marsh. The Ferrykeeper remembers a house, a flood, and the moment the rain stopped moving. The river was their first page.' },
    combine: { voice: 'The Reed Seedwell page', title: 'The Scribe pressed the rain first', text: 'They pressed the flood that took their home, then could not stop pressing. The Ferrykeeper turns her lantern toward winter. At the Press, the Scribe is still keeping the last season.' },
  },
  press: {
    teach: { voice: 'A scorched margin', title: 'The hand behind the marks', text: 'At the Press stands someone small and old. The Scribe has kept every place close enough to touch, yet none of the pressed moments can answer them.' },
    develop: { voice: 'An Archive leaf', title: 'The shadow at the Press', text: 'Every pressed moment left ink behind. In the Archive it gathers into a watcher, following the Scribe without a sound. Neither has been able to leave this last winter.' },
    combine: { voice: 'The Scribe', title: 'The last season we were all here', text: '“I kept autumn because it was the last season we were all here.” The Warden folds into the Scribe’s shadow. The fox offers warmth; the Scribe lets the year turn.' },
  },
} as const satisfies Record<WorldId, Record<LevelId, StoryMemory>>;
