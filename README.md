# Prototype 1: Next.js 15 Full Vercel 24/7 Proxy

Full-featured, serverless OpenAI-compatible proxy built with **Next.js 15 (App Router)** designed for seamless 24/7 hosting on **Vercel** with zero server management.

---

## Features
- **1-Click Vercel Deployment**: Serverless architecture runs 24/7 with zero maintenance.
- **Web Dashboard**: Clean dark glassmorphism dashboard with live account status and configuration instructions.
- **Multi-Account Auto-Balancing & Failover**: Distributes traffic across all your Google AI Pro accounts and automatically fails over on 429 rate limits.
- **24/7 Auto-Renewing OAuth**: Automatically refreshes Google OAuth tokens behind the scenes.
- **SillyTavern & Janitor AI Ready**: Native streaming SSE support and OpenAI compatibility (`/v1/chat/completions`, `/v1/models`).
- **Security Guard**: Protect your public Vercel endpoint with `PROXY_API_KEY`.

---

## Deploying to Vercel (Step-by-Step)

1. **Push this folder to a GitHub repository**:
   ```bash
   git init
   git add .
   git commit -m "Deploy Antigravity Vercel Proxy"
   git remote add origin https://github.com/YOUR_USER/antigravity-proxy.git
   git push -u origin main
   ```
2. **Import into Vercel**:
   - Go to [vercel.com](https://vercel.com) and click **Add New Project**.
   - Select your repository.
3. **Set Environment Variables in Vercel**:
   Add the following in **Settings &rarr; Environment Variables**:
   - `PROXY_API_KEY`: `your-custom-secret-key` (e.g. `tavern-secret-key-12345`)
   - `ACCOUNT_1_NAME`: `yashv3050@gmail.com`
   - `ACCOUNT_1_REFRESH_TOKEN`: `your-google-refresh-token`
   - `ACCOUNT_1_PROJECT_ID`: `primeval-dreamer-xxspj`
   - `ACCOUNT_2_NAME`: `manishflamingopharma@gmail.com`
   - `ACCOUNT_2_REFRESH_TOKEN`: `your-second-refresh-token`
   - `ACCOUNT_2_PROJECT_ID`: `trusty-arch-pc9s2`
4. **Click Deploy**:
   - Your proxy is live 24/7 at `https://your-app.vercel.app`!

---

## Connecting in SillyTavern / Janitor AI

- **API**: `OpenAI / Custom OpenAI`
- **API Base URL**: `https://your-app.vercel.app/v1`
- **API Key**: `tavern-secret-key-12345`
- **Model**: `gemini-3.7-flash`, `gemini-3.7-flash-high`, `gemini-3.1-pro`, `claude-opus-4-6-thinking`
