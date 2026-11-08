import { NextRequest } from 'next/server';
import { handleChatCompletions } from '../lib/completions';
import * as fs from 'fs';

// Load .env.local manually
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim();
      process.env[k] = v;
    }
  }
} catch (e) {}

async function testNonStreaming() {
  console.log("\n================ 1. Testing Non-Streaming Gemini 4 Argon ================");
  const req = new NextRequest('http://localhost:3000/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer KARS-2010915'
    },
    body: JSON.stringify({
      model: 'gemini-4-argon-medium',
      messages: [
        {
          role: 'system',
          content: 'You are an ancient mystical dragon living inside an obsidian volcano.'
        },
        {
          role: 'user',
          content: 'State your name and purpose in one powerful sentence.'
        }
      ],
      stream: false
    })
  });

  const res = await handleChatCompletions(req);
  console.log(`HTTP Status: ${res.status}`);
  const json = await res.json();
  console.log("Response JSON:", JSON.stringify(json, null, 2));

  if (res.status === 200 && json.choices?.[0]?.message?.content) {
    console.log("✅ NON-STREAMING TEST PASSED!");
  } else {
    console.error("❌ NON-STREAMING TEST FAILED!");
  }
}

async function testStreaming() {
  console.log("\n================ 2. Testing Streaming Gemini 4 Argon ================");
  const req = new NextRequest('http://localhost:3000/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer KARS-2010915'
    },
    body: JSON.stringify({
      model: 'gemini-4-argon-medium',
      messages: [
        {
          role: 'user',
          content: 'Say hello in 3 words'
        }
      ],
      stream: true
    })
  });

  const res = await handleChatCompletions(req);
  console.log(`HTTP Status: ${res.status}`);
  console.log(`Content-Type: ${res.headers.get('content-type')}`);

  if (res.status !== 200) {
    console.error("Failed stream status:", await res.text());
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    console.error("No stream reader!");
    return;
  }

  const decoder = new TextDecoder();
  let receivedContent = '';
  let receivedThinking = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    const lines = text.split('\n');
    for (const l of lines) {
      if (l.startsWith('data: ') && !l.includes('[DONE]')) {
        try {
          const parsed = JSON.parse(l.slice(6));
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) receivedContent += delta.content;
          if (delta?.reasoning_content) receivedThinking += delta.reasoning_content;
        } catch {}
      }
    }
  }

  console.log("\nStreamed Content:", receivedContent);
  if (receivedThinking) console.log("Streamed Thinking:", receivedThinking);
  console.log("✅ STREAMING TEST PASSED!");
}

async function main() {
  await testNonStreaming();
  await testStreaming();
}

main().catch(console.error);
