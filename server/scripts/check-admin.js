const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { once } = require('node:events');
const db = require('../db');
const { hashPassword } = require('../lib/passwords');
const createApp = require('../app');

async function check() {
  let admin, product, order, server, returnedOrder, otherAdmin;
  try {
    const password = randomUUID();
    admin = await db.admins.create({ data: { email: `test-${randomUUID()}@example.invalid`, password_hash: await hashPassword(password) } });
    product = await db.products.create({ data: { name: 'Admin test', price: 100,
      product_variants: { create: { size: 'M', color: 'Black', stock: 3 } } }, include: { product_variants: true } });
    const variant = product.product_variants[0];
    order = await db.orders.create({ data: { customer_name: 'Admin test', phone: '0550000000', wilaya: 'Test', commune: 'Test', address: 'Test', subtotal: 200,
      order_items: { create: { variant_id: variant.id, product_name: product.name, size: 'M', color: 'Black', quantity: 2, unit_price: 100 } } } });
    server = createApp(db).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/admin`;
    const request = async (path, method = 'GET', body, token) => {
      const response = await fetch(base + path, { method, headers: {
        'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: response.status === 204 ? null : await response.json() };
    };
    assert.equal((await request('/orders')).status, 401);
    assert.equal((await request('/notifications')).status, 401);
    assert.equal((await request('/products', 'POST', {})).status, 401);
    assert.equal((await request(`/orders/${order.id}/status`, 'PATCH', { status: 'cancelled' })).status, 401);
    assert.equal((await request('/login', 'POST', { email: admin.email, password: 'wrong' })).status, 401);
    const login = await request('/login', 'POST', { email: admin.email.toUpperCase(), password });
    assert.equal(login.status, 200);
    const token = login.body.token;
    assert.equal(login.body.admin.password_hash, undefined);
    assert.equal((await request('/me', 'GET', undefined, token)).status, 200);
    const productPath = `/products/${product.id}`;
    const edited = await request(productPath, 'PATCH', { name: 'Edited test', price: '125.50' }, token);
    assert.equal(edited.status, 200);
    assert.equal(edited.body.product.price, '125.50');
    assert.equal((await request(productPath, 'PATCH', { price: '-1' }, token)).status, 400);
    assert.equal((await request(productPath, 'PATCH', { image_url: 'javascript:alert(1)' }, token)).status, 400);
    assert.equal((await request(productPath, 'PATCH', { is_active: 'false' }, token)).status, 400);
    const variantsPath = `${productPath}/variants`;
    assert.equal((await request(`${variantsPath}/${variant.id}`, 'PATCH', { color: 'black' }, token)).status, 200);
    assert.equal((await request(variantsPath, 'POST', { size: 'm', color: 'BLACK' }, token)).status, 409);
    assert.equal((await request('/products', 'POST', { name: 'Duplicate transaction test', price: 100,
      variants: [{ size: 'M', color: 'Red' }, { size: 'm', color: 'RED' }] }, token)).status, 409);
    const stockPath = `${variantsPath}/${variant.id}/stock`;
    assert.equal((await request(stockPath, 'PATCH', { stock: 4, expected_stock: 3 }, token)).status, 200);
    assert.equal((await request(stockPath, 'PATCH', { stock: 100, expected_stock: 3 }, token)).status, 409);
    assert.equal((await request(stockPath, 'PATCH', { stock: 3, expected_stock: 4 }, token)).status, 200);
    const extra = await request(variantsPath, 'POST', { size: 'XL', color: 'White', stock: 2 }, token);
    assert.equal(extra.status, 201);
    assert.equal((await request(`${variantsPath}/${extra.body.variant.id}`, 'PATCH', { is_active: false }, token)).status, 200);
    assert.equal((await request(productPath, 'PATCH', { is_active: false }, token)).status, 200);
    assert.equal((await request(productPath, 'GET', undefined, token)).body.product.is_active, false);
    assert.equal((await request('/orders?status=new&search=Admin', 'GET', undefined, token)).status, 200);
    const detail = await request(`/orders/${order.id}`, 'GET', undefined, token);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.order.order_items.length, 1);
    assert.equal(detail.body.order.order_items[0].product_name, 'Admin test');
    assert.equal(detail.body.order.order_items[0].unit_price, '100');
    assert.equal(detail.body.order.checkout_hash, undefined);
    const change = status => request(`/orders/${order.id}/status`, 'PATCH', { status }, token);
    assert.equal((await change('delivered')).status, 409);
    assert.equal((await change('confirmed')).status, 200);
    const cancelled = await Promise.all([change('cancelled'), change('cancelled')]);
    assert(cancelled.some(result => result.status === 200));
    assert(cancelled.every(result => [200, 409].includes(result.status)));
    assert.equal((await db.product_variants.findUnique({ where: { id: variant.id } })).stock, 5);
    assert.equal((await change('cancelled')).status, 200);
    assert.equal((await db.product_variants.findUnique({ where: { id: variant.id } })).stock, 5);
    assert.equal((await change('confirmed')).status, 409);
    returnedOrder = await db.orders.create({ data: {
      customer_name: 'Return test', phone: '0550000000', wilaya: 'Test', commune: 'Test', address: 'Test',
      status: 'shipped', subtotal: 200,
      order_items: { create: { variant_id: variant.id, product_name: product.name, size: 'M', color: 'Black', quantity: 2, unit_price: 100 } },
    } });
    const returns = await Promise.all([1, 2].map(() => request(`/orders/${returnedOrder.id}/status`, 'PATCH', { status: 'returned' }, token)));
    assert(returns.some(r => r.status === 200));
    assert(returns.every(r => [200, 409].includes(r.status)));
    assert.equal((await db.product_variants.findUnique({ where: { id: variant.id } })).stock, 7);
    assert.equal((await request(`/orders/${returnedOrder.id}/status`, 'PATCH', { status: 'returned' }, token)).status, 200);
    assert.equal((await db.product_variants.findUnique({ where: { id: variant.id } })).stock, 7);
    const events = await db.admin_notifications.findMany({ where: { order_id: returnedOrder.id } });
    assert.equal(events.length, 1);
    assert.equal(events[0].status, 'returned');
    assert.equal((await request(`/orders/${returnedOrder.id}/status`, 'PATCH', { status: 'shipped' }, token)).status, 409);
    const notifications = await request('/notifications', 'GET', undefined, token);
    assert.equal(notifications.status, 200);
    assert(notifications.body.notifications.some(n => n.id === events[0].id && !n.is_read));
    assert.equal((await request(`/notifications/${events[0].id}/read`, 'PATCH', {}, token)).status, 204);
    assert.equal((await request(`/notifications/${events[0].id}/read`, 'PATCH', {}, token)).status, 204);
    assert.equal(await db.notification_reads.count({ where: { notification_id: events[0].id, admin_id: admin.id } }), 1);
    otherAdmin = await db.admins.create({ data: { email: `other-${randomUUID()}@example.invalid`, password_hash: 'test-account-unused' } });
    assert.equal(await db.notification_reads.count({ where: { notification_id: events[0].id, admin_id: otherAdmin.id } }), 0);
    assert.equal((await request('/notifications/read-all', 'PATCH', { through: events[0].id }, token)).status, 204);
    await db.admins.update({ where: { id: admin.id }, data: { is_active: false } });
    assert.equal((await request('/me', 'GET', undefined, token)).status, 401);
    await db.admins.update({ where: { id: admin.id }, data: { is_active: true } });
    assert.equal((await request('/logout', 'POST', {}, token)).status, 204);
    assert.equal((await request('/me', 'GET', undefined, token)).status, 401);
    const second = await request('/login', 'POST', { email: admin.email, password });
    await db.admin_sessions.update({ where: { token_hash: createHash('sha256').update(second.body.token).digest('hex') }, data: { expires_at: new Date(0) } });
    assert.equal((await request('/me', 'GET', undefined, second.body.token)).status, 401);
    let limited;
    for (let i = 0; i < 8; i++) limited = await request('/login', 'POST', {});
    assert.equal(limited.status, 429);
    console.log('Admin checks passed: login, access control, expiry, logout, throttling and cancellation restock.');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await db.$transaction(async tx => {
      if (returnedOrder) {
        await tx.order_items.deleteMany({ where: { order_id: returnedOrder.id } });
        await tx.orders.delete({ where: { id: returnedOrder.id } });
      }
      if (otherAdmin) await tx.admins.delete({ where: { id: otherAdmin.id } });
      if (order) {
        await tx.order_items.deleteMany({ where: { order_id: order.id } });
        await tx.orders.delete({ where: { id: order.id } });
      }
      if (product) {
        await tx.product_variants.deleteMany({ where: { product_id: product.id } });
        await tx.products.delete({ where: { id: product.id } });
      }
      if (admin) await tx.admins.delete({ where: { id: admin.id } });
    });
  }
}
check().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
