import { ImageResponse } from 'next/og';

/*
 * Edge runtime on purpose. The node build of `@vercel/og` resolves its bundled
 * font through `fileURLToPath(import.meta.url)`, which throws during a Node
 * server build; the edge build renders the same card without that dependency.
 */
export const runtime = 'edge';

export const alt = 'RepoVeriX. Find code risks. Understand impact. Verify the fix.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Social card.
 *
 * Rendered rather than illustrated: the type, the rule and the severity chips
 * are the same elements the product uses, so the card cannot drift from the
 * interface. No gradients, no mock terminal, no stock imagery.
 *
 *   GET /opengraph-image  →  1200×630 PNG
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#f6f7f8',
          padding: '64px 72px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: '#12181d',
              color: '#f7f9fa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 19,
              fontWeight: 600,
            }}
          >
            R
          </div>
          <div style={{ fontSize: 26, fontWeight: 600, color: '#0d1114', letterSpacing: '-0.02em' }}>
            RepoVeriX
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 900 }}>
          <div
            style={{
              fontSize: 58,
              lineHeight: 1.1,
              fontWeight: 600,
              color: '#0d1114',
              letterSpacing: '-0.03em',
            }}
          >
            Find code risks. Understand impact. Verify the fix.
          </div>
          <div style={{ fontSize: 24, lineHeight: 1.45, color: '#3b4551' }}>
            Every finding carries the evidence chain behind it, and every repair is tested before it is
            called verified.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ height: 1, background: '#e1e5e9', display: 'flex' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {[
              { label: 'Critical', border: '#f0d3ce', bg: '#fbeeec', color: '#b3342c' },
              { label: 'Verified repair', border: '#cfe6d8', bg: '#ebf5ef', color: '#2b7a4b' },
              { label: 'SARIF export', border: '#e1e5e9', bg: '#f1f3f5', color: '#4a5568' },
            ].map((chip) => (
              <div
                key={chip.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  border: `1px solid ${chip.border}`,
                  background: chip.bg,
                  color: chip.color,
                  borderRadius: 4,
                  padding: '6px 12px',
                  fontSize: 19,
                  fontWeight: 500,
                }}
              >
                {chip.label}
              </div>
            ))}
            <div style={{ marginLeft: 'auto', fontSize: 19, color: '#566170' }}>
              Repository security with proof
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
