const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const db = require('../db');
const { limiter, PostgresStore } = require('../lib/rate-limits');

async function check() {
  const scope = `verification-${randomUUID()}`;
  const servers = [];
  const store = new PostgresStore(db, scope);
  try {
    const urls = [];
    for (let i = 0; i < 2; i++) {
      const app = express();
      app.get('/', limiter(db, scope, 3, 60000, 'Limited'), (req, res) => res.sendStatus(200));
      const server = app.listen(0, '127.0.0.1');
      servers.push(server); await once(server, 'listening');
      urls.push(`http://127.0.0.1:${server.address().port}`);
    }
    // Independent instances must enforce one atomic limit, even during a burst.
    const responses = await Promise.all(Array.from({ length: 8 }, (_, i) => fetch(urls[i % 2])));
    assert.equal(responses.filter(r => r.status === 200).length, 3);
    assert.equal(responses.filter(r => r.status === 429).length, 5);
    assert(responses.find(r => r.status === 429).headers.get('retry-after'));
    // Spoofed forwarding headers cannot evade limits on a directly hosted server.
    assert.equal((await fetch(urls[0], { headers: { 'X-Forwarded-For': '203.0.113.7' } })).status, 429);
    const key = store.key('127.0.0.1');
    await db.$executeRaw`UPDATE rate_limit_buckets SET expires_at = now() - interval '1 second' WHERE key = ${key}`;
    assert.equal((await fetch(urls[1])).status, 200);
    console.log('Shared rate limits passed: concurrent requests, independent instances, expiry and spoofing.');
  } finally {
    await Promise.all(servers.map(s => new Promise(resolve => s.close(resolve))));
    await store.resetKey('127.0.0.1');
  }
}
check().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
