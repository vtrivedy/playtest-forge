/**
 * Lookdev / render kit for Color Fox.
 *
 * Other streams import from here, e.g.:
 *   import { createColorField, createForgeRenderer, createPostStack } from '../../src/render';
 */

export { createForgeRenderer } from './forgeRenderer';
export type { ForgeRenderer, RendererOptions } from './forgeRenderer';

export { ColorField, createColorField } from './colorField';
export type { ColorFieldOptions, RestoreOptions, RestoreRegion, TrailSample } from './colorField';

export { createPostStack } from './postStack';
export type { PostStack, PostStackOptions, GradeParams } from './postStack';

export { detectQuality, probeGpu } from './quality';
export type { QualityTier, QualitySettings } from './quality';

export { createPaintedSky, applyLookdevLights } from './sky';
export type { PaintedSky, SkyParams } from './sky';

export { applyHeightFog, syncFog, matchFogToSky } from './atmosphere';
export type { HeightFogParams } from './atmosphere';

export { createDistantLand } from './distantLand';
export type { DistantLand, DistantLandOptions } from './distantLand';

export { createStylizedWater } from './water';
export type { StylizedWater } from './water';

export { createWindGrass, createStylizedTree, createMapleTree } from './foliage';
export type { WindFoliage } from './foliage';

export { createFoxWisps } from './wisps';
export type { FoxWisps } from './wisps';

export { createAutumnParticles } from './leaves';
export type { AutumnParticles, AutumnParticleOptions } from './leaves';

export { createEmberMotes } from './emberMotes';
export type { EmberMotes, EmberBurstOptions } from './emberMotes';
