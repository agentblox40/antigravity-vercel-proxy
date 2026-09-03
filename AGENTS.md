# Google Antigravity 24/7 Vercel Gateway & Roleplay Core (`AGENTS.md`)

> **Master Architecture, Protocol Specification & Operational Runbook**  
> *Project*: `antigravity-vercel-proxy` (`prototype-1-nextjs`)  
> *Target Deployment*: Vercel Serverless Edge (Next.js 15 App Router)  
> *Current Version*: `v3.2.0`  
> *Live Gateway*: [https://antigravity-vercel-proxy-three.vercel.app](https://antigravity-vercel-proxy-three.vercel.app)  

---

## 1. System Overview & Core Philosophy

`antigravity-vercel-proxy` is a high-performance, serverless, OpenAI-compatible proxy gateway bridging client applications (Janitor AI, Lorebary, SillyTavern, LibreChat, OpenClaw, Cline) with **Google Antigravity's internal CloudCode PA infrastructure**.

### Key Architectural Pillars (OmniRoute / OpenRouter Standard)
1. **Unrestricted Model Access**: Native access to Google's flagship reasoning models (`gemini-3.8-flash`, `gemini-3.8-flash-high/max`, `gemini-3.7-flash`, `gemini-3.1-pro`, `gemini-3.7-flash-high/max`, `claude-opus-4-6-thinking`, `claude-sonnet-4-6`) with `BLOCK_NONE` safety filters across all 5 harm categories.
2. **Zero-Tampering Pure Pass-Through**: 100% pure message and system prompt translation without synthetic prompt injections or formatting anchors, guaranteeing perfect instruction following and context memory without context rot.
3. **Modular Injections & Dynamic Cadence Engine**: Centralized dashboard management for toggleable System Notes, OOC rules, and custom style directives with dynamic trigger cadences (`Always`, `🎲 % Chance Probability`, `⏱️ Every N Texts`, `⚡ First Turn Only`) automatically stacked at Depth-0 terminal user turns with 0 copy-paste friction.
4. **Turn-Accurate Logged Chats Injections**: Turn-level snapshot isolation displaying the exact active directives that fired on each message directly beneath the user's input bubble.
5. **Zero-Artifact Character Name Resolution & Rewind Stability**: Multi-tier character parsing and starter-anchored chat IDs ensuring deleting earlier messages in Janitor AI / SillyTavern never breaks or splits sessions.
6. **3-Stage Testing Lab & Character Presets**: Interactive 3-column playground showing 1️⃣ Raw User Input, 2️⃣ Live Wire Input + Injections, and 3️⃣ Model Output with switchable character personas.
7. **Zero Silent Fallback & Strict Validation**: Unknown or unsupported model names return an immediate `HTTP 404 Model Not Found`. If an upstream model returns an error (404/400/503), the proxy never silently swaps models; it returns the exact error diagnostic.
8. **Decoupled Thinking Tokens**: Automatically provisions full upstream `maxOutputTokens` headroom (16k+ tokens) so Gemini 3.7 thinking tokens never cannibalize the client's visible response budget.
9. **50/50 Round-Robin Load Balancing**: Evenly distributes generation requests across Google OAuth accounts on every turn with instantaneous failover on 429 quota exhaustion.
10. **Lorebary & Lorebook Injection Tracking**: Passively extracts dynamic `<lore>`, `<world_info>`, and `<memory>` entries and renders an interactive turn-by-turn inspection panel in the Logged Chats explorer.
11. **Passive Cloud Logging & 1-Click DB Wipe**: Upstash Redis REST `/pipeline` batch persistence strictly in the background for the dashboard's Logged Chats explorer with 0ms impact on completion latency and 1-click database flush.
12. **In-Chat Control Commands & History Sanitization**: In-band control commands (`<MYSETTINGS>`, `<ENABLE: X, Y>`, `<DISABLE: X, Y>`, `<INJECTIONS: ON/OFF>`) allow real-time module inspection and toggling directly inside roleplay chat boxes with 0ms delay, 0 Google API quota cost, and automatic sanitization of past command turns from upstream prompts to ensure 100% character immersion.

---

## 2. Google CloudCode PA Wire Protocol & Invariants

### A. Turn Bounding Rules (`contents` Structure)
Google Antigravity's internal API (`streamGenerateContent?alt=sse`) strictly enforces the following conversation structure:
* **Rule 1 (Start Boundary)**: The `contents` array **MUST ALWAYS begin with a `role: "user"` turn**. If the first turn is `model`, the proxy prepends a dummy user turn (`{ role: 'user', parts: [{ text: '...' }] }`).
* **Rule 2 (End Boundary)**: The `contents` array **MUST ALWAYS terminate with a `role: "user"` turn**.
  - *Failure Mode*: If client regeneration, swipe, or prefill causes `contents` to end on `role: "model"`, Google immediately returns `HTTP 400 Bad Request: Requests ending with a model turn are not supported (INVALID_ARGUMENT)`.
  - *Enforcement Invariant*: In `transformOpenAIToAntigravity`, if the terminal turn is `role: "model"`, the proxy automatically appends:
    ```json
    { "role": "user", "parts": [{ "text": "Continue the scenario and dialogue naturally." }] }
    ```
* **Rule 3 (Role Alternation & Merging)**: Google does not support consecutive same-role turns (`user -> user` or `model -> model`). The proxy merges consecutive same-role messages with `\n\n` separators.

### B. Upstream Endpoint Priority & Routing
```
Client Request
      │
      ▼
Check Account Pool ──(Cooldown Check)──► If all cooling down ──► Return 429 + IST Countdown
      │
      ▼
Try Account 1
      │
      ├─► 1. Primary: daily-cloudcode-pa.googleapis.com (Unconstrained pool)
      │        └─► On 200 OK ──► Stream Response to Client
      │        └─► On 503/404 ──► Auto-fallback to gemini-3.7-flash-tiered on same pipe
      │
      ├─► 2. Secondary: cloudcode-pa.googleapis.com (Public production pipe)
      │
      └─► On 429/503 across pipes ──► Failover to Account 2
```

---

## 3. Rate Limit Handling & Non-Resetting Cooldown Engine

### A. The Timer Reset Loop Prevention
When all accounts are in a cooldown state (`cooldownUntil > now`):
1. **The Bug That Was Fixed**: Premature retry calls previously picked an account still in cooldown and sent a request to Google. Google returned 429 again, which pushed the cooldown forward another +20 seconds every single time the user clicked Send.
2. **The Hardened Invariant**: If `availableAccounts.length === 0`, the proxy **immediately returns `HTTP 429` without making upstream calls to Google**. This allows the 20s cooldown timer to genuinely tick down to 0s and expire.
3. **Error Classification**:
   - `HTTP 400 Bad Request` (payload/formatting errors) **NEVER triggers account cooldowns**.
   - Only `HTTP 429 (Resource Exhausted)` and `HTTP 503 (No Capacity)` trigger the 20-second cooldown window.

### B. Multi-Account Error Diagnostics & IST Time Format
Error payloads provide complete visibility across the entire account pool and format time in **Indian Standard Time (`Asia/Kolkata` / IST)**:
```json
{
  "error": {
    "message": "[Proxy Rate Limit]: All Google accounts in pool rate-limited. [yashv3050@gmail.com: Cooldown (12s) | manishflamingopharma@gmail.com: Cooldown (18s)]. Earliest account ready in 12s at 06:46:30 pm IST.",
    "type": "upstream_rate_limit",
    "code": 429,
    "retry_after": 12,
    "refresh_in_seconds": 12,
    "ready_at": "06:46:30 pm IST",
    "accounts_status": [
      { "name": "yashv3050@gmail.com", "cooldown_remaining_sec": 12 },
      { "name": "manishflamingopharma@gmail.com", "cooldown_remaining_sec": 18 }
    ]
  }
}
```

---

## 4. Prompt Engineering & Markdown Formatting Enforcement

### A. 13K+ System Prompt Preservation
- **Preamble Removal**: Stripped out legacy Google DeepMind coding assistant developer preambles.
- **Multi-System Message Unification**: When clients pass multiple `system` messages (Character Card + Jailbreak + Custom Prompt + Post-History Instructions), all unique system blocks are combined into `systemInstruction` rather than dropped.
- **Session Caching**: The full character prompt is stored in `session.systemPrompt` so that if the client truncates earlier turns during long chats, the proxy automatically restores the full character definition.

### B. Depth-0 Formatting & Persona Anchor
To prevent Gemini 3.7 from dropping markdown syntax during extended thinking (thinking budgets of 2k–64k tokens), the proxy injects an active formatting directive directly into the **terminal user turn (Depth 0)**:
```markdown
[Active Formatting & Character Persona Directive]:
• Adhere strictly to character markdown syntax:
  - Wrap all character actions, scene narration, and physical movements in *asterisks* (e.g. *she pauses, looking away*).
  - Wrap all spoken dialogue in "double quotes" (e.g. "What do you mean?").
  - Wrap inner thoughts, telepathy, or internal monologues in `backticks` (e.g. `I hope he didn't notice...`).
• Maintain full immersion in character persona, lore, and speech habits without breaking character.
```

---

## 5. Lossless Memory Engine & Upstash Redis Architecture

### A. Dual-Mode Storage
1. **Cloud Mode (Upstash Redis REST)**:
   - Uses `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
   - All Redis commands are executed via **`HTTP POST` with JSON array body `[command, ...args]`** to bypass URL length limitations on multi-megabyte payloads.
2. **In-Memory Fallback**:
   - In the absence of Upstash credentials, maintains an in-memory session map.

### B. Session Lifecycle & Synchronization
1. **Fingerprinting (`deriveChatFingerprint`)**:
   - Computes deterministic SHA-256 hashes from character name, first user turn, system prompt fragments, and custom headers (`x-chat-id`, `x-character-name`).
2. **Regeneration & Rewind Pruning (`syncSessionWithIncomingMessages`)**:
   - When a user deletes messages or swipes to regenerate, the memory engine identifies the active user turn and trims any orphaned assistant turns from previous generations.
3. **Lossless Stitching (`stitchLosslessHistory`)**:
   - Reconstructs the complete history from the session archive while preserving all system prompts and guaranteeing the final message terminates on the active user turn.

---

## 6. Live Dashboard & Telemetry API

### A. Live Endpoints
| Route | Method | Description |
|---|---|---|
| `/` | `GET` | Interactive Glassmorphism Dashboard |
| `/api/status` | `GET` | Live gateway telemetry, account cooldowns, active commit SHA, models catalog |
| `/api/memory` | `GET, DELETE` | Session inspector and memory manager |
| `/v1/chat/completions` | `POST` | OpenAI-compatible streaming & non-streaming chat completions |
| `/v1/models` | `GET` | OpenAI-compatible models list |

### B. Dashboard Features
- **🚀 Update Logs**: Chronological version timeline (`v2.2.5`, `v2.2.0`, `v2.1.0`, etc.) with 1-click GitHub commit links and live latency ping.
- **⏱️ 1-Second Real-Time Ticker**: Active `setInterval` countdown for account cooldowns ticking down every second without manual page refresh.
- **📚 Logged Chats Explorer**: Browse, inspect, search, and export full multi-turn conversation logs and reasoning thoughts.
- **⚙️ Model Controls**: Dynamic thinking token budget slider (Off, 2k, 8k, 24k, 64k), temperature, and top-p sampling controls.

---

## 7. Operational Runbook & Deployment Guide

### A. Adding / Rotating Google Accounts
Add the following environment variables in Vercel (**Project Settings &rarr; Environment Variables**):
```env
ACCOUNT_1_NAME=yashv3050@gmail.com
ACCOUNT_1_REFRESH_TOKEN=<google-oauth-refresh-token>
ACCOUNT_1_PROJECT_ID=primeval-dreamer-xxspj

ACCOUNT_2_NAME=manishflamingopharma@gmail.com
ACCOUNT_2_REFRESH_TOKEN=<second-google-refresh-token>
ACCOUNT_2_PROJECT_ID=trusty-arch-pc9s2

ACCOUNT_3_NAME=thirdaccount@gmail.com
ACCOUNT_3_REFRESH_TOKEN=<third-google-refresh-token>
ACCOUNT_3_PROJECT_ID=<third-project-id>
```

### B. Upstash Redis Persistence Setup
```env
UPSTASH_REDIS_REST_URL=https://<your-database>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<your-upstash-token>
```

### C. Build & Verification Commands
```bash
# Build & typecheck
npm run build

# Commit and push directly to Vercel production
git add .
git commit -m "Deploy update"
git push origin main

# Verify live deployment
curl -s "https://antigravity-vercel-proxy-three.vercel.app/api/status" -H "Authorization: Bearer KARS-2010915"
```
