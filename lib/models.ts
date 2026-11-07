import { ModelSpec, FALLBACK_MODELS, OPENCODE_MODEL_SPECS, ALL_MODELS } from './antigravity';
import { OPENCODE_MODELS, OpenCodeModelSpec, resolveOpenCodeModel } from './opencode';

export type { ModelSpec, OpenCodeModelSpec };
export { FALLBACK_MODELS, OPENCODE_MODEL_SPECS, ALL_MODELS, OPENCODE_MODELS, resolveOpenCodeModel };

export const SUPPORTED_MODELS: ModelSpec[] = ALL_MODELS;
export default SUPPORTED_MODELS;
