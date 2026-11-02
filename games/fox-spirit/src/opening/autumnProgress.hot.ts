import type { WorldProgress } from '../worlds/progress';

/** Physical facts remain readable so an early Keeping solve waits for the Millbrook prerequisite. */
export function syncAutumnProgress(progress: WorldProgress, pageHome: boolean, kilnLit: boolean, treeSettled: boolean): void {
  if (pageHome) progress.complete('russetvale', 'teach');
  if (kilnLit) progress.complete('russetvale', 'develop');
  if (treeSettled) progress.complete('russetvale', 'combine');
}
