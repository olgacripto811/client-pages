const { destroySession } = require('../_lib/auth');

// POST /api/auth/logout — завершает текущую сессию (ссылка при этом
// остаётся рабочей, ей можно войти заново).
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  await destroySession(req, res);
  return res.status(200).json({ ok: true });
};
