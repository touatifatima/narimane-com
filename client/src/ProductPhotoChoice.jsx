import { useEffect, useState } from 'react';

export default function ProductPhotoChoice({ mode, setMode, file, setFile, url, setUrl, disabled }) {
  const [preview, setPreview] = useState(''), [error, setError] = useState('');
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return <fieldset className="photo-choice span-2" disabled={disabled}>
    <legend>Photo du produit</legend>
    <div className="photo-choice-options">
      <label className="checkbox"><input type="radio" name="photo-mode" checked={mode === 'upload'} onChange={() => setMode('upload')} /> Importer une image</label>
      <label className="checkbox"><input type="radio" name="photo-mode" checked={mode === 'url'} onChange={() => setMode('url')} /> Utiliser une URL</label>
    </div>
    {mode === 'url' ? <label>URL de la photo<input type="url" placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} /></label> : <>
      <label className="upload-label">Choisir une photo<input type="file" accept="image/jpeg,image/png,image/webp" required={!file} onChange={e => {
        const selected = e.target.files?.[0];
        setError('');
        if (selected && (selected.size > 3.5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(selected.type))) {
          setError('Choisissez une image JPG, PNG ou WebP de 3,5 Mo maximum.');
          setFile(null); e.target.value = ''; return;
        }
        setFile(selected || null);
      }} /></label>
      <p className="muted">JPG, PNG ou WebP · 3,5 Mo maximum. La photo sera importée lors de l’enregistrement du produit.</p>
      {error && <p className="notice" role="alert">{error}</p>}
      {preview && <div className="photo-choice-preview"><img src={preview} alt="Aperçu de la photo du produit" /><small>{file?.name}</small></div>}
    </>}
  </fieldset>;
}
