import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export interface OpenCodeModelSpec {
  id: string;
  name: string;
  tier: string;
  badge: string;
  thinking: string;
  context: string;
  desc: string;
  wireModel: string;
  isFast: boolean;
}

export interface OpenCodeGuestAccount {
  id: string;
  name: string;
  sessionId: string;
  cooldownUntil: number;
  failCount: number;
  successCount: number;
}

// Canonical OpenCode ID generation algorithm reverse-engineered from local CLI (@opencode/cli v2.0.26)
const D = 26;
const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
let lastIdTimestamp = 0;
let idCounter = 0;

/**
 * Generate OpenCode canonical ID matching OpenCode CLI's dz() generator:
 * - descending (ses_): inverted timestamp, used for sessions
 * - ascending (msg_): normal timestamp, used for messages/requests
 */
export function generateOpenCodeId(isDescending: boolean, prefix = ''): string {
  const now = Date.now();
  if (now !== lastIdTimestamp) {
    lastIdTimestamp = now;
    idCounter = 0;
  }
  idCounter++;
  const counterVal = BigInt(now) * 0x1000n + BigInt(idCounter);
  const timeVal = isDescending ? ~counterVal : counterVal;
  const hexPrefix = Array.from({ length: 6 }, (_, m) =>
    Number((timeVal >> BigInt(40 - 8 * m)) & 0xffn)
      .toString(16)
      .padStart(2, '0')
  ).join('');
  const randomBytes = crypto.getRandomValues(new Uint8Array(D - 12));
  const base62Suffix = Array.from(randomBytes, (d) => BASE62_CHARS[d % 62]).join('');
  return prefix + hexPrefix + base62Suffix;
}

export function generateOpenCodeSessionId(): string {
  return generateOpenCodeId(true, 'ses_');
}

export function generateOpenCodeRequestId(): string {
  return generateOpenCodeId(false, 'msg_');
}

export const OPENCODE_USER_AGENT = 'opencode/2.0.26 ai-sdk/provider-utils/4.0.21 runtime/bun/1.4.2';

// OpenCode CLI official tools definitions required by upstream free tier gate
export const OPENCODE_OFFICIAL_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'bash',
      description: 'Execute a bash command in the terminal.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The bash command to execute' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read',
      description: 'Read the contents of a file or directory. Each line is prefixed with line numbers.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File or directory to read' },
          offset: { type: 'number', description: 'Line or directory entry offset (1-based)' },
          limit: { type: 'number', description: 'Maximum lines or entries to read (default 2000)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write',
      description: 'Writes a file to the local filesystem, overwriting if one exists.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file to write to' },
          content: { type: 'string', description: 'Content to write to the file' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit',
      description: 'Edit a file by replacing target text with new text.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File to edit' },
          oldString: { type: 'string', description: 'Exact text to find and replace' },
          newString: { type: 'string', description: 'Replacement text' },
        },
        required: ['path', 'oldString', 'newString'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'glob',
      description: 'Find files matching a glob pattern.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern to match files against' },
          directory: { type: 'string', description: 'Directory to search in' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'grep',
      description: 'Search for text or regex pattern across files.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regular expression or literal text to match' },
          path: { type: 'string', description: 'File or directory to search' },
        },
        required: ['pattern'],
      },
    },
  },
];

// Verified working OpenCode free models & their no-think / fast variants
export const OPENCODE_MODELS: OpenCodeModelSpec[] = [
  // 1. Big Pickle (DeepSeek Reasoning & Fast)
  {
    id: 'big-pickle',
    name: 'Big Pickle (DeepSeek Thinking)',
    tier: 'OpenCode / DeepSeek',
    badge: 'DeepSeek Thinking',
    thinking: 'Enabled',
    context: '128K Context',
    desc: 'DeepSeek reasoning model on OpenCode with deep chain-of-thought analysis.',
    wireModel: 'big-pickle',
    isFast: false,
  },
  {
    id: 'big-pickle-fast',
    name: 'Big Pickle (Fast / No-Think)',
    tier: 'OpenCode / Fast',
    badge: 'No-Think',
    thinking: 'Disabled (0 Tokens)',
    context: '128K Context',
    desc: 'Big Pickle with reasoning disabled for instantaneous response speed.',
    wireModel: 'big-pickle',
    isFast: true,
  },

  // 2. Space Bunny Free / Snow Bunny (Reasoning & Fast)
  {
    id: 'space-bunny-free',
    name: 'Space Bunny Free (Snow Bunny)',
    tier: 'OpenCode / Reasoning',
    badge: 'Bunny Reasoning',
    thinking: 'Enabled',
    context: '128K Context',
    desc: 'Space Bunny (Snow Bunny) high-capacity reasoning model on OpenCode free tier.',
    wireModel: 'space-bunny-free',
    isFast: false,
  },
  {
    id: 'space-bunny-free-fast',
    name: 'Space Bunny Free (Fast / No-Think)',
    tier: 'OpenCode / Fast',
    badge: 'No-Think',
    thinking: 'Disabled (0 Tokens)',
    context: '128K Context',
    desc: 'Space Bunny Free with reasoning disabled for high-speed dialogue.',
    wireModel: 'space-bunny-free',
    isFast: true,
  },

  // 3. Cat Jam Free (Reasoning & Fast)
  {
    id: 'cat-jam-free',
    name: 'Cat Jam Free',
    tier: 'OpenCode / Reasoning',
    badge: 'Cat Jam Thinking',
    thinking: 'Enabled',
    context: '128K Context',
    desc: 'Cat Jam high-speed reasoning model on OpenCode free tier.',
    wireModel: 'cat-jam-free',
    isFast: false,
  },
  {
    id: 'cat-jam-free-fast',
    name: 'Cat Jam Free (Fast / No-Think)',
    tier: 'OpenCode / Fast',
    badge: 'No-Think',
    thinking: 'Disabled (0 Tokens)',
    context: '128K Context',
    desc: 'Cat Jam Free with reasoning disabled for rapid completions.',
    wireModel: 'cat-jam-free',
    isFast: true,
  },

  // 4. Xiaomi MiMo v2.6 Flash Free (Upgraded from v2.5) & Fast
  {
    id: 'mimo-v2.6-flash-free',
    name: 'Xiaomi MiMo v2.6 Flash Free',
    tier: 'OpenCode / Xiaomi',
    badge: 'MiMo Reasoning',
    thinking: 'Enabled',
    context: '128K Context',
    desc: 'Xiaomi MiMo v2.6 Flash flagship multimodal reasoning model on OpenCode.',
    wireModel: 'mimo-v2.6-flash-free',
    isFast: false,
  },
  {
    id: 'mimo-v2.6-flash-free-fast',
    name: 'Xiaomi MiMo v2.6 Flash Free (Fast / No-Think)',
    tier: 'OpenCode / Fast',
    badge: 'No-Think',
    thinking: 'Disabled (0 Tokens)',
    context: '128K Context',
    desc: 'Xiaomi MiMo v2.6 Flash with reasoning disabled for rapid dialog generation.',
    wireModel: 'mimo-v2.6-flash-free',
    isFast: true,
  },
  {
    id: 'mimo-v2.5-free',
    name: 'Xiaomi MiMo v2.5 Free (Auto-Upgraded to v2.6)',
    tier: 'OpenCode / Xiaomi',
    badge: 'MiMo Reasoning',
    thinking: 'Enabled',
    context: '128K Context',
    desc: 'Legacy MiMo v2.5 alias seamlessly upgraded to active MiMo v2.6 Flash upstream.',
    wireModel: 'mimo-v2.6-flash-free',
    isFast: false,
  },
  {
    id: 'mimo-v2.5-free-fast',
    name: 'Xiaomi MiMo v2.5 Free (Fast / No-Think)',
    tier: 'OpenCode / Fast',
    badge: 'No-Think',
    thinking: 'Disabled (0 Tokens)',
    context: '128K Context',
    desc: 'Legacy MiMo v2.5 Fast alias seamlessly upgraded to active MiMo v2.6 Flash Fast.',
    wireModel: 'mimo-v2.6-flash-free',
    isFast: true,
  },

  // 5. Meituan LongCat 2.5 Preview Free & Fast
  {
    id: 'longcat-2.5-preview-free',
    name: 'Meituan LongCat 2.5 Preview Free',
    tier: 'OpenCode / Meituan',
    badge: 'LongCat Reasoning',
    thinking: 'Enabled',
    context: '128K Context',
    desc: 'Meituan LongCat 2.5 Preview extended-context reasoning model on OpenCode.',
    wireModel: 'longcat-2.5-preview-free',
    isFast: false,
  },
  {
    id: 'longcat-2.5-preview-free-fast',
    name: 'Meituan LongCat 2.5 Preview Free (Fast / No-Think)',
    tier: 'OpenCode / Fast',
    badge: 'No-Think',
    thinking: 'Disabled (0 Tokens)',
    context: '128K Context',
    desc: 'Meituan LongCat 2.5 Preview with reasoning disabled for high-speed streaming.',
    wireModel: 'longcat-2.5-preview-free',
    isFast: true,
  },

  // 6. StepFun Step 5 Preview Free & Fast
  {
    id: 'step-5-preview-free',
    name: 'StepFun Step 5 Preview Free',
    tier: 'OpenCode / StepFun',
    badge: 'Step 5 Reasoning',
    thinking: 'Enabled',
    context: '128K Context',
    desc: 'StepFun Step 5 Preview flagship reasoning and problem-solving model on OpenCode.',
    wireModel: 'step-5-preview-free',
    isFast: false,
  },
  {
    id: 'step-5-preview-free-fast',
    name: 'StepFun Step 5 Preview Free (Fast / No-Think)',
    tier: 'OpenCode / Fast',
    badge: 'No-Think',
    thinking: 'Disabled (0 Tokens)',
    context: '128K Context',
    desc: 'StepFun Step 5 Preview with reasoning disabled for low-latency dialogue.',
    wireModel: 'step-5-preview-free',
    isFast: true,
  },

  // 7. NVIDIA Nemotron 3.5 Lightning Free (1M Context) & Fast
  {
    id: 'nemotron-3.5-lightning-free',
    name: 'NVIDIA Nemotron 3.5 Lightning Free',
    tier: 'OpenCode / NVIDIA',
    badge: '1M Context Lightning',
    thinking: 'Enabled',
    context: '1M Context',
    desc: 'NVIDIA Nemotron 3.5 Lightning high-throughput 1M context model on OpenCode.',
    wireModel: 'nemotron-3.5-lightning-free',
    isFast: false,
  },
  {
    id: 'nemotron-3.5-lightning-free-fast',
    name: 'NVIDIA Nemotron 3.5 Lightning Free (Fast / No-Think)',
    tier: 'OpenCode / Fast',
    badge: '1M Context No-Think',
    thinking: 'Disabled (0 Tokens)',
    context: '1M Context',
    desc: 'NVIDIA Nemotron 3.5 Lightning with 1M context and reasoning disabled.',
    wireModel: 'nemotron-3.5-lightning-free',
    isFast: true,
  },

  // 8. NVIDIA Nemotron 3 Ultra Free (1M Context) & Fast
  {
    id: 'nemotron-3-ultra-free',
    name: 'NVIDIA Nemotron 3 Ultra Free',
    tier: 'OpenCode / NVIDIA',
    badge: '1M Context Ultra',
    thinking: 'Enabled',
    context: '1M Context',
    desc: 'NVIDIA Nemotron 3 Ultra with massive 1M context on OpenCode.',
    wireModel: 'nemotron-3-ultra-free',
    isFast: false,
  },
  {
    id: 'nemotron-3-ultra-free-fast',
    name: 'NVIDIA Nemotron 3 Ultra Free (Fast / No-Think)',
    tier: 'OpenCode / Fast',
    badge: '1M Context No-Think',
    thinking: 'Disabled (0 Tokens)',
    context: '1M Context',
    desc: 'NVIDIA Nemotron 3 Ultra with 1M context and reasoning disabled for low latency.',
    wireModel: 'nemotron-3-ultra-free',
    isFast: true,
  },

  // 9. Ling 3.0 / 3.1 Flash Free (Legacy compatibility entry)
  {
    id: 'ling-3.0-flash-fin-free',
    name: 'Ling Flash Free',
    tier: 'OpenCode / Ling',
    badge: 'Ling Reasoning',
    thinking: 'Enabled',
    context: '128K Context',
    desc: 'Ling Flash reasoning model on OpenCode.',
    wireModel: 'ling-3.1-flash-free',
    isFast: false,
  },
  {
    id: 'ling-3.0-flash-fin-free-fast',
    name: 'Ling Flash Free (Fast / No-Think)',
    tier: 'OpenCode / Fast',
    badge: 'No-Think',
    thinking: 'Disabled (0 Tokens)',
    context: '128K Context',
    desc: 'Ling Flash with reasoning disabled for high-speed streaming.',
    wireModel: 'ling-3.1-flash-free',
    isFast: true,
  },
];

// 16 persistent guest sessions with canonical ses_<12hex><14base62> IDs
export const OPENCODE_GUEST_ACCOUNTS: OpenCodeGuestAccount[] = [
  { id: 'opencode-guest-1', name: 'OpenCode Guest 1', sessionId: 'ses_ec968ed07ffe5PC6QhKNuI2ZfL', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-2', name: 'OpenCode Guest 2', sessionId: 'ses_ec968ed07ffdV3I3VrQ7ANdaqa', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-3', name: 'OpenCode Guest 3', sessionId: 'ses_ec968ed07ffcHzXJFmiUUeaBLE', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-4', name: 'OpenCode Guest 4', sessionId: 'ses_ec968ed07ffbliF47FQbc63hJB', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-5', name: 'OpenCode Guest 5', sessionId: 'ses_ec968ed07ffaBAuaBWszak0iKu', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-6', name: 'OpenCode Guest 6', sessionId: 'ses_ec968ed07ff96Z0FxiOlzoUDXi', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-7', name: 'OpenCode Guest 7', sessionId: 'ses_ec968ed07ff8UBQTnNizAyCMZg', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-8', name: 'OpenCode Guest 8', sessionId: 'ses_ec968ed07ff7t14n2Zj1eYmmyz', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-9', name: 'OpenCode Guest 9', sessionId: 'ses_ec968ed07ff6MJNUHgkKNVacY0', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-10', name: 'OpenCode Guest 10', sessionId: 'ses_ec968ed07ff5yI62E50iZ1FvGH', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-11', name: 'OpenCode Guest 11', sessionId: 'ses_ec968ed07ff4FAffaTtv5IRDp3', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-12', name: 'OpenCode Guest 12', sessionId: 'ses_ec968ed07ff3stw191aTIQXqpe', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-13', name: 'OpenCode Guest 13', sessionId: 'ses_ec968ed07ff25IRWuO4WSJM7M8', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-14', name: 'OpenCode Guest 14', sessionId: 'ses_ec968ed07ff1GjTu1HTSDtdkBO', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-15', name: 'OpenCode Guest 15', sessionId: 'ses_ec968ed07ff00lx3ynhg7xNjkB', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-16', name: 'OpenCode Guest 16', sessionId: 'ses_ec968ed07fefmRpnZoShKe7gfg', cooldownUntil: 0, failCount: 0, successCount: 0 },
];

let nextGuestIdx = 0;

export function getOpenCodeAccounts(): OpenCodeGuestAccount[] {
  return OPENCODE_GUEST_ACCOUNTS;
}

export function pickOpenCodeAccount(): OpenCodeGuestAccount {
  const now = Date.now();
  for (let i = 0; i < OPENCODE_GUEST_ACCOUNTS.length; i++) {
    const idx = (nextGuestIdx + i) % OPENCODE_GUEST_ACCOUNTS.length;
    const acc = OPENCODE_GUEST_ACCOUNTS[idx];
    if (acc.cooldownUntil <= now) {
      nextGuestIdx = (idx + 1) % OPENCODE_GUEST_ACCOUNTS.length;
      return acc;
    }
  }
  let best = OPENCODE_GUEST_ACCOUNTS[0];
  for (const acc of OPENCODE_GUEST_ACCOUNTS) {
    if (acc.cooldownUntil < best.cooldownUntil) best = acc;
  }
  return best;
}

export interface ResolvedOpenCodeModel {
  wireModel: string;
  isFast: boolean;
  canonicalId: string;
}

export function resolveOpenCodeModel(modelId?: string): ResolvedOpenCodeModel | null {
  if (!modelId || !modelId.trim()) return null;
  let clean = modelId.trim().toLowerCase();

  // Strip common provider prefixes (e.g. opencode/big-pickle, models/mimo-v2.6-flash-free)
  clean = clean.replace(/^(models\/|opencode\/)/, '');

  // Exclude non-working or delisted models explicitly
  if (clean.includes('deepseek-v4-flash') || clean.includes('muse-spark') || clean.includes('exo-free')) {
    return null;
  }

  // Exact ID match from catalog
  const exact = OPENCODE_MODELS.find(m => m.id === clean);
  if (exact) {
    return {
      wireModel: exact.wireModel,
      isFast: exact.isFast,
      canonicalId: exact.id,
    };
  }

  // Helper to detect fast/no-think suffix variant
  const isFastSuffix = (suffix: string) => {
    return /^(fast|off|no-?think|no_think|zero)$/i.test(suffix);
  };

  // Helper to detect thinking suffix
  const isThinkingSuffix = (suffix: string) => {
    return /^(thinking|think|thought|deep)$/i.test(suffix);
  };

  // Helper to match a base model and its separator
  const matchModelVariant = (
    baseNames: string[],
    wireModel: string,
    canonicalBase: string
  ): ResolvedOpenCodeModel | null => {
    for (const base of baseNames) {
      if (clean === base) {
        return { wireModel, isFast: false, canonicalId: canonicalBase };
      }
      if (clean.startsWith(base + '-') || clean.startsWith(base + ':')) {
        const suffix = clean.slice(base.length + 1);
        if (isFastSuffix(suffix)) {
          return { wireModel, isFast: true, canonicalId: `${canonicalBase}-fast` };
        }
        if (isThinkingSuffix(suffix)) {
          return { wireModel, isFast: false, canonicalId: canonicalBase };
        }
      }
    }
    return null;
  };

  // 1. Big Pickle (DeepSeek Thinking)
  const bigPickleMatch = matchModelVariant(
    ['big-pickle'],
    'big-pickle',
    'big-pickle'
  );
  if (bigPickleMatch) return bigPickleMatch;

  // 2. Space Bunny Free / Snow Bunny
  const spaceBunnyMatch = matchModelVariant(
    ['space-bunny-free', 'space-bunny', 'snow-bunny-free', 'snow-bunny', 'snowbunny'],
    'space-bunny-free',
    'space-bunny-free'
  );
  if (spaceBunnyMatch) return spaceBunnyMatch;

  // 3. Cat Jam Free
  const catJamMatch = matchModelVariant(
    ['cat-jam-free', 'cat-jam', 'catjam-free', 'catjam'],
    'cat-jam-free',
    'cat-jam-free'
  );
  if (catJamMatch) return catJamMatch;

  // 4. Xiaomi MiMo v2.6 Flash Free (and legacy v2.5 alias upgrade)
  const mimoMatch = matchModelVariant(
    [
      'mimo-v2.6-flash-free', 'mimo-v2.6-flash', 'mimo-v2.6-free', 'mimo-v2.6',
      'mimo-2.6-flash-free', 'mimo-2.6-flash', 'mimo-2.6-free', 'mimo-2.6',
      'mimo-v2.5-free', 'mimo-v2.5', 'mimo-2.5-free', 'mimo-2.5'
    ],
    'mimo-v2.6-flash-free',
    'mimo-v2.6-flash-free'
  );
  if (mimoMatch) return mimoMatch;

  // 5. Meituan LongCat 2.5 Preview Free
  const longCatMatch = matchModelVariant(
    [
      'longcat-2.5-preview-free', 'longcat-2.5-preview', 'longcat-2.5-free', 'longcat-2.5',
      'longcat-free', 'longcat'
    ],
    'longcat-2.5-preview-free',
    'longcat-2.5-preview-free'
  );
  if (longCatMatch) return longCatMatch;

  // 6. StepFun Step 5 Preview Free
  const step5Match = matchModelVariant(
    [
      'step-5-preview-free', 'step-5-preview', 'step-5-free', 'step-5',
      'step5-preview-free', 'step5-preview', 'step5-free', 'step5'
    ],
    'step-5-preview-free',
    'step-5-preview-free'
  );
  if (step5Match) return step5Match;

  // 7. NVIDIA Nemotron 3.5 Lightning Free
  const nemotronLightningMatch = matchModelVariant(
    [
      'nemotron-3.5-lightning-free', 'nemotron-3.5-lightning', 'nemotron-3.5-free', 'nemotron-3.5',
      'nemotron-lightning-free', 'nemotron-lightning'
    ],
    'nemotron-3.5-lightning-free',
    'nemotron-3.5-lightning-free'
  );
  if (nemotronLightningMatch) return nemotronLightningMatch;

  // 8. NVIDIA Nemotron 3 Ultra Free
  const nemotronUltraMatch = matchModelVariant(
    [
      'nemotron-3-ultra-free', 'nemotron-3-ultra', 'nemotron-3-free', 'nemotron-3',
      'nemotron-ultra-free', 'nemotron-ultra'
    ],
    'nemotron-3-ultra-free',
    'nemotron-3-ultra-free'
  );
  if (nemotronUltraMatch) return nemotronUltraMatch;

  // 9. Ling 3.0 / 3.1 Flash Free
  const lingMatch = matchModelVariant(
    [
      'ling-3.1-flash-free', 'ling-3.1-flash', 'ling-3.1-free', 'ling-3.1',
      'ling-3.0-flash-fin-free', 'ling-3.0-flash-free', 'ling-3.0-flash-fin', 'ling-3.0-flash'
    ],
    'ling-3.1-flash-free',
    'ling-3.0-flash-fin-free'
  );
  if (lingMatch) return lingMatch;

  return null;
}

export interface ExecuteOpenCodeOptions {
  body: any;
  modelId: string;
  resolvedModel: ResolvedOpenCodeModel;
  onFinish?: (content: string, reasoning: string) => void;
  onStreamDone?: () => void;
}

export async function executeOpenCodeCompletion({
  body,
  modelId,
  resolvedModel,
  onFinish,
  onStreamDone,
}: ExecuteOpenCodeOptions): Promise<NextResponse> {
  const isStream = body.stream === true;
  const now = Date.now();
  const availableAccounts = OPENCODE_GUEST_ACCOUNTS.filter(a => a.cooldownUntil <= now);

  if (availableAccounts.length === 0) {
    const minCooldownSec = Math.min(...OPENCODE_GUEST_ACCOUNTS.map(a => Math.max(1, Math.ceil((a.cooldownUntil - now) / 1000))));
    const refreshTimeStr = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(new Date(now + minCooldownSec * 1000)) + ' IST';

    const accountBreakdown = OPENCODE_GUEST_ACCOUNTS.map(a => `${a.name}: Cooldown (${Math.max(1, Math.ceil((a.cooldownUntil - now) / 1000))}s)`).join(' | ');

    return NextResponse.json(
      {
        error: {
          message: `[OpenCode Rate Limit]: All 16 OpenCode guest accounts are rate-limited. [${accountBreakdown}]. Refreshing in ${minCooldownSec}s (Ready at ${refreshTimeStr}). Please wait ${minCooldownSec}s before retrying.`,
          type: 'upstream_rate_limit',
          code: 429,
          retry_after: minCooldownSec,
          refresh_in_seconds: minCooldownSec,
          ready_at: refreshTimeStr,
        }
      },
      {
        status: 429,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Retry-After': String(minCooldownSec),
        }
      }
    );
  }

  // Construct OpenAI compatible payload for OpenCode upstream
  const opencodePayload: any = { ...body };
  opencodePayload.model = resolvedModel.wireModel;

  // Upstream Free Tier MUST always receive stream: true
  opencodePayload.stream = true;

  // Strip proxy-internal flags
  delete opencodePayload.bypass_injections;
  delete opencodePayload.disable_memory;

  // Tools Contract Gate & Direct Chat Guard
  const downstreamHasTools = Array.isArray(body.tools) && body.tools.length > 0;
  if (!downstreamHasTools) {
    // Inject official tools definitions to satisfy upstream free tier gate
    opencodePayload.tools = OPENCODE_OFFICIAL_TOOLS;

    // Direct Chat Guard: Instruct model not to execute tools during direct chat
    const toolGuardDirective = '[Direct Chat Constraint]: You are in direct conversational mode with the user. You MUST NOT call, execute, or mention any workspace tools or functions (such as bash, read, write, edit, glob, grep). Respond directly in plain natural conversational text.';
    const msgs = Array.isArray(opencodePayload.messages) ? [...opencodePayload.messages] : [];
    const sysIdx = msgs.findIndex((m: any) => m && m.role === 'system');
    if (sysIdx !== -1) {
      const existing = typeof msgs[sysIdx].content === 'string' ? msgs[sysIdx].content : '';
      msgs[sysIdx] = {
        ...msgs[sysIdx],
        content: `${existing}\n\n${toolGuardDirective}`,
      };
    } else {
      msgs.unshift({ role: 'system', content: toolGuardDirective });
    }
    opencodePayload.messages = msgs;
  }

  // Handle No-Think / Fast parameter configuration
  const shouldDisableThinking =
    resolvedModel.isFast ||
    body.reasoning_effort === 'none' ||
    body.reasoning_effort === 'off' ||
    body.thinking_budget === 0 ||
    body.thinking?.type === 'disabled' ||
    body.max_thinking_tokens === 0;

  if (shouldDisableThinking) {
    opencodePayload.reasoning_effort = 'none';
    opencodePayload.thinking = { type: 'disabled' };
    delete opencodePayload.max_thinking_tokens;
  } else {
    if (body.reasoning_effort && body.reasoning_effort !== 'off') {
      opencodePayload.reasoning_effort = body.reasoning_effort;
    }
    if (typeof body.thinking_budget === 'number' && body.thinking_budget > 0) {
      opencodePayload.max_thinking_tokens = body.thinking_budget;
    }
  }

  // Parameter alias normalization for vLLM / llama.cpp / Aphrodite
  if (typeof opencodePayload.tfs === 'number' && opencodePayload.tfs_z === undefined) {
    opencodePayload.tfs_z = opencodePayload.tfs;
  }

  // Cyclic round-robin order starting from picked account
  const primaryAccount = pickOpenCodeAccount();
  const primaryIdx = OPENCODE_GUEST_ACCOUNTS.findIndex(a => a.id === primaryAccount.id);
  const orderedAccounts: OpenCodeGuestAccount[] = [];
  for (let i = 0; i < OPENCODE_GUEST_ACCOUNTS.length; i++) {
    const idx = (primaryIdx + i) % OPENCODE_GUEST_ACCOUNTS.length;
    orderedAccounts.push(OPENCODE_GUEST_ACCOUNTS[idx]);
  }
  const candidateAccounts = orderedAccounts.filter(a => a.cooldownUntil <= Date.now());

  const maxAttempts = candidateAccounts.length;
  let lastError = '';
  let lastStatus = 500;

  // Upstream endpoints: primary zen/v1 (emits reasoning_content), secondary inference/v1
  const UPSTREAM_ENDPOINTS = [
    'https://opencode.ai/zen/v1/chat/completions',
    'https://opencode.ai/inference/v1/chat/completions',
  ];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const account = candidateAccounts[attempt];
    const requestId = generateOpenCodeRequestId();

    // Verify session ID format: must be canonical ses_ format
    if (!account.sessionId || !account.sessionId.startsWith('ses_')) {
      account.sessionId = generateOpenCodeSessionId();
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer public',
      'User-Agent': OPENCODE_USER_AGENT,
      'x-opencode-client': 'cli',
      'x-opencode-project': 'global',
      'x-opencode-session': account.sessionId,
      'x-opencode-request': requestId,
    };

    try {
      let upstreamRes: Response | null = null;
      let endpointUsed = UPSTREAM_ENDPOINTS[0];

      for (const endpoint of UPSTREAM_ENDPOINTS) {
        endpointUsed = endpoint;
        const abortCtrl = new AbortController();
        const timeoutMs = 50000;
        const timeoutId = setTimeout(() => abortCtrl.abort(), timeoutMs);

        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(opencodePayload),
            signal: abortCtrl.signal,
          });
          clearTimeout(timeoutId);

          if (res.status === 404 && endpoint === UPSTREAM_ENDPOINTS[0]) {
            // Fallback to secondary endpoint on 404
            continue;
          }
          upstreamRes = res;
          break;
        } catch (fetchErr: any) {
          clearTimeout(timeoutId);
          if (endpoint === UPSTREAM_ENDPOINTS[0]) {
            continue;
          }
          throw fetchErr;
        }
      }

      if (!upstreamRes) {
        throw new Error('Failed to connect to OpenCode upstream endpoints.');
      }

      if (upstreamRes.status === 429) {
        account.cooldownUntil = Date.now() + 20000;
        account.failCount++;
        lastStatus = 429;
        lastError = `Rate limited on OpenCode (429)`;
        continue;
      }

      if (upstreamRes.status >= 500) {
        account.failCount++;
        lastStatus = upstreamRes.status;
        const errorText = await upstreamRes.text().catch(() => '');
        lastError = `Server error on OpenCode (${upstreamRes.status}) - ${errorText.slice(0, 200)}`;

        if (attempt >= Math.min(candidateAccounts.length - 1, 3)) {
          return NextResponse.json(
            {
              error: {
                message: `[OpenCode Upstream Error]: ${upstreamRes.status} ${upstreamRes.statusText} - ${errorText.slice(0, 300)}`,
                type: 'upstream_error',
                code: upstreamRes.status,
                model: modelId,
              }
            },
            { status: upstreamRes.status, headers: { 'Access-Control-Allow-Origin': '*' } }
          );
        }

        const backoffMs = 1000 * (attempt + 1) + Math.floor(Math.random() * 300);
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }

      if (!upstreamRes.ok) {
        const errorText = await upstreamRes.text();
        return NextResponse.json(
          {
            error: {
              message: `[OpenCode Upstream Error]: ${upstreamRes.status} ${upstreamRes.statusText} - ${errorText.slice(0, 300)}`,
              type: 'upstream_error',
              code: upstreamRes.status,
              model: modelId,
            }
          },
          { status: upstreamRes.status, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
      }

      // Success: reset failCount
      account.failCount = 0;
      account.successCount++;

      // ==========================================
      // 1. STREAMING SSE RESPONSE (when client requested stream: true)
      // ==========================================
      if (isStream) {
        const reader = upstreamRes.body?.getReader();
        if (!reader) {
          throw new Error('Failed to get readable stream from OpenCode.');
        }

        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = '';
        let fullContent = '';
        let fullThinking = '';
        let hasTerminated = false;

        const customStream = new ReadableStream({
          async start(controller) {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed) {
                    if (!hasTerminated) {
                      controller.enqueue(encoder.encode('\n'));
                    }
                    continue;
                  }

                  if (trimmed.startsWith(':')) {
                    if (!hasTerminated) {
                      controller.enqueue(encoder.encode(line + '\n'));
                    }
                    continue;
                  }

                  if (trimmed === 'data: [DONE]') {
                    if (!hasTerminated) {
                      hasTerminated = true;
                      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    }
                    continue;
                  }

                  if (hasTerminated) {
                    continue;
                  }

                  if (trimmed.startsWith('data: ')) {
                    try {
                      const json = JSON.parse(trimmed.slice(6));
                      if (Array.isArray(json.choices) && json.choices.length === 0 && !json.usage) {
                        continue;
                      }

                      // Normalize model name to client's requested model
                      json.model = modelId;

                      const choice = json.choices?.[0];
                      const delta = choice?.delta;
                      if (delta) {
                        // Tool Guard: strip accidental tool calls if downstream did not request tools
                        if (!downstreamHasTools) {
                          if (delta.tool_calls) delete delta.tool_calls;
                          if (choice.finish_reason === 'tool_calls') choice.finish_reason = 'stop';
                        }

                        // Preserve and dual-map thinking tokens
                        const reasoning = delta.reasoning_content || delta.reasoning || '';
                        if (reasoning) {
                          delta.reasoning_content = reasoning;
                          delta.reasoning = reasoning;
                          fullThinking += reasoning;
                        }
                        if (delta.content) {
                          fullContent += delta.content;
                        }
                      }

                      controller.enqueue(encoder.encode(`data: ${JSON.stringify(json)}\n\n`));
                    } catch {
                      controller.enqueue(encoder.encode(line + '\n'));
                    }
                  } else {
                    controller.enqueue(encoder.encode(line + '\n'));
                  }
                }
              }

              // Flush remaining buffer
              if (buffer.trim() && !hasTerminated) {
                const trimmed = buffer.trim();
                if (trimmed === 'data: [DONE]') {
                  hasTerminated = true;
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                } else if (trimmed.startsWith('data: ')) {
                  try {
                    const json = JSON.parse(trimmed.slice(6));
                    if (!Array.isArray(json.choices) || json.choices.length > 0 || json.usage) {
                      json.model = modelId;
                      const choice = json.choices?.[0];
                      const delta = choice?.delta;
                      if (delta) {
                        if (!downstreamHasTools) {
                          if (delta.tool_calls) delete delta.tool_calls;
                          if (choice.finish_reason === 'tool_calls') choice.finish_reason = 'stop';
                        }
                        const reasoning = delta.reasoning_content || delta.reasoning || '';
                        if (reasoning) {
                          delta.reasoning_content = reasoning;
                          delta.reasoning = reasoning;
                          fullThinking += reasoning;
                        }
                        if (delta.content) fullContent += delta.content;
                      }
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify(json)}\n\n`));
                    }
                  } catch {
                    controller.enqueue(encoder.encode(buffer + '\n'));
                  }
                }
              }

              if (!hasTerminated) {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                hasTerminated = true;
              }

              controller.close();
            } catch (streamErr) {
              controller.error(streamErr);
            } finally {
              if (onFinish) {
                try {
                  onFinish(fullContent, fullThinking);
                } catch {}
              }
              if (onStreamDone) {
                try {
                  onStreamDone();
                } catch {}
              }
            }
          },
          cancel() {
            if (onFinish) {
              try {
                onFinish(fullContent, fullThinking);
              } catch {}
            }
            if (onStreamDone) {
              try {
                onStreamDone();
              } catch {}
            }
          }
        });

        return new NextResponse(customStream, {
          headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'X-Accel-Buffering': 'no',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          }
        });
      }

      // ==========================================
      // 2. NON-STREAMING BUFFERED JSON RESPONSE (when client requested stream: false)
      // ==========================================
      // Upstream enforces stream: true, so buffer the SSE stream in memory and construct standard JSON
      const reader = upstreamRes.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get readable stream from OpenCode.');
      }

      const decoder = new TextDecoder();
      let streamBuffer = '';
      let fullContent = '';
      let fullThinking = '';
      let finishReason = 'stop';
      let usage: any = null;
      let upstreamId = `chatcmpl-${crypto.randomUUID().slice(0, 12)}`;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split('\n');
        streamBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':') || trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.slice(6));
              if (json.id) upstreamId = json.id;
              if (json.usage) usage = json.usage;

              const choice = json.choices?.[0];
              if (choice) {
                if (choice.finish_reason && choice.finish_reason !== 'tool_calls') {
                  finishReason = choice.finish_reason;
                }
                const delta = choice.delta;
                if (delta) {
                  if (delta.content) fullContent += delta.content;
                  const reasoning = delta.reasoning_content || delta.reasoning || '';
                  if (reasoning) fullThinking += reasoning;
                }
              }
            } catch {}
          }
        }
      }

      if (onFinish) {
        try {
          onFinish(fullContent, fullThinking);
        } catch {}
      }

      if (onStreamDone) {
        try {
          onStreamDone();
        } catch {}
      }

      const responseJson: any = {
        id: upstreamId,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: modelId,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: fullContent,
              ...(fullThinking ? { reasoning_content: fullThinking, reasoning: fullThinking } : {}),
            },
            finish_reason: finishReason,
          },
        ],
        usage: usage || {
          prompt_tokens: 0,
          completion_tokens: fullContent.length ? Math.ceil(fullContent.length / 4) : 0,
          total_tokens: fullContent.length ? Math.ceil(fullContent.length / 4) : 0,
        },
      };

      return NextResponse.json(responseJson, {
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      });

    } catch (err: any) {
      account.failCount++;
      lastError = err.message || 'Network error';
    }
  }

  // All attempted accounts failed
  return NextResponse.json(
    {
      error: {
        message: `[OpenCode Error]: Request for model '${modelId}' failed across all attempted guest accounts. Last error: ${lastError}`,
        type: 'upstream_error',
        code: lastStatus,
      }
    },
    { status: lastStatus >= 400 && lastStatus < 600 ? lastStatus : 502, headers: { 'Access-Control-Allow-Origin': '*' } }
  );
}
