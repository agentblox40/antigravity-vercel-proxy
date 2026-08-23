'use client';

import React, { useState, useEffect, useRef } from 'react';

// Minimalist SVG Icons
const Icons = {
  Lock: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  Key: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>
    </svg>
  ),
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
  Book: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/>
    </svg>
  ),
  FileText: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>
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
  LogOut: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>
    </svg>
  ),
  Trash: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
    </svg>
  ),
  Plus: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Pin: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
    </svg>
  ),
  Download: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
    </svg>
  ),
  Rocket: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
    </svg>
  ),
  GitBranch: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
    </svg>
  ),
  ExternalLink: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/>
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
  const [activeTab, setActiveTab] = useState<'models' | 'logs' | 'playground' | 'controls' | 'accounts' | 'clients' | 'updates'>('models');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('dark');

  // Authentication State (Key Gate)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loginKeyInput, setLoginKeyInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [origin, setOrigin] = useState('');
  const [apiKey, setApiKey] = useState('');
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

  // Logged Chats & Transcripts State
  const [memoryStats, setMemoryStats] = useState<any>({
    totalCharacters: 0,
    totalSessions: 0,
    totalArchivedMessages: 0,
    storageMode: 'Checking...',
    redisConnected: false
  });
  const [memoryCharacters, setMemoryCharacters] = useState<any[]>([]);
  const [memorySessions, setMemorySessions] = useState<any[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [isLoadingMemory, setIsLoadingMemory] = useState(false);
  const [memorySearch, setMemorySearch] = useState('');
  const [selectedCharFilter, setSelectedCharFilter] = useState<string>('all');

  // Deployment & Update Logs Telemetry State
  const [deploymentData, setDeploymentData] = useState<any>(null);
  const [isCheckingDeploy, setIsCheckingDeploy] = useState<boolean>(false);
  const [deployCheckStatus, setDeployCheckStatus] = useState<string>('');

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

  // 1-second live countdown ticker for account cooldowns
  useEffect(() => {
    const timer = setInterval(() => {
      setAccounts(prev => {
        if (!prev || prev.length === 0) return prev;
        let changed = false;
        const next = prev.map(acc => {
          if (acc.cooldownRemainingSec && acc.cooldownRemainingSec > 0) {
            changed = true;
            const remaining = acc.cooldownRemainingSec - 1;
            return {
              ...acc,
              cooldownRemainingSec: Math.max(0, remaining),
              status: remaining <= 0 ? 'Ready' : 'Cooldown'
            };
          }
          return acc;
        });
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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

  // Auth Initialization on Load (checks URL parameter ?key=... or localStorage)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
      
      const urlParams = new URLSearchParams(window.location.search);
      const urlKey = urlParams.get('key') || urlParams.get('auth');
      const storedKey = localStorage.getItem('proxy_master_key') || '';

      const keyToTest = urlKey || storedKey;

      if (keyToTest) {
        verifyAndUnlock(keyToTest, !!urlKey);
      } else {
        setIsAuthenticated(false);
      }
    }
  }, []);

  const verifyAndUnlock = async (key: string, clearUrlParam = false) => {
    setIsVerifying(true);
    setLoginError('');
    const trimmed = key.trim();

    try {
      const start = Date.now();
      const res = await fetch('/api/status', {
        headers: { 'Authorization': `Bearer ${trimmed}` }
      });

      if (res.ok) {
        const data = await res.json();
        setApiKey(trimmed);
        localStorage.setItem('proxy_master_key', trimmed);
        setIsAuthenticated(true);
        setAccounts(data.accounts || []);
        if (Array.isArray(data.supportedModels)) setAvailableModels(data.supportedModels);
        if (data.deployment) setDeploymentData(data.deployment);
        setLatencyMs(Date.now() - start);

        if (clearUrlParam && window.history.replaceState) {
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        }

        // Fetch memory overview
        fetchMemoryOverview(trimmed);
      } else {
        setLoginError('Invalid Key. Access Denied.');
        setIsAuthenticated(false);
      }
    } catch {
      setLoginError('Unable to connect to gateway.');
      setIsAuthenticated(false);
    } finally {
      setIsVerifying(false);
    }
  };

  const fetchMemoryOverview = async (currentKey = apiKey) => {
    if (!currentKey) return;
    setIsLoadingMemory(true);
    try {
      const res = await fetch('/api/memory', {
        headers: { 'Authorization': `Bearer ${currentKey}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMemoryCharacters(data.characters || []);
        setMemorySessions(data.sessions || []);
        setMemoryStats(data.stats || {});

        // If no chat selected, select the first one if available
        if (!selectedChatId && data.sessions && data.sessions.length > 0) {
          fetchSingleSession(data.sessions[0].id, currentKey);
        }
      }
    } catch {}
    finally {
      setIsLoadingMemory(false);
    }
  };

  const fetchSingleSession = async (chatId: string, currentKey = apiKey) => {
    if (!currentKey || !chatId) return;
    try {
      const res = await fetch(`/api/memory?chatId=${encodeURIComponent(chatId)}`, {
        headers: { 'Authorization': `Bearer ${currentKey}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedChatId(chatId);
        setSelectedSession(data.session);
      }
    } catch {}
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginKeyInput.trim()) {
      setLoginError('Please enter your Proxy Key.');
      return;
    }
    verifyAndUnlock(loginKeyInput);
  };

  const handleLockDashboard = () => {
    localStorage.removeItem('proxy_master_key');
    setApiKey('');
    setIsAuthenticated(false);
    setLoginKeyInput('');
    setLoginError('');
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentDelta, currentThought]);

  const fetchStatusAndModels = async () => {
    if (!apiKey) return;
    setIsSyncingModels(true);
    const start = Date.now();
    try {
      const res = await fetch('/api/status', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
        if (Array.isArray(data.supportedModels) && data.supportedModels.length > 0) {
          setAvailableModels(data.supportedModels);
        }
        if (data.deployment) {
          setDeploymentData(data.deployment);
        }
        setLatencyMs(Date.now() - start);
      }
    } catch {}
    finally {
      setIsSyncingModels(false);
    }
  };

  const handleCheckLatestDeployment = async () => {
    if (!apiKey) return;
    setIsCheckingDeploy(true);
    setDeployCheckStatus('Connecting to live gateway...');
    const start = Date.now();
    try {
      const res = await fetch('/api/status', {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.deployment) {
          setDeploymentData(data.deployment);
        }
        if (Array.isArray(data.supportedModels)) {
          setAvailableModels(data.supportedModels);
        }
        const rtt = Date.now() - start;
        setLatencyMs(rtt);
        setDeployCheckStatus(`Verified live on Vercel (${rtt}ms RTT). Commit: ${data.deployment?.commitSha || 'latest'}`);
      } else {
        setDeployCheckStatus(`Status check failed: HTTP ${res.status}`);
      }
    } catch {
      setDeployCheckStatus('Error reaching Vercel server.');
    } finally {
      setIsCheckingDeploy(false);
    }
  };


  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyTranscriptMarkdown = (session: any) => {
    if (!session || !session.messages) return;
    let md = `# Roleplay Transcript: ${session.characterName} - ${session.title}\n`;
    md += `*Session ID: ${session.id} | Turns: ${session.messages.length}*\n\n---\n\n`;

    if (session.oocRules && session.oocRules.length > 0) {
      md += `### Active Pinned OOC Rules:\n`;
      for (const r of session.oocRules) {
        if (r.enabled) md += `- ${r.rule}\n`;
      }
      md += `\n---\n\n`;
    }

    for (const m of session.messages) {
      const speaker = m.role === 'user' ? 'User' : session.characterName;
      md += `### **${speaker}**\n${m.content}\n\n`;
    }

    copyToClipboard(md, `transcript_${session.id}`);
  };

  const downloadTranscriptJson = (session: any) => {
    if (!session) return;
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${session.characterName || 'chat'}_${session.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

      // Refresh memory if active
      setTimeout(() => fetchMemoryOverview(), 1000);
    } catch (err: any) {
      setMessages([...newHistory, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setIsStreaming(false);
      setCurrentThought('');
      setCurrentDelta('');
    }
  };

  const handleDeleteChatSession = async (chatId: string) => {
    if (!confirm('Are you sure you want to delete this chat session memory?')) return;
    try {
      const res = await fetch(`/api/memory?chatId=${encodeURIComponent(chatId)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (res.ok) {
        if (selectedChatId === chatId) {
          setSelectedChatId(null);
          setSelectedSession(null);
        }
        fetchMemoryOverview();
      }
    } catch {}
  };

  const handleClearChatHistory = async (chatId: string) => {
    if (!confirm('Clear message history for this chat? (Pinned OOC rules and lore facts will be kept)')) return;
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ action: 'clear_history', chatId })
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedSession(data.session);
        fetchMemoryOverview();
      }
    } catch {}
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
    badgeBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    badgeBorder: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    cardShadow: isDark ? '0 12px 32px -8px rgba(0,0,0,0.8)' : '0 2px 12px -2px rgba(0,0,0,0.06)',
  };

  const filteredModels = availableModels.filter(m => 
    m.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (m.name && m.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (m.desc && m.desc.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredSessions = memorySessions.filter(s => {
    const matchesSearch = (s.title && s.title.toLowerCase().includes(memorySearch.toLowerCase())) ||
      (s.characterName && s.characterName.toLowerCase().includes(memorySearch.toLowerCase())) ||
      (s.id && s.id.toLowerCase().includes(memorySearch.toLowerCase())) ||
      (s.lastMessagePreview && s.lastMessagePreview.toLowerCase().includes(memorySearch.toLowerCase()));
    
    const matchesChar = selectedCharFilter === 'all' || s.characterId === selectedCharFilter;
    return matchesSearch && matchesChar;
  });

  const baseUrl = origin ? `${origin}/v1` : 'https://your-app.vercel.app/v1';

  // Render Loading Splash while checking key
  if (isAuthenticated === null) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textMuted, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icons.Key />
          <span>Verifying security key...</span>
        </div>
      </div>
    );
  }

  // Render Login Gate Screen if Unauthenticated
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{
          width: '100%',
          maxWidth: 380,
          background: colors.cardBg,
          border: `1px solid ${colors.border}`,
          borderRadius: 16,
          padding: 32,
          boxShadow: colors.cardShadow
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 24 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: colors.cardInner, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textMain, marginBottom: 14 }}>
              <Icons.Lock />
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.02em', color: colors.textMain }}>
              Antigravity Protected
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: colors.textMuted }}>
              Enter your master Proxy API Key to unlock the control center.
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <input
                type="password"
                placeholder="Enter PROXY_API_KEY..."
                value={loginKeyInput}
                onChange={e => setLoginKeyInput(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: colors.inputBg,
                  border: `1px solid ${loginError ? '#ef4444' : colors.border}`,
                  borderRadius: 8,
                  padding: '11px 14px',
                  color: colors.textMain,
                  fontSize: 13,
                  outline: 'none'
                }}
              />
              {loginError && (
                <div style={{ color: '#ef4444', fontSize: 11, marginTop: 6, fontWeight: 600 }}>
                  {loginError}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              style={{
                width: '100%',
                background: colors.btnPrimaryBg,
                color: colors.btnPrimaryText,
                border: 'none',
                borderRadius: 8,
                padding: '11px 0',
                fontSize: 13,
                fontWeight: 700,
                cursor: isVerifying ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}>
              {isVerifying ? 'Verifying...' : 'Unlock Gateway'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Render Full Unlocked Dashboard
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
              { id: 'logs', label: 'Logged Chats', icon: <Icons.FileText /> },
              { id: 'playground', label: 'Roleplay Studio', icon: <Icons.Chat /> },
              { id: 'controls', label: 'Model Controls', icon: <Icons.Sliders /> },
              { id: 'accounts', label: 'Accounts & Quota', icon: <Icons.Server /> },
              { id: 'clients', label: 'Janitor / Tavern', icon: <Icons.Terminal /> },
              { id: 'updates', label: 'Update Logs', icon: <Icons.Rocket /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  if (tab.id === 'logs') fetchMemoryOverview();
                  if (tab.id === 'updates') fetchStatusAndModels();
                }}
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

          {/* 1-Click Lock / Logout Button */}
          <button
            onClick={handleLockDashboard}
            title="Lock Dashboard (Log Out)"
            style={{
              background: colors.cardInner,
              border: `1px solid ${colors.border}`,
              color: colors.textMuted,
              borderRadius: 6,
              padding: '5px 9px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5
            }}>
            <Icons.LogOut />
            Lock
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px' }}>

        {/* Global Cooldown Live Ticker Banner */}
        {accounts.some(a => a.cooldownRemainingSec > 0) && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.09)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 10,
            padding: '12px 18px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            boxShadow: '0 4px 14px rgba(239, 68, 68, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }}></span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>
                Account Quota Cooldown Active
              </span>
              <span style={{ fontSize: 12, color: colors.textMuted }}>
                {accounts.filter(a => a.cooldownRemainingSec > 0).map(a => `${a.name}: ${a.cooldownRemainingSec}s`).join(' | ')}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#ef4444', fontFamily: 'monospace' }}>
              <Icons.Refresh />
              <span>Auto-refreshing in {Math.min(...accounts.filter(a => a.cooldownRemainingSec > 0).map(a => a.cooldownRemainingSec))}s</span>
            </div>
          </div>
        )}

        {/* TAB 1: MODELS CATALOG */}
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

        {/* TAB 2: LOGGED CHATS ARCHIVE & TRANSCRIPT READER */}
        {activeTab === 'logs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* Top Logged Chats Header */}
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: colors.cardShadow }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: colors.textMain, letterSpacing: '-0.01em' }}>
                    Logged Roleplay Chats ({memorySessions.length})
                  </h1>
                  <span style={{ fontSize: 11, background: colors.badgeBg, border: `1px solid ${colors.badgeBorder}`, padding: '2px 8px', borderRadius: 4, color: colors.textSub, fontWeight: 600 }}>
                    {memoryStats.storageMode || 'Active'}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.textMuted }}>
                  Lossless conversation transcripts automatically recorded from Janitor AI, SillyTavern, and Roleplay Studio.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search logs & dialogues..."
                    value={memorySearch}
                    onChange={e => setMemorySearch(e.target.value)}
                    style={{
                      background: colors.inputBg,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 8,
                      padding: '8px 12px 8px 30px',
                      fontSize: 12,
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
                  onClick={() => fetchMemoryOverview()}
                  disabled={isLoadingMemory}
                  style={{
                    background: colors.cardInner,
                    border: `1px solid ${colors.border}`,
                    color: colors.textMain,
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                  <Icons.Refresh />
                  {isLoadingMemory ? 'Syncing...' : 'Refresh Logs'}
                </button>
              </div>
            </div>

            {/* Character Filter Pills */}
            {memoryCharacters.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setSelectedCharFilter('all')}
                  style={{
                    background: selectedCharFilter === 'all' ? colors.btnPrimaryBg : colors.cardInner,
                    color: selectedCharFilter === 'all' ? colors.btnPrimaryText : colors.textMuted,
                    border: `1px solid ${colors.border}`,
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}>
                  All Characters ({memorySessions.length})
                </button>
                {memoryCharacters.map(c => (
                  <button
                    key={c.characterId}
                    onClick={() => setSelectedCharFilter(c.characterId)}
                    style={{
                      background: selectedCharFilter === c.characterId ? colors.btnPrimaryBg : colors.cardInner,
                      color: selectedCharFilter === c.characterId ? colors.btnPrimaryText : colors.textMuted,
                      border: `1px solid ${colors.border}`,
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}>
                    {c.characterName} ({c.chatCount})
                  </button>
                ))}
              </div>
            )}

            {/* 2-Pane Logged Chat Explorer */}
            <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 }}>
              
              {/* Left Pane: Sessions Directory */}
              <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, height: 'calc(100vh - 240px)', display: 'flex', flexDirection: 'column', boxShadow: colors.cardShadow }}>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredSessions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 10px', color: colors.textMuted, fontSize: 12 }}>
                      {memorySessions.length === 0 ? 'No logged chats yet. Start chatting in Janitor AI to record your first transcript!' : 'No matching chat logs found.'}
                    </div>
                  ) : (
                    filteredSessions.map(s => (
                      <div
                        key={s.id}
                        onClick={() => fetchSingleSession(s.id)}
                        style={{
                          background: selectedChatId === s.id ? (isDark ? '#222226' : '#f4f4f5') : colors.cardInner,
                          border: `1px solid ${selectedChatId === s.id ? (isDark ? '#ffffff' : '#000000') : colors.border}`,
                          borderRadius: 8,
                          padding: '12px 14px',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: colors.textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>
                            {s.characterName}
                          </span>
                          <span style={{ fontSize: 10, color: colors.textSub, fontFamily: 'monospace' }}>
                            {new Date(s.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        
                        <div style={{ fontSize: 12, color: colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>
                          {s.title}
                        </div>

                        {s.lastMessagePreview && (
                          <div style={{ fontSize: 11, color: colors.textSub, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 8, borderLeft: `2px solid ${colors.border}`, paddingLeft: 6 }}>
                            {s.lastMessagePreview}
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10 }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <span style={{ background: colors.badgeBg, padding: '1px 5px', borderRadius: 4, border: `1px solid ${colors.badgeBorder}`, color: colors.textSub, fontWeight: 600 }}>
                              {s.messageCount} turns
                            </span>
                            <span style={{ background: colors.badgeBg, padding: '1px 5px', borderRadius: 4, border: `1px solid ${colors.badgeBorder}`, color: colors.textSub, fontWeight: 600 }}>
                              ~{s.estimatedTokens?.toLocaleString()} tokens
                            </span>
                          </div>
                          {s.oocCount > 0 && (
                            <span style={{ color: colors.textSub, fontWeight: 600 }}>
                              📌 {s.oocCount} OOC
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Pane: Full Interactive Transcript Reader */}
              <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 20, height: 'calc(100vh - 240px)', display: 'flex', flexDirection: 'column', boxShadow: colors.cardShadow, overflow: 'hidden' }}>
                {selectedSession ? (
                  <>
                    {/* Transcript Toolbar Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${colors.border}`, paddingBottom: 14, marginBottom: 16 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: colors.textMain }}>
                            {selectedSession.characterName}
                          </h2>
                          <span style={{ fontSize: 11, color: colors.textSub, background: colors.cardInner, border: `1px solid ${colors.border}`, padding: '1px 6px', borderRadius: 4 }}>
                            {selectedSession.title}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: colors.textSub, fontFamily: 'monospace' }}>
                          ID: {selectedSession.id} • {(selectedSession.messages || []).length} turns • ~{Math.floor(((selectedSession.messages || []).reduce((acc: number, m: any) => acc + (m.content?.length || 0), 0)) / 4).toLocaleString()} tokens preserved
                        </div>
                      </div>

                      {/* Export & Manage Actions */}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => copyTranscriptMarkdown(selectedSession)}
                          style={{
                            background: copiedField === `transcript_${selectedSession.id}` ? (isDark ? '#ffffff' : '#000000') : colors.cardInner,
                            color: copiedField === `transcript_${selectedSession.id}` ? (isDark ? '#000000' : '#ffffff') : colors.textMain,
                            border: `1px solid ${colors.border}`,
                            borderRadius: 6,
                            padding: '6px 10px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                          {copiedField === `transcript_${selectedSession.id}` ? <><Icons.Check /> Copied</> : <><Icons.Copy /> Copy Markdown</>}
                        </button>

                        <button
                          onClick={() => downloadTranscriptJson(selectedSession)}
                          title="Export full JSON archive"
                          style={{ background: colors.cardInner, border: `1px solid ${colors.border}`, color: colors.textMain, borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Icons.Download /> JSON
                        </button>

                        <button
                          onClick={() => handleClearChatHistory(selectedSession.id)}
                          title="Clear message history while preserving OOC rules"
                          style={{ background: colors.cardInner, border: `1px solid ${colors.border}`, color: colors.textMuted, borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          Clear
                        </button>

                        <button
                          onClick={() => handleDeleteChatSession(selectedSession.id)}
                          title="Delete entire chat log"
                          style={{ background: colors.cardInner, border: `1px solid ${colors.border}`, color: '#ef4444', borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Icons.Trash />
                        </button>
                      </div>
                    </div>

                    {/* Chat Messages Stream */}
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingRight: 6 }}>
                      {(selectedSession.messages || []).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: colors.textMuted, fontStyle: 'italic', fontSize: 13 }}>
                          No turns recorded for this session yet.
                        </div>
                      ) : (
                        (selectedSession.messages || []).map((m: any, idx: number) => {
                          const isUser = m.role === 'user';
                          return (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, alignSelf: isUser ? 'flex-end' : 'flex-start' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: isUser ? colors.textMain : colors.textSub, textTransform: 'capitalize' }}>
                                  {isUser ? 'You' : selectedSession.characterName}
                                </span>
                                <span style={{ fontSize: 10, color: colors.textSub, fontFamily: 'monospace' }}>
                                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>

                              {/* Thought Reasoning Accordion if present */}
                              {m.reasoning_content && (
                                <div style={{ marginBottom: 6, background: colors.cardInner, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '8px 12px' }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    Reasoning Process ({Math.floor(m.reasoning_content.length / 4)} tokens)
                                  </div>
                                  <div style={{ marginTop: 4, fontSize: 11, color: colors.textSub, whiteSpace: 'pre-wrap', lineHeight: 1.4, maxHeight: 120, overflowY: 'auto', fontFamily: 'monospace' }}>
                                    {m.reasoning_content}
                                  </div>
                                </div>
                              )}

                              {/* Message Body */}
                              <div style={{
                                background: isUser ? (isDark ? '#222226' : '#09090b') : colors.cardInner,
                                color: isUser ? '#ffffff' : colors.textMain,
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
                          );
                        })
                      )}
                    </div>

                    {/* Pinned Rules & Lore Footer Tag */}
                    {(selectedSession.oocRules?.length > 0 || selectedSession.loreFacts?.length > 0) && (
                      <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 10, marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: 11 }}>
                        <span style={{ color: colors.textSub, fontWeight: 600 }}>Active Directives:</span>
                        {(selectedSession.oocRules || []).filter((r: any) => r.enabled).map((r: any) => (
                          <span key={r.id} style={{ background: colors.badgeBg, border: `1px solid ${colors.badgeBorder}`, color: colors.textMain, padding: '2px 6px', borderRadius: 4 }}>
                            📌 {r.rule.slice(0, 30)}...
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '80px 20px', color: colors.textMuted }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: colors.cardInner, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textMain, margin: '0 auto 12px' }}>
                      <Icons.FileText />
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: colors.textMain, margin: '0 0 6px' }}>Select a Chat to View Transcript</h3>
                    <p style={{ fontSize: 12, maxWidth: 360, margin: '0 auto', lineHeight: 1.5 }}>
                      Choose any session on the left to read the full dialogue history, view reasoning steps, and export markdown transcripts.
                    </p>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* TAB 3: ROLEPLAY STUDIO */}
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

        {/* TAB 5: MODEL CONTROLS & REASONING ENGINE */}
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

        {/* TAB 6: ACCOUNTS & QUOTA */}
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
                <div key={acc.id} style={{ background: colors.cardBg, border: `1px solid ${acc.cooldownRemainingSec > 0 ? 'rgba(239, 68, 68, 0.3)' : colors.border}`, borderRadius: 12, padding: 18, boxShadow: colors.cardShadow, transition: 'all 0.2s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: colors.textMain }}>{acc.name}</span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: acc.cooldownRemainingSec > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)',
                      border: `1px solid ${acc.cooldownRemainingSec > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                      color: acc.cooldownRemainingSec > 0 ? '#ef4444' : '#22c55e',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: acc.cooldownRemainingSec > 0 ? '#ef4444' : '#22c55e', boxShadow: acc.cooldownRemainingSec > 0 ? '0 0 6px rgba(239, 68, 68, 0.8)' : 'none' }}></span>
                      {acc.cooldownRemainingSec > 0 ? `Cooldown (${acc.cooldownRemainingSec}s)` : 'Ready'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: colors.textSub, lineHeight: 1.8 }}>
                    <div>Project ID: <code style={{ color: colors.textMain, fontWeight: 600 }}>{acc.projectId}</code></div>
                    <div>Account Slot: <code style={{ color: colors.textMuted }}>ACCOUNT_{idx + 1}</code></div>
                    <div>Failures / 429s: <span style={{ color: colors.textMain, fontWeight: 600 }}>{acc.failCount}</span></div>
                    {acc.cooldownRemainingSec > 0 && (
                      <div style={{ marginTop: 6, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '6px 10px', borderRadius: 6, color: '#ef4444', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icons.Refresh />
                        <span>Refreshing capacity in <strong>{acc.cooldownRemainingSec}s</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 7: CLIENT GUIDES */}
        {activeTab === 'clients' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
            
            {/* Janitor AI Card */}
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 22, boxShadow: colors.cardShadow }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: colors.textMain }}>Janitor AI Setup</h3>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: colors.textMuted }}>Configuration for Janitor AI Custom OpenAI mode.</p>

              <div style={{ background: colors.cardInner, padding: 14, borderRadius: 8, border: `1px solid ${colors.border}`, marginBottom: 16, fontSize: 12, lineHeight: 1.8 }}>
                <div><span style={{ color: colors.textSub }}>API Format: </span> <code style={{ color: colors.textMain, fontWeight: 600 }}>OpenAI / Custom OpenAI</code></div>
                <div><span style={{ color: colors.textSub }}>Reverse Proxy URL: </span> <code style={{ color: colors.textMain, fontWeight: 600 }}>{baseUrl}</code></div>
                <div><span style={{ color: colors.textSub }}>API Key: </span> <code style={{ color: colors.textMain, fontWeight: 600 }}>{apiKey || 'YOUR_API_KEY'}</code></div>
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
                <div><span style={{ color: colors.textSub }}>API Key: </span> <code style={{ color: colors.textMain, fontWeight: 600 }}>{apiKey || 'YOUR_API_KEY'}</code></div>
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

        {/* TAB 7: UPDATE LOGS & DEPLOYMENT TELEMETRY */}
        {activeTab === 'updates' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Header with live checker */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 10px rgba(34, 197, 94, 0.7)' }}></span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Live Production Deployment
                  </span>
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.02em', color: colors.textMain }}>
                  Deployment Telemetry & Update Logs
                </h1>
                <p style={{ margin: 0, fontSize: 13, color: colors.textMuted }}>
                  Track live build commits, deployment timestamps, serverless runtime state, and full release history.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={handleCheckLatestDeployment}
                  disabled={isCheckingDeploy}
                  style={{
                    background: colors.btnPrimaryBg,
                    color: colors.btnPrimaryText,
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 16px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: isCheckingDeploy ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: colors.cardShadow
                  }}>
                  <Icons.Refresh />
                  {isCheckingDeploy ? 'Checking Live Vercel...' : 'Verify Live Deployment'}
                </button>
              </div>
            </div>

            {deployCheckStatus && (
              <div style={{ background: colors.cardInner, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: colors.textMain, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icons.Sparkle />
                <span>{deployCheckStatus}</span>
              </div>
            )}

            {/* Telemetry Cards 3-Column Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {/* Card 1: Version & Environment */}
              <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 20, boxShadow: colors.cardShadow }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: colors.textSub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active Version</span>
                  <span style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.25)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                    🟢 DEPLOYED
                  </span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: colors.textMain, fontFamily: 'monospace', marginBottom: 6 }}>
                  v{deploymentData?.version || '2.1.0'}
                </div>
                <div style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.6 }}>
                  <div>Target: <span style={{ color: colors.textMain, fontWeight: 600 }}>Next.js 15.5 App Router</span></div>
                  <div>Environment: <span style={{ color: colors.textMain, fontWeight: 600 }}>Vercel Serverless ({deploymentData?.deploymentEnv || 'production'})</span></div>
                </div>
              </div>

              {/* Card 2: Git Commit & Branch */}
              <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 20, boxShadow: colors.cardShadow }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: colors.textSub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Latest Git Commit</span>
                  <span style={{ background: colors.badgeBg, border: `1px solid ${colors.badgeBorder}`, color: colors.textMain, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>
                    main
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <code style={{ fontSize: 18, fontWeight: 800, color: colors.textMain, background: colors.cardInner, padding: '2px 8px', borderRadius: 6, border: `1px solid ${colors.border}`, fontFamily: 'monospace' }}>
                    {deploymentData?.commitSha || '7bb7c61'}
                  </code>
                  <a
                    href={`https://github.com/agentblox40/antigravity-vercel-proxy/commit/${deploymentData?.commitFullSha || '7bb7c61'}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 11, color: colors.textMuted, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3, border: `1px solid ${colors.border}`, padding: '4px 8px', borderRadius: 6, background: colors.cardInner }}>
                    <span>GitHub</span>
                    <Icons.ExternalLink />
                  </a>
                </div>
                <div style={{ fontSize: 12, color: colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={deploymentData?.commitMessage}>
                  {deploymentData?.commitMessage || 'Support {length: short} bracket syntax and boost response length directives'}
                </div>
              </div>

              {/* Card 3: Cloud Telemetry & Health */}
              <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 20, boxShadow: colors.cardShadow }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: colors.textSub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Live Infrastructure</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, fontFamily: 'monospace' }}>
                    {latencyMs !== null ? `${latencyMs}ms RTT` : 'Online'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: colors.textMuted }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Memory Engine:</span>
                    <span style={{ color: memoryStats.redisConnected ? '#22c55e' : colors.textMain, fontWeight: 600 }}>
                      {memoryStats.storageMode || 'Upstash Redis'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Account Pool:</span>
                    <span style={{ color: colors.textMain, fontWeight: 600 }}>{accounts.length} Active ({accounts.filter(a => a.status === 'Ready').length} Ready)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Live Models:</span>
                    <span style={{ color: colors.textMain, fontWeight: 600 }}>{availableModels.length} Discovered</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Chronological Release History & Changelog */}
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 24, boxShadow: colors.cardShadow }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 16px', color: colors.textMain }}>
                Release History & Feature Timeline
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(deploymentData?.changelog || []).map((entry: any, idx: number) => {
                  const tagColors: Record<string, { bg: string; text: string; border: string }> = {
                    LATEST: { bg: 'rgba(34, 197, 94, 0.1)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.3)' },
                    MAJOR: { bg: isDark ? '#27272a' : '#f4f4f5', text: colors.textMain, border: colors.border },
                    PATCH: { bg: isDark ? '#1f1f23' : '#f9f9fb', text: colors.textMuted, border: colors.borderMuted },
                    CORE: { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' }
                  };
                  const t = tagColors[entry.tag] || tagColors.PATCH;

                  return (
                    <div
                      key={entry.version}
                      style={{
                        background: colors.cardInner,
                        border: `1px solid ${idx === 0 ? colors.border : colors.borderMuted}`,
                        borderRadius: 10,
                        padding: 18,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: colors.textMain, fontFamily: 'monospace' }}>
                            v{entry.version}
                          </span>
                          <span style={{ background: t.bg, color: t.text, border: `1px solid ${t.border}`, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, letterSpacing: '0.04em' }}>
                            {entry.tag}
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: colors.textMain }}>
                            {entry.title}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: colors.textSub }}>{entry.date}</span>
                          <a
                            href={`https://github.com/agentblox40/antigravity-vercel-proxy/commit/${entry.commit}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: 11,
                              fontFamily: 'monospace',
                              color: colors.textMuted,
                              textDecoration: 'none',
                              background: colors.inputBg,
                              border: `1px solid ${colors.border}`,
                              padding: '2px 7px',
                              borderRadius: 4,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                            <Icons.GitBranch />
                            {entry.commit}
                          </a>
                        </div>
                      </div>

                      <p style={{ margin: 0, fontSize: 12, color: colors.textMuted, lineHeight: 1.5 }}>
                        {entry.description}
                      </p>

                      {entry.highlights && entry.highlights.length > 0 && (
                        <div style={{ background: colors.inputBg, border: `1px solid ${colors.borderMuted}`, borderRadius: 6, padding: '10px 14px' }}>
                          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: colors.textMain, lineHeight: 1.7 }}>
                            {entry.highlights.map((hl: string, hIdx: number) => (
                              <li key={hIdx} style={{ color: colors.textMuted }}>
                                <span style={{ color: colors.textMain }}>{hl}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}


      </main>

    </div>
  );
}
