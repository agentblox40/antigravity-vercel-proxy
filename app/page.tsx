'use client';

import React, { useState, useEffect, useRef } from 'react';

// Minimalist SVG Icons (Zero Emojis)
const Icons = {
  Sparkle: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    </svg>
  ),
  Cpu: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3"/><path d="M15 1v3"/><path d="M9 20v3"/><path d="M15 20v3"/><path d="M20 9h3"/><path d="M20 14h3"/><path d="M1 9h3"/><path d="M1 14h3"/>
    </svg>
  ),
  Chat: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
    </svg>
  ),
  Sliders: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="1" x2="7" y1="14" y2="14"/><line x1="9" x2="15" y1="8" y2="8"/><line x1="17" x2="23" y1="16" y2="16"/>
    </svg>
  ),
  Server: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>
    </svg>
  ),
  Terminal: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>
    </svg>
  ),
  Activity: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  ),
  Copy: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
    </svg>
  ),
  Check: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Search: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
    </svg>
  ),
  Refresh: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
    </svg>
  ),
  Sun: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
    </svg>
  ),
  Moon: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
    </svg>
  ),
  Laptop: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>
    </svg>
  ),
  Send: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  Shield: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
    </svg>
  )
};

const PRESETS = [
  { name: 'Tavern Roleplay', sys: 'You are an immersive, descriptive roleplay character. Write vivid reactions, actions in asterisks, and speech in quotes.' },
  { name: 'Dark Fantasy RPG', sys: 'You are the Dungeon Master in a gritty dark fantasy world. Describe atmospheric details, sensory cues, and combat physics.' },
  { name: 'Creative Storyteller', sys: 'You are a master novelist. Emphasize emotional depth, subtext, character motives, and prose cadence.' },
  { name: 'General Assistant', sys: 'You are a sharp, proactive AI assistant. Provide concise, high-value responses.' }
];

export default function AntigravityControlCenter() {
  const [activeTab, setActiveTab] = useState<'models' | 'playground' | 'controls' | 'accounts' | 'clients' | 'analytics'>('models');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('dark');

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
  const [totalTokensServed, setTotalTokensServed] = useState(32400);
  const [requestsCount, setRequestsCount] = useState(38);

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
      setMessages([...newHistory, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setIsStreaming(false);
      setCurrentThought('');
      setCurrentDelta('');
    }
  };

  const isDark = effectiveTheme === 'dark';

  // Monochrome Matte Black & Pure White Design System
  const colors = {
    bg: isDark ? '#000000' : '#ffffff',
    navBg: isDark ? '#080808' : '#fafafa',
    cardBg: isDark ? '#0d0d0f' : '#ffffff',
    cardInner: isDark ? '#141417' : '#f4f4f5',
    inputBg: isDark ? '#08080a' : '#ffffff',
    border: isDark ? 'rgba(255, 255, 255, 0.09)' : '#e4e4e7',
    borderMuted: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f1f4',
    textMain: isDark ? '#ffffff' : '#09090b',
    textMuted: isDark ? '#a1a1aa' : '#52525b',
    textSub: isDark ? '#71717a' : '#71717a',
    btnPrimaryBg: isDark ? '#ffffff' : '#09090b',
    btnPrimaryText: isDark ? '#000000' : '#ffffff',
    btnPrimaryHover: isDark ? '#e4e4e7' : '#27272a',
    badgeBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    badgeBorder: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    cardShadow: isDark ? '0 12px 32px -8px rgba(0,0,0,0.8)' : '0 2px 12px -2px rgba(0,0,0,0.06)',
  };

  const filteredModels = availableModels.filter(m => 
    m.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (m.name && m.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (m.desc && m.desc.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const baseUrl = origin ? `${origin}/v1` : 'https://your-app.vercel.app/v1';
  const chatUrl = origin ? `${origin}/v1/chat/completions` : 'https://your-app.vercel.app/v1/chat/completions';

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.textMain, fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', transition: 'background-color 0.15s, color 0.15s' }}>
      
      {/* Top Navigation Bar */}
      <nav style={{ background: colors.navBg, borderBottom: `1px solid ${colors.border}`, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: isDark ? '#ffffff' : '#000000', boxShadow: isDark ? '0 0 10px rgba(255,255,255,0.6)' : 'none' }}></span>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em', color: colors.textMain }}>
              ANTIGRAVITY
            </span>
            <span style={{ fontSize: 11, background: colors.cardInner, border: `1px solid ${colors.border}`, padding: '1px 6px', borderRadius: 4, color: colors.textMuted, fontWeight: 600, letterSpacing: '0.04em' }}>GATEWAY</span>
          </div>

          <div style={{ display: 'flex', gap: 2, background: colors.cardInner, padding: 3, borderRadius: 8, border: `1px solid ${colors.border}` }}>
            {[
              { id: 'models', label: 'Models Catalog', icon: <Icons.Cpu /> },
              { id: 'playground', label: 'Roleplay Studio', icon: <Icons.Chat /> },
              { id: 'controls', label: 'Model Controls', icon: <Icons.Sliders /> },
              { id: 'accounts', label: 'Accounts & Quota', icon: <Icons.Server /> },
              { id: 'clients', label: 'Janitor / Tavern', icon: <Icons.Terminal /> },
              { id: 'analytics', label: 'Analytics', icon: <Icons.Activity /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  background: activeTab === tab.id ? (isDark ? '#222226' : '#ffffff') : 'transparent',
                  color: activeTab === tab.id ? colors.textMain : colors.textMuted,
                  boxShadow: (activeTab === tab.id && !isDark) ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  border: activeTab === tab.id ? `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` : '1px solid transparent',
                  borderRadius: 6,
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s'
                }}>
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {latencyMs !== null && (
            <span style={{ fontSize: 11, color: colors.textMuted, background: colors.cardInner, padding: '3px 8px', borderRadius: 6, border: `1px solid ${colors.border}`, fontWeight: 600, fontFamily: 'monospace' }}>
              {latencyMs}ms
            </span>
          )}

          {/* Theme Selector Toggle */}
          <div style={{ display: 'flex', background: colors.cardInner, padding: 2, borderRadius: 6, border: `1px solid ${colors.border}` }}>
            {[
              { id: 'light', icon: <Icons.Sun /> },
              { id: 'dark', icon: <Icons.Moon /> },
              { id: 'system', icon: <Icons.Laptop /> }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => handleThemeChange(t.id as any)}
                title={`Switch to ${t.id} mode`}
                style={{
                  background: theme === t.id ? (isDark ? '#27272a' : '#ffffff') : 'transparent',
                  color: theme === t.id ? colors.textMain : colors.textMuted,
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 7px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: (theme === t.id && !isDark) ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                }}>
                {t.icon}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: colors.cardInner, padding: '4px 10px', borderRadius: 6, border: `1px solid ${colors.border}` }}>
            <span style={{ fontSize: 11, color: colors.textSub, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>KEY</span>
            <code style={{ fontSize: 11, color: colors.textMain, fontWeight: 700, fontFamily: 'monospace' }}>{showKey ? apiKey : '••••••••••••'}</code>
            <button onClick={() => setShowKey(!showKey)} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: 11, padding: '0 2px' }}>
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px' }}>

        {/* TAB 1: MODELS CATALOG (MONOCHROME MATTE CARDS) */}
        {activeTab === 'models' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.02em', color: colors.textMain }}>
                  Models Catalog ({availableModels.length})
                </h1>
                <p style={{ margin: 0, fontSize: 13, color: colors.textMuted }}>
                  Click <strong>Copy</strong> on any model and paste its identifier directly into Janitor AI or SillyTavern.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search models..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                      background: colors.inputBg,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 8,
                      padding: '8px 12px 8px 30px',
                      fontSize: 13,
                      color: colors.textMain,
                      width: 220,
                      outline: 'none'
                    }}
                  />
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: colors.textSub, display: 'flex' }}>
                    <Icons.Search />
                  </span>
                </div>
                
                <button
                  onClick={fetchStatusAndModels}
                  disabled={isSyncingModels}
                  style={{
                    background: colors.cardInner,
                    border: `1px solid ${colors.border}`,
                    color: colors.textMain,
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: isSyncingModels ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                  <Icons.Refresh />
                  {isSyncingModels ? 'Syncing...' : 'Sync Live'}
                </button>
              </div>
            </div>

            {/* Model Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
              {filteredModels.map(m => (
                <div
                  key={m.id}
                  style={{
                    background: colors.cardBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 12,
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: colors.cardShadow
                  }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: colors.badgeBg,
                        border: `1px solid ${colors.badgeBorder}`,
                        color: colors.textMain
                      }}>
                        {m.badge || 'Live'}
                      </span>
                      <span style={{ fontSize: 11, color: colors.textSub, fontFamily: 'monospace' }}>
                        {m.context || '1M Context'}
                      </span>
                    </div>

                    <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: colors.textMain }}>
                      {m.name || m.id}
                    </h3>
                    <p style={{ margin: '0 0 14px', fontSize: 12, color: colors.textMuted, lineHeight: 1.5 }}>
                      {m.desc || `Google Antigravity model ${m.id}`}
                    </p>
                  </div>

                  <div style={{ borderTop: `1px solid ${colors.borderMuted}`, paddingTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, fontSize: 11 }}>
                      <span style={{ color: colors.textSub }}>Thinking Tokens:</span>
                      <span style={{ fontWeight: 600, color: colors.textMain, fontFamily: 'monospace' }}>{m.thinking || 'Auto'}</span>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <code style={{
                        flex: 1,
                        background: colors.cardInner,
                        border: `1px solid ${colors.border}`,
                        padding: '6px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        color: colors.textMain,
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
                          background: copiedField === m.id ? (isDark ? '#ffffff' : '#000000') : colors.cardInner,
                          color: copiedField === m.id ? (isDark ? '#000000' : '#ffffff') : colors.textMain,
                          border: `1px solid ${colors.border}`,
                          borderRadius: 6,
                          padding: '0 12px',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                        {copiedField === m.id ? <><Icons.Check /> Copied</> : <><Icons.Copy /> Copy</>}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: ROLEPLAY STUDIO */}
        {activeTab === 'playground' && (
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
            
            {/* Left Sidebar: Character Definition & Presets */}
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18, height: 'calc(100vh - 150px)', display: 'flex', flexDirection: 'column', boxShadow: colors.cardShadow }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: colors.textMain }}>Scenario & Persona</h3>
              </div>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                {PRESETS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setSystemPrompt(p.sys)}
                    style={{ background: colors.cardInner, border: `1px solid ${colors.border}`, color: colors.textMain, padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    {p.name}
                  </button>
                ))}
              </div>

              <textarea
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                placeholder="Enter character persona or scenario instructions..."
                style={{ flex: 1, width: '100%', boxSizing: 'border-box', background: colors.inputBg, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '10px 12px', color: colors.textMain, fontSize: 12, resize: 'none', outline: 'none', lineHeight: 1.5, marginBottom: 14 }}
              />

              <div style={{ borderTop: `1px solid ${colors.borderMuted}`, paddingTop: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Model Selection
                </label>
                <select
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                  style={{ width: '100%', background: colors.cardInner, border: `1px solid ${colors.border}`, borderRadius: 6, padding: '8px 10px', color: colors.textMain, fontSize: 12, fontWeight: 600, outline: 'none' }}>
                  {availableModels.map(m => (
                    <option key={m.id} value={m.id}>{m.name || m.id}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right Panel: Chat Stream & Interactive Thread */}
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 150px)', overflow: 'hidden', boxShadow: colors.cardShadow }}>
              
              {/* Chat Thread */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {messages.map((m, idx) => (
                  <div key={idx} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                    
                    {/* Reasoning Accordion (if exists) */}
                    {m.thought && (
                      <div style={{ marginBottom: 6, background: colors.cardInner, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '8px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          <span>Reasoning Process ({Math.floor(m.thought.length / 4)} tokens)</span>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: colors.textSub, whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: 160, overflowY: 'auto', fontFamily: 'monospace' }}>
                          {m.thought}
                        </div>
                      </div>
                    )}

                    {/* Chat Bubble */}
                    <div style={{
                      background: m.role === 'user' ? (isDark ? '#222226' : '#09090b') : colors.cardInner,
                      color: m.role === 'user' ? '#ffffff' : colors.textMain,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 10,
                      padding: '12px 16px',
                      fontSize: 13,
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
                      <div style={{ marginBottom: 6, background: colors.cardInner, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '8px 12px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMain, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          <span>Thinking...</span>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: colors.textMuted, whiteSpace: 'pre-wrap', lineHeight: 1.5, fontFamily: 'monospace' }}>
                          {currentThought}
                        </div>
                      </div>
                    )}
                    {currentDelta && (
                      <div style={{ background: colors.cardInner, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '12px 16px', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {currentDelta}
                      </div>
                    )}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div style={{ borderTop: `1px solid ${colors.border}`, padding: 14, background: colors.cardBg, display: 'flex', gap: 10 }}>
                <input
                  type="text"
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message or action (*takes a step forward*)..."
                  style={{ flex: 1, background: colors.inputBg, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '10px 14px', color: colors.textMain, fontSize: 13, outline: 'none' }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isStreaming || !inputMessage.trim()}
                  style={{
                    background: isStreaming ? colors.border : colors.btnPrimaryBg,
                    color: isStreaming ? colors.textMuted : colors.btnPrimaryText,
                    border: 'none',
                    borderRadius: 8,
                    padding: '0 20px',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: isStreaming ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                  <Icons.Send />
                  {isStreaming ? 'Streaming...' : 'Send'}
                </button>
              </div>

            </div>

          </div>
        )}

        {/* TAB 3: MODEL CONTROLS & REASONING ENGINE */}
        {activeTab === 'controls' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
            
            {/* Reasoning Budget Control */}
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 22, boxShadow: colors.cardShadow }}>
              <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: colors.textMain }}>Thinking Token Budget</h3>
              <p style={{ fontSize: 12, color: colors.textMuted, margin: '0 0 18px' }}>Configure internal reasoning token limit before final output generation.</p>

              <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
                {[
                  { label: 'Off', budget: 0 },
                  { label: '2K', budget: 2048 },
                  { label: '8K', budget: 8192 },
                  { label: '24K', budget: 24576 },
                  { label: '64K', budget: 65536 }
                ].map(p => (
                  <button
                    key={p.budget}
                    onClick={() => setThinkingBudget(p.budget)}
                    style={{
                      flex: 1,
                      background: thinkingBudget === p.budget ? colors.btnPrimaryBg : colors.cardInner,
                      color: thinkingBudget === p.budget ? colors.btnPrimaryText : colors.textMain,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 6,
                      padding: '7px 2px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}>
                    {p.label}
                  </button>
                ))}
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: colors.textMuted }}>Custom Token Budget:</span>
                  <span style={{ color: colors.textMain, fontWeight: 700, fontFamily: 'monospace' }}>{thinkingBudget.toLocaleString()} tokens</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="65536"
                  step="1024"
                  value={thinkingBudget}
                  onChange={e => setThinkingBudget(Number(e.target.value))}
                  style={{ width: '100%', accentColor: isDark ? '#ffffff' : '#000000' }}
                />
              </div>
            </div>

            {/* Generation Parameters */}
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 22, boxShadow: colors.cardShadow }}>
              <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: colors.textMain }}>Sampling Parameters</h3>
              <p style={{ fontSize: 12, color: colors.textMuted, margin: '0 0 18px' }}>Adjust temperature and length parameters (overridden by client if set).</p>
              
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: colors.textMuted }}>Temperature:</span>
                  <span style={{ color: colors.textMain, fontWeight: 700, fontFamily: 'monospace' }}>{temperature}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.05"
                  value={temperature}
                  onChange={e => setTemperature(Number(e.target.value))}
                  style={{ width: '100%', accentColor: isDark ? '#ffffff' : '#000000' }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: colors.textMuted }}>Max Output Tokens:</span>
                  <span style={{ color: colors.textMain, fontWeight: 700, fontFamily: 'monospace' }}>{maxTokens.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="1024"
                  max="32768"
                  step="1024"
                  value={maxTokens}
                  onChange={e => setMaxTokens(Number(e.target.value))}
                  style={{ width: '100%', accentColor: isDark ? '#ffffff' : '#000000' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: colors.textMuted }}>Top-P (Nucleus Sampling):</span>
                  <span style={{ color: colors.textMain, fontWeight: 700, fontFamily: 'monospace' }}>{topP}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={topP}
                  onChange={e => setTopP(Number(e.target.value))}
                  style={{ width: '100%', accentColor: isDark ? '#ffffff' : '#000000' }}
                />
              </div>
            </div>

            {/* Uncensored Roleplay Bypass */}
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 22, gridColumn: '1 / -1', boxShadow: colors.cardShadow }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: colors.textMain }}>Safety Override (BLOCK_NONE)</h3>
                  <p style={{ margin: 0, fontSize: 12, color: colors.textMuted }}>Bypasses content moderation filters across all categories for unrestricted creative writing.</p>
                </div>
                <button
                  onClick={() => setUncensoredMode(!uncensoredMode)}
                  style={{
                    background: uncensoredMode ? colors.btnPrimaryBg : colors.cardInner,
                    color: uncensoredMode ? colors.btnPrimaryText : colors.textMuted,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 6,
                    padding: '8px 14px',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}>
                  {uncensoredMode ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>
            </div>

          </div>
        )}

        {/* TAB 4: ACCOUNTS & QUOTA */}
        {activeTab === 'accounts' && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px', color: colors.textMain }}>Connected Google AI Pro Accounts</h2>
                <p style={{ margin: 0, fontSize: 13, color: colors.textMuted }}>Traffic is automatically load-balanced across accounts with seamless 429 failover.</p>
              </div>
              <button
                onClick={fetchStatusAndModels}
                style={{ background: colors.cardInner, border: `1px solid ${colors.border}`, color: colors.textMain, borderRadius: 6, padding: '7px 12px', fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icons.Refresh />
                Refresh
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
              {accounts.map((acc, idx) => (
                <div key={acc.id} style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18, boxShadow: colors.cardShadow }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: colors.textMain }}>{acc.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 6px', borderRadius: 4, background: colors.badgeBg, border: `1px solid ${colors.badgeBorder}`, color: colors.textMain }}>
                      {acc.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: colors.textSub, lineHeight: 1.8 }}>
                    <div>Project ID: <code style={{ color: colors.textMain, fontWeight: 600 }}>{acc.projectId}</code></div>
                    <div>Account Slot: <code style={{ color: colors.textMuted }}>ACCOUNT_{idx + 1}</code></div>
                    <div>Failures / 429s: <span style={{ color: colors.textMain, fontWeight: 600 }}>{acc.failCount}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: CLIENT GUIDES (JANITOR AI & SILLYTAVERN) */}
        {activeTab === 'clients' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
            
            {/* Janitor AI Card */}
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 22, boxShadow: colors.cardShadow }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: colors.textMain }}>Janitor AI Setup</h3>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: colors.textMuted }}>Configuration for Janitor AI Custom OpenAI mode.</p>

              <div style={{ background: colors.cardInner, padding: 14, borderRadius: 8, border: `1px solid ${colors.border}`, marginBottom: 16, fontSize: 12, lineHeight: 1.8 }}>
                <div><span style={{ color: colors.textSub }}>API Format: </span> <code style={{ color: colors.textMain, fontWeight: 600 }}>OpenAI / Custom OpenAI</code></div>
                <div><span style={{ color: colors.textSub }}>Reverse Proxy URL: </span> <code style={{ color: colors.textMain, fontWeight: 600 }}>{baseUrl}</code></div>
                <div><span style={{ color: colors.textSub }}>API Key: </span> <code style={{ color: colors.textMain, fontWeight: 600 }}>{apiKey}</code></div>
                <div><span style={{ color: colors.textSub }}>Recommended Model: </span> <code style={{ color: colors.textMain, fontWeight: 600 }}>gemini-3.7-flash-high</code></div>
              </div>

              <button
                onClick={() => copyToClipboard(baseUrl, 'janitorUrl')}
                style={{ width: '100%', background: colors.btnPrimaryBg, color: colors.btnPrimaryText, border: 'none', borderRadius: 6, padding: '9px 0', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {copiedField === 'janitorUrl' ? <><Icons.Check /> Copied</> : <><Icons.Copy /> Copy Janitor AI Proxy URL</>}
              </button>
            </div>

            {/* SillyTavern Card */}
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 22, boxShadow: colors.cardShadow }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: colors.textMain }}>SillyTavern Setup</h3>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: colors.textMuted }}>Configuration for SillyTavern Chat Completion API.</p>

              <div style={{ background: colors.cardInner, padding: 14, borderRadius: 8, border: `1px solid ${colors.border}`, marginBottom: 16, fontSize: 12, lineHeight: 1.8 }}>
                <div><span style={{ color: colors.textSub }}>API: </span> <code style={{ color: colors.textMain, fontWeight: 600 }}>Chat Completion (OpenAI)</code></div>
                <div><span style={{ color: colors.textSub }}>Custom Endpoint: </span> <code style={{ color: colors.textMain, fontWeight: 600 }}>{baseUrl}</code></div>
                <div><span style={{ color: colors.textSub }}>API Key: </span> <code style={{ color: colors.textMain, fontWeight: 600 }}>{apiKey}</code></div>
                <div><span style={{ color: colors.textSub }}>Streaming: </span> <code style={{ color: colors.textMain, fontWeight: 600 }}>Enabled (SSE)</code></div>
              </div>

              <button
                onClick={() => copyToClipboard(baseUrl, 'tavernUrl')}
                style={{ width: '100%', background: colors.btnPrimaryBg, color: colors.btnPrimaryText, border: 'none', borderRadius: 6, padding: '9px 0', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {copiedField === 'tavernUrl' ? <><Icons.Check /> Copied</> : <><Icons.Copy /> Copy SillyTavern Endpoint URL</>}
              </button>
            </div>

          </div>
        )}

        {/* TAB 6: ANALYTICS & VALUE */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 20, boxShadow: colors.cardShadow }}>
              <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Requests Processed</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: colors.textMain, fontFamily: 'monospace' }}>{requestsCount}</div>
            </div>
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 20, boxShadow: colors.cardShadow }}>
              <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Estimated Tokens</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: colors.textMain, fontFamily: 'monospace' }}>{totalTokensServed.toLocaleString()}</div>
            </div>
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 20, boxShadow: colors.cardShadow }}>
              <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Estimated Cost</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: colors.textMain, fontFamily: 'monospace' }}>$0.00</div>
              <span style={{ fontSize: 11, color: colors.textSub }}>Google AI Pro Included</span>
            </div>
          </div>
        )}

      </main>

    </div>
  );
}
