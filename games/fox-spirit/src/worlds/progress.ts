/** World progress: mechanism facts are canonical; abilities and Seedwells are derived. */
export const WORLD_IDS = ['russetvale', 'ashwater', 'press'] as const;
export const LEVEL_IDS = ['teach', 'develop', 'combine'] as const;
export type WorldId = typeof WORLD_IDS[number];
export type LevelId = typeof LEVEL_IDS[number];
export type ActiveWorld = WorldId | 'hub';
export const PROGRESS_SAVE_KEY = 'russet-vale-worlds-v1';
export const WORLD_CATALOGUE = {
  russetvale: { name: 'Russetvale', season: 'Autumn hearthlands', well: 'Kiln', ability: 'Hearthbound', color: '#dc8748', levels: { teach: 'Lanternhollow', develop: 'Millbrook Kiln', combine: 'Hearthtree Keeping' } },
  ashwater: { name: 'Ashwater Reach', season: 'Rain & reedwater', well: 'Reed', ability: 'Reedskim', color: '#56b9b2', levels: { teach: 'Low Sluice', develop: 'Ferry Lantern', combine: 'Weir Heart' } },
  press: { name: 'The Scribe’s Press', season: 'Winter ink', well: 'Maple', ability: 'Inkstep', color: '#a6a9e6', levels: { teach: 'White Margin', develop: 'Folded Archive', combine: 'Wellspring Press' } },
} as const satisfies Record<WorldId, { name: string; season: string; well: string; ability: string; color: string; levels: Record<LevelId, string> }>;
export interface ProgressStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export interface WorldProgressSnapshot {
  activeWorld: ActiveWorld;
  revision: number;
  worlds: Record<WorldId, { visited: LevelId[]; restored: LevelId[]; ability: string | null; well: string; fill: number; next: LevelId | null }>;
}
export interface WorldProgress {
  enterWorld(world: ActiveWorld): void;
  visit(world: WorldId, level: LevelId): boolean;
  complete(world: WorldId, level: LevelId): boolean;
  isVisited(world: WorldId, level: LevelId): boolean;
  isRestored(world: WorldId, level: LevelId): boolean;
  hasAbility(world: WorldId): boolean;
  snapshot(): WorldProgressSnapshot;
  subscribe(fn: () => void): () => void;
  reset(): void;
}
const bit = { teach: 1, develop: 2, combine: 4 } as const;
const prerequisites = { teach: 0, develop: 1, combine: 3 } as const;
/** Storage is injected for deterministic probes; absence/quota failures retain session play. Fresh is boot-only. */
export function createWorldProgress(storage?: ProgressStorage, fresh = false): WorldProgress {
  const restored: Record<WorldId, number> = { russetvale: 0, ashwater: 0, press: 0 };
  const visited: Record<WorldId, number> = { russetvale: 0, ashwater: 0, press: 0 };
  let activeWorld: ActiveWorld = 'hub';
  let revision = 0;
  const listeners = new Set<() => void>();
  try {
    if (fresh) storage?.removeItem(PROGRESS_SAVE_KEY);
    else {
      const raw = storage?.getItem(PROGRESS_SAVE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object' && 'version' in parsed && parsed.version === 1 && 'worlds' in parsed && parsed.worlds && typeof parsed.worlds === 'object') {
        for (const world of WORLD_IDS) {
          const entry = (parsed.worlds as Record<string, unknown>)[world];
          if (!entry || typeof entry !== 'object') continue;
          const facts = entry as { restored?: unknown; visited?: unknown };
          // Only a contiguous prerequisite-valid prefix can restore physical progression.
          if (Array.isArray(facts.restored)) for (const level of LEVEL_IDS) {
            if (!facts.restored.includes(level)) break;
            restored[world] |= bit[level];
          }
          visited[world] = restored[world];
          if (Array.isArray(facts.visited)) for (const level of LEVEL_IDS) if (facts.visited.includes(level)) visited[world] |= bit[level];
        }
      }
    }
  } catch { /* unavailable or malformed save starts safely */ }
  function save() {
    try {
      const worlds = Object.fromEntries(WORLD_IDS.map(world => [world, { restored: LEVEL_IDS.filter(level => (restored[world] & bit[level]) !== 0), visited: LEVEL_IDS.filter(level => (visited[world] & bit[level]) !== 0) }]));
      storage?.setItem(PROGRESS_SAVE_KEY, JSON.stringify({ version: 1, worlds }));
    } catch { /* current-session progress remains authoritative */ }
  }
  function changed(persist: boolean) {
    revision++;
    if (persist) save();
    for (const listener of listeners) listener();
  }
  return {
    enterWorld(world) { if (activeWorld !== world) { activeWorld = world; changed(false); } },
    visit(world, level) {
      if (visited[world] & bit[level]) return false;
      visited[world] |= bit[level]; changed(true); return true;
    },
    complete(world, level) {
      const mask = restored[world];
      if ((mask & bit[level]) || (mask & prerequisites[level]) !== prerequisites[level]) return false;
      restored[world] |= bit[level]; visited[world] |= bit[level]; changed(true); return true;
    },
    isVisited: (world, level) => (visited[world] & bit[level]) !== 0,
    isRestored: (world, level) => (restored[world] & bit[level]) !== 0,
    hasAbility: world => (restored[world] & bit.teach) !== 0,
    snapshot() {
      const worlds = {} as WorldProgressSnapshot['worlds'];
      for (const world of WORLD_IDS) {
        const solved = LEVEL_IDS.filter(level => (restored[world] & bit[level]) !== 0);
        worlds[world] = { visited: LEVEL_IDS.filter(level => (visited[world] & bit[level]) !== 0), restored: solved, ability: restored[world] & 1 ? WORLD_CATALOGUE[world].ability : null, well: WORLD_CATALOGUE[world].well, fill: solved.length / LEVEL_IDS.length, next: LEVEL_IDS.find(level => !(restored[world] & bit[level])) ?? null };
      }
      return { activeWorld, revision, worlds };
    },
    subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    reset() { for (const world of WORLD_IDS) { restored[world] = 0; visited[world] = 0; } activeWorld = 'hub'; changed(true); },
  };
}
