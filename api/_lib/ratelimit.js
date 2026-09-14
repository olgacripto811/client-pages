// Rate limiting для публичных чувствительных эндпоинтов (заявка на
// подключение, вход по ссылке). Если в проекте настроен Upstash Redis
// (переменные UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN — подключается
// в пару кликов через Vercel Marketplace), используем его для честного
// distributed-лимита. Без него — примитивный лимит в памяти инстанса:
// не строгая защита в serverless (у каждого холодного инстанса своя
// память), но лучше, чем ничего, до момента подключения Upstash.
const memoryStore = new Map();

async function checkRateLimit(key, { limit = 5, windowSeconds = 60 } = {}) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      const res = await fetch(`${url}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', key],
          ['EXPIRE', key, String(windowSeconds), 'NX'],
        ]),
      });
      const data = await res.json();
      const count = Number(data?.[0]?.result || 0);
      return count <= limit;
    } catch (err) {
      console.error('ratelimit upstash error', err);
      return true; // не блокируем запрос при недоступности Redis
    }
  }

  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const entry = memoryStore.get(key);
  if (!entry || now - entry.start > windowMs) {
    memoryStore.set(key, { start: now, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

module.exports = { checkRateLimit, clientIp };
