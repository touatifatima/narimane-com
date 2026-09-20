const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { put, del } = require('@vercel/blob');
const directory = path.join(__dirname, '../uploads/products');
const ordered = { orderBy: [{ position: 'asc' }, { id: 'asc' }] };
class ImageError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 1, fileSize: 3.5 * 1024 * 1024, fields: 0, parts: 2 },
  fileFilter(req, file, next) {
    next(['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) ? null : new ImageError(400, 'Utilisez des images JPG, PNG ou WebP.'), true);
  },
}).array('images', 1);
async function storeFile(name, buffer) {
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID || process.env.VERCEL) {
    const blob = await put(`products/${name}`, buffer, {
      access: 'public', contentType: 'image/webp', addRandomSuffix: false,
    });
    return blob.url;
  }
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, name), buffer, { flag: 'wx' });
  return `/api/uploads/products/${name}`;
}
async function removeFile(url) {
  if (/^https:\/\/[^/]+\.blob\.vercel-storage\.com\//.test(url)) {
    await del(url).catch(() => console.error('Could not remove unused product image from Blob.'));
    return;
  }
  const name = url.split('/').pop();
  if (!/^[a-f0-9-]{36}\.webp$/.test(name)) return;
  await fs.unlink(path.join(directory, name)).catch(error => { if (error.code !== 'ENOENT') console.error('Could not remove unused product image.'); });
}
module.exports = function imageRoutes(db) {
  const router = express.Router({ mergeParams: true });
  router.use((req, res, next) => {
    if (!/^[1-9]\d*$/.test(req.params.productId) || Number(req.params.productId) > 2147483647) return res.status(400).json({ error: 'Invalid product ID.' });
    next();
  });
  async function locked(id, work) {
    return db.$transaction(async tx => {
      const rows = await tx.$queryRaw`SELECT id FROM products WHERE id = ${id} FOR UPDATE`;
      if (!rows.length) throw new ImageError(404, 'Produit introuvable.');
      return work(tx);
    }, { timeout: 15000 });
  }
  router.post('/', upload, async (req, res) => {
    if (!req.files?.length) throw new ImageError(400, 'Sélectionnez au moins une photo.');
    const buffers = [];
    for (const file of req.files) {
      try {
        const image = sharp(file.buffer, { limitInputPixels: 25000000, failOn: 'warning' });
        const metadata = await image.metadata();
        if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) throw new Error('Unsupported image');
        buffers.push(await image.rotate().resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer());
      } catch { throw new ImageError(400, 'Image invalide : utilisez une photo JPG, PNG ou WebP non animée (25 mégapixels maximum).'); }
    }
    const written = [];
    try {
      const images = await locked(Number(req.params.productId), async tx => {
        const existing = await tx.product_images.findMany({ where: { product_id: Number(req.params.productId) }, ...ordered });
        if (existing.length + buffers.length > 6) throw new ImageError(409, 'Maximum 6 photos par produit.');
        let position = existing.length ? existing.at(-1).position + 1 : 0;
        for (const buffer of buffers) {
          const name = `${randomUUID()}.webp`;
          const url = await storeFile(name, buffer);
          written.push(url);
          await tx.product_images.create({ data: { product_id: Number(req.params.productId), url, position: position++ } });
        }
        return tx.product_images.findMany({ where: { product_id: Number(req.params.productId) }, ...ordered });
      });
      res.status(201).json({ images });
    } catch (error) { await Promise.all(written.map(removeFile)); throw error; }
  });
  router.patch('/:imageId/main', async (req, res) => {
    const id = Number(req.params.imageId);
    if (!Number.isInteger(id) || id < 1 || id > 2147483647) throw new ImageError(400, 'Invalid image ID.');
    const images = await locked(Number(req.params.productId), async tx => {
      const images = await tx.product_images.findMany({ where: { product_id: Number(req.params.productId) }, ...ordered });
      const chosen = images.find(i => i.id === id);
      if (!chosen) throw new ImageError(404, 'Photo introuvable.');
      const sorted = [chosen, ...images.filter(i => i.id !== id)];
      for (const [position, image] of sorted.entries()) await tx.product_images.update({ where: { id: image.id }, data: { position } });
      return tx.product_images.findMany({ where: { product_id: Number(req.params.productId) }, ...ordered });
    });
    res.json({ images });
  });
  router.delete('/:imageId', async (req, res) => {
    const id = Number(req.params.imageId);
    if (!Number.isInteger(id) || id < 1 || id > 2147483647) throw new ImageError(400, 'Invalid image ID.');
    const result = await locked(Number(req.params.productId), async tx => {
      const image = await tx.product_images.findFirst({ where: { id, product_id: Number(req.params.productId) } });
      if (!image) throw new ImageError(404, 'Photo introuvable.');
      await tx.product_images.delete({ where: { id } });
      return { url: image.url, images: await tx.product_images.findMany({ where: { product_id: Number(req.params.productId) }, ...ordered }) };
    });
    await removeFile(result.url);
    res.json({ images: result.images });
  });
  router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) return res.status(400).json({ error: 'Importez une photo à la fois, 3,5 Mo maximum. Champ attendu : images.' });
    if (error instanceof ImageError) return res.status(error.status).json({ error: error.message });
    next(error);
  });
  return router;
};
module.exports.directory = directory;

