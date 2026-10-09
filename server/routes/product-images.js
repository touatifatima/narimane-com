const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const storage = require('../storage');
const ordered = { orderBy: [{ position: 'asc' }, { id: 'asc' }] };
class ImageError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 6, fileSize: 3.5 * 1024 * 1024, fields: 0, parts: 7 },
  fileFilter(req, file, next) {
    next(['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) ? null : new ImageError(400, 'Utilisez des images JPG, PNG ou WebP.'), true);
  },
}).array('images', 6);
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
  router.post('/', (req, res, next) => {
    const size = Number(req.get('content-length'));
    if (size > 4 * 1024 * 1024) return res.status(413).json({ error: 'Importez les photos une par une (3,5 Mo maximum par photo).' });
    next();
  }, upload, async (req, res) => {
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
          const saved = await storage.save(buffer, Number(req.params.productId));
          const url = saved.url;
          written.push(url);
          await tx.product_images.create({ data: { product_id: Number(req.params.productId), url, position: position++ } });
        }
        return tx.product_images.findMany({ where: { product_id: Number(req.params.productId) }, ...ordered });
      });
      res.status(201).json({ images });
    } catch (error) { await Promise.all(written.map(url => storage.remove(url).catch(() => {}))); throw error; }
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
    await storage.remove(result.url);
    res.json({ images: result.images });
  });
  router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) return res.status(400).json({ error: 'Maximum 6 photos, 3,5 Mo par photo. Champ attendu : images.' });
    if (error instanceof ImageError) return res.status(error.status).json({ error: error.message });
    next(error);
  });
  return router;
};
module.exports.directory = storage.directory;

