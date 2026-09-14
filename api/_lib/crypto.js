const crypto = require('crypto');

// Персональная ссылка-вход и сессионный токен — высокоэнтропийные случайные
// строки (32 байта). Это не пароль пользователя, поэтому для хранения
// достаточно sha256 (без соли/bcrypt) — см. раздел "Безопасность" в плане.
function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

module.exports = { randomToken, sha256 };
