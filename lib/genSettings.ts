// Generation Settings stubbed for pure client pass-through architecture
// Sampling parameters are directly controlled by client sliders (Janitor AI / SillyTavern)

export interface GenerationSettings {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  min_p?: number;
  min_k?: number;
  top_a?: number;
  typical_p?: number;
  tfs?: number;
  repetition_penalty?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  thinking_budget?: number;
  reasoning_effort?: 'off' | 'low' | 'medium' | 'high' | 'max';
  dynatemp_low?: number;
  dynatemp_high?: number;
  mirostat?: number;
  mirostat_tau?: number;
  mirostat_eta?: number;
  seed?: number;
  [key: string]: any;
}

export const DEFAULT_GENERATION_SETTINGS: Record<string, any> = {
  temperature: 0.7,
  max_tokens: 8192,
  top_p: 0.95,
  top_k: 40,
  min_p: 0.05,
  min_k: 0,
  top_a: 0.0,
  typical_p: 1.0,
  tfs: 1.0,
  repetition_penalty: 1.05,
  frequency_penalty: 0.0,
  presence_penalty: 0.0,
  thinking_budget: 24576,
  reasoning_effort: 'high',
};

export async function getGlobalGenSettings(_forceRefresh = false): Promise<GenerationSettings> {
  return {};
}

export async function saveGlobalGenSettings(_settings: GenerationSettings): Promise<void> {}
export async function resetGlobalGenSettings(): Promise<GenerationSettings> {
  return {};
}

export function sanitizeGenSettings(settings: Partial<GenerationSettings>): Partial<GenerationSettings> {
  return settings || {};
}

export function getCachedSessionGenSettings(_chatId: string): Partial<GenerationSettings> | null | undefined {
  return undefined;
}

export function setCachedSessionGenSettings(_chatId: string, _settings: Partial<GenerationSettings> | null): void {}
export function clearCachedSessionGenSettings(_chatId: string): void {}

export function parseGenerationSettingsString(_input: string): { settings: Partial<GenerationSettings>; parsedSummary: string[] } {
  return { settings: {}, parsedSummary: [] };
}

export function generateGenSettingsMenu(_currentSettings?: any, _notice?: string): string {
  return '⚙️ [ANTIGRAVITY ROLEPLAY SAMPLING]\n\nPure client pass-through is active. Sampling is controlled by your client sliders.';
}

export async function executeGenSettingsCommand(_cmd: any, _session?: any): Promise<string> {
  return '⚙️ [ANTIGRAVITY ROLEPLAY SAMPLING]\n\nPure client pass-through is active. Sampling is controlled by your client sliders.';
}

export function mergeGenerationSettings(
  _defaults: any,
  _globalSettings: any,
  clientBody: any,
  _sessionOverrides?: any
): any {
  return clientBody || {};
}
