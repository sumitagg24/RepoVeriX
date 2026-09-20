import { NextResponse, type NextRequest } from 'next/server';
import { JevClient } from '@/lib/jev/client';

export const dynamic = 'force-dynamic';

/**
 * Server-side Route Handler for TypeSafe AI Jev evaluations.
 * 
 * SECURITY:
 * - API keys (TYPESAFE_API_KEY / JEV_API_KEY) are handled strictly server-side.
 * - Never returns or leaks API keys to the browser.
 * - Enforces decision query types (classify_category, classify_severity, route_scan, score_risk, boolean).
 * - Disallows text generation.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, input, instructions, threshold } = body;

    if (!action || !input || typeof input.target !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request payload. Expected action and input object with target string.' },
        { status: 400 }
      );
    }

    // Initialize server-side Jev client
    const client = new JevClient();

    let result;
    const confidenceOptions = typeof threshold === 'number' ? { threshold } : undefined;

    switch (action) {
      case 'classify_category':
        result = await client.classifyVulnerabilityCategory(input, confidenceOptions);
        break;

      case 'classify_severity':
        result = await client.classifySeverity(input, confidenceOptions);
        break;

      case 'route_scan':
        result = await client.routeScanStrategy(input, confidenceOptions);
        break;

      case 'score_risk':
        result = await client.scoreRisk(input, confidenceOptions);
        break;

      case 'boolean':
        if (typeof instructions !== 'string' || !instructions) {
          return NextResponse.json(
            { error: 'Boolean decision requires an instructions string.' },
            { status: 400 }
          );
        }
        result = await client.evaluateBoolean(input, instructions, confidenceOptions);
        break;

      case 'generate_text':
        // Explicitly block text generation attempt
        return NextResponse.json(
          {
            error:
              'Jev (typesafe-ai/jev) is a System 1 non-generative model and cannot generate text. Use primary LLM pipeline.',
          },
          { status: 400 }
        );

      default:
        return NextResponse.json(
          { error: `Unsupported Jev action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      data: result,
      model: 'typesafe-ai/jev',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal server error during Jev evaluation' },
      { status: 500 }
    );
  }
}
