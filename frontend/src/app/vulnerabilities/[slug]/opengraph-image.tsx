import { ImageResponse } from 'next/og';
import { VULNERABILITY_CLASSES, getVulnerability } from '@/lib/seo/vulnerabilities';

export const alt = 'RepoVeriX vulnerability class';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// Edge runtime: @vercel/og's Node font loader breaks on Windows builds;
// edge skips build-time prerender and renders on demand.
export const runtime = 'edge';

export function generateImageMetadata({ params }: { params: { slug: string } }) {
  const v = getVulnerability(params.slug);
  return [{ content: v ? `${v.name} — RepoVeriX` : 'RepoVeriX' }];
}

export default async function Image({ params }: { params: { slug: string } }) {
  const v = getVulnerability(params.slug) ?? VULNERABILITY_CLASSES[0];
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #6366f1, #22d3ee)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26,
                fontWeight: 700,
              }}
            >
              X
            </div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>RepoVeriX</div>
          </div>
          <div style={{ fontSize: 24, color: '#9ca3af' }}>{v.cwe}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 30, color: '#22d3ee', fontWeight: 600 }}>
            Vulnerability class
          </div>
          <div style={{ marginTop: 12, fontSize: 68, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.5 }}>
            {v.name}
          </div>
          <div style={{ marginTop: 20, fontSize: 27, color: '#9ca3af', maxWidth: 960 }}>
            Detection logic · evidence chain · counterexample checks · verified fix
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 21, color: '#d1d5db' }}>
          {v.rules.map((r) => (
            <div key={r} style={{ border: '1px solid #374151', borderRadius: 999, padding: '6px 18px' }}>
              {r}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
