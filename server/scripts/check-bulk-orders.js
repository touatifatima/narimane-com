const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const db = require('../db');
const createApp = require('../app');
const { hashPassword } = require('../lib/passwords');

async function check() {
  let server, admin, product;
  const orderIds = [];
  try {
    const password = randomUUID();
    admin = await db.admins.create({ data: { email: `bulk-orders-${randomUUID()}@example.invalid`, password_hash: await hashPassword(password) } });
    product = await db.products.create({ data: { name: 'Bulk orders verification', price: 100,
      product_variants: { create: { size: 'M', color: 'Black', stock: 4 } } }, include: { product_variants: true } });
    const variant = product.product_variants[0];
    for (const status of ['new', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned']) {
      const order = await db.orders.create({ data: { customer_name: 'Bulk orders verification', phone: '0550000000',
        wilaya: 'Test', commune: 'Test', address: 'Test', status, subtotal: 100,
        order_items: { create: { variant_id: variant.id, product_name: product.name,
          size: variant.size, color: variant.color, unit_price: 100, quantity: 1 } } } });
      orderIds.push(order.id);
      await db.admin_notifications.create({ data: { order_id: order.id, kind: 'status_changed', status } });
    }
    server = createApp(db).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/admin`;
    const login = await fetch(base + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: admin.email, password }) });
    assert.equal(login.status, 200);
    const token = (await login.json()).token;
    const post = (ids, authorized = true) => fetch(base + '/orders/bulk-delete', { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authorized ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ ids }) });
    assert.equal((await post([orderIds[0]], false)).status, 401);
    assert.equal((await post([orderIds[0], orderIds[0]])).status, 400);
    assert.equal((await post([...orderIds, 2147483647])).status, 404);
    assert.equal(await db.orders.count({ where: { id: { in: orderIds } } }), 6);
    const result = await post(orderIds);
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { deleted: 6, restocked: 2 });
    assert.equal(await db.orders.count({ where: { id: { in: orderIds } } }), 0);
    assert.equal(await db.order_items.count({ where: { order_id: { in: orderIds } } }), 0);
    assert.equal(await db.admin_notifications.count({ where: { order_id: { in: orderIds } } }), 0);
    assert.equal((await db.product_variants.findUnique({ where: { id: variant.id } })).stock, 6);
    console.log('Bulk order deletion passed: auth, validation, atomicity, cleanup and stock restoration.');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (orderIds.length) {
      await db.order_items.deleteMany({ where: { order_id: { in: orderIds } } });
      await db.orders.deleteMany({ where: { id: { in: orderIds } } });
    }
    if (product) {
      await db.product_variants.deleteMany({ where: { product_id: product.id } });
      await db.products.delete({ where: { id: product.id } });
    }
    if (admin) await db.admins.delete({ where: { id: admin.id } });
  }
}
check().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
