'use client';

import React, { useState, useEffect, useRef } from 'react';

const PRESETS = [
  { name: 'Tavern Roleplay', sys: 'You are an immersive, descriptive roleplay character. Write vivid reactions, actions in asterisks, and speech in quotes.' },
  { name: 'Dark Fantasy RPG', sys: 'You are the Dungeon Master in a gritty dark fantasy world. Describe atmospheric details, sensory cues, and combat physics.' },
  { name: 'Creative Storyteller', sys: 'You are a master novelist. Emphasize emotional depth, subtext, character motives, and prose cadence.' },
  { name: 'General Assistant', sys: 'You are a sharp, proactive AI assistant. Provide concise, high-value responses.' }
];

export default function AntigravityControlCenter() {
  const [activeTab, setActiveTab] = useState<'playground' | 'models' | 'controls' | 'accounts' | 'clients' | 'analytics'>('models');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

  const [origin, setOrigin] = useState('');
  const [apiKey, setApiKey] = useState('KARS-2010915');
  const [showKey, setShowKey] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Live Discovered Models & Search
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
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
  const [totalTokensServed, setTotalTokensServed] = useState(28900);
  const [requestsCount, setRequestsCount] = useState(32);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Theme Detection & Management
  useEffect(() => {
    const savedTheme = (localStorage.getItem('proxy_ui_theme') as any) || 'system';
    setTheme(savedTheme);

    const applyTheme = () => {
      if (savedTheme === 'dark') setEffectiveTheme('dark');
      else if (savedTheme === 'light') setEffectiveTheme('light');
      else {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        setEffectiveTheme(prefersDark ? 'dark' : 'light');
      }
    };

    applyTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (theme === 'system') setEffectiveTheme(e.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, [theme]);

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem('proxy_ui_theme', newTheme);
    if (newTheme === 'dark') setEffectiveTheme('dark');
    else if (newTheme === 'light') setEffectiveTheme('light');
    else {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      setEffectiveTheme(prefersDark ? 'dark' : 'light');
    }
  };

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

  const isDark = effectiveTheme === 'dark';

  // Dynamic Theme Colors
  const colors = {
    bg: isDark ? '#09090b' : '#f8fafc',
    navBg: isDark ? '#0c0c0e' : '#ffffff',
    cardBg: isDark ? '#121215' : '#ffffff',
    cardInner: isDark ? '#18181b' : '#f1f5f9',
    inputBg: isDark ? '#09090b' : '#ffffff',
    border: isDark ? '#27272a' : '#e2e8f0',
    borderMuted: isDark ? '#1f1f23' : '#f1f5f9',
    textMain: isDark ? '#f4f4f5' : '#0f172a',
    textMuted: isDark ? '#a1a1aa' : '#64748b',
    textSub: isDark ? '#71717a' : '#94a3b8',
    accent: '#0284c7',
    accentHover: '#0369a1',
    cardShadow: isDark ? '0 10px 30px -10px rgba(0,0,0,0.5)' : '0 4px 20px -2px rgba(0,0,0,0.05)',
  };

  const filteredModels = availableModels.filter(m => 
    m.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (m.name && m.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (m.desc && m.desc.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const baseUrl = origin ? `${origin}/v1` : 'https://your-app.vercel.app/v1';
  const chatUrl = origin ? `${origin}/v1/chat/completions` : 'https://your-app.vercel.app/v1/chat/completions';

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.textMain, fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', transition: 'background-color 0.2s, color 0.2s' }}>
      
      {/* Top Navigation Bar */}
      <nav style={{ background: colors.navBg, borderBottom: `1px solid ${colors.border}`, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }}></span>
            <span style={{ fontWeight: 800, fontSize: 16, background: 'linear-gradient(135deg, #0284c7, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Antigravity Control Center
            </span>
            <span style={{ fontSize: 11, background: colors.cardInner, border: `1px solid ${colors.border}`, padding: '2px 8px', borderRadius: 6, color: colors.textMuted }}>v2.0</span>
          </div>

          <div style={{ display: 'flex', gap: 4, background: colors.cardInner, padding: 4, borderRadius: 10, border: `1px solid ${colors.border}` }}>
            {[
              { id: 'models', label: '🧠 Models Catalog' },
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
                  background: activeTab === tab.id ? (isDark ? '#27272a' : '#ffffff') : 'transparent',
                  color: activeTab === tab.id ? '#0284c7' : colors.textMuted,
                  boxShadow: (activeTab === tab.id && !isDark) ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
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
            <span style={{ fontSize: 12, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.2)', fontWeight: 600 }}>
              ⚡ {latencyMs}ms
            </span>
          )}

          {/* Theme Selector Toggle */}
          <div style={{ display: 'flex', background: colors.cardInner, padding: 3, borderRadius: 8, border: `1px solid ${colors.border}` }}>
            {[
              { id: 'light', icon: '☀️' },
              { id: 'dark', icon: '🌙' },
              { id: 'system', icon: '💻' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => handleThemeChange(t.id as any)}
                title={`Switch to ${t.id} mode`}
                style={{
                  background: theme === t.id ? (isDark ? '#27272a' : '#ffffff') : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 8px',
                  fontSize: 12,
                  cursor: 'pointer',
                  boxShadow: (theme === t.id && !isDark) ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                }}>
                {t.icon}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: colors.cardInner, padding: '4px 10px', borderRadius: 8, border: `1px solid ${colors.border}` }}>
            <span style={{ fontSize: 12, color: colors.textSub }}>Key:</span>
            <code style={{ fontSize: 12, color: '#0284c7', fontWeight: 600 }}>{showKey ? apiKey : '••••••••••••'}</code>
            <button onClick={() => setShowKey(!showKey)} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: 11, padding: 0 }}>
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 20px' }}>

        {/* TAB 1: 🧠 MODELS CATALOG (NEW COMPREHENSIVE TAB) */}
        {activeTab === 'models' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px', color: colors.textMain }}>
                  🧠 Antigravity Models Catalog ({availableModels.length})
                </h1>
                <p style={{ margin: 0, fontSize: 14, color: colors.textMuted }}>
                  Click <strong>Copy Model Name</strong> on any model below and paste it directly into Janitor AI or SillyTavern.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <input
                  type="text"
                  placeholder="Search models (flash, reasoning, claude, pro)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    background: colors.cardBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 13,
                    color: colors.textMain,
                    width: 260,
                    outline: 'none'
                  }}
                />
                <button
                  onClick={fetchStatusAndModels}
                  disabled={isSyncingModels}
                  style={{
                    background: colors.cardInner,
                    border: `1px solid ${colors.border}`,
                    color: '#0284c7',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: isSyncingModels ? 'not-allowed' : 'pointer'
                  }}>
                  {isSyncingModels ? 'Syncing...' : '🔄 Auto-Sync Live'}
                </button>
              </div>
            </div>

            {/* Model Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
              {filteredModels.map(m => (
                <div
                  key={m.id}
                  style={{
                    background: colors.cardBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 14,
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: colors.cardShadow,
                    transition: 'transform 0.15s, border-color 0.15s'
                  }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: m.id.includes('high') || m.id.includes('max') ? 'rgba(99, 102, 241, 0.1)' : 'rgba(2, 132, 199, 0.1)',
                        color: m.id.includes('high') || m.id.includes('max') ? '#6366f1' : '#0284c7'
                      }}>
                        {m.badge || 'Available'}
                      </span>
                      <span style={{ fontSize: 11, color: colors.textSub, fontWeight: 600 }}>
                        {m.context || '1M Context'}
                      </span>
                    </div>

                    <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: colors.textMain }}>
                      {m.name || m.id}
                    </h3>
                    <p style={{ margin: '0 0 14px', fontSize: 13, color: colors.textMuted, lineHeight: 1.5 }}>
                      {m.desc || `Google Antigravity upstream model ${m.id}`}
                    </p>
                  </div>

                  <div style={{ borderTop: `1px solid ${colors.borderMuted}`, paddingTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, fontSize: 12 }}>
                      <span style={{ color: colors.textSub }}>Thinking Tokens:</span>
                      <span style={{ fontWeight: 600, color: colors.textMain }}>{m.thinking || 'Auto'}</span>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <code style={{
                        flex: 1,
                        background: colors.cardInner,
                        border: `1px solid ${colors.border}`,
                        padding: '8px 10px',
                        borderRadius: 8,
                        fontSize: 12,
                        color: '#0284c7',
                        fontFamily: 'monospace',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {m.id}
                      </code>
                      <button
                        onClick={() => copyToClipboard(m.id, m.id)}
                        style={{
                          background: copiedField === m.id ? '#10b981' : '#0284c7',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '0 14px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}>
                        {copiedField === m.id ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: 💬 ROLEPLAY STUDIO */}
        {activeTab === 'playground' && (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24 }}>
            
            {/* Left Sidebar: Character Definition & Presets */}
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 20, height: 'calc(100vh - 160px)', display: 'flex', flexDirection: 'column', boxShadow: colors.cardShadow }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.textMain }}>🎭 Persona & Scenario</h3>
              </div>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {PRESETS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setSystemPrompt(p.sys)}
                    style={{ background: colors.cardInner, border: `1px solid ${colors.border}`, color: '#0284c7', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    {p.name}
                  </button>
                ))}
              </div>

              <textarea
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                placeholder="Enter character persona, system instructions, or scenario definition..."
                style={{ flex: 1, width: '100%', boxSizing: 'border-box', background: colors.inputBg, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 12, color: colors.textMain, fontSize: 13, resize: 'none', outline: 'none', lineHeight: 1.5, marginBottom: 16 }}
              />

              <div style={{ borderTop: `1px solid ${colors.borderMuted}`, paddingTop: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.textMuted, marginBottom: 6 }}>
                  Active Model ({availableModels.length} available)
                </label>
                <select
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                  style={{ width: '100%', background: colors.cardInner, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '8px 10px', color: '#0284c7', fontSize: 13, fontWeight: 600, outline: 'none' }}>
                  {availableModels.map(m => (
                    <option key={m.id} value={m.id}>{m.name || m.id}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right Panel: Chat Stream & Interactive Thread */}
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 16, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)', overflow: 'hidden', boxShadow: colors.cardShadow }}>
              
              {/* Chat Thread */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {messages.map((m, idx) => (
                  <div key={idx} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                    
                    {/* Reasoning Accordion (if exists) */}
                    {m.thought && (
                      <div style={{ marginBottom: 8, background: colors.cardInner, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '8px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: colors.textMuted }}>
                          <span>🧠 Reasoning Process ({Math.floor(m.thought.length / 4)} tokens)</span>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: colors.textSub, whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: 160, overflowY: 'auto', fontFamily: 'monospace' }}>
                          {m.thought}
                        </div>
                      </div>
                    )}

                    {/* Chat Bubble */}
                    <div style={{
                      background: m.role === 'user' ? '#0284c7' : colors.cardInner,
                      color: m.role === 'user' ? '#ffffff' : colors.textMain,
                      border: m.role === 'user' ? 'none' : `1px solid ${colors.border}`,
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
                      <div style={{ marginBottom: 8, background: colors.cardInner, border: '1px solid #0284c7', borderRadius: 8, padding: '8px 12px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>⚡</span> Thinking in progress...
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: colors.textMuted, whiteSpace: 'pre-wrap', lineHeight: 1.5, fontFamily: 'monospace' }}>
                          {currentThought}
                        </div>
                      </div>
                    )}
                    {currentDelta && (
                      <div style={{ background: colors.cardInner, border: `1px solid ${colors.border}`, borderRadius: 14, padding: '14px 18px', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {currentDelta}
                      </div>
                    )}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div style={{ borderTop: `1px solid ${colors.border}`, padding: 16, background: colors.cardBg, display: 'flex', gap: 12 }}>
                <input
                  type="text"
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message or action (*takes a step forward*)..."
                  style={{ flex: 1, background: colors.inputBg, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '12px 16px', color: colors.textMain, fontSize: 14, outline: 'none' }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isStreaming || !inputMessage.trim()}
                  style={{ background: isStreaming ? colors.border : '#0284c7', color: '#fff', border: 'none', borderRadius: 10, padding: '0 24px', fontWeight: 700, fontSize: 14, cursor: isStreaming ? 'not-allowed' : 'pointer' }}>
                  {isStreaming ? 'Streaming...' : 'Send'}
                </button>
              </div>

            </div>

          </div>
        )}

        {/* TAB 3: 🎛️ MODEL CONTROLS & REASONING ENGINE */}
        {activeTab === 'controls' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
            
            {/* Reasoning Budget Control */}
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 24, boxShadow: colors.cardShadow }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 18, color: colors.textMain }}>🧠 Thinking & Reasoning Token Budget</h3>
              <p style={{ fontSize: 13, color: colors.textMuted, margin: '0 0 20px' }}>Configure how many internal thinking tokens Gemini allocates before writing output.</p>

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
                      background: thinkingBudget === p.budget ? '#0284c7' : colors.cardInner,
                      color: thinkingBudget === p.budget ? '#ffffff' : colors.textMain,
                      border: `1px solid ${colors.border}`,
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
                  <span style={{ color: colors.textMuted }}>Custom Token Budget:</span>
                  <span style={{ color: '#0284c7', fontWeight: 700 }}>{thinkingBudget.toLocaleString()} tokens</span>
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
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 24, boxShadow: colors.cardShadow }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 18, color: colors.textMain }}>🎛️ Sampling & Output Length</h3>
              
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: colors.textMuted }}>Temperature:</span>
                  <span style={{ color: '#0284c7', fontWeight: 700 }}>{temperature} ({temperature < 0.5 ? 'Precise' : temperature < 0.9 ? 'Creative' : 'Chaotic'})</span>
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
                  <span style={{ color: colors.textMuted }}>Max Output Tokens:</span>
                  <span style={{ color: '#0284c7', fontWeight: 700 }}>{maxTokens.toLocaleString()} tokens</span>
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
                  <span style={{ color: colors.textMuted }}>Top-P (Nucleus Sampling):</span>
                  <span style={{ color: '#0284c7', fontWeight: 700 }}>{topP}</span>
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
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 24, gridColumn: '1 / -1', boxShadow: colors.cardShadow }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 16, color: colors.textMain }}>🔓 Uncensored Roleplay Safety Override (`BLOCK_NONE`)</h3>
                  <p style={{ margin: 0, fontSize: 13, color: colors.textMuted }}>Bypasses Google content moderation filters across all categories for unrestricted creative writing and character chat.</p>
                </div>
                <button
                  onClick={() => setUncensoredMode(!uncensoredMode)}
                  style={{
                    background: uncensoredMode ? 'rgba(16, 185, 129, 0.15)' : colors.cardInner,
                    color: uncensoredMode ? '#10b981' : colors.textMuted,
                    border: `1px solid ${uncensoredMode ? 'rgba(16, 185, 129, 0.3)' : colors.border}`,
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

        {/* TAB 4: ⚡ ACCOUNTS & QUOTA */}
        {activeTab === 'accounts' && (
          <div style={{ display: 'grid', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px', color: colors.textMain }}>⚡ Connected Google AI Pro Accounts</h2>
                <p style={{ margin: 0, fontSize: 13, color: colors.textMuted }}>Traffic is automatically load-balanced across all accounts. If one hits a rate limit, it fails over immediately.</p>
              </div>
              <button
                onClick={fetchStatusAndModels}
                style={{ background: colors.cardInner, border: `1px solid ${colors.border}`, color: '#0284c7', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                🔄 Refresh Status
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              {accounts.map((acc, idx) => (
                <div key={acc.id} style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 20, boxShadow: colors.cardShadow }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: colors.textMain }}>{acc.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: acc.status === 'Ready' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: acc.status === 'Ready' ? '#10b981' : '#ef4444' }}>
                      ● {acc.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: colors.textSub, lineHeight: 1.8 }}>
                    <div>Project ID: <code style={{ color: '#0284c7' }}>{acc.projectId}</code></div>
                    <div>Account Slot: <code style={{ color: colors.textMuted }}>ACCOUNT_{idx + 1}</code></div>
                    <div>Failures / 429s: <span style={{ color: acc.failCount > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>{acc.failCount}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: 🎮 CLIENT GUIDES (JANITOR AI & SILLYTAVERN) */}
        {activeTab === 'clients' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
            
            {/* Janitor AI Card */}
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 24, boxShadow: colors.cardShadow }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 24 }}>🐱</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, color: colors.textMain }}>Janitor AI Configuration</h3>
                  <span style={{ fontSize: 12, color: colors.textMuted }}>Custom OpenAI / Reverse Proxy Mode</span>
                </div>
              </div>

              <div style={{ background: colors.cardInner, padding: 16, borderRadius: 10, border: `1px solid ${colors.border}`, marginBottom: 16, fontSize: 13, lineHeight: 1.8 }}>
                <div><span style={{ color: colors.textSub }}>API Type: </span> <code style={{ color: '#0284c7' }}>OpenAI / Custom OpenAI</code></div>
                <div><span style={{ color: colors.textSub }}>Reverse Proxy URL: </span> <code style={{ color: '#0284c7' }}>{baseUrl}</code></div>
                <div><span style={{ color: colors.textSub }}>API Key: </span> <code style={{ color: '#0284c7' }}>{apiKey}</code></div>
                <div><span style={{ color: colors.textSub }}>Model: </span> <code style={{ color: '#0284c7' }}>gemini-3.7-flash-high</code></div>
              </div>

              <button
                onClick={() => copyToClipboard(baseUrl, 'janitorUrl')}
                style={{ width: '100%', background: '#0284c7', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {copiedField === 'janitorUrl' ? '✓ Copied URL!' : '📋 Copy Janitor AI Proxy URL'}
              </button>
            </div>

            {/* SillyTavern Card */}
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 24, boxShadow: colors.cardShadow }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 24 }}>🍺</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, color: colors.textMain }}>SillyTavern Configuration</h3>
                  <span style={{ fontSize: 12, color: colors.textMuted }}>Chat Completion / OpenAI API</span>
                </div>
              </div>

              <div style={{ background: colors.cardInner, padding: 16, borderRadius: 10, border: `1px solid ${colors.border}`, marginBottom: 16, fontSize: 13, lineHeight: 1.8 }}>
                <div><span style={{ color: colors.textSub }}>API: </span> <code style={{ color: '#0284c7' }}>Chat Completion (OpenAI)</code></div>
                <div><span style={{ color: colors.textSub }}>Custom Endpoint: </span> <code style={{ color: '#0284c7' }}>{baseUrl}</code></div>
                <div><span style={{ color: colors.textSub }}>API Key: </span> <code style={{ color: '#0284c7' }}>{apiKey}</code></div>
                <div><span style={{ color: colors.textSub }}>Streaming: </span> <code style={{ color: '#10b981' }}>Enabled (SSE)</code></div>
              </div>

              <button
                onClick={() => copyToClipboard(baseUrl, 'tavernUrl')}
                style={{ width: '100%', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {copiedField === 'tavernUrl' ? '✓ Copied URL!' : '📋 Copy SillyTavern Endpoint URL'}
              </button>
            </div>

          </div>
        )}

        {/* TAB 6: 📊 ANALYTICS & VALUE */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 24, boxShadow: colors.cardShadow }}>
              <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 6 }}>Requests Served</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#0284c7' }}>{requestsCount}</div>
            </div>
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 24, boxShadow: colors.cardShadow }}>
              <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 6 }}>Estimated Tokens Processed</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#6366f1' }}>{totalTokensServed.toLocaleString()}</div>
            </div>
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 24, boxShadow: colors.cardShadow }}>
              <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 6 }}>Est. Cloud API Cost Saved</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#10b981' }}>$0.00 / 100% Free</div>
              <span style={{ fontSize: 11, color: colors.textSub }}>Using your Google AI Pro quota</span>
            </div>
          </div>
        )}

      </main>

    </div>
  );
}
