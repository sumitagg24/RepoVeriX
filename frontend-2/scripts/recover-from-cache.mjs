/**
 * Recover sources from the Next.js dev cache.
 *
 * The webpack dev cache (`.next/cache/webpack/<group>/<hash>.pack.gz`) stores the source
 * map of every module it compiled, and those maps carry `sourcesContent` — the
 * original file text. That makes the cache a usable backup of `src/`, which is
 * what this script reconstructs: it walks every pack, decodes each embedded map,
 * pairs `sources[i]` with `sourcesContent[i]`, and writes the newest/longest
 * version of each path into a staging directory.
 *
 *   node frontend-2/scripts/recover-from-cache.mjs [--out .recover] [--apply]
 *
 * `--apply` copies the staged files into `src/`; without it nothing outside the
 * staging directory is touched. Run the recovery only when `src/` is missing or
 * you want to diff it against the cache.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');

const args = process.argv.slice(2);
const debug = args.includes('--debug');
const outFlag = args.indexOf('--out');
const outDir = path.resolve(appRoot, outFlag >= 0 ? args[outFlag + 1] : '.recover');
const apply = args.includes('--apply');

const cacheRoot = path.join(appRoot, '.next', 'cache', 'webpack');

function listPacks() {
  if (!fs.existsSync(cacheRoot)) return [];
  const packs = [];
  for (const group of fs.readdirSync(cacheRoot)) {
    const dir = path.join(cacheRoot, group);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith('.pack.gz') || file.endsWith('.pack')) {
        packs.push(path.join(dir, file));
      }
    }
  }
  return packs;
}

/** Read one pack, tolerating multi-member gzip streams. */
function readPack(file) {
  const raw = fs.readFileSync(file);
  if (!file.endsWith('.gz')) return raw;
  return zlib.gunzipSync(raw);
}

/**
 * Find the escaped JSON object that contains `"sourcesContent"`.
 *
 * The pack stores the map as a JSON *string*, so every quote and newline inside
 * it is escaped. We locate the marker, walk back to the object start, then scan
 * for the matching brace while respecting escapes.
 */
function findMaps(text) {
  const maps = [];
  const marker = '"sourcesContent":';
  let index = 0;

  while (true) {
    index = text.indexOf(marker, index);
    if (index < 0) break;

    let start = text.lastIndexOf('{"version":3', index);
    if (start < 0) start = text.lastIndexOf('{"version"', index);
    if (start < 0) {
      index += marker.length;
      continue;
    }

    let depth = 0;
    let escaped = false;
    let inString = false;
    let end = -1;
    for (let i = start; i < text.length; i += 1) {
      const ch = text[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }

    if (end > 0) {
      maps.push(text.slice(start, end));
      index = end;
    } else {
      index += marker.length;
    }
  }

  return maps;
}

/** The map may be stored raw or as an escaped JSON string; accept both. */
function parseMap(blob) {
  try {
    return JSON.parse(blob);
  } catch {
    try {
      return JSON.parse(JSON.parse(`"${blob.replace(/"/g, '\\"')}"`));
    } catch {
      return null;
    }
  }
}

/** `webpack://..././src/app/page.tsx` → `src/app/page.tsx`. */
function normalize(source) {
  if (!source) return null;
  let value = source;
  const inner = value.indexOf('./src/');
  if (inner >= 0) value = value.slice(inner + 2);
  else if (value.endsWith('.tsx') || value.endsWith('.ts') || value.endsWith('.css')) {
    const at = value.indexOf('src/');
    if (at < 0) return null;
    value = value.slice(at);
  } else {
    return null;
  }
  if (value.includes('node_modules')) return null;
  if (!/\.(tsx|ts|css)$/.test(value)) return null;
  return value.replace(/\\/g, '/');
}

/**
 * Paths that belong to this application.
 *
 * Bundled dependencies publish their own source maps under their package root,
 * so framer-motion, lucide and TanStack Query all arrive as `src/...` too (for
 * example `src/icons/check.tsx` or `src/useQuery.ts`). Only the directories this
 * app owns are kept.
 */
const KEEP = [
  /^src\/app\//,
  /^src\/components\/(app|auth|billing|findings|layout|marketing|repositories|scans|ui)\//,
  /^src\/context\/(auth|theme)-context\.tsx$/,
  /^src\/hooks\/use-[a-z-]+\.ts$/,
  /^src\/lib\//,
  /^src\/services\//,
  /^src\/types\//,
];

const isOurs = (target) => KEEP.some((pattern) => pattern.test(target));

const recovered = new Map();
const packFiles = listPacks();
let debugCount = 0;

for (const pack of packFiles) {
  let buffer;
  try {
    buffer = readPack(pack);
  } catch (error) {
    console.log(`skip ${path.relative(appRoot, pack)}: ${error.message}`);
    continue;
  }

  const text = buffer.toString('latin1');
  let decoded = 0;

  for (const escaped of findMaps(text)) {
    const map = parseMap(escaped);
    if (!map || !Array.isArray(map.sources) || !Array.isArray(map.sourcesContent)) continue;
    if (debug && debugCount < 8) {
      debugCount += 1;
      console.log('--- map');
      console.log('  file:', map.file, '| sourceRoot:', map.sourceRoot);
      console.log('  sources:', map.sources.slice(0, 2));
      console.log('  head:', String(map.sourcesContent[0] ?? '').slice(0, 70).replace(/\n/g, '\\n'));
    }

    for (let i = 0; i < map.sources.length; i += 1) {
      const target = normalize(map.sources[i]);
      const content = map.sourcesContent[i];
      if (!target || typeof content !== 'string' || content.length === 0) continue;
      if (!isOurs(target)) continue;
      const previous = recovered.get(target);
      if (!previous || content.length >= previous.content.length) {
        recovered.set(target, { content, pack: path.relative(appRoot, pack) });
      }
      decoded += 1;
    }
  }

  console.log(
    `${path.relative(appRoot, pack).padEnd(52)} ${(buffer.length / 1e6).toFixed(1)} MB  entries=${decoded}  unique=${recovered.size}`,
  );
}

const paths = [...recovered.keys()].sort();
let written = 0;
let bytes = 0;

for (const target of paths) {
  const { content } = recovered.get(target);
  const destination = path.join(outDir, target);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  // The pack was read byte-for-byte as latin1, so write it back the same way:
  // re-encoding as UTF-8 would double-encode every non-ASCII character.
  fs.writeFileSync(destination, content, 'latin1');
  written += 1;
  bytes += content.length;
}

console.log(`\nrecovered ${written} files (${(bytes / 1024).toFixed(0)} kB) into ${path.relative(appRoot, outDir)}`);

const byDir = new Map();
for (const target of paths) {
  const dir = path.dirname(target);
  byDir.set(dir, (byDir.get(dir) ?? 0) + 1);
}
for (const [dir, count] of [...byDir.entries()].sort()) {
  console.log(`  ${String(count).padStart(3)}  ${dir}`);
}

if (apply) {
  for (const target of paths) {
    const destination = path.join(appRoot, target);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, recovered.get(target).content, 'latin1');
  }
  console.log(`\napplied ${written} files into ${path.relative(appRoot, appRoot)}/`);
}
