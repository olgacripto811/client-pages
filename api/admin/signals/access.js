const { sql, db } = require('../../_lib/db');
const { requireAdmin } = require('../../_lib/auth');

// GET /api/admin/signals/access?user_id=... — какие слоты сейчас доступны
// участнику (для галочек в админке).
// POST /api/admin/signals/access {user_id, slot_ids: []} — полностью
// заменяет список доступных участнику слотов (гибкое per-user назначение —
// не тиры "всё или ничего", у каждого свой набор).
module.exports = async (req, res) => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === 'GET') {
    const userId = (req.query.user_id || '').toString();
    if (!userId) return res.status(400).json({ error: 'invalid_input' });
    const { rows } = await sql`
      SELECT slot_id FROM user_signal_access WHERE user_id = ${userId}
    `;
    return res.status(200).json({ slot_ids: rows.map((r) => r.slot_id) });
  }

  if (req.method === 'POST') {
    const { user_id, slot_ids } = req.body || {};
    if (!user_id || !Array.isArray(slot_ids)) return res.status(400).json({ error: 'invalid_input' });

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM user_signal_access WHERE user_id = $1', [user_id]);
      for (const slotId of slot_ids) {
        await client.query(
          'INSERT INTO user_signal_access (user_id, slot_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [user_id, slotId]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('signal access update error', err);
      return res.status(500).json({ error: 'server_error' });
    } finally {
      client.release();
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
};
