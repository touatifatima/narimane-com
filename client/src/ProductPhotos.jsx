import { useEffect, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { imageUrl } from './api';

function GalleryPhoto({ photo, name, index }) {
  const [failed, setFailed] = useState(false);
  return <div className="gallery-slide product-image">{!failed ? <img src={imageUrl(photo.url)} alt={`${name} — photo ${index + 1}`} draggable={false} onError={() => setFailed(true)} /> : <div className="image-placeholder">Photo indisponible</div>}</div>;
}

export function ProductGallery({ product }) {
  const photos = product.images?.length ? product.images : product.image_url ? [{ id: 'legacy', url: product.image_url }] : [];
  const [selected, setSelected] = useState(0);
  const track = useRef(null), drag = useRef(null), current = useRef(0);
  function go(index) {
    const next = Math.max(0, Math.min(photos.length - 1, index));
    track.current?.scrollTo({ left: next * track.current.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  useEffect(() => {
    current.current = 0; setSelected(0);
    const element = track.current;
    if (!element) return;
    element.scrollLeft = 0;
    const observer = new ResizeObserver(() => element.scrollTo({ left: current.current * element.clientWidth, behavior: 'instant' }));
    observer.observe(element);
    return () => observer.disconnect();
  }, [product.id]);
  function finish(event) {
    if (!drag.current) return;
    const offset = event.clientX - drag.current.x;
    const index = drag.current.index;
    drag.current = null;
    track.current.classList.remove('dragging');
    go(Math.abs(offset) > 40 ? index + (offset < 0 ? 1 : -1) : index);
  }
  return <div className="product-gallery" role="region" aria-label="Photos du produit" aria-roledescription="carrousel">
    <div className="gallery-stage">
      <div className="gallery-track" ref={track} tabIndex={photos.length > 1 ? 0 : -1} aria-label="Faites défiler les photos vers la gauche ou la droite"
        onScroll={() => { const el = track.current; if (!el.clientWidth) return; const index = Math.max(0, Math.min(photos.length - 1, Math.round(el.scrollLeft / el.clientWidth))); current.current = index; setSelected(index); }}
        onKeyDown={e => { if (['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); go(selected + (e.key === 'ArrowRight' ? 1 : -1)); } }}
        onPointerDown={e => { if (e.pointerType !== 'mouse' || e.button !== 0 || photos.length < 2) return; drag.current = { x: e.clientX, left: track.current.scrollLeft, index: selected }; track.current.setPointerCapture(e.pointerId); track.current.classList.add('dragging'); }}
        onPointerMove={e => { if (drag.current) track.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x); }}
        onPointerUp={finish} onPointerCancel={() => { drag.current = null; track.current?.classList.remove('dragging'); }}>
        {photos.length ? photos.map((photo, index) => <GalleryPhoto key={`${product.id}-${photo.id}-${photo.url}`} photo={photo} name={product.name} index={index} />) : <div className="gallery-slide product-image"><div className="image-placeholder">Photo indisponible</div></div>}
      </div>
      {photos.length > 1 && <><button className="gallery-arrow previous" aria-label="Photo précédente" disabled={selected === 0} onClick={() => go(selected - 1)}><ChevronLeft size={22} /></button><button className="gallery-arrow next" aria-label="Photo suivante" disabled={selected === photos.length - 1} onClick={() => go(selected + 1)}><ChevronRight size={22} /></button><span className="gallery-counter" aria-live="polite">{selected + 1} / {photos.length}</span></>}
    </div>
    {photos.length > 1 && <><p className="gallery-hint">Glissez pour découvrir toutes les photos</p><div className="gallery-thumbnails">{photos.map((photo, index) => <button key={photo.id} aria-label={`Voir la photo ${index + 1}`} aria-pressed={selected === index} className={selected === index ? 'selected' : ''} onClick={() => go(index)}><img src={imageUrl(photo.url)} alt="" draggable={false} /></button>)}</div></>}
  </div>;
}
export default function ProductPhotos({ product, request }) {
  const [images, setImages] = useState(product.images || []), [files, setFiles] = useState([]), [previews, setPreviews] = useState([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [inputKey, setInputKey] = useState(0);
  useEffect(() => { const urls = files.map(file => URL.createObjectURL(file)); setPreviews(urls); return () => urls.forEach(URL.revokeObjectURL); }, [files]);
  async function run(work) { setBusy(true); setError(''); try { const result = await work(); setImages(result.images); return true; } catch (e) { setError(e.message); return false; } finally { setBusy(false); } }
  function select(event) {
    const selected = Array.from(event.target.files || []); setError('');
    if (selected.length + images.length > 6 || selected.some(f => f.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(f.type))) {
      setError('Maximum 6 photos par produit, JPG / PNG / WebP, 5 Mo par fichier.'); setFiles([]); setInputKey(k => k + 1); return;
    }
    setFiles(selected);
  }
  return <section className="photo-manager"><h3>Photos du produit</h3><p className="muted">Jusqu’à 6 photos · JPG, PNG ou WebP · 5 Mo chacune. La première photo est la photo principale.</p>{error && <p className="notice" role="alert">{error}</p>}<div className="photo-grid">{images.map((image, index) => <div className="photo-tile" key={image.id}><img src={imageUrl(image.url)} alt={`Photo ${index + 1} du produit`} /><button type="button" className="secondary" disabled={busy || index === 0} onClick={() => run(() => request(`/products/${product.id}/images/${image.id}/main`, { method: 'PATCH' }))}>{index === 0 ? 'Photo principale' : 'Définir comme principale'}</button><button type="button" className="text-link danger" disabled={busy} onClick={() => { if (window.confirm('Supprimer cette photo ?')) run(() => request(`/products/${product.id}/images/${image.id}`, { method: 'DELETE' })); }}>Supprimer</button></div>)}</div>{!images.length && product.image_url && <p className="muted">Votre image par URL reste affichée tant qu’aucune photo n’est importée.</p>}<label className="upload-label">Ajouter des photos<input key={inputKey} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || images.length >= 6} onChange={select} /></label>{!!previews.length && <><div className="photo-grid">{previews.map((url, index) => <div className="photo-tile" key={url}><img src={url} alt={`Aperçu ${index + 1}`} /><small>{files[index]?.name}</small></div>)}</div><button type="button" className="primary" disabled={busy} onClick={async () => { const body = new FormData(); files.forEach(file => body.append('images', file)); if (await run(() => request(`/products/${product.id}/images`, { method: 'POST', body }))) { setFiles([]); setInputKey(k => k + 1); } }}>{busy ? 'Importation…' : `Importer ${files.length} photo(s)`}</button></>}</section>;
}

