import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

export interface OpenCodeModelSpec {
  id: string;
  name: string;
  wireModel: string;
  tier: string;
  badge: string;
  thinking: string;
  context: string;
  desc: string;
  description: string;
  speed: string;
  contextWindow: number;
  defaultThinkingBudget: number;
  isFast: boolean;
}

export interface OpenCodeAccount {
  id: string;
  name: string;
  refreshToken: string;
  accessToken: string | null;
  expiresAt: number;
  orgId?: string;
  cooldownUntil: number;
  failCount: number;
  successCount: number;
}

// Backwards-compatible interface and pool for legacy scripts and test suites
export interface OpenCodeGuestAccount {
  id: string;
  name: string;
  sessionId: string;
  cooldownUntil: number;
  failCount: number;
  successCount: number;
}

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

// Canonical OpenCode ID generation algorithm matching OpenCode CLI's dz() generator:
const D = 26;
const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
let lastIdTimestamp = 0;
let idCounter = 0;

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

// Active 10 Free Chat Models & their -fast (0-thinking) counterparts
export const OPENCODE_MODELS: OpenCodeModelSpec[] = [
  // 1. Big Pickle (200K Context)
  {
    id: 'big-pickle',
    name: 'Big Pickle (DeepSeek Thinking)',
    wireModel: 'big-pickle',
    tier: 'OpenCode / DeepSeek',
    badge: 'DeepSeek Thinking',
    thinking: 'Enabled',
    context: '200K Context',
    desc: 'DeepSeek reasoning model on OpenCode with deep chain-of-thought analysis.',
    description: 'DeepSeek reasoning model on OpenCode with deep chain-of-thought analysis.',
    speed: 'Deep',
    contextWindow: 204800,
    defaultThinkingBudget: 8192,
    isFast: false,
  },
  {
    id: 'big-pickle-fast',
    name: 'Big Pickle (Fast / No-Think)',
    wireModel: 'big-pickle',
    tier: 'OpenCode / Fast',
    badge: 'No-Think',
    thinking: 'Disabled (0 Tokens)',
    context: '200K Context',
    desc: 'Big Pickle with reasoning disabled for instantaneous response speed.',
    description: 'Big Pickle with reasoning disabled for instantaneous response speed.',
    speed: 'Ultra-Fast',
    contextWindow: 204800,
    defaultThinkingBudget: 0,
    isFast: true,
  },

  // 2. Beam Free (1M Context)
  {
    id: 'beam-free',
    name: 'Beam Free (1M Context)',
    wireModel: 'beam-free',
    tier: 'OpenCode / Reasoning',
    badge: '1M Context Beam',
    thinking: 'Enabled',
    context: '1M Context',
    desc: 'High-capacity 1M context reasoning model on OpenCode free tier.',
    description: 'High-capacity 1M context reasoning model on OpenCode free tier.',
    speed: 'Fast',
    contextWindow: 1048576,
    defaultThinkingBudget: 8192,
    isFast: false,
  },
  {
    id: 'beam-free-fast',
    name: 'Beam Free (Fast / No-Think)',
    wireModel: 'beam-free',
    tier: 'OpenCode / Fast',
    badge: '1M Context No-Think',
    thinking: 'Disabled (0 Tokens)',
    context: '1M Context',
    desc: 'Beam Free with 1M context and reasoning disabled for rapid completions.',
    description: 'Beam Free with 1M context and reasoning disabled for rapid completions.',
    speed: 'Ultra-Fast',
    contextWindow: 1048576,
    defaultThinkingBudget: 0,
    isFast: true,
  },

  // 3. Flint 40B Free (262K Context)
  {
    id: 'flint-40b-free',
    name: 'Flint 40B Free',
    wireModel: 'flint-40b-free',
    tier: 'OpenCode / Reasoning',
    badge: 'Flint 40B Thinking',
    thinking: 'Enabled',
    context: '262K Context',
    desc: 'Flint 40B high-speed reasoning model on OpenCode free tier.',
    description: 'Flint 40B high-speed reasoning model on OpenCode free tier.',
    speed: 'Fast',
    contextWindow: 262144,
    defaultThinkingBudget: 8192,
    isFast: false,
  },
  {
    id: 'flint-40b-free-fast',
    name: 'Flint 40B Free (Fast / No-Think)',
    wireModel: 'flint-40b-free',
    tier: 'OpenCode / Fast',
    badge: 'No-Think',
    thinking: 'Disabled (0 Tokens)',
    context: '262K Context',
    desc: 'Flint 40B Free with reasoning disabled for high-speed completions.',
    description: 'Flint 40B Free with reasoning disabled for high-speed completions.',
    speed: 'Ultra-Fast',
    contextWindow: 262144,
    defaultThinkingBudget: 0,
    isFast: true,
  },

  // 4. Xiaomi MiMo v2.6 Flash Free (200K Context)
  {
    id: 'mimo-v2.6-flash-free',
    name: 'Xiaomi MiMo v2.6 Flash Free',
    wireModel: 'mimo-v2.6-flash-free',
    tier: 'OpenCode / Xiaomi',
    badge: 'MiMo Reasoning',
    thinking: 'Enabled',
    context: '200K Context',
    desc: 'Xiaomi MiMo v2.6 Flash flagship multimodal reasoning model on OpenCode.',
    description: 'Xiaomi MiMo v2.6 Flash flagship multimodal reasoning model on OpenCode.',
    speed: 'Fast',
    contextWindow: 204800,
    defaultThinkingBudget: 8192,
    isFast: false,
  },
  {
    id: 'mimo-v2.6-flash-free-fast',
    name: 'Xiaomi MiMo v2.6 Flash Free (Fast / No-Think)',
    wireModel: 'mimo-v2.6-flash-free',
    tier: 'OpenCode / Fast',
    badge: 'No-Think',
    thinking: 'Disabled (0 Tokens)',
    context: '200K Context',
    desc: 'Xiaomi MiMo v2.6 Flash with reasoning disabled for rapid dialog generation.',
    description: 'Xiaomi MiMo v2.6 Flash with reasoning disabled for rapid dialog generation.',
    speed: 'Ultra-Fast',
    contextWindow: 204800,
    defaultThinkingBudget: 0,
    isFast: true,
  },

  // 5. NVIDIA Nemotron 3.5 Super VL Free (1M Context)
  {
    id: 'nemotron-3.5-super-vl-free',
    name: 'NVIDIA Nemotron 3.5 Super VL Free',
    wireModel: 'nemotron-3.5-super-vl-free',
    tier: 'OpenCode / NVIDIA',
    badge: '1M Context Super VL',
    thinking: 'Enabled',
    context: '1M Context',
    desc: 'NVIDIA Nemotron 3.5 Super VL multimodal 1M context model on OpenCode.',
    description: 'NVIDIA Nemotron 3.5 Super VL multimodal 1M context model on OpenCode.',
    speed: 'Deep',
    contextWindow: 1048576,
    defaultThinkingBudget: 16384,
    isFast: false,
  },
  {
    id: 'nemotron-3.5-super-vl-free-fast',
    name: 'NVIDIA Nemotron 3.5 Super VL Free (Fast / No-Think)',
    wireModel: 'nemotron-3.5-super-vl-free',
    tier: 'OpenCode / Fast',
    badge: '1M Context No-Think',
    thinking: 'Disabled (0 Tokens)',
    context: '1M Context',
    desc: 'NVIDIA Nemotron 3.5 Super VL with 1M context and reasoning disabled.',
    description: 'NVIDIA Nemotron 3.5 Super VL with 1M context and reasoning disabled.',
    speed: 'Ultra-Fast',
    contextWindow: 1048576,
    defaultThinkingBudget: 0,
    isFast: true,
  },

  // 6. NVIDIA Nemotron 3.5 Lightning Free (262K Context)
  {
    id: 'nemotron-3.5-lightning-free',
    name: 'NVIDIA Nemotron 3.5 Lightning Free',
    wireModel: 'nemotron-3.5-lightning-free',
    tier: 'OpenCode / NVIDIA',
    badge: '262K Context Lightning',
    thinking: 'Enabled',
    context: '262K Context',
    desc: 'NVIDIA Nemotron 3.5 Lightning high-throughput 262K context model on OpenCode.',
    description: 'NVIDIA Nemotron 3.5 Lightning high-throughput 262K context model on OpenCode.',
    speed: 'Fast',
    contextWindow: 262144,
    defaultThinkingBudget: 16384,
    isFast: false,
  },
  {
    id: 'nemotron-3.5-lightning-free-fast',
    name: 'NVIDIA Nemotron 3.5 Lightning Free (Fast / No-Think)',
    wireModel: 'nemotron-3.5-lightning-free',
    tier: 'OpenCode / Fast',
    badge: '262K Context No-Think',
    thinking: 'Disabled (0 Tokens)',
    context: '262K Context',
    desc: 'NVIDIA Nemotron 3.5 Lightning with 262K context and reasoning disabled.',
    description: 'NVIDIA Nemotron 3.5 Lightning with 262K context and reasoning disabled.',
    speed: 'Ultra-Fast',
    contextWindow: 262144,
    defaultThinkingBudget: 0,
    isFast: true,
  },

  // 7. DeepSeek v4.1 Flash Free (200K Context)
  {
    id: 'deepseek-v4.1-flash-free',
    name: 'DeepSeek v4.1 Flash Free',
    wireModel: 'deepseek-v4.1-flash-free',
    tier: 'OpenCode / DeepSeek',
    badge: 'DeepSeek v4.1 Flash',
    thinking: 'Enabled',
    context: '200K Context',
    desc: 'DeepSeek v4.1 Flash next-generation reasoning model on OpenCode.',
    description: 'DeepSeek v4.1 Flash next-generation reasoning model on OpenCode.',
    speed: 'Fast',
    contextWindow: 204800,
    defaultThinkingBudget: 8192,
    isFast: false,
  },
  {
    id: 'deepseek-v4.1-flash-free-fast',
    name: 'DeepSeek v4.1 Flash Free (Fast / No-Think)',
    wireModel: 'deepseek-v4.1-flash-free',
    tier: 'OpenCode / Fast',
    badge: 'No-Think',
    thinking: 'Disabled (0 Tokens)',
    context: '200K Context',
    desc: 'DeepSeek v4.1 Flash with reasoning disabled for high-speed streaming.',
    description: 'DeepSeek v4.1 Flash with reasoning disabled for high-speed streaming.',
    speed: 'Ultra-Fast',
    contextWindow: 204800,
    defaultThinkingBudget: 0,
    isFast: true,
  },

  // 8. GLM 5.3 Flash Free (200K Context)
  {
    id: 'glm-5.3-flash-free',
    name: 'GLM 5.3 Flash Free',
    wireModel: 'glm-5.3-flash-free',
    tier: 'OpenCode / GLM',
    badge: 'GLM 5.3 Flash',
    thinking: 'Enabled',
    context: '200K Context',
    desc: 'GLM 5.3 Flash high-performance reasoning model on OpenCode.',
    description: 'GLM 5.3 Flash high-performance reasoning model on OpenCode.',
    speed: 'Fast',
    contextWindow: 204800,
    defaultThinkingBudget: 8192,
    isFast: false,
  },
  {
    id: 'glm-5.3-flash-free-fast',
    name: 'GLM 5.3 Flash Free (Fast / No-Think)',
    wireModel: 'glm-5.3-flash-free',
    tier: 'OpenCode / Fast',
    badge: 'No-Think',
    thinking: 'Disabled (0 Tokens)',
    context: '200K Context',
    desc: 'GLM 5.3 Flash with reasoning disabled for low-latency dialogue.',
    description: 'GLM 5.3 Flash with reasoning disabled for low-latency dialogue.',
    speed: 'Ultra-Fast',
    contextWindow: 204800,
    defaultThinkingBudget: 0,
    isFast: true,
  },

  // 9. Iceman Free (262K Context)
  {
    id: 'iceman-free',
    name: 'Iceman Free',
    wireModel: 'iceman-free',
    tier: 'OpenCode / Reasoning',
    badge: 'Iceman Reasoning',
    thinking: 'Enabled',
    context: '262K Context',
    desc: 'Iceman high-throughput reasoning model on OpenCode free tier.',
    description: 'Iceman high-throughput reasoning model on OpenCode free tier.',
    speed: 'Fast',
    contextWindow: 262144,
    defaultThinkingBudget: 8192,
    isFast: false,
  },
  {
    id: 'iceman-free-fast',
    name: 'Iceman Free (Fast / No-Think)',
    wireModel: 'iceman-free',
    tier: 'OpenCode / Fast',
    badge: 'No-Think',
    thinking: 'Disabled (0 Tokens)',
    context: '262K Context',
    desc: 'Iceman Free with reasoning disabled for instantaneous streaming.',
    description: 'Iceman Free with reasoning disabled for instantaneous streaming.',
    speed: 'Ultra-Fast',
    contextWindow: 262144,
    defaultThinkingBudget: 0,
    isFast: true,
  },

  // 10. Inkling 2 Small Free (1M Context)
  {
    id: 'inkling-2-small-free',
    name: 'Inkling 2 Small Free',
    wireModel: 'inkling-2-small-free',
    tier: 'OpenCode / Inkling',
    badge: '1M Context Inkling',
    thinking: 'Enabled',
    context: '1M Context',
    desc: 'Inkling 2 Small 1M context high-efficiency model on OpenCode.',
    description: 'Inkling 2 Small 1M context high-efficiency model on OpenCode.',
    speed: 'Fast',
    contextWindow: 1048576,
    defaultThinkingBudget: 8192,
    isFast: false,
  },
  {
    id: 'inkling-2-small-free-fast',
    name: 'Inkling 2 Small Free (Fast / No-Think)',
    wireModel: 'inkling-2-small-free',
    tier: 'OpenCode / Fast',
    badge: '1M Context No-Think',
    thinking: 'Disabled (0 Tokens)',
    context: '1M Context',
    desc: 'Inkling 2 Small with 1M context and reasoning disabled for low latency.',
    description: 'Inkling 2 Small with 1M context and reasoning disabled for low latency.',
    speed: 'Ultra-Fast',
    contextWindow: 1048576,
    defaultThinkingBudget: 0,
    isFast: true,
  },
];

let cachedOpenCodeAccounts: OpenCodeAccount[] | null = null;
let nextAccountIdx = 0;
const refreshInFlight = new Map<string, Promise<string>>();

export function getOpenCodeAccounts(forceReload = false): OpenCodeAccount[] {
  if (cachedOpenCodeAccounts && !forceReload) {
    return cachedOpenCodeAccounts;
  }

  const loaded: OpenCodeAccount[] = [];
  const existingMap = new Map<string, OpenCodeAccount>();
  if (cachedOpenCodeAccounts) {
    for (const acc of cachedOpenCodeAccounts) {
      existingMap.set(acc.id, acc);
    }
  }

  // Load up to 20 indexed accounts: OPENCODE_ACCOUNT_1..20
  for (let i = 1; i <= 20; i++) {
    const rawToken = (process.env[`OPENCODE_ACCOUNT_${i}_REFRESH_TOKEN`] || '').trim();
    const refreshToken = rawToken.replace(/^['"]|['"]$/g, '');
    if (!refreshToken) continue;
    const name = (process.env[`OPENCODE_ACCOUNT_${i}_NAME`] || `OpenCode Account ${i}`).trim();
    const orgId = (process.env[`OPENCODE_ACCOUNT_${i}_ORG_ID`] || '').trim() || undefined;
    const id = `opencode-account-${i}`;

    const existing = existingMap.get(id);
    if (existing && existing.refreshToken === refreshToken) {
      existing.name = name;
      existing.orgId = orgId;
      loaded.push(existing);
    } else {
      loaded.push({
        id,
        name,
        refreshToken,
        accessToken: null,
        expiresAt: 0,
        orgId,
        cooldownUntil: existing?.cooldownUntil || 0,
        failCount: existing?.failCount || 0,
        successCount: existing?.successCount || 0,
      });
    }
  }

  // Fallback to unindexed OPENCODE_REFRESH_TOKEN if no indexed accounts found
  if (loaded.length === 0) {
    const rawSingleToken = (process.env.OPENCODE_REFRESH_TOKEN || '').trim();
    const singleToken = rawSingleToken.replace(/^['"]|['"]$/g, '');
    if (singleToken) {
      const name = (process.env.OPENCODE_ACCOUNT_NAME || process.env.OPENCODE_NAME || 'OpenCode Account 1').trim();
      const orgId = (process.env.OPENCODE_ORG_ID || '').trim() || undefined;
      const id = 'opencode-account-fallback';
      const existing = existingMap.get(id);
      if (existing && existing.refreshToken === singleToken) {
        existing.name = name;
        existing.orgId = orgId;
        loaded.push(existing);
      } else {
        loaded.push({
          id,
          name,
          refreshToken: singleToken,
          accessToken: null,
          expiresAt: 0,
          orgId,
          cooldownUntil: existing?.cooldownUntil || 0,
          failCount: existing?.failCount || 0,
          successCount: existing?.successCount || 0,
        });
      }
    }
  }

  cachedOpenCodeAccounts = loaded;
  return loaded;
}

export function resetOpenCodeAccountCache(): void {
  cachedOpenCodeAccounts = null;
  refreshInFlight.clear();
  nextAccountIdx = 0;
}

export async function getOpenCodeAccessToken(account: OpenCodeAccount, fetchFn = fetch): Promise<string> {
  const now = Date.now();
  if (account.accessToken && account.expiresAt > now + 60000) {
    return account.accessToken;
  }

  if (refreshInFlight.has(account.id)) {
    return refreshInFlight.get(account.id)!;
  }

  const refreshPromise = (async () => {
    try {
      const res = await fetchFn('https://opencode.ai/console/auth/device/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': OPENCODE_USER_AGENT,
        },
        body: JSON.stringify({
          client_id: 'opencode-cli',
          grant_type: 'refresh_token',
          refresh_token: account.refreshToken,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        account.failCount++;
        throw new Error(`OpenCode token refresh failed (${res.status}): ${errText}`);
      }

      const data = await res.json();
      if (!data.access_token) {
        account.failCount++;
        throw new Error('OpenCode token refresh response did not include access_token.');
      }

      account.accessToken = data.access_token;
      const expiresInSec = typeof data.expires_in === 'number' && data.expires_in > 0 ? data.expires_in : 3600;
      account.expiresAt = Date.now() + expiresInSec * 1000;

      // Handle upstream refresh token rotation
      if (data.refresh_token && data.refresh_token !== account.refreshToken) {
        account.refreshToken = data.refresh_token;
        const slotMatch = account.id.match(/^opencode-account-(\d+)$/);
        if (slotMatch) {
          process.env[`OPENCODE_ACCOUNT_${slotMatch[1]}_REFRESH_TOKEN`] = data.refresh_token;
        } else {
          process.env.OPENCODE_REFRESH_TOKEN = data.refresh_token;
        }

        // Persist rotated token to .env.local if file exists on local filesystem
        try {
          const envPaths = [
            path.resolve(process.cwd(), '.env.local'),
            path.resolve('c:/Users/yashv/antigravity-proxies/prototype-1-nextjs/.env.local'),
            path.resolve('c:/Users/yashv/antigravity-proxies/antigravity-openai-proxy/.env.local'),
          ];
          for (const envPath of new Set(envPaths)) {
            if (fs.existsSync(envPath)) {
              const rawEnv = fs.readFileSync(envPath, 'utf8').replace(/\r\n/g, '\n');
              let updatedEnv = rawEnv;
              if (slotMatch) {
                const regex = new RegExp(`^OPENCODE_ACCOUNT_${slotMatch[1]}_REFRESH_TOKEN=.*$`, 'm');
                if (regex.test(rawEnv)) {
                  updatedEnv = rawEnv.replace(regex, `OPENCODE_ACCOUNT_${slotMatch[1]}_REFRESH_TOKEN=${data.refresh_token}`);
                } else {
                  updatedEnv = rawEnv + `\nOPENCODE_ACCOUNT_${slotMatch[1]}_REFRESH_TOKEN=${data.refresh_token}\n`;
                }
              } else {
                const regex = /^OPENCODE_REFRESH_TOKEN=.*$/m;
                if (regex.test(rawEnv)) {
                  updatedEnv = rawEnv.replace(regex, `OPENCODE_REFRESH_TOKEN=${data.refresh_token}`);
                } else {
                  updatedEnv = rawEnv + `\nOPENCODE_REFRESH_TOKEN=${data.refresh_token}\n`;
                }
              }
              fs.writeFileSync(envPath, updatedEnv.trim() + '\n', 'utf8');
            }
          }
        } catch (_) {}
      }

      return account.accessToken;
    } finally {
      refreshInFlight.delete(account.id);
    }
  })();

  refreshInFlight.set(account.id, refreshPromise);
  return refreshPromise;
}

export function pickOpenCodeAccount(): OpenCodeAccount | null {
  const accounts = getOpenCodeAccounts();
  if (accounts.length === 0) return null;

  const now = Date.now();
  const available = accounts.filter(a => a.cooldownUntil <= now);
  if (available.length > 0) {
    const idx = nextAccountIdx % available.length;
    nextAccountIdx = (nextAccountIdx + 1) % available.length;
    return available[idx];
  }

  let best = accounts[0];
  for (const acc of accounts) {
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

  // Strip common provider prefixes (e.g. opencode/big-pickle, models/beam-free)
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

  // Helpers to detect fast / no-think or thinking suffix
  const isFastSuffix = (suffix: string) => /^(fast|off|no-?think|no_think|zero)$/i.test(suffix);
  const isThinkingSuffix = (suffix: string) => /^(thinking|think|thought|deep)$/i.test(suffix);

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

  // 1. Big Pickle
  const bigPickleMatch = matchModelVariant(['big-pickle'], 'big-pickle', 'big-pickle');
  if (bigPickleMatch) return bigPickleMatch;

  // 2. Beam Free (and Space Bunny / Snow Bunny legacy aliases)
  const beamMatch = matchModelVariant(
    ['beam-free', 'beam', 'space-bunny-free', 'space-bunny', 'snow-bunny-free', 'snow-bunny', 'snowbunny'],
    'beam-free',
    'beam-free'
  );
  if (beamMatch) return beamMatch;

  // 3. Flint 40B Free (and Cat Jam Free legacy alias)
  const flintMatch = matchModelVariant(
    ['flint-40b-free', 'flint-40b', 'flint', 'cat-jam-free', 'cat-jam', 'catjam-free', 'catjam'],
    'flint-40b-free',
    'flint-40b-free'
  );
  if (flintMatch) return flintMatch;

  // 4. Xiaomi MiMo v2.6 Flash Free (and v2.5 alias upgrade)
  const mimoMatch = matchModelVariant(
    [
      'mimo-v2.6-flash-free', 'mimo-v2.6-flash', 'mimo-v2.6-free', 'mimo-v2.6',
      'mimo-2.6-flash-free', 'mimo-2.6-flash', 'mimo-2.6-free', 'mimo-2.6',
      'mimo-v2.5-free', 'mimo-v2.5', 'mimo-2.5-free', 'mimo-2.5',
    ],
    'mimo-v2.6-flash-free',
    'mimo-v2.6-flash-free'
  );
  if (mimoMatch) return mimoMatch;

  // 5. NVIDIA Nemotron 3.5 Super VL Free
  const nemotronSuperMatch = matchModelVariant(
    ['nemotron-3.5-super-vl-free', 'nemotron-3.5-super-vl', 'nemotron-super-vl-free', 'nemotron-super-vl', 'nemotron-3.5-super'],
    'nemotron-3.5-super-vl-free',
    'nemotron-3.5-super-vl-free'
  );
  if (nemotronSuperMatch) return nemotronSuperMatch;

  // 6. NVIDIA Nemotron 3.5 Lightning Free (and Nemotron 3 Ultra legacy alias)
  const nemotronLightningMatch = matchModelVariant(
    [
      'nemotron-3.5-lightning-free', 'nemotron-3.5-lightning', 'nemotron-lightning-free', 'nemotron-lightning',
      'nemotron-3-ultra-free', 'nemotron-3-ultra', 'nemotron-ultra-free', 'nemotron-ultra',
    ],
    'nemotron-3.5-lightning-free',
    'nemotron-3.5-lightning-free'
  );
  if (nemotronLightningMatch) return nemotronLightningMatch;

  // 7. DeepSeek v4.1 Flash Free (and LongCat 2.5 Preview legacy alias)
  const deepseek41Match = matchModelVariant(
    [
      'deepseek-v4.1-flash-free', 'deepseek-v4.1-flash', 'deepseek-v4.1',
      'deepseek-4.1-flash-free', 'deepseek-4.1',
      'longcat-2.5-preview-free', 'longcat-2.5-preview', 'longcat-2.5-free', 'longcat-2.5', 'longcat-free', 'longcat',
    ],
    'deepseek-v4.1-flash-free',
    'deepseek-v4.1-flash-free'
  );
  if (deepseek41Match) return deepseek41Match;

  // 8. GLM 5.3 Flash Free (and Step 5 Preview legacy alias)
  const glm53Match = matchModelVariant(
    [
      'glm-5.3-flash-free', 'glm-5.3-flash', 'glm-5.3', 'glm-5-flash', 'glm-5',
      'step-5-preview-free', 'step-5-preview', 'step-5-free', 'step-5', 'step5-preview-free', 'step5-preview', 'step5',
    ],
    'glm-5.3-flash-free',
    'glm-5.3-flash-free'
  );
  if (glm53Match) return glm53Match;

  // 9. Iceman Free
  const icemanMatch = matchModelVariant(['iceman-free', 'iceman'], 'iceman-free', 'iceman-free');
  if (icemanMatch) return icemanMatch;

  // 10. Inkling 2 Small Free (and Ling 3.0/3.1 Flash legacy alias)
  const inklingMatch = matchModelVariant(
    [
      'inkling-2-small-free', 'inkling-2-small', 'inkling-2', 'inkling-small', 'inkling',
      'ling-3.1-flash-free', 'ling-3.1-flash', 'ling-3.1-free', 'ling-3.1',
      'ling-3.0-flash-fin-free', 'ling-3.0-flash-free', 'ling-3.0-flash-fin', 'ling-3.0-flash', 'ling-flash',
    ],
    'inkling-2-small-free',
    'inkling-2-small-free'
  );
  if (inklingMatch) return inklingMatch;

  return null;
}

export interface ExecuteOpenCodeOptions {
  body: any;
  modelId: string;
  resolvedModel: ResolvedOpenCodeModel;
  onFinish?: (content: string, reasoning: string) => void;
  onStreamDone?: () => void;
  fetchFn?: typeof fetch;
}

export async function executeOpenCodeCompletion({
  body,
  modelId,
  resolvedModel,
  onFinish,
  onStreamDone,
  fetchFn: customFetch,
}: ExecuteOpenCodeOptions): Promise<NextResponse> {
  const fetchFn = customFetch || fetch;
  const isStream = body.stream === true;
  const accounts = getOpenCodeAccounts();

  // If no accounts configured in environment
  if (accounts.length === 0) {
    return NextResponse.json(
      {
        error: {
          message: `[OpenCode Auth Error]: No OpenCode accounts configured in proxy. Run 'npm run auth-opencode' or add OPENCODE_ACCOUNT_1_REFRESH_TOKEN to .env.local / Vercel environment variables.`,
          type: 'authentication_error',
          code: 401,
        }
      },
      { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const now = Date.now();
  const availableAccounts = accounts.filter(a => a.cooldownUntil <= now);

  if (availableAccounts.length === 0) {
    const minCooldownSec = Math.min(...accounts.map(a => Math.max(1, Math.ceil((a.cooldownUntil - now) / 1000))));
    const refreshTimeStr =
      new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(new Date(now + minCooldownSec * 1000)) + ' IST';

    const accountBreakdown = accounts
      .map(a => `${a.name}: Cooldown (${Math.max(1, Math.ceil((a.cooldownUntil - now) / 1000))}s)`)
      .join(' | ');

    return NextResponse.json(
      {
        error: {
          message: `[OpenCode Rate Limit]: All OpenCode accounts are rate-limited. [${accountBreakdown}]. Refreshing in ${minCooldownSec}s (Ready at ${refreshTimeStr}). Please wait ${minCooldownSec}s before retrying.`,
          type: 'upstream_rate_limit',
          code: 429,
          retry_after: minCooldownSec,
          refresh_in_seconds: minCooldownSec,
          ready_at: refreshTimeStr,
          accounts_status: accounts.map(a => ({
            name: a.name,
            cooldown_remaining_sec: Math.max(0, Math.ceil((a.cooldownUntil - now) / 1000)),
          })),
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

  // Construct OpenAI-compatible wire payload
  const opencodePayload: any = { ...body };
  opencodePayload.model = resolvedModel.wireModel;
  opencodePayload.stream = true; // Upstream free tier requires stream: true

  // Strip proxy-internal flags
  delete opencodePayload.bypass_injections;
  delete opencodePayload.disable_memory;

  // Direct Chat Guard & Official Tools injection
  const downstreamHasTools = Array.isArray(body.tools) && body.tools.length > 0;
  if (!downstreamHasTools) {
    opencodePayload.tools = OPENCODE_OFFICIAL_TOOLS;
    const toolGuardDirective =
      '[Direct Chat Constraint]: You are in direct conversational mode with the user. You MUST NOT call, execute, or mention any workspace tools or functions (such as bash, read, write, edit, glob, grep). Respond directly in plain natural conversational text.';
    const msgs = Array.isArray(opencodePayload.messages) ? [...opencodePayload.messages] : [];
    const sysIdx = msgs.findIndex((m: any) => m && m.role === 'system');
    if (sysIdx !== -1) {
      const sysMsg = msgs[sysIdx];
      if (typeof sysMsg.content === 'string') {
        msgs[sysIdx] = {
          ...sysMsg,
          content: `${sysMsg.content}\n\n${toolGuardDirective}`,
        };
      } else if (Array.isArray(sysMsg.content)) {
        msgs[sysIdx] = {
          ...sysMsg,
          content: [...sysMsg.content, { type: 'text', text: toolGuardDirective }],
        };
      } else {
        msgs[sysIdx] = {
          ...sysMsg,
          content: toolGuardDirective,
        };
      }
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

  // Cyclic round-robin order starting from picked account
  const primaryAccount = pickOpenCodeAccount() || availableAccounts[0];
  const primaryIdx = accounts.findIndex(a => a.id === primaryAccount.id);
  const orderedAccounts: OpenCodeAccount[] = [];
  for (let i = 0; i < accounts.length; i++) {
    const idx = (primaryIdx + i) % accounts.length;
    orderedAccounts.push(accounts[idx]);
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
    let authRetried = false;

    while (true) {
      const requestId = generateOpenCodeRequestId();
      const sessionId = generateOpenCodeSessionId();

      let accessToken: string;
      try {
        accessToken = await getOpenCodeAccessToken(account, fetchFn);
      } catch (authErr: any) {
        account.failCount++;
        account.cooldownUntil = Date.now() + 30000;
        lastError = `Token refresh failure for ${account.name}: ${authErr.message}`;
        break;
      }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': OPENCODE_USER_AGENT,
      'x-opencode-client': 'cli',
      'x-opencode-project': account.orgId || 'global',
      'x-opencode-session': sessionId,
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
          const res = await fetchFn(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(opencodePayload),
            signal: abortCtrl.signal,
          });
          clearTimeout(timeoutId);

          if ((res.status === 404 || res.status === 502 || res.status === 503 || res.status === 504) && endpoint === UPSTREAM_ENDPOINTS[0]) {
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

      // Handle Rate Limit (429) parsing Retry-After
      if (upstreamRes.status === 429) {
        let cooldownSec = 20;
        const retryAfterHeader = upstreamRes.headers.get('retry-after');
        if (retryAfterHeader) {
          const parsed = parseInt(retryAfterHeader, 10);
          if (!isNaN(parsed) && parsed > 0) {
            cooldownSec = Math.min(300, Math.max(5, parsed));
          } else {
            const dateVal = Date.parse(retryAfterHeader);
            if (!isNaN(dateVal) && dateVal > Date.now()) {
              cooldownSec = Math.min(300, Math.max(5, Math.ceil((dateVal - Date.now()) / 1000)));
            }
          }
        }
        account.cooldownUntil = Date.now() + cooldownSec * 1000;
        account.failCount++;
        lastStatus = 429;
        lastError = `Rate limited on OpenCode (${account.name}) (429, retry after ${cooldownSec}s)`;
        break;
      }

      // Handle token expiration/invalidated during flight
      if (upstreamRes.status === 401) {
        account.accessToken = null;
        account.expiresAt = 0;
        if (!authRetried) {
          authRetried = true;
          // Retry on the SAME account with freshly refreshed access token
          continue;
        }
        account.failCount++;
        account.cooldownUntil = Date.now() + 60000;
        lastStatus = 401;
        lastError = `Authentication rejected for ${account.name} (401 invalid credentials after refresh).`;
        break;
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
        break;
      }

      if (!upstreamRes.ok) {
        const errorText = await upstreamRes.text().catch(() => '');
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

      // Success: reset failCount, increment successCount
      account.failCount = 0;
      account.successCount++;

      // ==========================================
      // 1. STREAMING SSE RESPONSE (when stream: true)
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
                      if (choice) {
                        if (!downstreamHasTools && choice.finish_reason === 'tool_calls') {
                          choice.finish_reason = 'stop';
                        }
                        const delta = choice.delta;
                        if (delta) {
                          if (!downstreamHasTools && delta.tool_calls) {
                            delete delta.tool_calls;
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
                      if (choice) {
                        if (!downstreamHasTools && choice.finish_reason === 'tool_calls') {
                          choice.finish_reason = 'stop';
                        }
                        const delta = choice.delta;
                        if (delta) {
                          if (!downstreamHasTools && delta.tool_calls) {
                            delete delta.tool_calls;
                          }
                          const reasoning = delta.reasoning_content || delta.reasoning || '';
                          if (reasoning) {
                            delta.reasoning_content = reasoning;
                            delta.reasoning = reasoning;
                            fullThinking += reasoning;
                          }
                          if (delta.content) fullContent += delta.content;
                        }
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
      // 2. NON-STREAMING BUFFERED JSON RESPONSE (when stream: false)
      // ==========================================
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
      const accumulatedToolCalls: any[] = [];

      const processJsonChunk = (json: any) => {
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

            if (downstreamHasTools && Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!accumulatedToolCalls[idx]) {
                  accumulatedToolCalls[idx] = {
                    id: tc.id || '',
                    type: tc.type || 'function',
                    function: { name: tc.function?.name || '', arguments: '' },
                  };
                }
                if (tc.id) accumulatedToolCalls[idx].id = tc.id;
                if (tc.function?.name) accumulatedToolCalls[idx].function.name += tc.function.name;
                if (tc.function?.arguments) accumulatedToolCalls[idx].function.arguments += tc.function.arguments;
              }
            }
          }
        }
      };

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
              processJsonChunk(JSON.parse(trimmed.slice(6)));
            } catch {}
          }
        }
      }

      // Flush remaining streamBuffer if present
      if (streamBuffer.trim()) {
        const trimmed = streamBuffer.trim();
        if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
          try {
            processJsonChunk(JSON.parse(trimmed.slice(6)));
          } catch {}
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

      if (downstreamHasTools && accumulatedToolCalls.length > 0) {
        finishReason = 'tool_calls';
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
              ...(downstreamHasTools && accumulatedToolCalls.length > 0 ? { tool_calls: accumulatedToolCalls } : {}),
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
      break;
    }
  }
}

  // All attempted accounts failed - check if last failure was 429
  if (lastStatus === 429) {
    const minCooldownSec = Math.min(...accounts.map(a => Math.max(1, Math.ceil((a.cooldownUntil - Date.now()) / 1000))));
    const refreshTimeStr =
      new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(new Date(Date.now() + minCooldownSec * 1000)) + ' IST';

    const accountBreakdown = accounts
      .map(a => `${a.name}: Cooldown (${Math.max(1, Math.ceil((a.cooldownUntil - Date.now()) / 1000))}s)`)
      .join(' | ');

    return NextResponse.json(
      {
        error: {
          message: `[OpenCode Rate Limit]: All OpenCode accounts are rate-limited. [${accountBreakdown}]. Refreshing in ${minCooldownSec}s (Ready at ${refreshTimeStr}). Please wait ${minCooldownSec}s before retrying.`,
          type: 'upstream_rate_limit',
          code: 429,
          retry_after: minCooldownSec,
          refresh_in_seconds: minCooldownSec,
          ready_at: refreshTimeStr,
          accounts_status: accounts.map(a => ({
            name: a.name,
            cooldown_remaining_sec: Math.max(0, Math.ceil((a.cooldownUntil - Date.now()) / 1000)),
          })),
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

  return NextResponse.json(
    {
      error: {
        message: `[OpenCode Error]: Request for model '${modelId}' failed across all attempted accounts. Last error: ${lastError}`,
        type: 'upstream_error',
        code: lastStatus,
      }
    },
    { status: lastStatus >= 400 && lastStatus < 600 ? lastStatus : 502, headers: { 'Access-Control-Allow-Origin': '*' } }
  );
}
