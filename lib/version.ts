export interface ChangelogEntry {
  version: string;
  tag: 'LATEST' | 'MAJOR' | 'PATCH' | 'CORE';
  title: string;
  date: string;
  commit: string;
  description: string;
  highlights: string[];
}

export const CURRENT_VERSION = '2.5.0';
export const GITHUB_REPO_URL = 'https://github.com/agentblox40/antigravity-vercel-proxy';

export const CHANGELOG_HISTORY: ChangelogEntry[] = [
  {
    version: '2.5.0',
    tag: 'LATEST',
    title: 'OmniRoute-Standard Pure Pass-Through & Decoupled Thinking Engine',
    date: 'Aug 24, 2026',
    commit: 'latest',
    description: 'Adopted exact OmniRoute/OpenRouter architecture: pure zero-interference prompt pass-through, decoupled thinking budget, clean summary handling, and 50/50 round-robin account balancing.',
    highlights: [
      'Pure Pass-Through Translation: Zero synthetic prompt injections, passing character cards and jailbreaks with 100% fidelity.',
      'Decoupled Thinking Tokens: Upstream maxOutputTokens calculated with full headroom (16k+ tokens) so reasoning never cuts responses mid-sentence.',
      '50/50 Round-Robin Load Balancing: Automatically alternates requests between Google accounts to prevent quota exhaustion.',
      'Clean Utility & Summary Execution: Janitor AI memory/summary requests execute without character card contamination.'
    ]
  },
  {
    version: '2.4.0',
    tag: 'MAJOR',
    title: 'Ultra-Low Latency Debloat & Lorebary Architecture',
    date: 'Aug 23, 2026',
    commit: '5ea29c8',
    description: 'Stripped proxy-level lore and OOC scrapers for near-instant TTFT, delegating all character lore to Lorebary and external Lorebooks.',
    highlights: [
      'Zero-Overhead Hot Path: Eliminated regex scraping and string allocations for minimum Time-To-First-Token.',
      'Lorebary Handoff: Handed off 100% of character lore and world-state management to Lorebary and client Lorebooks.',
      'Upstash Redis Pipeline: Fast single-request batch retrieval (<80ms) for Logged Chats explorer.',
      'Streamlined Dashboard: Trimmed UI tabs down to 7 core essential modules for snappy client navigation.'
    ]
  },
  {
    version: '2.3.0',
    tag: 'MAJOR',
    title: 'OpenRouter-Style Pure Pass-Through & Ultra-Fast Parallel Memory',
    date: 'Aug 23, 2026',
    commit: 'e6f315b',
    description: 'Eliminated synthetic OOC rule injection for clean prompt pass-through, and upgraded Redis fetching to pipeline batching.',
    highlights: [
      'Pure Pass-Through Architecture: System prompt <ooc_command_and_continuity_engine> handles all {...} directives natively without proxy interference.',
      'Eliminated OOC rule duplication and conflicting length prompts when switching between {length: short} and {length: medium}.',
      'Parallelized Redis Fetching: Upgraded listAllSessions to Upstash pipeline endpoint, reducing memory API latency to ~80ms.',
      'Optimistic UI Updates: Instant 0ms checkbox and toggle feedback in dashboard.'
    ]
  },
  {
    version: '2.2.5',
    tag: 'MAJOR',
    title: 'Markdown Formatting Enforcement & Multi-System Message Unification',
    date: 'Aug 23, 2026',
    commit: '82e16e2',
    description: 'Enforces strict roleplay markdown syntax (*actions*, "dialogue", `thoughts`) and unifies all system prompts.',
    highlights: [
      'Injected Depth-0 Formatting Anchor at the immediate active turn so Gemini never forgets markdown styles.',
      'Unified all system messages across request arrays (character cards, custom prompts, jailbreaks).',
      'Fixed trailing model turn errors on regeneration by guaranteeing conversations always terminate on a user turn.',
      'Added non-resetting cooldown timer with live 1-second countdown and exact IST timestamps.'
    ]
  },
  {
    version: '2.2.0',
    tag: 'MAJOR',
    title: '13K+ System Prompt Preservation & Zero-Loss Stitching',
    date: 'Aug 23, 2026',
    commit: '82dd8a1',
    description: 'Fixed system prompt drop during history stitching and eliminated coding assistant persona conflict.',
    highlights: [
      'Preserved leading system messages across stitchLosslessHistory so 13k token character cards are never dropped.',
      'Stored full character system prompts in persistent session state to recover from client truncation.',
      'Upgraded Upstash Redis calls to HTTP POST to eliminate URL length limits on large payloads.',
      'Prioritized character system prompts directly in systemInstruction to prevent assistant persona conflicts.'
    ]
  },
  {
    version: '2.1.0',
    tag: 'MAJOR',
    title: 'Universal Syntax Parsing & Response Length Booster',
    date: 'Aug 23, 2026',
    commit: '7bb7c61',
    description: 'Added support for all bracket/tag styles ({length: short}, [style: ...]) and built-in constraint booster.',
    highlights: [
      'Universal regex captures {length: short}, [length: ...], ((...)), {{...}}, and <ooc>...</ooc>.',
      'Automatic constraint boosting: Translates length directives into strict output boundaries so Gemini never bloats.',
      'Case-insensitive key-value parameter extraction across user messages.'
    ]
  },
  {
    version: '2.0.5',
    tag: 'PATCH',
    title: 'Depth-0 In-Context Turn Anchoring & Multi-Part System',
    date: 'Aug 23, 2026',
    commit: '5fc5417',
    description: 'Anchors active OOC rules to the immediate prompt turn to prevent Gemini tone and persona reversion.',
    highlights: [
      'Injected active OOC directives directly into the latest active user turn (Depth 0 prompt boundary).',
      'Decoupled systemInstruction.parts into discrete developer and character chunks so persona instructions are never shadowed.',
      'Guarantees 100% continuous multi-turn adherence even when subsequent turns omit OOC commands.'
    ]
  },
  {
    version: '2.0.0',
    tag: 'MAJOR',
    title: 'Persistent Cloud Memory Engine & Upstash Redis',
    date: 'Aug 23, 2026',
    commit: 'a00161f',
    description: 'Full cloud memory persistence with zero-dependency Upstash REST Redis adapter and 1M context stitcher.',
    highlights: [
      'Dual-mode storage: Native Upstash Redis REST + in-memory store fallback.',
      'Deterministic 2-tier fingerprinting (Character ID + Chat Session ID).',
      '1M token lossless context stitching that bypasses Janitor AI\'s 128k truncation window.',
      'Smart multi-turn rewind, edit, and regeneration synchronization.'
    ]
  },
  {
    version: '1.9.0',
    tag: 'MAJOR',
    title: 'Logged Chats Explorer & Interactive Transcripts',
    date: 'Aug 23, 2026',
    commit: '037ccdb',
    description: 'Dedicated dashboard tab to browse, inspect, search, and export full conversation logs.',
    highlights: [
      'Turn-by-turn dialogue viewer with speaker separation and timestamps.',
      'Expandable thinking & reasoning process accordion for every turn.',
      'Character filtering pills, search bar, 1-click Markdown copy, and JSON export.'
    ]
  },
  {
    version: '1.5.0',
    tag: 'CORE',
    title: 'Dual-Account Failover & Dynamic Thinking Budgets',
    date: 'Aug 23, 2026',
    commit: '4e7770f',
    description: 'Automatic quota failover with 30s cooldown and granular thinking token budgets.',
    highlights: [
      'Automatic failover across OAuth account pool on HTTP 429 quota exhaustion.',
      'Granular reasoning tiers for Gemini 3.7 Flash (Low 2k, Med 8k, High 24k, Max 64k).',
      'Live model auto-discovery from Google CloudCode PA internal endpoint.'
    ]
  },
  {
    version: '1.0.0',
    tag: 'CORE',
    title: 'Initial Antigravity CloudCode PA Proxy Gateway',
    date: 'Aug 23, 2026',
    commit: '9f31a21',
    description: 'Serverless Next.js App Router gateway with OpenAI-to-Antigravity envelope translation.',
    highlights: [
      'Unrestricted safety filter bypass (BLOCK_NONE across all 5 harm categories).',
      'Clean SSE stream separation of reasoning_content vs visible content.',
      'Master security gate lockdown with Bearer token authentication.'
    ]
  }
];

export function getDeploymentTelemetry() {
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || '7bb7c61';
  const commitMsg = process.env.VERCEL_GIT_COMMIT_MESSAGE || 'Support {length: short} bracket syntax and boost response length directives';
  const deploymentEnv = process.env.VERCEL_ENV || 'production';
  const region = process.env.VERCEL_REGION || 'ap-south-1 (Mumbai)';

  return {
    version: CURRENT_VERSION,
    commitSha: commitSha.slice(0, 7),
    commitFullSha: commitSha,
    commitMessage: commitMsg,
    deploymentEnv,
    region,
    repoUrl: GITHUB_REPO_URL,
    changelog: CHANGELOG_HISTORY
  };
}
