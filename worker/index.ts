import handler from 'vinext/server/fetch-handler';
import { authorize } from '../lib/access.mjs';

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    if (!import.meta.env.DEV) {
      const denied = await authorize(request, env);
      if (denied) return denied;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      if (request.headers.get('Origin') !== new URL(request.url).origin) {
        return new Response('Request origin is not allowed.', { status: 403 });
      }
      if (new URL(request.url).pathname.startsWith('/api/')) {
        if (!request.headers.get('Content-Type')?.startsWith('application/json')) {
          return new Response('Expected JSON.', { status: 415 });
        }
        if (Number(request.headers.get('Content-Length') || 0) > 1_000_000) {
          return new Response('Request is too large.', { status: 413 });
        }
      }
    }
    const response = await handler.fetch(request, env, ctx);
    const secured = new Response(response.body, response);
    secured.headers.set('Cache-Control', 'private, no-store');
    secured.headers.set('X-Content-Type-Options', 'nosniff');
    secured.headers.set('Referrer-Policy', 'same-origin');
    secured.headers.set('Content-Security-Policy', "frame-ancestors 'none'");
    return secured;
  },
};
