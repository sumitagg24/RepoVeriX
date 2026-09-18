import { ImageResponse } from 'next/og';

/**
 * Generated Open Graph card.
 *
 * The site shipped `twitter: { card: 'summary_large_image' }` with no image
 * anywhere (public/ is empty and metadata declared none), so every share
 * rendered an image-less card while asking the platform for the large format.
 *
 * This is generated at build time rather than shipped as a raster file: it
 * stays in sync with the palette, costs no bytes in the JS bundle, and needs no
 * designer round-trip when copy changes.
 *
 * NOTE: an earlier revision of this card painted an indigo→cyan gradient
 * (#6366f1 → #22d3ee) from the pre-redesign palette, which no longer existed
 * anywhere else in the product. It now renders on the live token values
 * (background 220 15% 8% ≈ #111318, primary 217 91% 60% ≈ #4f8cff) and keeps
 * the original card's product description as its supporting line.
 */
/**
 * Edge runtime: on the default Node runtime `next/og` resolves its bundled
 * renderer through `import.meta.url` → `fileURLToPath`, which throws
 * "TypeError: Invalid URL" on Windows paths and fails the whole build.
 */
export const runtime = 'edge';

export const alt =
  'RepoVeriX — evidence-grounded repository auditing and verified automated repair.';

export const size = { width: 1200, height: 630 };

export const contentType = 'image/png';

const BG = '#111318';
const SURFACE = '#181b22';
const BORDER = '#242a35';
const TEXT = '#f5f7fa';
const MUTED = '#949ba8';
const BLUE = '#4f8cff';
const GREEN = '#32d583';
const AMBER = '#f5b942';
const RED = '#ff5c5c';

/** The product's own chain: SOURCE → ANALYSIS → EVIDENCE → RISK → REPAIR → VERIFIED. */
const CHAIN = [
  { label: 'SOURCE', color: BLUE },
  { label: 'ANALYSIS', color: BLUE },
  { label: 'EVIDENCE', color: AMBER },
  { label: 'RISK', color: RED },
  { label: 'REPAIR', color: BLUE },
  { label: 'VERIFIED', color: GREEN },
];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: BG,
          backgroundImage: `radial-gradient(circle at 12% 0%, ${BLUE}22, transparent 45%)`,
          padding: '64px 72px',
          color: TEXT,
          fontFamily: 'sans-serif',
        }}
      >
        {/* Brand row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: `${BLUE}1f`,
              border: `1px solid ${BLUE}55`,
              color: BLUE,
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            R
          </div>
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 600, letterSpacing: -0.5 }}>
            RepoVeriX
          </div>
          <div
            style={{
              display: 'flex',
              marginLeft: 12,
              padding: '5px 12px',
              borderRadius: 999,
              border: `1px solid ${BORDER}`,
              backgroundColor: SURFACE,
              color: MUTED,
              fontSize: 15,
              letterSpacing: 1.2,
            }}
          >
            REPOSITORY SECURITY INTELLIGENCE
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', fontSize: 58, fontWeight: 700, letterSpacing: -1.8, lineHeight: 1.1 }}>
            Evidence-grounded repository auditing
          </div>
          <div style={{ display: 'flex', fontSize: 58, fontWeight: 700, letterSpacing: -1.8, lineHeight: 1.1 }}>
            and verified automated repair
          </div>
          <div style={{ display: 'flex', marginTop: 8, fontSize: 24, color: MUTED, maxWidth: 920 }}>
            Every finding carries its evidence chain. Every repair is verified before it ships.
          </div>
        </div>

        {/* Evidence chain — the signature visual */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {CHAIN.map((step, i) => (
            <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                  backgroundColor: SURFACE,
                  fontSize: 17,
                  letterSpacing: 1.4,
                  color: TEXT,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: step.color,
                  }}
                />
                {step.label}
              </div>
              {i < CHAIN.length - 1 && (
                <div style={{ display: 'flex', color: MUTED, fontSize: 20 }}>
                  {'\u2192'}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
