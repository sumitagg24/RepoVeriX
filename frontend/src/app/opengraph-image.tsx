import { ImageResponse } from 'next/og';

export const alt = 'RepoVeriX — evidence-grounded repository auditing and verified automated repair';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// Edge runtime: @vercel/og's Node font loader breaks on Windows builds;
// edge skips build-time prerender and renders on demand.
export const runtime = 'edge';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: 'linear-gradient(135deg, #0b1020 0%, #111827 60%, #1f2937 100%)',
          color: '#f9fafb',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #6366f1, #22d3ee)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            X
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.5 }}>RepoVeriX</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: 980 }}>
            Repository intelligence that shows its work.
          </div>
          <div style={{ marginTop: 24, fontSize: 30, color: '#9ca3af' }}>
            LLM proposes → Evidence supports → Execution verifies
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 22, color: '#d1d5db' }}>
          <div style={{ border: '1px solid #374151', borderRadius: 999, padding: '8px 20px' }}>
            Evidence chains
          </div>
          <div style={{ border: '1px solid #374151', borderRadius: 999, padding: '8px 20px' }}>
            Counterexample validation
          </div>
          <div style={{ border: '1px solid #374151', borderRadius: 999, padding: '8px 20px' }}>
            Sandboxed verification
          </div>
        </div>
      </div>
    ),
    size
  );
}
