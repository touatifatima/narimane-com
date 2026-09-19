const express = require('express');
const validId = value => /^[1-9]\d*$/.test(String(value)) && Number(value) <= 2147483647;
module.exports = function notifications(db) {
  const router = express.Router();
  router.get('/', async (req, res) => {
    const before = req.query.before;
    if (before !== undefined && (typeof before !== 'string' || !validId(before))) return res.status(400).json({ error: 'Invalid cursor.' });
    const [items, unread_count] = await Promise.all([
      db.admin_notifications.findMany({
        where: before ? { id: { lt: Number(before) } } : {}, orderBy: { id: 'desc' }, take: 31,
        include: { reads: { where: { admin_id: req.admin.id }, select: { read_at: true } } },
      }),
      db.admin_notifications.count({ where: { reads: { none: { admin_id: req.admin.id } } } }),
    ]);
    res.json({ notifications: items.slice(0, 30).map(({ reads, ...item }) => ({ ...item, is_read: !!reads.length })), unread_count,
      next_cursor: items.length > 30 ? items[29].id : null });
  });
  router.patch('/read-all', async (req, res) => {
    const through = req.body?.through;
    if (!Number.isInteger(through) || !validId(through)) return res.status(400).json({ error: 'Invalid notification ID.' });
    await db.$executeRaw`INSERT INTO notification_reads (notification_id, admin_id)
      SELECT id, ${req.admin.id} FROM admin_notifications WHERE id <= ${through}
      ON CONFLICT (notification_id, admin_id) DO NOTHING`;
    res.sendStatus(204);
  });
  router.patch('/:id/read', async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid notification ID.' });
    const id = Number(req.params.id);
    const notification = await db.admin_notifications.findUnique({ where: { id } });
    if (!notification) return res.status(404).json({ error: 'Notification not found.' });
    await db.notification_reads.upsert({ where: { notification_id_admin_id: { notification_id: id, admin_id: req.admin.id } },
      create: { notification_id: id, admin_id: req.admin.id }, update: {} });
    res.sendStatus(204);
  });
  return router;
};
