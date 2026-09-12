const jwt = require('jsonwebtoken');

// Проверяет JWT из заголовка Authorization: Bearer <token>
// При успехе кладёт req.userId для использования в роутах
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Недействительный или истёкший токен' });
  }
}

// Отдельная версия для проверки токена при подключении по Socket.IO
function verifySocketToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET); // бросит исключение, если невалиден
}

module.exports = { authMiddleware, verifySocketToken };
