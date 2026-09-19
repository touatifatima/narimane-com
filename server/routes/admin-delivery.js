const express = require('express');
module.exports = function deliveryRoutes(db) {
  const router = express.Router();
  router.get('/', async (req, res) => {
    const rates = await db.delivery_rates.findMany({ orderBy: { wilaya_code: 'asc' } });
    res.json({ delivery_rates: rates.map(r => ({ ...r, fee: r.fee.toFixed(2) })) });
  });
  router.put('/', async (req, res) => {
    const { wilaya_code, wilaya_name, fee, is_active } = req.body || {};
    if (typeof wilaya_code !== 'string' || !/^[0-9]{1,3}$/.test(wilaya_code) || Number(wilaya_code) < 1
      || typeof wilaya_name !== 'string' || !wilaya_name.trim() || wilaya_name.trim().length > 120
      || !['string', 'number'].includes(typeof fee) || !/^\d{1,9}(\.\d{1,2})?$/.test(String(fee))
      || typeof is_active !== 'boolean') return res.status(400).json({ error: 'Vérifiez le code wilaya, le nom, le tarif et le statut.' });
    const code = String(Number(wilaya_code)).padStart(2, '0');
    const data = { wilaya_name: wilaya_name.trim(), fee: String(fee), is_active };
    const rate = await db.delivery_rates.upsert({ where: { wilaya_code: code }, create: { wilaya_code: code, ...data }, update: data });
    res.json({ delivery_rate: { ...rate, fee: rate.fee.toFixed(2) } });
  });
  return router;
};
