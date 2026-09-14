const { requireUser } = require('../_lib/auth');
const { fetchUserSignalHistory } = require('../_lib/signals');

// GET /api/signals/history?from=YYYY-MM-DD&to=YYYY-MM-DD — по датам, какие
// сигналы были доступны и какие отмечены (статистика "выполнил/пропустил").
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const user = await requireUser(req, res);
  if (!user) return;

  const from = (req.query.from || '1970-01-01').toString();
  const to = (req.query.to || '2999-12-31').toString();

  const items = await fetchUserSignalHistory(user.id, from, to);
  return res.status(200).json({ items });
};
