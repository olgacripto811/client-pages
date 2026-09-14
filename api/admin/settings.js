const { sql } = require('../_lib/db');
const { requireAdmin } = require('../_lib/auth');

// GET /api/admin/settings — текущий курс USDT→RUB и комиссия на вывод.
// POST /api/admin/settings — обновить курс и/или комиссию (v1: курс вводит
// Ольга вручную; поле спроектировано так, что позже источник можно сменить
// на авто-обновление по API без изменения схемы).
module.exports = async (req, res) => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === 'GET') {
    const { rows } = await sql`
      SELECT usdt_rub_rate, usdt_rub_rate_updated_at, withdrawal_commission_pct
      FROM settings WHERE id = true
    `;
    return res.status(200).json(rows[0]);
  }

  if (req.method === 'POST') {
    const { usdt_rub_rate, withdrawal_commission_pct } = req.body || {};

    if (usdt_rub_rate != null) {
      await sql`
        UPDATE settings SET usdt_rub_rate = ${usdt_rub_rate}, usdt_rub_rate_updated_at = now()
        WHERE id = true
      `;
    }
    if (withdrawal_commission_pct != null) {
      await sql`
        UPDATE settings SET withdrawal_commission_pct = ${withdrawal_commission_pct}
        WHERE id = true
      `;
    }

    const { rows } = await sql`
      SELECT usdt_rub_rate, usdt_rub_rate_updated_at, withdrawal_commission_pct
      FROM settings WHERE id = true
    `;
    return res.status(200).json(rows[0]);
  }

  return res.status(405).json({ error: 'method_not_allowed' });
};
