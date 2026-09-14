const { sql } = require('../_lib/db');
const { requireAdmin } = require('../_lib/auth');

// GET /api/admin/users — список участников со статусом и уровнем.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { rows } = await sql`
    SELECT u.id, u.first_name, u.last_name, u.email, u.exchange_uid,
           u.is_leader, u.referred_by_uid, u.status, u.role,
           u.created_at, u.approved_at,
           u.level_id, l.name AS level_name, l.rate_usdt_per_signal
    FROM users u
    LEFT JOIN membership_levels l ON l.id = u.level_id
    ORDER BY u.created_at DESC
  `;

  return res.status(200).json({ users: rows });
};
