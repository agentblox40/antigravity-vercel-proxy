import { NextRequest } from 'next/server';
import { handleChatCompletions } from '../lib/completions';
import assert from 'node:assert';

async function testStreamingCompletion(model: string) {
  console.log(`\n--- Testing handleChatCompletions (stream: true) with model: '${model}' ---`);
  const reqBody = {
    model,
    messages: [
      { role: 'user', content: 'Say "hello world" in exactly two words.' }
    ],
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

  const res = await handleChatCompletions(req);
  console.log(`Response status: ${res.status} ${res.statusText}`);
  assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);

  const reader = res.body?.getReader();
  assert.ok(reader, 'Readable stream must exist');

  const decoder = new TextDecoder();
  let fullContent = '';
  let fullReasoning = '';
  let seenDone = false;
  let chunkCount = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;
      if (trimmed === 'data: [DONE]') {
        seenDone = true;
        continue;
      }
      if (trimmed.startsWith('data: ')) {
        chunkCount++;
        try {
          const json = JSON.parse(trimmed.slice(6));
          const delta = json.choices?.[0]?.delta;
          if (delta) {
            if (delta.content) fullContent += delta.content;
            const r = delta.reasoning_content || delta.reasoning;
            if (r) fullReasoning += r;
          }
        } catch {}
      }
    }
  }

  console.log(`Received ${chunkCount} chunks, [DONE]=${seenDone}`);
  console.log(`Content: "${fullContent.trim()}"`);
  if (fullReasoning) {
    console.log(`Reasoning snippet: "${fullReasoning.trim().slice(0, 80)}..."`);
  }
  assert.ok(seenDone, 'Terminal [DONE] event must be received');
  assert.ok(fullContent.trim().length > 0, 'Content must not be empty');
  console.log(`✅ Streaming test passed for '${model}'.`);
}

async function testNonStreamingCompletion(model: string) {
  console.log(`\n--- Testing handleChatCompletions (stream: false) with model: '${model}' ---`);
  const reqBody = {
    model,
    messages: [
      { role: 'user', content: 'Say "goodbye world" in exactly two words.' }
    ],
    stream: false
  };

  const req = new NextRequest('http://localhost:3000/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': 'Bearer KARS-2010915'
    },
    body: JSON.stringify(reqBody)
  });

  const res = await handleChatCompletions(req);
  console.log(`Response status: ${res.status} ${res.statusText}`);
  assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);

  const json: any = await res.json();
  console.log('Returned JSON:', JSON.stringify(json, null, 2));

  assert.strictEqual(json.object, 'chat.completion');
  assert.ok(Array.isArray(json.choices) && json.choices.length > 0, 'choices must exist');
  const message = json.choices[0].message;
  assert.strictEqual(message.role, 'assistant');
  assert.ok(typeof message.content === 'string' && message.content.trim().length > 0, 'content must not be empty');
  console.log(`✅ Non-streaming test passed for '${model}'.`);
}

async function run() {
  console.log('🚀 RUNNING END-TO-END PROXY COMPLETIONS VERIFICATION');
  
  // 1. Streaming test with big-pickle
  await testStreamingCompletion('big-pickle');

  // 2. Non-streaming test with big-pickle
  await testNonStreamingCompletion('big-pickle');

  // 3. Streaming test with alias 'snow-bunny' -> 'space-bunny-free'
  await testStreamingCompletion('snow-bunny');

  // 4. Non-streaming test with cat-jam-free
  await testNonStreamingCompletion('cat-jam-free');

  console.log('\n🎉 ALL END-TO-END COMPLETIONS VERIFICATIONS PASSED SUCCESSFULLY!');
}

run().catch(err => {
  console.error('E2E Verification Error:', err);
  process.exit(1);
});
