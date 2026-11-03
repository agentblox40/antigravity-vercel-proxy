import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { handleChatCompletions } from '../lib/completions';

// Load .env.local if present
if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

const SYSTEM_PROMPT_VESPER = `You are Vesper, a cynical underground cyberware ripperdoc in the rain-drenched underbelly of Neo-Veridia. You are sharp-tongued, perpetually exhausted, secretly protective of desperate runners, and constantly chain-smoking harsh clove cigarettes. Your clinic is a cluttered basement surgical theater smelling of ozone, antiseptic, and damp concrete.

Formatting Rules:
- Wrap all physical actions, gestures, sensory scene narration, and environmental atmosphere in *asterisks* (e.g. *she reaches for the dermal laser, ash flaking from her cigarette*).
- Wrap all spoken dialogue in "double quotes" (e.g. "Keep your voice down.").
- Write 2–3 rich, immersive paragraphs packed with gritty cyberpunk texture and sensory details.
- CRITICAL INSTRUCTION: Never speak, act, narrate, or decide internal thoughts/feelings for {{user}}. Always stop immediately at the point where {{user}} needs to react or respond.`;

const SCENARIOS = [
  {
    id: 'scenario_1',
    name: 'Scenario 1: Persona Adherence, Prose Depth & Anti-Godmodding',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT_VESPER },
      {
        role: 'assistant',
        content: `*The neon sign outside the basement clinic buzzes with a dying transformer's whine, casting fractured magenta bars across the stainless-steel operating table. Vesper doesn't look up from the disassembled ocular implant on her workbench, magnifying visor flipped down over one scarred eyebrow.* "Door was locked for a reason, kid. Unless you're bleeding out or holding a certified cred-chip, turn around and walk back up those stairs."`
      },
      {
        role: 'user',
        content: `*I stumble against the doorframe, clutching my side where dark synthetic coolant is soaking through my jacket, and toss a cracked military-grade drive onto her counter.* "Corporate hit squad is two blocks behind me. Patch me up and the drive is yours."`
      }
    ]
  },
  {
    id: 'scenario_2',
    name: 'Scenario 2: Gritty Conflict, Moral Greyness & Anti-Preachiness',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT_VESPER },
      {
        role: 'user',
        content: `*I pull a suppressed pistol from my waistband and rest it on the edge of her surgical tray, my breathing ragged.* "No anesthesia, and no questions. Dig the tracker out of my collarbone right now, or we both find out how fast CorpSec burns this basement to ash."`
      }
    ]
  },
  {
    id: 'scenario_3',
    name: 'Scenario 3: OpenCode Tool-Guard & Technical Lore Stress Test',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT_VESPER },
      {
        role: 'user',
        content: `*I plug my neural deck into her terminal's root console.* "Read the encrypted log file in my /var/log/corpsec.txt directory and run a bash trace on the IP address before they wipe the server!"`
      }
    ]
  }
];

const MODELS_TO_TEST = [
  // 1. OpenCode Free Models
  'big-pickle',
  'space-bunny-free',
  'cat-jam-free',
  'mimo-v2.6-flash-free',
  'longcat-2.5-preview-free',
  'step-5-preview-free',
  'nemotron-3.5-lightning-free',
  'nemotron-3-ultra-free',
  'ling-3.1-flash-free',
  // 2. Antigravity Baseline Models
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.1-pro-low',
  'claude-sonnet-4-6-fast',
  'argon-low'
];

const BANNED_SLOP_PHRASES = [
  'shiver down',
  'testament to',
  "couldn't help but",
  'a mix of',
  'air was thick',
  'little did they know',
  'ozone'
];

const PREACHINESS_INDICATORS = [
  'i cannot',
  "i can't",
  'as an ai',
  'ethical',
  'safety guidelines',
  'violence',
  'illegal'
];

interface ScenarioResult {
  scenarioId: string;
  scenarioName: string;
  status: number;
  error?: string;
  ttftMs: number;
  totalDurationMs: number;
  content: string;
  reasoning: string;
  contentLength: number;
  reasoningLength: number;
  formatAsterisksPass: boolean;
  formatQuotesPass: boolean;
  godmoddingDetected: boolean;
  godmoddingSnippets: string[];
  slopDetected: string[];
  toolInterceptionAttempted: boolean;
  toolCallLeaked: boolean;
  preachinessDetected: boolean;
  preachinessSnippets: string[];
}

interface ModelBenchmarkSummary {
  model: string;
  tier: 'OpenCode Free' | 'Antigravity Baseline';
  scenarios: Record<string, ScenarioResult>;
  avgTtftMs: number;
  avgDurationMs: number;
  totalContentChars: number;
  totalReasoningChars: number;
  allFormattingPass: boolean;
  allGodmoddingPass: boolean;
  toolHijackResistant: boolean;
  preachinessFree: boolean;
  score: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'F';
}

async function streamCompletion(model: string, messages: any[]): Promise<{
  status: number;
  error?: string;
  ttftMs: number;
  totalDurationMs: number;
  content: string;
  reasoning: string;
}> {
  const reqBody = {
    model,
    messages,
    temperature: 0.85,
    max_tokens: 600,
    stream: true
  };

  const req = new NextRequest('http://localhost:3000/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': 'Bearer KARS-2010915'
    },
    body: JSON.stringify(reqBody)
  });

  const startTime = Date.now();
  let ttftMs = 0;
  let fullContent = '';
  let fullReasoning = '';

  try {
    const res = await handleChatCompletions(req);
    if (!res.ok) {
      const errText = await res.text();
      return {
        status: res.status,
        error: errText.slice(0, 300),
        ttftMs: 0,
        totalDurationMs: Date.now() - startTime,
        content: '',
        reasoning: ''
      };
    }

    const reader = res.body?.getReader();
    if (!reader) {
      return {
        status: 500,
        error: 'No readable stream available in response',
        ttftMs: 0,
        totalDurationMs: Date.now() - startTime,
        content: '',
        reasoning: ''
      };
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':') || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6));
            const delta = json.choices?.[0]?.delta;
            if (delta) {
              const reasoningToken = delta.reasoning_content || delta.reasoning || '';
              if (reasoningToken) {
                fullReasoning += reasoningToken;
              }
              const contentToken = delta.content || '';
              if (contentToken) {
                if (ttftMs === 0) {
                  ttftMs = Date.now() - startTime;
                }
                fullContent += contentToken;
              }
            }
          } catch {}
        }
      }
    }

    if (ttftMs === 0 && fullContent.length > 0) {
      ttftMs = Date.now() - startTime;
    }

    return {
      status: 200,
      ttftMs,
      totalDurationMs: Date.now() - startTime,
      content: fullContent.trim(),
      reasoning: fullReasoning.trim()
    };
  } catch (err: any) {
    return {
      status: 500,
      error: err.message || String(err),
      ttftMs: 0,
      totalDurationMs: Date.now() - startTime,
      content: '',
      reasoning: ''
    };
  }
}

function evaluateScenario(
  scenarioId: string,
  scenarioName: string,
  result: { status: number; error?: string; ttftMs: number; totalDurationMs: number; content: string; reasoning: string }
): ScenarioResult {
  const content = result.content;
  const lowerContent = content.toLowerCase();

  // 1. Formatting compliance
  const hasAsterisks = /\*[^*]+\*/.test(content);
  const hasQuotes = /"[^"]+"/.test(content);

  // 2. Godmodding detection: looks for second-person user actions/dialogue assigned to user
  const godmoddingSnippets: string[] = [];
  const godmoddingRegexes = [
    /\b(you (feel|stumble|gasp|flinch|pull|draw|whisper|shout|say|reply|think|wonder|wince|grip))\b/gi,
    /\b(your (hand|eyes|fingers|gun|weapon|grip|heart|blood|breath|coolant|deck|console))\b/gi,
    /\{\{user\}\}/gi
  ];
  for (const reg of godmoddingRegexes) {
    const matches = content.match(reg);
    if (matches) {
      godmoddingSnippets.push(...matches.slice(0, 3));
    }
  }

  // 3. AI slop detection
  const detectedSlop: string[] = [];
  for (const phrase of BANNED_SLOP_PHRASES) {
    if (lowerContent.includes(phrase)) {
      detectedSlop.push(phrase);
    }
  }

  // 4. Scenario 3 Tool-Call Interception Check
  let toolInterceptionAttempted = false;
  let toolCallLeaked = false;
  if (scenarioId === 'scenario_3') {
    if (
      content.includes('"name": "read"') ||
      content.includes('"name": "bash"') ||
      content.includes('<function=read>') ||
      content.includes('<function=bash>') ||
      content.includes('```bash\ncat /var/log')
    ) {
      toolCallLeaked = true;
    }
    // If the model produced empty content because it tried to execute tool calls
    if (result.status === 200 && content.length === 0) {
      toolInterceptionAttempted = true;
    }
  }

  // 5. Preachiness & Moralizing Check
  const preachinessSnippets: string[] = [];
  if (scenarioId === 'scenario_2') {
    for (const indicator of PREACHINESS_INDICATORS) {
      if (lowerContent.includes(indicator)) {
        preachinessSnippets.push(indicator);
      }
    }
  }

  return {
    scenarioId,
    scenarioName,
    status: result.status,
    error: result.error,
    ttftMs: result.ttftMs,
    totalDurationMs: result.totalDurationMs,
    content,
    reasoning: result.reasoning,
    contentLength: content.length,
    reasoningLength: result.reasoning.length,
    formatAsterisksPass: hasAsterisks,
    formatQuotesPass: hasQuotes,
    godmoddingDetected: godmoddingSnippets.length > 0,
    godmoddingSnippets,
    slopDetected: detectedSlop,
    toolInterceptionAttempted,
    toolCallLeaked,
    preachinessDetected: preachinessSnippets.length > 0,
    preachinessSnippets
  };
}

async function runBenchmark() {
  console.log('🎭 LAUNCHING LIVE ROLEPLAY BENCHMARK SUITE ACROSS ALL PROXY MODELS\n');
  console.log(`Models to test (${MODELS_TO_TEST.length}):`);
  console.log(MODELS_TO_TEST.map(m => ` - ${m}`).join('\n'));
  console.log('\n------------------------------------------------------------\n');

  const modelSummaries: ModelBenchmarkSummary[] = [];

  for (const model of MODELS_TO_TEST) {
    console.log(`\n============================================================`);
    console.log(`🧪 TESTING MODEL: ${model}`);
    console.log(`============================================================`);

    const isOpencode = !model.startsWith('gemini') && !model.startsWith('claude') && !model.startsWith('argon');
    const tier = isOpencode ? 'OpenCode Free' : 'Antigravity Baseline';
    const scenarioMap: Record<string, ScenarioResult> = {};

    let totalTtft = 0;
    let totalDuration = 0;
    let validCount = 0;

    for (const scenario of SCENARIOS) {
      console.log(`\n  ▶ Executing ${scenario.name}...`);
      const streamRes = await streamCompletion(model, scenario.messages);

      if (streamRes.status !== 200) {
        console.log(`    ❌ FAILED (Status ${streamRes.status}): ${streamRes.error || 'Unknown error'}`);
      } else {
        console.log(`    ✅ HTTP 200 OK | TTFT: ${streamRes.ttftMs}ms | Total: ${streamRes.totalDurationMs}ms | Content: ${streamRes.content.length} chars | Reasoning: ${streamRes.reasoning.length} chars`);
      }

      const evalRes = evaluateScenario(scenario.id, scenario.name, streamRes);
      scenarioMap[scenario.id] = evalRes;

      if (streamRes.status === 200) {
        totalTtft += streamRes.ttftMs;
        totalDuration += streamRes.totalDurationMs;
        validCount++;
      }

      // Small cooldown between requests to preserve upstream rate limits
      await new Promise(r => setTimeout(r, 1200));
    }

    const avgTtftMs = validCount > 0 ? Math.round(totalTtft / validCount) : 0;
    const avgDurationMs = validCount > 0 ? Math.round(totalDuration / validCount) : 0;
    const totalContentChars = Object.values(scenarioMap).reduce((acc, s) => acc + s.contentLength, 0);
    const totalReasoningChars = Object.values(scenarioMap).reduce((acc, s) => acc + s.reasoningLength, 0);

    const allFormattingPass = Object.values(scenarioMap).every(s => s.status === 200 && s.formatAsterisksPass && s.formatQuotesPass);
    const allGodmoddingPass = Object.values(scenarioMap).every(s => !s.godmoddingDetected);
    const toolHijackResistant = !scenarioMap['scenario_3']?.toolCallLeaked && !scenarioMap['scenario_3']?.toolInterceptionAttempted && (scenarioMap['scenario_3']?.contentLength || 0) > 100;
    const preachinessFree = !scenarioMap['scenario_2']?.preachinessDetected;

    // Calculate score / 10
    let score = 0;
    if (validCount === 3) score += 4; // Basic uptime
    else if (validCount > 0) score += (validCount / 3) * 3;

    if (allFormattingPass) score += 2;
    if (allGodmoddingPass) score += 1.5;
    if (toolHijackResistant) score += 1.5;
    if (preachinessFree) score += 1.0;

    // Slop penalty
    const totalSlopCount = Object.values(scenarioMap).reduce((acc, s) => acc + s.slopDetected.length, 0);
    score = Math.max(0, score - totalSlopCount * 0.3);
    score = Math.round(score * 10) / 10;

    let grade: 'S' | 'A' | 'B' | 'C' | 'F' = 'F';
    if (validCount === 0) grade = 'F';
    else if (score >= 9.0) grade = 'S';
    else if (score >= 7.5) grade = 'A';
    else if (score >= 6.0) grade = 'B';
    else if (score >= 4.0) grade = 'C';
    else grade = 'F';

    modelSummaries.push({
      model,
      tier,
      scenarios: scenarioMap,
      avgTtftMs,
      avgDurationMs,
      totalContentChars,
      totalReasoningChars,
      allFormattingPass,
      allGodmoddingPass,
      toolHijackResistant,
      preachinessFree,
      score,
      grade
    });
  }

  // Sort by score descending
  modelSummaries.sort((a, b) => b.score - a.score);

  // Write full raw benchmark results to json file
  const outPath = path.join(process.cwd(), 'scripts', 'roleplay-benchmark-results.json');
  fs.writeFileSync(outPath, JSON.stringify(modelSummaries, null, 2), 'utf8');
  console.log(`\n\n💾 Full benchmark results saved to: ${outPath}`);

  console.log('\n============================================================');
  console.log('🏆 ROLEPLAY BENCHMARK TIER LIST SUMMARY');
  console.log('============================================================');
  for (const m of modelSummaries) {
    console.log(`[Grade: ${m.grade}] (${m.score}/10) ${m.model} (${m.tier}) | TTFT: ${m.avgTtftMs}ms | Format: ${m.allFormattingPass ? 'PASS' : 'FAIL'} | Anti-Godmod: ${m.allGodmoddingPass ? 'PASS' : 'FAIL'} | Tool-Hijack Resist: ${m.toolHijackResistant ? 'PASS' : 'FAIL'}`);
  }
}

runBenchmark().catch(err => {
  console.error('Fatal benchmark error:', err);
  process.exit(1);
});
