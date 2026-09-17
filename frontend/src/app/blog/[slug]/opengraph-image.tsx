import { ImageResponse } from 'next/og';
import { BLOG_POSTS, getPost } from '@/lib/blog';

export const alt = 'RepoVeriX engineering blog';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// Edge runtime: @vercel/og's Node font loader breaks on Windows builds;
// edge skips build-time prerender and renders on demand.
export const runtime = 'edge';

export default async function Image({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug) ?? BLOG_POSTS[0];
  const words = post.title.split(' ');
  const lines: string[] = [];
  let current: string[] = [];
  for (const w of words) {
    current.push(w);
    if (current.join(' ').length > 26) {
      lines.push(current.join(' '));
      current = [];
    }
  }
  if (current.length) lines.push(current.join(' '));

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
          <div style={{ marginLeft: 18, fontSize: 24, color: '#9ca3af' }}>Engineering blog</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lines.map((l, i) => (
            <div key={i} style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.12, letterSpacing: -1 }}>
              {l}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 21, color: '#d1d5db' }}>
          {post.tags.map((t) => (
            <div key={t} style={{ border: '1px solid #374151', borderRadius: 999, padding: '6px 18px' }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
