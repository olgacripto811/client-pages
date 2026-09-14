const { sql } = require('./_lib/db');

// GET /api/levels — публичный список уровней (только id+name, без ставки —
// не хотим показывать экономику посторонним посетителям формы заявки).
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const { rows } = await sql`
    SELECT id, name FROM membership_levels ORDER BY name
  `;

  return res.status(200).json({ levels: rows });
};
