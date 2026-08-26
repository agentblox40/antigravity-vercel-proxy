import { NextRequest, NextResponse } from 'next/server';
import {
  getInjectionsConfig,
  saveInjectionsConfig,
  estimateTokens,
  DEFAULT_INJECTIONS,
  PromptInjection
} from '@/lib/injections';
import { checkAuth } from '@/lib/completions';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, api-key, x-api-key',
    },
  });
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json(
      { error: { message: 'Unauthorized. Invalid proxy key.' } },
      { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const config = await getInjectionsConfig();
  const totalTokens = (config.injections || []).reduce((acc, inj) => {
    return acc + (inj.enabled ? estimateTokens(inj.content) : 0);
  }, 0);
  const activeCount = (config.injections || []).filter(inj => inj.enabled).length;

  return NextResponse.json(
    {
      success: true,
      masterEnabled: config.masterEnabled,
      activeCount,
      totalTokens,
      injections: config.injections
    },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  );
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json(
      { error: { message: 'Unauthorized. Invalid proxy key.' } },
      { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  try {
    const body = await req.json();
    const currentConfig = await getInjectionsConfig();

    // Case 1: Toggle Master Switch
    if (typeof body.masterEnabled === 'boolean' && !body.action) {
      currentConfig.masterEnabled = body.masterEnabled;
      await saveInjectionsConfig(currentConfig);
      return NextResponse.json({ success: true, config: currentConfig }, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    // Case 2: Reset to Defaults
    if (body.action === 'reset_defaults') {
      const resetConfig = {
        masterEnabled: true,
        injections: DEFAULT_INJECTIONS
      };
      await saveInjectionsConfig(resetConfig);
      return NextResponse.json({ success: true, config: resetConfig }, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    // Case 3: Toggle Individual Injection
    if (body.action === 'toggle' && body.id) {
      const target = (currentConfig.injections || []).find(inj => inj.id === body.id);
      if (target) {
        target.enabled = typeof body.enabled === 'boolean' ? body.enabled : !target.enabled;
        await saveInjectionsConfig(currentConfig);
        return NextResponse.json({ success: true, config: currentConfig }, { headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      return NextResponse.json({ error: 'Injection not found' }, { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    // Case 4: Create or Update Injection
    if (body.action === 'upsert' && body.injection) {
      const inj: PromptInjection = body.injection;
      if (!inj.title || !inj.content) {
        return NextResponse.json({ error: 'Title and content are required' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
      }

      inj.tokens = estimateTokens(inj.content);
      const existingIdx = (currentConfig.injections || []).findIndex(item => item.id === inj.id);

      if (existingIdx >= 0) {
        currentConfig.injections[existingIdx] = {
          ...currentConfig.injections[existingIdx],
          ...inj,
          tokens: estimateTokens(inj.content)
        };
      } else {
        const newInj: PromptInjection = {
          id: inj.id || 'inj_' + Date.now(),
          title: inj.title.trim(),
          content: inj.content.trim(),
          enabled: typeof inj.enabled === 'boolean' ? inj.enabled : true,
          category: inj.category || 'custom',
          position: inj.position || 'depth_0_user',
          triggerMode: inj.triggerMode || 'always',
          probabilityPercent: typeof inj.probabilityPercent === 'number' ? inj.probabilityPercent : 10,
          intervalTurns: typeof inj.intervalTurns === 'number' ? inj.intervalTurns : 5,
          tokens: estimateTokens(inj.content),
          createdAt: Date.now()
        };
        currentConfig.injections.push(newInj);
      }

      await saveInjectionsConfig(currentConfig);
      return NextResponse.json({ success: true, config: currentConfig }, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    // Case 5: Full Array Replacement (e.g. reordering)
    if (Array.isArray(body.injections)) {
      currentConfig.injections = body.injections.map((inj: PromptInjection) => ({
        ...inj,
        tokens: estimateTokens(inj.content)
      }));
      if (typeof body.masterEnabled === 'boolean') {
        currentConfig.masterEnabled = body.masterEnabled;
      }
      await saveInjectionsConfig(currentConfig);
      return NextResponse.json({ success: true, config: currentConfig }, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    return NextResponse.json({ error: 'Invalid action or payload' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json(
      { error: { message: 'Unauthorized. Invalid proxy key.' } },
      { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing injection ID parameter' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const currentConfig = await getInjectionsConfig();
  currentConfig.injections = (currentConfig.injections || []).filter(inj => inj.id !== id);
  await saveInjectionsConfig(currentConfig);

  return NextResponse.json(
    { success: true, config: currentConfig },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  );
}
