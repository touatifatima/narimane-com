const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const db = require('../db');
const createApp = require('../app');
const { hashPassword } = require('../lib/passwords');
const sharp = require('sharp');
const storage = require('../storage');

async function check() {
  const ids = [];
  let admin, order, server, imageUrl;
  try {
    const password = randomUUID();
    admin = await db.admins.create({ data: { email: `bulk-${randomUUID()}@example.invalid`, password_hash: await hashPassword(password) } });
    for (let i = 0; i < 3; i++) {
      const product = await db.products.create({ data: { name: `Bulk verification ${randomUUID()}`, price: 100,
        product_variants: { create: { size: 'M', color: 'Black', stock: 2 } } }, include: { product_variants: true } });
      ids.push(product);
    }
    const imageBuffer = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#778899' } }).webp().toBuffer();
    imageUrl = (await storage.save(imageBuffer, ids[0].id)).url;
    await db.product_images.create({ data: { product_id: ids[0].id, url: imageUrl } });
    order = await db.orders.create({ data: { customer_name: 'Bulk verification', phone: '0550000000',
      wilaya: 'Test', commune: 'Test', address: 'Test', subtotal: 100,
      order_items: { create: { variant_id: ids[2].product_variants[0].id, product_name: ids[2].name,
        size: 'M', color: 'Black', unit_price: 100, quantity: 1 } } } });
    server = createApp(db).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/admin`;
    const login = await fetch(base + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: admin.email, password }) });
    assert.equal(login.status, 200);
    const token = (await login.json()).token;
    const post = (selected, authorized = true) => fetch(base + '/products/bulk-delete', { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authorized ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ ids: selected }) });
    assert.equal((await post([ids[0].id], false)).status, 401);
    assert.equal((await post([ids[0].id, ids[0].id])).status, 400);
    assert.equal((await post([ids[0].id, ids[2].id])).status, 409);
    assert.equal(await db.products.count({ where: { id: ids[0].id } }), 1);
    const result = await post([ids[0].id, ids[1].id]);
    assert.equal(result.status, 200);
    assert.equal((await result.json()).deleted, 2);
    assert.equal(await db.products.count({ where: { id: { in: ids.slice(0, 2).map(x => x.id) } } }), 0);
    assert.equal(await db.product_variants.count({ where: { product_id: { in: ids.slice(0, 2).map(x => x.id) } } }), 0);
    if (storage.supabaseEnabled) {
      const key = decodeURIComponent(imageUrl.split('/product-images/')[1]);
      assert.equal((await db.$queryRaw`SELECT name FROM storage.objects WHERE bucket_id = 'product-images' AND name = ${key}`).length, 0);
    }
    assert.equal(await db.products.count({ where: { id: ids[2].id } }), 1);
    console.log('Bulk product deletion passed: auth, validation, atomic conflict, deletion and order protection.');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (order) {
      await db.order_items.deleteMany({ where: { order_id: order.id } });
      await db.orders.delete({ where: { id: order.id } });
    }
    for (const product of ids) {
      if (await db.products.count({ where: { id: product.id } })) {
        await db.product_variants.deleteMany({ where: { product_id: product.id } });
        await db.products.delete({ where: { id: product.id } });
      }
    }
    if (imageUrl) await storage.remove(imageUrl);
    if (admin) await db.admins.delete({ where: { id: admin.id } });
  }
}
check().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
