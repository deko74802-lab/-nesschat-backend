const express = require('express');
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Поиск пользователей по части имени: GET /api/users/search?query=alex
router.get('/search', authMiddleware, async (req, res) => {
  const { query } = req.query;

  if (!query || query.trim().length < 2) {
    return res.json({ users: [] });
  }

  try {
    const result = await pool.query(
      `SELECT id, username, avatar_url
       FROM users
       WHERE username ILIKE $1 AND id != $2
       ORDER BY username
       LIMIT 20`,
      [`%${query.trim()}%`, req.userId]
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error('Ошибка поиска пользователей:', err.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Сохранение Web Push подписки браузера текущего пользователя
router.post('/push-subscribe', authMiddleware, async (req, res) => {
  const { endpoint, keys } = req.body;

  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    return res.status(400).json({ error: 'Некорректные данные подписки' });
  }

  try {
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = $3, auth = $4`,
      [req.userId, endpoint, keys.p256dh, keys.auth]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка сохранения push-подписки:', err.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
