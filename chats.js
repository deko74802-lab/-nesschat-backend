const express = require('express');
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Список чатов текущего пользователя с последним сообщением
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.type, c.title,
              (SELECT text FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
              (SELECT created_at FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at
       FROM chats c
       JOIN chat_members cm ON cm.chat_id = c.id
       WHERE cm.user_id = $1
       ORDER BY last_message_at DESC NULLS LAST`,
      [req.userId]
    );
    res.json({ chats: result.rows });
  } catch (err) {
    console.error('Ошибка получения чатов:', err.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Начать (или найти существующий) личный чат с другим пользователем
router.post('/start', authMiddleware, async (req, res) => {
  const { targetUserId } = req.body;

  if (!targetUserId || targetUserId === req.userId) {
    return res.status(400).json({ error: 'Некорректный targetUserId' });
  }

  try {
    const existing = await pool.query(
      `SELECT c.id FROM chats c
       JOIN chat_members cm1 ON cm1.chat_id = c.id AND cm1.user_id = $1
       JOIN chat_members cm2 ON cm2.chat_id = c.id AND cm2.user_id = $2
       WHERE c.type = 'direct'
       LIMIT 1`,
      [req.userId, targetUserId]
    );

    if (existing.rows.length > 0) {
      return res.json({ chatId: existing.rows[0].id });
    }

    const chat = await pool.query(
      `INSERT INTO chats (type) VALUES ('direct') RETURNING id`
    );
    const chatId = chat.rows[0].id;

    await pool.query(
      `INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2), ($1, $3)`,
      [chatId, req.userId, targetUserId]
    );

    res.status(201).json({ chatId });
  } catch (err) {
    console.error('Ошибка создания чата:', err.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// История сообщений чата (с пагинацией через параметр before)
router.get('/:chatId/messages', authMiddleware, async (req, res) => {
  const { chatId } = req.params;
  const { before } = req.query; // ISO-дата, чтобы подгружать более старые сообщения

  try {
    const membership = await pool.query(
      'SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2',
      [chatId, req.userId]
    );
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Нет доступа к этому чату' });
    }

    const params = [chatId];
    let whereClause = 'chat_id = $1';
    if (before) {
      params.push(before);
      whereClause += ` AND created_at < $${params.length}`;
    }

    const messages = await pool.query(
      `SELECT id, sender_id, text, created_at, read_at
       FROM messages
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT 50`,
      params
    );

    res.json({ messages: messages.rows.reverse() });
  } catch (err) {
    console.error('Ошибка загрузки сообщений:', err.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
