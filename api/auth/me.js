const { requireUser } = require('../_lib/auth');

// GET /api/auth/me — данные текущего пользователя (для персонализации
// кабинета: имя в шапке и т.п.).
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const user = await requireUser(req, res);
  if (!user) return;

  return res.status(200).json({ id: user.id, name: user.name, email: user.email, role: user.role });
};
