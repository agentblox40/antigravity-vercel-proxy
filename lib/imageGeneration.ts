import crypto from 'node:crypto';
import { getAccounts, pickAccount, getAccessToken } from './antigravity';

export const ALLOWED_IMAGE_MODEL = 'gemini-3.1-flash-image';

const UPSTREAM_URLS = [
  'https://daily-cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse',
  'https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse',
];

interface CachedImage {
  buffer: Buffer;
  mimeType: string;
  createdAt: number;
}

const imageMemoryCache = new Map<string, CachedImage>();
const MAX_CACHE_ENTRIES = 100;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function storeImage(id: string, buffer: Buffer, mimeType: string) {
  // Prune expired or old entries if cache is full
  if (imageMemoryCache.size >= MAX_CACHE_ENTRIES) {
    const now = Date.now();
    for (const [key, item] of imageMemoryCache.entries()) {
      if (now - item.createdAt > CACHE_TTL_MS || imageMemoryCache.size >= MAX_CACHE_ENTRIES) {
        imageMemoryCache.delete(key);
      }
    }
  }

  imageMemoryCache.set(id, {
    buffer,
    mimeType,
    createdAt: Date.now(),
  });

  // Upstash Redis asynchronous persistence if credentials are available
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (upstashUrl && upstashToken) {
    try {
      const payload = JSON.stringify({
        mimeType,
        b64: buffer.toString('base64'),
      });
      fetch(`${upstashUrl}/set/antigravity:image:${id}?ex=86400`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          'Content-Type': 'application/json',
        },
        body: payload,
      }).catch(() => {});
    } catch {}
  }
}

export async function getImage(id: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const cleanId = id.replace(/\.(jpg|jpeg|png|webp)$/i, '');
  const cached = imageMemoryCache.get(cleanId);
  if (cached) {
    return { buffer: cached.buffer, mimeType: cached.mimeType };
  }

  // Check Upstash Redis fallback
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (upstashUrl && upstashToken) {
    try {
      const res = await fetch(`${upstashUrl}/get/antigravity:image:${cleanId}`, {
        headers: { Authorization: `Bearer ${upstashToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.result) {
          const parsed = JSON.parse(data.result);
          const buffer = Buffer.from(parsed.b64, 'base64');
          imageMemoryCache.set(cleanId, {
            buffer,
            mimeType: parsed.mimeType || 'image/jpeg',
            createdAt: Date.now(),
          });
          return { buffer, mimeType: parsed.mimeType || 'image/jpeg' };
        }
      }
    } catch {}
  }

  return null;
}

export async function generateSingleImage(prompt: string): Promise<{ mimeType: string; b64Data: string }> {
  const accounts = getAccounts();
  if (accounts.length === 0) {
    throw new Error('No Google CloudCode PA accounts configured in environment variables.');
  }

  let lastError: any = null;

  for (let attempt = 0; attempt < accounts.length; attempt++) {
    const account = pickAccount();
    let accessToken: string;
    try {
      accessToken = await getAccessToken(account);
    } catch (err: any) {
      lastError = err;
      continue;
    }

    const payload = {
      project: account.projectId,
      model: ALLOWED_IMAGE_MODEL,
      request: {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ['IMAGE'],
        },
      },
    };

    for (const url of UPSTREAM_URLS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            'User-Agent': 'antigravity/2.22.0 windows/amd64',
          },
          body: JSON.stringify(payload),
        });

        if (res.status === 429 || res.status === 503) {
          account.cooldownUntil = Date.now() + 20000;
          lastError = new Error(`Upstream ${res.status}: Account ${account.name} rate limited`);
          break; // try next account in pool
        }

        if (!res.ok) {
          const errText = await res.text();
          lastError = new Error(`Upstream error ${res.status}: ${errText}`);
          continue; // try next URL
        }

        const text = await res.text();
        const lines = text.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          try {
            const data = JSON.parse(jsonStr);
            const candidates = data.response?.candidates || data.candidates || [];
            for (const cand of candidates) {
              const parts = cand.content?.parts || [];
              for (const part of parts) {
                const inline = part.inlineData || part.inline_data;
                if (inline?.data) {
                  return {
                    mimeType: inline.mimeType || inline.mime_type || 'image/jpeg',
                    b64Data: inline.data.replace(/\s+/g, ''),
                  };
                }
              }
            }
          } catch {}
        }
      } catch (err) {
        lastError = err;
      }
    }
  }

  throw lastError || new Error('Failed to generate image across all Google accounts in pool.');
}

export interface ImageGenerationOptions {
  prompt: string;
  model?: string;
  n?: number;
  size?: string;
  response_format?: 'b64_json' | 'url';
}

export async function executeImageGeneration(options: ImageGenerationOptions, origin: string) {
  const { prompt, model, n = 1, response_format = 'url' } = options;

  if (model && model.trim() !== ALLOWED_IMAGE_MODEL) {
    throw new Error(
      `[Model Error]: Unsupported model '${model}'. Only '${ALLOWED_IMAGE_MODEL}' is supported for image generation.`
    );
  }

  const count = Math.min(Math.max(1, n), 4);
  const tasks = Array.from({ length: count }, () => generateSingleImage(prompt));
  const generatedImages = await Promise.all(tasks);

  const created = Math.floor(Date.now() / 1000);

  if (response_format === 'b64_json') {
    return {
      created,
      data: generatedImages.map((img) => ({
        b64_json: img.b64Data,
      })),
    };
  }

  // Default: response_format === 'url'
  return {
    created,
    data: generatedImages.map((img) => {
      const id = `img_${crypto.randomBytes(8).toString('hex')}`;
      const buffer = Buffer.from(img.b64Data, 'base64');
      storeImage(id, buffer, img.mimeType);
      const ext = img.mimeType.includes('png') ? 'png' : 'jpg';
      return {
        url: `${origin}/api/images/${id}.${ext}`,
      };
    }),
  };
}
