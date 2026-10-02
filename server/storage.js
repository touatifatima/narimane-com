const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');

const directory = path.join(__dirname, 'uploads/products');
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';
const supabaseEnabled = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
let supabase;
if (supabaseEnabled) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function save(buffer, productId) {
  const name = `products/${productId}/${randomUUID()}.webp`;
  if (supabaseEnabled) {
    const { error } = await supabase.storage.from(bucket).upload(name, buffer, { contentType: 'image/webp', upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(name);
    return { url: data.publicUrl, storageKey: name };
  }
  await fs.mkdir(directory, { recursive: true });
  const localName = name.split('/').pop();
  await fs.writeFile(path.join(directory, localName), buffer, { flag: 'wx' });
  return { url: `/api/uploads/products/${localName}`, storageKey: localName };
}

async function remove(url) {
  if (supabaseEnabled) {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const index = url.indexOf(marker);
    if (index < 0) return;
    const key = decodeURIComponent(url.slice(index + marker.length));
    const { error } = await supabase.storage.from(bucket).remove([key]);
    if (error) throw error;
    return;
  }
  const name = url.split('/').pop();
  if (!/^[a-f0-9-]{36}\.webp$/.test(name)) return;
  await fs.unlink(path.join(directory, name)).catch(error => { if (error.code !== 'ENOENT') throw error; });
}

module.exports = { directory, bucket, supabaseEnabled, save, remove };
