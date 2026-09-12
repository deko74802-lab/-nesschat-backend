const pool = require('../db/pool');
const { verifySocketToken } = require('../middleware/auth');
const { sendPushToUser } = require('../utils/webpush');

// Отслеживаем, кто сейчас онлайн, чтобы решать — слать push или нет
const onlineUsers = new Set();

function attachSocketHandlers(io) {
  // Проверка токена при подключении (клиент передаёт его в auth)
  io.use((socket, next) => {
    try {
      const { token } = socket.handshake.auth;
      const payload = verifySocketToken(token);
      socket.userId = payload.userId;
      next();
    } catch (err) {
      next(new Error('Ошибка авторизации сокета'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    onlineUsers.add(userId);
    socket.join(`user:${userId}`);

    socket.on('send_message', async ({ chatId, text }) => {
      if (!text || !text.trim()) return;

      try {
        const membership = await pool.query(
          'SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2',
          [chatId, userId]
        );
        if (membership.rows.length === 0) {
          return socket.emit('error_message', { error: 'Нет доступа к этому чату' });
        }

        const inserted = await pool.query(
          `INSERT INTO messages (chat_id, sender_id, text) VALUES ($1, $2, $3)
           RETURNING id, created_at`,
          [chatId, userId, text.trim()]
        );

        const payload = {
          id: inserted.rows[0].id,
          chatId,
          senderId: userId,
          text: text.trim(),
          createdAt: inserted.rows[0].created_at
        };

        const members = await pool.query(
          'SELECT user_id FROM chat_members WHERE chat_id = $1',
          [chatId]
        );

        for (const { user_id: memberId } of members.rows) {
          io.to(`user:${memberId}`).emit('new_message', payload);

          // Если получатель не онлайн — шлём push-уведомление
          if (memberId !== userId && !onlineUsers.has(memberId)) {
            sendPushToUser(memberId, {
              title: 'Новое сообщение',
              body: text.trim().slice(0, 100),
              chatId
            }).catch((err) => console.error('Push не отправлен:', err.message));
          }
        }
      } catch (err) {
        console.error('Ошибка отправки сообщения:', err.message);
        socket.emit('error_message', { error: 'Не удалось отправить сообщение' });
      }
    });

    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
    });
  });
}

module.exports = { attachSocketHandlers };
