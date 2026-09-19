const readline = require('node:readline/promises');
const { Writable } = require('node:stream');
const db = require('../db');
const { hashPassword } = require('../lib/passwords');

async function main() {
  if (!process.stdin.isTTY) throw new Error('Run this command in an interactive terminal.');
  let hidden = false;
  const output = new Writable({ write(chunk, encoding, done) {
    if (!hidden) process.stdout.write(chunk, encoding);
    done();
  } });
  const prompt = readline.createInterface({ input: process.stdin, output, terminal: true });
  try {
    const email = (await prompt.question('Admin email: ')).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Enter a valid email.');
    process.stdout.write('Password (12–128 characters, hidden): ');
    hidden = true;
    const password = await prompt.question('');
    hidden = false;
    process.stdout.write('\n');
    if (password.length < 12 || password.length > 128) throw new Error('Use a password of 12–128 characters.');
    process.stdout.write('Confirm password (hidden): ');
    hidden = true;
    const confirm = await prompt.question('');
    hidden = false;
    process.stdout.write('\n');
    if (password !== confirm) throw new Error('Passwords do not match.');
    await db.admins.create({ data: { email, password_hash: await hashPassword(password) } });
    console.log('Admin account created.');
  } finally { prompt.close(); }
}
main().catch(error => {
  console.error(error.code === 'P2002' ? 'That admin email already exists.'
    : error.code ? 'Database operation failed.' : error.message);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
