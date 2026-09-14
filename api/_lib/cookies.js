function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

function serializeCookie(name, value, opts = {}) {
  let str = `${name}=${encodeURIComponent(value)}`;
  if (opts.maxAge != null) str += `; Max-Age=${Math.floor(opts.maxAge)}`;
  str += `; Path=${opts.path || '/'}`;
  str += '; HttpOnly';
  if (opts.secure !== false) str += '; Secure';
  str += `; SameSite=${opts.sameSite || 'Lax'}`;
  return str;
}

function setCookie(res, name, value, opts) {
  const prev = res.getHeader('Set-Cookie');
  const next = serializeCookie(name, value, opts);
  if (!prev) res.setHeader('Set-Cookie', next);
  else if (Array.isArray(prev)) res.setHeader('Set-Cookie', [...prev, next]);
  else res.setHeader('Set-Cookie', [prev, next]);
}

function clearCookie(res, name) {
  setCookie(res, name, '', { maxAge: 0 });
}

module.exports = { parseCookies, setCookie, clearCookie };
