/**
 * Twitter/X card image.
 *
 * `twitter.card` is `summary_large_image`, which is only meaningful with an
 * image attached — Next.js does not fall back to `opengraph-image` for a
 * separately declared Twitter card. Rather than maintain a second design, this
 * re-exports the generated OG card so both platforms render the same asset.
 */
export { alt, size, contentType, default } from './opengraph-image';

export const runtime = 'edge';
