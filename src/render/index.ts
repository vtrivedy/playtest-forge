/**
 * Lookdev / render kit for Color Fox.
 *
 * Other streams import from here, e.g.:
 *   import { createColorField, createForgeRenderer, createPostStack } from '../../src/render';
 */

export { createForgeRenderer } from './forgeRenderer';
export type { ForgeRenderer, RendererOptions } from './forgeRenderer';

export { ColorField, PaintLayer, createColorField } from './colorField';
export type { RestoreRegion } from './colorField';

export { createPostStack } from './postStack';
export type { PostStack } from './postStack';

export { detectQuality } from './quality';

export { createPaintedSky, applyLookdevLights } from './sky';
export type { PaintedSky } from './sky';

export { applyHeightFog, syncFog, matchFogToSky } from './atmosphere';
export type { HeightFogParams } from './atmosphere';

export { createDistantLand } from './distantLand';

export { createStylizedWater } from './water';

export { createAutumnParticles } from './leaves';
export type { AutumnParticles } from './leaves';

export { createEmberMotes } from './emberMotes';
export { createPaintSprouts } from './paintSprouts';
export type { EmberMotes } from './emberMotes';
