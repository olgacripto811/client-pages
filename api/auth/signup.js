const { sql } = require('../_lib/db');
const { checkRateLimit, clientIp } = require('../_lib/ratelimit');

// POST /api/auth/signup — заявка на подключение (имя+email), публичный.
// Ольга одобряет заявку вручную в kabinet-admin.html.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const ok = await checkRateLimit(`signup:${clientIp(req)}`, { limit: 5, windowSeconds: 600 });
  if (!ok) return res.status(429).json({ error: 'rate_limited' });

  const { name, email } = req.body || {};
  const cleanName = (name || '').toString().trim().slice(0, 200);
  const cleanEmail = (email || '').toString().trim().toLowerCase().slice(0, 200);

  if (!cleanName || !cleanEmail || !cleanEmail.includes('@')) {
    return res.status(400).json({ error: 'invalid_input' });
  }

  try {
    await sql`
      INSERT INTO users (name, email)
      VALUES (${cleanName}, ${cleanEmail})
      ON CONFLICT (email) DO NOTHING
    `;
  } catch (err) {
    console.error('signup error', err);
    return res.status(500).json({ error: 'server_error' });
  }

  // Намеренно не различаем "создано" / "уже была заявка с таким email" —
  // чтобы форма не превращалась в способ проверить, кто уже подавал заявку.
  return res.status(200).json({ ok: true });
};
