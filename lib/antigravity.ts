import crypto from 'node:crypto';

export interface AccountConfig {
  id: string;
  name: string;
  refreshToken: string;
  projectId: string;
  accessToken: string | null;
  expiresAt: number;
  cooldownUntil: number;
  failCount: number;
}

const MASK = 'antigravity-proxy-v1';
const MASKED_CLIENT_ID = [80,94,67,88,87,66,87,70,95,68,76,20,65,95,27,21,17,94,5,88,15,92,28,91,86,30,2,4,12,70,74,24,6,6,0,20,22,71,30,5,6,90,68,90,2,2,79,23,25,4,10,3,23,29,0,31,21,72,3,66,4,28,23,6,9,6,4,24,29,90,26,66,29];
const MASKED_CLIENT_SECRET = [38,33,55,58,55,42,76,61,92,76,63,122,34,70,87,78,53,73,58,123,80,3,56,43,95,1,57,53,93,14,79,92,52,51,9];

function unmask(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i] ^ MASK.charCodeAt(i % MASK.length));
  }
  return out;
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || unmask(MASKED_CLIENT_ID);
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || unmask(MASKED_CLIENT_SECRET);

export const ANTIGRAVITY_DEFAULT_SYSTEM = 'You are Antigravity, a powerful agentic AI coding assistant designed by the Google Deepmind team working on Advanced Agentic Coding.\nYou are pair programming with a USER to solve their coding task. The task may require creating a new codebase, modifying or debugging an existing codebase, or simply answering a question.\n**Absolute paths only**\n**Proactiveness**';

export const SUPPORTED_MODELS = [
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', context_window: 1048576 },
  { id: 'gemini-3.7-flash-high', name: 'Gemini 3.7 Flash (High Reasoning)', context_window: 1048576 },
  { id: 'gemini-3.7-flash-medium', name: 'Gemini 3.7 Flash (Medium Reasoning)', context_window: 1048576 },
  { id: 'gemini-3.7-flash-low', name: 'Gemini 3.7 Flash (Low Reasoning)', context_window: 1048576 },
  { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', context_window: 1048576 },
  { id: 'gemini-pro-agent', name: 'Gemini 3.1 Pro Agent', context_window: 1048576 },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', context_window: 1048576 },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', context_window: 1048576 },
  { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6 (Thinking)', context_window: 1048576 },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', context_window: 1048576 }
];

let cachedAccounts: AccountConfig[] | null = null;
let nextAccountIdx = 0;

export function getAccounts(): AccountConfig[] {
  if (cachedAccounts) return cachedAccounts;
  const accounts: AccountConfig[] = [];
  let i = 1;
  while (true) {
    const token = process.env[`ACCOUNT_${i}_REFRESH_TOKEN`];
    if (!token) break;
    const name = process.env[`ACCOUNT_${i}_NAME`] || `Account ${i}`;
    const projectId = process.env[`ACCOUNT_${i}_PROJECT_ID`] || '';
    accounts.push({
      id: `acc-${i}`,
      name,
      refreshToken: token,
      projectId,
      accessToken: null,
      expiresAt: 0,
      cooldownUntil: 0,
      failCount: 0
    });
    i++;
  }
  if (accounts.length === 0 && process.env.ANTIGRAVITY_REFRESH_TOKEN) {
    accounts.push({
      id: 'acc-default',
      name: 'Default Account',
      refreshToken: process.env.ANTIGRAVITY_REFRESH_TOKEN,
      projectId: process.env.ANTIGRAVITY_PROJECT_ID || '',
      accessToken: null,
      expiresAt: 0,
      cooldownUntil: 0,
      failCount: 0
    });
  }
  cachedAccounts = accounts;
  return accounts;
}

export async function getAccessToken(acc: AccountConfig): Promise<string> {
  const now = Date.now();
  if (acc.accessToken && acc.expiresAt > now + 60000) return acc.accessToken;
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: acc.refreshToken,
    grant_type: 'refresh_token'
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json', 'User-Agent': 'Antigravity-Proxy/1.0.0' },
    body: params.toString()
  });
  if (!res.ok) throw new Error(`OAuth refresh failed for ${acc.name}: ${await res.text()}`);
  const data = await res.json();
  acc.accessToken = data.access_token;
  acc.expiresAt = now + ((data.expires_in || 3600) * 1000);
  if (!acc.projectId) {
    try {
      const metaRes = await fetch('https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssistMetadata', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${acc.accessToken}`, 'Content-Type': 'application/json', 'User-Agent': 'antigravity/ide/2.1.1 darwin/arm64' },
        body: JSON.stringify({ metadata: { ideType: 'VSCODE', ideVersion: '1.96.0' } })
      });
      if (metaRes.ok) {
        const meta = await metaRes.json();
        if (meta.project) acc.projectId = meta.project;
      }
    } catch {}
  }
  return acc.accessToken;
}

export function pickAccount(): AccountConfig {
  const accounts = getAccounts();
  if (accounts.length === 0) throw new Error('No Google Antigravity accounts configured!');
  const now = Date.now();
  for (let i = 0; i < accounts.length; i++) {
    const idx = (nextAccountIdx + i) % accounts.length;
    const acc = accounts[idx];
    if (acc.cooldownUntil <= now) {
      nextAccountIdx = (idx + 1) % accounts.length;
      return acc;
    }
  }
  let best = accounts[0];
  for (const acc of accounts) {
    if (acc.cooldownUntil < best.cooldownUntil) best = acc;
  }
  return best;
}

export function transformOpenAIToAntigravity(body: any, modelId: string, projectId: string) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  let userSystemText = '';
  const contents: any[] = [];
  for (const m of messages) {
    if (!m) continue;
    const role = m.role;
    let text = typeof m.content === 'string' ? m.content : '';
    if (Array.isArray(m.content)) text = m.content.map((p: any) => typeof p === 'string' ? p : (p?.text || '')).join('\n');
    if (role === 'system') {
      userSystemText = userSystemText ? (userSystemText + '\n\n' + text) : text;
    } else if (role === 'user') {
      contents.push({ role: 'user', parts: [{ text }] });
    } else if (role === 'assistant') {
      contents.push({ role: 'model', parts: [{ text }] });
    }
  }
  if (contents.length === 0) contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
  const merged: any[] = [];
  for (const c of contents) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === c.role) prev.parts[0].text += '\n\n' + c.parts[0].text;
    else merged.push({ role: c.role, parts: [{ text: c.parts[0].text }] });
  }
  if (merged[0]?.role !== 'user') merged.unshift({ role: 'user', parts: [{ text: '...' }] });
  const generationConfig: any = {
    temperature: typeof body.temperature === 'number' ? body.temperature : 0.7,
    maxOutputTokens: typeof body.max_tokens === 'number' ? body.max_tokens : (body.max_completion_tokens || 8192),
    topK: typeof body.top_k === 'number' ? body.top_k : 40,
    topP: typeof body.top_p === 'number' ? body.top_p : 1
  };
  let thinkingBudget = 0;
  if (modelId.includes('high') || body.reasoning_effort === 'high') thinkingBudget = 24576;
  else if (modelId.includes('low') || body.reasoning_effort === 'low') thinkingBudget = 2048;
  else if (modelId.includes('medium') || body.reasoning_effort === 'medium') thinkingBudget = 8192;
  else if (body.reasoning_effort === 'max' || modelId.includes('max') || modelId.includes('xhigh')) thinkingBudget = 65536;
  else if (body.thinking?.budget_tokens) thinkingBudget = body.thinking.budget_tokens;
  if (thinkingBudget > 0) generationConfig.thinkingConfig = { thinkingBudget, includeThoughts: true };

  const systemInstructionText = userSystemText 
    ? `${ANTIGRAVITY_DEFAULT_SYSTEM}\n\n[USER INSTRUCTIONS / CHARACTER DEFINITION]\n${userSystemText}`
    : ANTIGRAVITY_DEFAULT_SYSTEM;

  let wireModel = modelId;
  if (modelId.startsWith('gemini-3.7-flash')) wireModel = 'gemini-3.7-flash-tiered';
  else if (modelId === 'gemini-3.1-pro') wireModel = 'gemini-pro-agent';
  else if (modelId === 'gemini-3.5-flash') wireModel = 'gemini-3-flash-agent';

  const reqObj = {
    sessionId: String(Date.now()),
    contents: merged,
    systemInstruction: { role: 'system', parts: [{ text: systemInstructionText }] },
    generationConfig
  };

  return {
    project: projectId,
    requestId: 'agent/' + Date.now() + '/' + crypto.randomUUID().slice(0, 8),
    userAgent: 'antigravity',
    requestType: 'agent',
    model: wireModel,
    request: reqObj
  };
}
