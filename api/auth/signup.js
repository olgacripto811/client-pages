const { sql } = require('../_lib/db');
const { checkRateLimit, clientIp } = require('../_lib/ratelimit');

// POST /api/auth/signup — заявка на подключение, публичный.
// Ольга одобряет заявку вручную в kabinet-admin.html.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const ok = await checkRateLimit(`signup:${clientIp(req)}`, { limit: 5, windowSeconds: 600 });
  if (!ok) return res.status(429).json({ error: 'rate_limited' });

  const body = req.body || {};
  const firstName = (body.first_name || '').toString().trim().slice(0, 200);
  const lastName = (body.last_name || '').toString().trim().slice(0, 200);
  const email = (body.email || '').toString().trim().toLowerCase().slice(0, 200);
  const exchangeUid = (body.exchange_uid || '').toString().trim().slice(0, 200);
  const levelId = (body.level_id || '').toString().trim();
  const isLeader = !!body.is_leader;
  const referredByUid = (body.referred_by_uid || '').toString().trim().slice(0, 200) || null;

  if (!firstName || !lastName || !email || !email.includes('@') || !exchangeUid || !levelId) {
    return res.status(400).json({ error: 'invalid_input' });
  }

  try {
    await sql`
      INSERT INTO users (first_name, last_name, email, exchange_uid, level_id, is_leader, referred_by_uid)
      VALUES (${firstName}, ${lastName}, ${email}, ${exchangeUid}, ${levelId}, ${isLeader}, ${referredByUid})
      ON CONFLICT (email) DO NOTHING
    `;
  } catch (err) {
    console.error('signup error', err);
    // Некорректный level_id (не существует) даёт ошибку внешнего ключа —
    // это единственная реалистичная причина отказа кроме уже обработанных
    // выше проверок, поэтому здесь можно смело считать это невалидным вводом.
    return res.status(400).json({ error: 'invalid_input' });
  }

  // Намеренно не различаем "создано" / "уже была заявка с таким email" —
  // чтобы форма не превращалась в способ проверить, кто уже подавал заявку.
  return res.status(200).json({ ok: true });
};
