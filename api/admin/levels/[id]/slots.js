const { sql, db } = require('../../../_lib/db');
const { requireAdmin } = require('../../../_lib/auth');

// GET /api/admin/levels/:id/slots — какие слоты сейчас входят в уровень.
// POST /api/admin/levels/:id/slots {slot_ids: []} — полностью заменяет
// набор слотов уровня (Ольга настраивает один раз на уровень, а не на
// каждого участника — доступ участника = слоты его уровня + лидерский
// бонус, см. api/_lib/signals.js).
module.exports = async (req, res) => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { id } = req.query;

  if (req.method === 'GET') {
    const { rows } = await sql`
      SELECT slot_id FROM level_signal_access WHERE level_id = ${id}
    `;
    return res.status(200).json({ slot_ids: rows.map((r) => r.slot_id) });
  }

  if (req.method === 'POST') {
    const { slot_ids } = req.body || {};
    if (!Array.isArray(slot_ids)) return res.status(400).json({ error: 'invalid_input' });

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM level_signal_access WHERE level_id = $1', [id]);
      for (const slotId of slot_ids) {
        await client.query(
          'INSERT INTO level_signal_access (level_id, slot_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, slotId]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('level signal access update error', err);
      return res.status(500).json({ error: 'server_error' });
    } finally {
      client.release();
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
};
