import { NextResponse, type NextRequest } from 'next/server';

/**
 * Same-origin API proxy.
 *
 * The frontend calls `/api/v1/*` on its own origin and this handler forwards the
 * request to the FastAPI backend. Nothing about the backend contract changes:
 * method, query string, body and the headers the API cares about are passed
 * through untouched, and the response (status, headers and body) comes back the
 * way the backend produced it.
 *
 * Only an allowlist of request headers is forwarded, so browser cookies, the
 * app's own trace headers and anything else incidental never leak upstream. The
 * `Authorization` header is forwarded because that is how the API authenticates.
 */

export const dynamic = 'force-dynamic';

const API_ORIGIN = (
  process.env.NEXT_PUBLIC_API_ORIGIN ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000'
).replace(/\/$/, '');

/** Headers worth forwarding. Anything absent here is dropped. */
const FORWARD_REQUEST_HEADERS = [
  'authorization',
  'content-type',
  'accept',
  'accept-language',
  'idempotency-key',
  'if-none-match',
  'x-requested-with',
];

/** Response headers the browser needs back verbatim. */
const FORWARD_RESPONSE_HEADERS = [
  'content-type',
  'content-disposition',
  'cache-control',
  'etag',
  'last-modified',
  'x-upgrade-reason',
  'retry-after',
];

async function forward(request: NextRequest, context: { params: { path: string[] } }) {
  const path = (context.params.path ?? []).join('/');
  const search = request.nextUrl.search;
  const target = `${API_ORIGIN}/api/v1/${path}${search}`;

  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const body = hasBody ? await request.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      {
        detail:
          'Cannot reach the RepoVeriX API. Check that the backend is running and try again.',
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const HEAD = forward;
export const OPTIONS = forward;
