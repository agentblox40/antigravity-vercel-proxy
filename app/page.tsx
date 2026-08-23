'use client';

import React, { useState, useEffect } from 'react';

const SUPPORTED_MODELS = [
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', badge: 'Default', tag: 'Fast / 1M Context', desc: 'Standard high-speed multimodal reasoning model.' },
  { id: 'gemini-3.7-flash-high', name: 'Gemini 3.7 Flash (High)', badge: 'Thinking', tag: '24K Tokens Budget', desc: 'Maximum reasoning depth for complex character roleplay & narratives.' },
  { id: 'gemini-3.7-flash-medium', name: 'Gemini 3.7 Flash (Med)', badge: 'Thinking', tag: '8K Tokens Budget', desc: 'Balanced reasoning with low latency.' },
  { id: 'gemini-3.7-flash-low', name: 'Gemini 3.7 Flash (Low)', badge: 'Thinking', tag: '2K Tokens Budget', desc: 'Quick thinking budget for snappy banter.' },
  { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', badge: 'Pro Agent', tag: 'Deep Logic', desc: 'Heavyweight creative writing and complex scenario management.' },
  { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6', badge: 'Claude', tag: 'Thinking Enabled', desc: 'Anthropic Claude Opus running over Antigravity bridge.' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', badge: 'Claude', tag: 'High Speed', desc: 'Anthropic Claude Sonnet with reasoning capabilities.' },
  { id: 'gpt-4o', name: 'GPT-4o (Compatibility Alias)', badge: 'Alias', tag: 'Auto-Routed', desc: 'Maps directly to Gemini 3.7 Flash for clients that hardcode GPT-4o.' },
];

export default function Dashboard() {
  const [origin, setOrigin] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Playground State
  const [selectedModel, setSelectedModel] = useState('gemini-3.7-flash');
  const [testPrompt, setTestPrompt] = useState('You are in a lively tavern. Describe the atmosphere and greet me.');
  const [testResponse, setTestResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
      const savedKey = localStorage.getItem('proxy_test_key') || 'KARS-2010915';
      setApiKey(savedKey);
    }
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const runTestPrompt = async () => {
    if (!testPrompt.trim()) return;
    setIsLoading(true);
    setTestError(null);
    setTestResponse('');
    localStorage.setItem('proxy_test_key', apiKey);

    try {
      const res = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: 'system', content: 'You are a creative, vivid roleplay narrator and assistant.' },
            { role: 'user', content: testPrompt }
          ],
          stream: true
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No readable stream available');

      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const parsed = JSON.parse(line.slice(6));
              const delta = parsed.choices?.[0]?.delta?.content || '';
              accumulated += delta;
              setTestResponse(accumulated);
            } catch {}
          }
        }
      }
    } catch (err: any) {
      setTestError(err.message || 'Failed to connect to proxy');
    } finally {
      setIsLoading(false);
    }
  };

  const baseUrl = origin ? `${origin}/v1` : 'https://your-domain.vercel.app/v1';
  const chatUrl = origin ? `${origin}/v1/chat/completions` : 'https://your-domain.vercel.app/v1/chat/completions';
  const modelsUrl = origin ? `${origin}/v1/models` : 'https://your-domain.vercel.app/v1/models';

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#f4f4f5', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', padding: '40px 20px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        
        {/* Header Bar */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #27272a', paddingBottom: 24, marginBottom: 32 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '4px 12px', borderRadius: 9999, marginBottom: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }}></span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#34d399', letterSpacing: '0.05em' }}>24/7 PROXY ACTIVE</span>
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 8px', background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 50%, #c084fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Antigravity 24/7 Gemini Gateway
            </h1>
            <p style={{ margin: 0, color: '#a1a1aa', fontSize: 15 }}>
              OpenAI-compatible serverless proxy for Janitor AI, SillyTavern, Agnaistic, and OpenAI SDKs.
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 12, color: '#71717a', display: 'block' }}>Engine</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#e4e4e7', background: '#18181b', padding: '6px 12px', borderRadius: 8, border: '1px solid #27272a', display: 'inline-block', marginTop: 4 }}>
              Google DeepMind / Cloud Code PA
            </span>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24, marginBottom: 32 }}>
          
          {/* Quick Setup Card */}
          <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 16, padding: 24, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#fafafa' }}>🔑 Connection Credentials</h2>
              <span style={{ fontSize: 12, color: '#a1a1aa', background: '#18181b', padding: '3px 8px', borderRadius: 6 }}>Custom OpenAI</span>
            </div>
            
            {/* Field 1: Base URL */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 6 }}>
                API Base URL <span style={{ color: '#38bdf8' }}>(Paste in Janitor AI / SillyTavern)</span>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input 
                  type="text" 
                  readOnly 
                  value={baseUrl} 
                  style={{ flex: 1, background: '#09090b', border: '1px solid #27272a', borderRadius: 8, padding: '10px 12px', color: '#38bdf8', fontFamily: 'monospace', fontSize: 13 }}
                />
                <button 
                  onClick={() => copyToClipboard(baseUrl, 'baseUrl')}
                  style={{ background: copiedField === 'baseUrl' ? '#059669' : '#27272a', color: '#fff', border: 'none', borderRadius: 8, padding: '0 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s' }}>
                  {copiedField === 'baseUrl' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Field 2: Full Completions URL */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 6 }}>
                Direct Chat Endpoint
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input 
                  type="text" 
                  readOnly 
                  value={chatUrl} 
                  style={{ flex: 1, background: '#09090b', border: '1px solid #27272a', borderRadius: 8, padding: '10px 12px', color: '#a1a1aa', fontFamily: 'monospace', fontSize: 13 }}
                />
                <button 
                  onClick={() => copyToClipboard(chatUrl, 'chatUrl')}
                  style={{ background: copiedField === 'chatUrl' ? '#059669' : '#27272a', color: '#fff', border: 'none', borderRadius: 8, padding: '0 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  {copiedField === 'chatUrl' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Field 3: Proxy API Key */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa' }}>
                  Proxy API Key (`PROXY_API_KEY`)
                </label>
                <button 
                  onClick={() => setShowKey(!showKey)} 
                  style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input 
                  type={showKey ? 'text' : 'password'} 
                  value={apiKey} 
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your PROXY_API_KEY"
                  style={{ flex: 1, background: '#09090b', border: '1px solid #27272a', borderRadius: 8, padding: '10px 12px', color: '#f4f4f5', fontFamily: 'monospace', fontSize: 13 }}
                />
                <button 
                  onClick={() => copyToClipboard(apiKey, 'apiKey')}
                  style={{ background: copiedField === 'apiKey' ? '#059669' : '#27272a', color: '#fff', border: 'none', borderRadius: 8, padding: '0 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  {copiedField === 'apiKey' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
            
            <p style={{ margin: '12px 0 0', fontSize: 12, color: '#71717a' }}>
              💡 In Janitor AI: Set <strong>API Key</strong> to your key, and <strong>Custom URL / Reverse Proxy</strong> to <code style={{ color: '#38bdf8' }}>{baseUrl}</code> or <code style={{ color: '#38bdf8' }}>{chatUrl}</code>.
            </p>
          </div>

          {/* Account & Architecture Status Card */}
          <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 16, padding: 24, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: '#fafafa' }}>🛡️ High-Availability Architecture</h2>
            
            <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#18181b', padding: '12px 14px', borderRadius: 10, border: '1px solid #27272a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ background: '#0284c7', color: '#fff', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>1</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f4f4f5' }}>Multi-Account Failover Pool</div>
                    <div style={{ fontSize: 11, color: '#71717a' }}>Rotates between Google AI Pro accounts automatically</div>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#34d399', background: 'rgba(52, 211, 153, 0.1)', padding: '3px 8px', borderRadius: 6 }}>Active</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#18181b', padding: '12px 14px', borderRadius: 10, border: '1px solid #27272a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ background: '#6366f1', color: '#fff', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>2</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f4f4f5' }}>24/7 Silent Token Auto-Refresh</div>
                    <div style={{ fontSize: 11, color: '#71717a' }}>Silent OAuth renewal before expiration</div>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', background: 'rgba(99, 102, 241, 0.1)', padding: '3px 8px', borderRadius: 6 }}>Automated</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#18181b', padding: '12px 14px', borderRadius: 10, border: '1px solid #27272a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ background: '#a855f7', color: '#fff', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>3</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f4f4f5' }}>Bearer Password Protection</div>
                    <div style={{ fontSize: 11, color: '#71717a' }}>Blocks unauthorized traffic with 401 Unauthorized</div>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#c084fc', background: 'rgba(168, 85, 247, 0.1)', padding: '3px 8px', borderRadius: 6 }}>Enforced</span>
              </div>
            </div>

            <div style={{ background: '#09090b', padding: '12px 14px', borderRadius: 8, border: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#a1a1aa' }}>Models Catalog:</span>
              <a href={modelsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}>
                View /v1/models JSON &rarr;
              </a>
            </div>
          </div>

        </div>

        {/* Live Interactive Sandbox */}
        <section style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 16, padding: 28, marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px', color: '#fafafa' }}>🧪 Live Proxy Test Sandbox</h2>
              <p style={{ margin: 0, color: '#a1a1aa', fontSize: 13 }}>Test your live proxy streaming directly from the browser.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa' }}>Model:</label>
              <select 
                value={selectedModel} 
                onChange={(e) => setSelectedModel(e.target.value)}
                style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, padding: '8px 12px', color: '#38bdf8', fontSize: 13, fontWeight: 600, outline: 'none' }}>
                {SUPPORTED_MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <textarea 
              rows={3} 
              value={testPrompt} 
              onChange={(e) => setTestPrompt(e.target.value)}
              placeholder="Enter a prompt to test your proxy..."
              style={{ width: '100%', boxSizing: 'border-box', background: '#09090b', border: '1px solid #27272a', borderRadius: 10, padding: 14, color: '#f4f4f5', fontSize: 14, resize: 'vertical', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button 
              onClick={runTestPrompt} 
              disabled={isLoading}
              style={{ background: isLoading ? '#3f3f46' : 'linear-gradient(135deg, #0284c7 0%, #4f46e5 100%)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: isLoading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)', transition: 'all 0.2s' }}>
              {isLoading ? 'Streaming Response...' : '⚡ Send Test Prompt'}
            </button>
          </div>

          {testError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 10, padding: 14, color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>
              <strong>Error:</strong> {testError}
            </div>
          )}

          {testResponse && (
            <div style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: 10, padding: 18, marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Live Streamed Output ({selectedModel})
              </div>
              <div style={{ color: '#e4e4e7', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {testResponse}
              </div>
            </div>
          )}
        </section>

        {/* Model Catalog Grid */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 16px', color: '#fafafa' }}>🧠 Available Models & Tiers</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {SUPPORTED_MODELS.map((m) => (
              <div key={m.id} style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#1e293b', color: '#38bdf8' }}>{m.badge}</span>
                    <span style={{ fontSize: 11, color: '#71717a' }}>{m.tag}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#f4f4f5', marginBottom: 6 }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.5, marginBottom: 12 }}>{m.desc}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #1f1f23', paddingTop: 10 }}>
                  <code style={{ fontSize: 11, color: '#38bdf8' }}>{m.id}</code>
                  <button 
                    onClick={() => copyToClipboard(m.id, m.id)}
                    style={{ background: copiedField === m.id ? '#059669' : '#27272a', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                    {copiedField === m.id ? '✓' : 'Copy'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
