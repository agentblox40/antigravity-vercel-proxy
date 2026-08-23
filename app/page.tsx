import React from 'react';
import { getAccounts, SUPPORTED_MODELS } from '@/lib/antigravity';

export const dynamic = 'force-dynamic';

export default function Home() {
  const accounts = getAccounts();
  const proxyKey = process.env.PROXY_API_KEY || '';

  return (
    <main style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #0f172a 100%)', color: '#f8fafc', padding: '50px 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '36px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 20, background: '#0284c7', color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              ● 24/7 Active Connection
            </span>
            <h1 style={{ fontSize: 28, margin: '12px 0 6px', color: '#38bdf8' }}>Antigravity Gemini Vercel Proxy</h1>
            <p style={{ color: '#94a3b8', margin: 0, fontSize: 14 }}>Zero-maintenance OpenAI-compatible gateway for SillyTavern, Janitor AI, and OpenAI SDKs.</p>
          </div>
        </div>

        {/* Connected Accounts Card */}
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#e2e8f0' }}>⚡ Connected Google AI Pro Accounts ({accounts.length})</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {accounts.map((acc, idx) => (
              <div key={acc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#f1f5f9' }}>{acc.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Project ID: <code style={{ color: '#38bdf8' }}>{acc.projectId || 'Auto-Discovered'}</code></div>
                </div>
                <span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, background: '#065f46', color: '#34d399', fontWeight: 600 }}>Active</span>
              </div>
            ))}
          </div>
        </div>

        {/* Configuration for SillyTavern / Janitor AI */}
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#e2e8f0' }}>🎮 SillyTavern / Janitor AI Connection Details</h3>
          <div style={{ background: '#020617', padding: 16, borderRadius: 8, fontFamily: 'monospace', fontSize: 13, color: '#a5f3fc', lineHeight: 1.8 }}>
            <div><span style={{ color: '#64748b' }}>API Format: </span> Custom OpenAI / OpenAI Compatible</div>
            <div><span style={{ color: '#64748b' }}>API Base URL: </span> https://YOUR-VERCEL-DOMAIN.vercel.app/v1</div>
            <div><span style={{ color: '#64748b' }}>API Key: </span> {proxyKey ? proxyKey : '(No API Key required - Open mode)'}</div>
            <div><span style={{ color: '#64748b' }}>Default Model: </span> gemini-3.7-flash (or gemini-3.7-flash-high)</div>
          </div>
        </div>

        {/* Models Catalog */}
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#e2e8f0' }}>🧠 Available Models</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SUPPORTED_MODELS.map((m) => (
              <span key={m.id} style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: 8, fontSize: 12, color: '#38bdf8', fontFamily: 'monospace' }}>
                {m.id}
              </span>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
