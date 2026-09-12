const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Укажите имя пользователя и пароль' });
  }
  if (username.length < 3 || username.length > 32) {
    return res.status(400).json({ error: 'Имя пользователя: от 3 до 32 символов' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Это имя пользователя уже занято' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
      [username, passwordHash]
    );
    const user = result.rows[0];

    console.log(`[РЕГИСТРАЦИЯ] ${new Date().toISOString()} | username: ${username} | ip: ${req.ip}`);

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error('Ошибка регистрации:', err.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Укажите имя пользователя и пароль' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE username = $1',
      [username]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }

    console.log(`[ВХОД] ${new Date().toISOString()} | username: ${username} | ip: ${req.ip}`);

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error('Ошибка входа:', err.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
