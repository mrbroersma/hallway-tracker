// Validate Cloudflare Access signatures as well as issuer, audience, and expiry.
// No production route opens until the school configures its Access application.
let cachedKeys;
let cachedIssuer;
let expiresAt = 0;
const decode = value => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
const parse = value => JSON.parse(new TextDecoder().decode(decode(value)));

export async function authorize(request, env, fetchKeys = fetch) {
  const team = env.ACCESS_TEAM_DOMAIN;
  const audience = env.ACCESS_AUD;
  if (typeof team !== 'string' || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team) || !audience) {
    return new Response('Hallway Desk is locked until staff sign-in is configured. The administrator must configure Cloudflare Access and set ACCESS_TEAM_DOMAIN and ACCESS_AUD. See the repository README.', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  const deny = () => new Response('Staff sign-in is required. Open this app through its Cloudflare Access protected address.', { status: 403, headers: { 'Cache-Control': 'no-store' } });
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || token.length > 16384) return deny();
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return deny();
    const [header, claims] = [parse(parts[0]), parse(parts[1])];
    const issuer = `https://${team}`;
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== 'RS256' || !header.kid || claims.iss !== issuer || !Array.isArray(claims.aud) || !claims.aud.includes(audience) || typeof claims.exp !== 'number' || claims.exp <= now || (claims.nbf !== undefined && (typeof claims.nbf !== 'number' || claims.nbf > now))) return deny();
    if (!cachedKeys || cachedIssuer !== issuer || expiresAt <= Date.now() || !cachedKeys.some(k => k.kid === header.kid)) {
      const response = await fetchKeys(`${issuer}/cdn-cgi/access/certs`, { redirect: 'error' });
      if (!response.ok) return deny();
      const body = await response.json();
      if (!Array.isArray(body.keys)) return deny();
      cachedKeys = body.keys; cachedIssuer = issuer; expiresAt = Date.now() + 300_000;
    }
    const jwk = cachedKeys.find(k => k.kid === header.kid && k.kty === 'RSA');
    if (!jwk) return deny();
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
    return valid ? null : deny();
  } catch { return deny(); }
}
