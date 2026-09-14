const { sql } = require('../../../_lib/db');
const { requireAdmin } = require('../../../_lib/auth');

// POST /api/admin/users/:id/leader {is_leader} — вручную включить/выключить
// лидерский статус участника (даёт доступ к слотам с requires_leader=true).
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { id } = req.query;
  const isLeader = !!(req.body || {}).is_leader;

  await sql`UPDATE users SET is_leader = ${isLeader} WHERE id = ${id}`;
  return res.status(200).json({ ok: true });
};
