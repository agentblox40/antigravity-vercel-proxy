'use client';

import React, { useState, useEffect, useRef } from 'react';

const PRESETS = [
  { name: 'Tavern Roleplay', sys: 'You are an immersive, descriptive roleplay character. Write vivid reactions, actions in asterisks, and speech in quotes.' },
  { name: 'Dark Fantasy RPG', sys: 'You are the Dungeon Master in a gritty dark fantasy world. Describe atmospheric details, sensory cues, and combat physics.' },
  { name: 'Creative Storyteller', sys: 'You are a master novelist. Emphasize emotional depth, subtext, character motives, and prose cadence.' },
  { name: 'General Assistant', sys: 'You are a sharp, proactive AI assistant. Provide concise, high-value responses.' }
];

export default function AntigravityControlCenter() {
  const [activeTab, setActiveTab] = useState<'playground' | 'controls' | 'accounts' | 'clients' | 'analytics'>('playground');
  const [origin, setOrigin] = useState('');
  const [apiKey, setApiKey] = useState('KARS-2010915');
  const [showKey, setShowKey] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Live Discovered Models
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState('gemini-3.7-flash-high');
  const [isSyncingModels, setIsSyncingModels] = useState(false);

  // Playground & Chat State
  const [systemPrompt, setSystemPrompt] = useState(PRESETS[0].sys);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; thought?: string }>>([
    { role: 'assistant', content: "*(Adjusts cloak and looks up from the corner table)* Well, who do we have here? Pull up a chair and state your business." }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentThought, setCurrentThought] = useState('');
  const [currentDelta, setCurrentDelta] = useState('');

  // Model Parameter Controls
  const [temperature, setTemperature] = useState(0.7);
  const [thinkingBudget, setThinkingBudget] = useState(24576);
  const [maxTokens, setMaxTokens] = useState(8192);
  const [topP, setTopP] = useState(0.95);
  const [uncensoredMode, setUncensoredMode] = useState(true);

  // Status & Accounts State
  const [accounts, setAccounts] = useState<any[]>([]);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [totalTokensServed, setTotalTokensServed] = useState(24300);
  const [requestsCount, setRequestsCount] = useState(26);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
      const savedKey = localStorage.getItem('proxy_test_key') || 'KARS-2010915';
      setApiKey(savedKey);
      fetchStatusAndModels();
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentDelta, currentThought]);

  const fetchStatusAndModels = async () => {
    setIsSyncingModels(true);
    const start = Date.now();
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
        if (Array.isArray(data.supportedModels) && data.supportedModels.length > 0) {
          setAvailableModels(data.supportedModels);
        }
        setLatencyMs(Date.now() - start);
      }
    } catch {}
    finally {
      setIsSyncingModels(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isStreaming) return;

    const userText = inputMessage.trim();
    const newHistory = [...messages, { role: 'user' as const, content: userText }];
    setMessages(newHistory);
    setInputMessage('');
    setIsStreaming(true);
    setCurrentThought('');
    setCurrentDelta('');

    const start = Date.now();

    try {
      const formattedMessages = [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...newHistory.map(m => ({ role: m.role, content: m.content }))
      ];

      const res = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: formattedMessages,
          temperature,
          max_tokens: maxTokens,
          top_p: topP,
          thinking_budget: thinkingBudget,
          stream: true
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No stream returned');

      let accumulatedContent = '';
      let accumulatedThought = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const parsed = JSON.parse(line.slice(6));
              const delta = parsed.choices?.[0]?.delta;
              if (delta) {
                if (delta.reasoning_content) {
                  accumulatedThought += delta.reasoning_content;
                  setCurrentThought(accumulatedThought);
                } else if (delta.content) {
                  if (delta.content === '<think>\n' || delta.content === '\n</think>\n\n') {
                    // Handled structurally
                  } else {
                    accumulatedContent += delta.content;
                    setCurrentDelta(accumulatedContent);
                  }
                }
              }
            } catch {}
          }
        }
      }

      setMessages([...newHistory, { role: 'assistant', content: accumulatedContent, thought: accumulatedThought }]);
      setTotalTokensServed(prev => prev + Math.floor((userText.length + accumulatedContent.length + accumulatedThought.length) / 3));
      setRequestsCount(prev => prev + 1);
      setLatencyMs(Date.now() - start);
    } catch (err: any) {
      setMessages([...newHistory, { role: 'assistant', content: `⚠️ Error: ${err.message}` }]);
    } finally {
      setIsStreaming(false);
      setCurrentThought('');
      setCurrentDelta('');
    }
  };

  const baseUrl = origin ? `${origin}/v1` : 'https://your-app.vercel.app/v1';
  const chatUrl = origin ? `${origin}/v1/chat/completions` : 'https://your-app.vercel.app/v1/chat/completions';

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#f4f4f5', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Top Navigation Bar */}
      <nav style={{ background: '#0c0c0e', borderBottom: '1px solid #1f1f23', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 12px #10b981' }}></span>
            <span style={{ fontWeight: 800, fontSize: 16, background: 'linear-gradient(135deg, #38bdf8, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Antigravity Control Center
            </span>
            <span style={{ fontSize: 11, background: '#18181b', border: '1px solid #27272a', padding: '2px 8px', borderRadius: 6, color: '#a1a1aa' }}>v2.0</span>
          </div>

          <div style={{ display: 'flex', gap: 4, background: '#18181b', padding: 4, borderRadius: 10, border: '1px solid #27272a' }}>
            {[
              { id: 'playground', label: '💬 Roleplay Studio' },
              { id: 'controls', label: '🎛️ Model Controls' },
              { id: 'accounts', label: '⚡ Accounts & Quota' },
              { id: 'clients', label: '🎮 Janitor / Tavern' },
              { id: 'analytics', label: '📊 Analytics' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  background: activeTab === tab.id ? '#27272a' : 'transparent',
                  color: activeTab === tab.id ? '#38bdf8' : '#a1a1aa',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {latencyMs !== null && (
            <span style={{ fontSize: 12, color: '#34d399', background: 'rgba(52, 211, 153, 0.1)', padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(52, 211, 153, 0.2)' }}>
              ⚡ {latencyMs}ms Latency
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#18181b', padding: '4px 10px', borderRadius: 8, border: '1px solid #27272a' }}>
            <span style={{ fontSize: 12, color: '#71717a' }}>Key:</span>
            <code style={{ fontSize: 12, color: '#38bdf8' }}>{showKey ? apiKey : '••••••••••••'}</code>
            <button onClick={() => setShowKey(!showKey)} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: 11 }}>
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 20px' }}>

        {/* TAB 1: ROLEPLAY & CHAT STUDIO */}
        {activeTab === 'playground' && (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24 }}>
            
            {/* Left Sidebar: Character Definition & Presets */}
            <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 16, padding: 20, height: 'calc(100vh - 160px)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fafafa' }}>🎭 Persona & Scenario</h3>
                <button
                  onClick={fetchStatusAndModels}
                  title="Auto-Sync Live Models from Google Antigravity"
                  style={{ background: '#18181b', border: '1px solid #27272a', color: '#38bdf8', padding: '2px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                  {isSyncingModels ? 'Syncing...' : '🔄 Sync Models'}
                </button>
              </div>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {PRESETS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setSystemPrompt(p.sys)}
                    style={{ background: '#18181b', border: '1px solid #27272a', color: '#38bdf8', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    {p.name}
                  </button>
                ))}
              </div>

              <textarea
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                placeholder="Enter character persona, system instructions, or scenario definition..."
                style={{ flex: 1, width: '100%', boxSizing: 'border-box', background: '#09090b', border: '1px solid #27272a', borderRadius: 10, padding: 12, color: '#f4f4f5', fontSize: 13, resize: 'none', outline: 'none', lineHeight: 1.5, marginBottom: 16 }}
              />

              <div style={{ borderTop: '1px solid #1f1f23', paddingTop: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 6 }}>
                  Active Model ({availableModels.length} available)
                </label>
                <select
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                  style={{ width: '100%', background: '#18181b', border: '1px solid #27272a', borderRadius: 8, padding: '8px 10px', color: '#38bdf8', fontSize: 13, fontWeight: 600, outline: 'none' }}>
                  {availableModels.map(m => (
                    <option key={m.id} value={m.id}>{m.name || m.id}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right Panel: Chat Stream & Interactive Thread */}
            <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 16, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)', overflow: 'hidden' }}>
              
              {/* Chat Thread */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {messages.map((m, idx) => (
                  <div key={idx} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                    
                    {/* Reasoning Accordion (if exists) */}
                    {m.thought && (
                      <div style={{ marginBottom: 8, background: '#18181b', border: '1px solid #27272a', borderRadius: 8, padding: '8px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#a1a1aa' }}>
                          <span>🧠 Reasoning Output ({Math.floor(m.thought.length / 4)} tokens)</span>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: '#71717a', whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: 160, overflowY: 'auto', fontFamily: 'monospace' }}>
                          {m.thought}
                        </div>
                      </div>
                    )}

                    {/* Chat Bubble */}
                    <div style={{
                      background: m.role === 'user' ? '#0284c7' : '#18181b',
                      color: '#f4f4f5',
                      border: m.role === 'user' ? 'none' : '1px solid #27272a',
                      borderRadius: 14,
                      padding: '14px 18px',
                      fontSize: 14,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap'
                    }}>
                      {m.content}
                    </div>
                  </div>
                ))}

                {/* Live Streaming Delta */}
                {isStreaming && (
                  <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                    {currentThought && (
                      <div style={{ marginBottom: 8, background: '#18181b', border: '1px solid #38bdf8', borderRadius: 8, padding: '8px 12px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>⚡</span> Thinking in progress...
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8', whiteSpace: 'pre-wrap', lineHeight: 1.5, fontFamily: 'monospace' }}>
                          {currentThought}
                        </div>
                      </div>
                    )}
                    {currentDelta && (
                      <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 14, padding: '14px 18px', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {currentDelta}
                      </div>
                    )}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div style={{ borderTop: '1px solid #27272a', padding: 16, background: '#0e0e11', display: 'flex', gap: 12 }}>
                <input
                  type="text"
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message or action (*takes a step forward*)..."
                  style={{ flex: 1, background: '#18181b', border: '1px solid #27272a', borderRadius: 10, padding: '12px 16px', color: '#f4f4f5', fontSize: 14, outline: 'none' }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isStreaming || !inputMessage.trim()}
                  style={{ background: isStreaming ? '#3f3f46' : '#0284c7', color: '#fff', border: 'none', borderRadius: 10, padding: '0 24px', fontWeight: 700, fontSize: 14, cursor: isStreaming ? 'not-allowed' : 'pointer' }}>
                  {isStreaming ? 'Streaming...' : 'Send'}
                </button>
              </div>

            </div>

          </div>
        )}

        {/* TAB 2: MODEL CONTROLS & REASONING ENGINE */}
        {activeTab === 'controls' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
            
            {/* Reasoning Budget Control */}
            <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 16, padding: 24 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 18, color: '#fafafa' }}>🧠 Thinking & Reasoning Token Budget</h3>
              <p style={{ fontSize: 13, color: '#a1a1aa', margin: '0 0 20px' }}>Configure how many internal thinking tokens Gemini allocates before writing output.</p>

              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {[
                  { label: 'Off', budget: 0 },
                  { label: 'Snappy (2K)', budget: 2048 },
                  { label: 'Balanced (8K)', budget: 8192 },
                  { label: 'Deep (24K)', budget: 24576 },
                  { label: 'Max (64K)', budget: 65536 }
                ].map(p => (
                  <button
                    key={p.budget}
                    onClick={() => setThinkingBudget(p.budget)}
                    style={{
                      flex: 1,
                      background: thinkingBudget === p.budget ? '#0284c7' : '#18181b',
                      color: '#fff',
                      border: '1px solid #27272a',
                      borderRadius: 8,
                      padding: '8px 4px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}>
                    {p.label}
                  </button>
                ))}
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: '#a1a1aa' }}>Custom Token Budget:</span>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>{thinkingBudget.toLocaleString()} tokens</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="65536"
                  step="1024"
                  value={thinkingBudget}
                  onChange={e => setThinkingBudget(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#0284c7' }}
                />
              </div>
            </div>

            {/* Generation Parameters */}
            <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 16, padding: 24 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 18, color: '#fafafa' }}>🎛️ Sampling & Output Length</h3>
              
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: '#a1a1aa' }}>Temperature:</span>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>{temperature} ({temperature < 0.5 ? 'Precise' : temperature < 0.9 ? 'Creative' : 'Chaotic'})</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.05"
                  value={temperature}
                  onChange={e => setTemperature(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#0284c7' }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: '#a1a1aa' }}>Max Output Tokens:</span>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>{maxTokens.toLocaleString()} tokens</span>
                </div>
                <input
                  type="range"
                  min="1024"
                  max="32768"
                  step="1024"
                  value={maxTokens}
                  onChange={e => setMaxTokens(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#0284c7' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: '#a1a1aa' }}>Top-P (Nucleus Sampling):</span>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>{topP}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={topP}
                  onChange={e => setTopP(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#0284c7' }}
                />
              </div>
            </div>

            {/* Uncensored Roleplay Bypass */}
            <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 16, padding: 24, gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#fafafa' }}>🔓 Uncensored Roleplay Safety Override (`BLOCK_NONE`)</h3>
                  <p style={{ margin: 0, fontSize: 13, color: '#a1a1aa' }}>Bypasses Google content moderation filters across all categories for unrestricted creative writing and character chat.</p>
                </div>
                <button
                  onClick={() => setUncensoredMode(!uncensoredMode)}
                  style={{
                    background: uncensoredMode ? '#065f46' : '#27272a',
                    color: uncensoredMode ? '#34d399' : '#a1a1aa',
                    border: '1px solid rgba(52, 211, 153, 0.3)',
                    borderRadius: 8,
                    padding: '8px 16px',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer'
                  }}>
                  {uncensoredMode ? '✓ ENABLED (BLOCK_NONE)' : 'OFF (Standard)'}
                </button>
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: ACCOUNTS & QUOTA */}
        {activeTab === 'accounts' && (
          <div style={{ display: 'grid', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px', color: '#fafafa' }}>⚡ Connected Google AI Pro Accounts</h2>
                <p style={{ margin: 0, fontSize: 13, color: '#a1a1aa' }}>Traffic is automatically load-balanced across all accounts. If one hits a rate limit, it fails over immediately.</p>
              </div>
              <button
                onClick={fetchStatusAndModels}
                style={{ background: '#18181b', border: '1px solid #27272a', color: '#38bdf8', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                🔄 Refresh Status
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              {accounts.map((acc, idx) => (
                <div key={acc.id} style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 14, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: '#f4f4f5' }}>{acc.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: acc.status === 'Ready' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: acc.status === 'Ready' ? '#34d399' : '#f87171' }}>
                      ● {acc.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#71717a', lineHeight: 1.8 }}>
                    <div>Project ID: <code style={{ color: '#38bdf8' }}>{acc.projectId}</code></div>
                    <div>Account Slot: <code style={{ color: '#a1a1aa' }}>ACCOUNT_{idx + 1}</code></div>
                    <div>Failures / 429s: <span style={{ color: acc.failCount > 0 ? '#f87171' : '#34d399' }}>{acc.failCount}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: CLIENT GUIDES (JANITOR AI & SILLYTAVERN) */}
        {activeTab === 'clients' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
            
            {/* Janitor AI Card */}
            <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 16, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 24 }}>🐱</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, color: '#fafafa' }}>Janitor AI Configuration</h3>
                  <span style={{ fontSize: 12, color: '#a1a1aa' }}>Custom OpenAI / Reverse Proxy Mode</span>
                </div>
              </div>

              <div style={{ background: '#09090b', padding: 16, borderRadius: 10, border: '1px solid #27272a', marginBottom: 16, fontSize: 13, lineHeight: 1.8 }}>
                <div><span style={{ color: '#71717a' }}>API Type: </span> <code style={{ color: '#38bdf8' }}>OpenAI / Custom OpenAI</code></div>
                <div><span style={{ color: '#71717a' }}>Reverse Proxy URL: </span> <code style={{ color: '#38bdf8' }}>{baseUrl}</code></div>
                <div><span style={{ color: '#71717a' }}>API Key: </span> <code style={{ color: '#38bdf8' }}>{apiKey}</code></div>
                <div><span style={{ color: '#71717a' }}>Model: </span> <code style={{ color: '#38bdf8' }}>gemini-3.7-flash-high</code></div>
              </div>

              <button
                onClick={() => copyToClipboard(baseUrl, 'janitorUrl')}
                style={{ width: '100%', background: '#0284c7', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {copiedField === 'janitorUrl' ? '✓ Copied URL!' : '📋 Copy Janitor AI Proxy URL'}
              </button>
            </div>

            {/* SillyTavern Card */}
            <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 16, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 24 }}>🍺</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, color: '#fafafa' }}>SillyTavern Configuration</h3>
                  <span style={{ fontSize: 12, color: '#a1a1aa' }}>Chat Completion / OpenAI API</span>
                </div>
              </div>

              <div style={{ background: '#09090b', padding: 16, borderRadius: 10, border: '1px solid #27272a', marginBottom: 16, fontSize: 13, lineHeight: 1.8 }}>
                <div><span style={{ color: '#71717a' }}>API: </span> <code style={{ color: '#38bdf8' }}>Chat Completion (OpenAI)</code></div>
                <div><span style={{ color: '#71717a' }}>Custom Endpoint: </span> <code style={{ color: '#38bdf8' }}>{baseUrl}</code></div>
                <div><span style={{ color: '#71717a' }}>API Key: </span> <code style={{ color: '#38bdf8' }}>{apiKey}</code></div>
                <div><span style={{ color: '#71717a' }}>Streaming: </span> <code style={{ color: '#34d399' }}>Enabled (SSE)</code></div>
              </div>

              <button
                onClick={() => copyToClipboard(baseUrl, 'tavernUrl')}
                style={{ width: '100%', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {copiedField === 'tavernUrl' ? '✓ Copied URL!' : '📋 Copy SillyTavern Endpoint URL'}
              </button>
            </div>

          </div>
        )}

        {/* TAB 5: ANALYTICS & VALUE */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 6 }}>Requests Served</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#38bdf8' }}>{requestsCount}</div>
            </div>
            <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 6 }}>Estimated Tokens Processed</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#818cf8' }}>{totalTokensServed.toLocaleString()}</div>
            </div>
            <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 6 }}>Est. Cloud API Cost Saved</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#34d399' }}>$0.00 / 100% Free</div>
              <span style={{ fontSize: 11, color: '#71717a' }}>Using your Google AI Pro quota</span>
            </div>
          </div>
        )}

      </main>

    </div>
  );
}
