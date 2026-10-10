import ColorField from './ColorField';
﻿import Notifications from './Notifications';
import Orders from './Orders';
import ProductPhotos from './ProductPhotos';
import ProductPhotoChoice from './ProductPhotoChoice';
import { useEffect, useState, useRef } from 'react';
import { Package, ShoppingBag, Truck, LogOut, Plus, ArrowLeft, ArrowRight } from 'lucide-react';
import { api, money, statusLabels } from './api';

function ErrorMessage({ error }) { return error && <p role="alert" className="notice">{error}</p>; }
function Login({ onLogin }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  return <section className="login section"><span className="eyebrow">ESPACE PRIVÉ</span><h1>Bienvenue<br /><i>chez vous.</i></h1><p>Connectez-vous pour gérer votre boutique.</p><form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); const values = Object.fromEntries(new FormData(e.currentTarget)); try { onLogin(await api('/admin/login', { method: 'POST', body: values })); } catch (e) { setError(e.message); } finally { setBusy(false); } }}><label>Adresse e-mail<input name="email" type="email" required autoComplete="username" maxLength={254} /></label><label>Mot de passe<input name="password" type="password" required autoComplete="current-password" maxLength={128} /></label><ErrorMessage error={error} /><button className="primary full" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}<ArrowRight size={16} /></button></form></section>;
}
function Pagination({ page, setPage, more, busy }) { return <div className="pagination"><button className="secondary" disabled={page === 1 || busy} onClick={() => setPage(p => p - 1)}>Précédent</button><span>Page {page}</span><button className="secondary" disabled={!more || busy} onClick={() => setPage(p => p + 1)}>Suivant</button></div>; }
const freshProduct = () => ({ name: '', description: '', price: '', image_url: '', is_active: true, customization_enabled: false });
function ProductEditor({ product, request, done }) {
  const [form, setForm] = useState(product ? { name: product.name, description: product.description, price: product.price, image_url: product.image_url || '', is_active: product.is_active, customization_enabled: product.customization_enabled || false } : freshProduct());
  const [variants, setVariants] = useState(product?.variants || [{ size: 'M', color: 'black', stock: 0 }]), [draft, setDraft] = useState({ size: '', color: '', stock: 0 }), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function action(work) { setError(''); setBusy(true); try { await work(); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  async function refresh() { setVariants((await request(`/products/${product.id}`)).product.variants); }
  const [photoMode, setPhotoMode] = useState('url'), [photo, setPhoto] = useState(null);
  const createdProduct = useRef(null), uploadedPhoto = useRef(null), saving = useRef(false);
  async function saveProduct() {
    if (saving.current) return;
    saving.current = true;
    await action(async () => {
      try {
        const selectedPhoto = !product && photoMode === 'upload' ? photo : null;
        const body = { ...form, image_url: !product && photoMode === 'upload' ? '' : form.image_url };
        if (product) {
          await request(`/products/${product.id}`, { method: 'PATCH', body });
          done();
          return;
        }
        if (!createdProduct.current) {
          const result = await request('/products', { method: 'POST', body: { ...body, variants, ...(selectedPhoto ? { is_active: false } : {}) } });
          createdProduct.current = result.product;
        }
        if (selectedPhoto && uploadedPhoto.current !== selectedPhoto) {
          const data = new FormData();
          data.append('images', selectedPhoto);
          const result = await request(`/products/${createdProduct.current.id}/images`, { method: 'POST', body: data });
          createdProduct.current = { ...createdProduct.current, images: result.images };
          uploadedPhoto.current = selectedPhoto;
        }
        await request(`/products/${createdProduct.current.id}`, { method: 'PATCH', body });
        done({ ...createdProduct.current, ...body });
      } catch (error) {
        if (createdProduct.current) throw new Error(`Le produit est enregistré. Finalisation incomplète : ${error.message} Cliquez sur « Enregistrer le produit » pour réessayer.`);
        throw error;
      }
    });
    saving.current = false;
  }

  return <div className="product-editor"><button className="text-link" disabled={busy} onClick={() => done()}><ArrowLeft size={16} /> Retour aux produits</button><h2>{product ? 'Modifier la pièce' : 'Une nouvelle pièce'}</h2><ErrorMessage error={error} /><form onSubmit={e => { e.preventDefault(); saveProduct(); }}><fieldset className="product-fields" disabled={busy || !!createdProduct.current}><div className="form-grid"><label>Nom<input required maxLength={150} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label>Prix (DA)<input required type="number" min="0" max="999999999" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></label>{product ? <label className="span-2">URL de la photo<input type="url" placeholder="https://…" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} /></label> : <ProductPhotoChoice mode={photoMode} setMode={setPhotoMode} file={photo} setFile={setPhoto} url={form.image_url} setUrl={image_url => setForm({ ...form, image_url })} disabled={busy || !!createdProduct.current} />}<label className="span-2">Description<textarea maxLength={5000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label></div><label className="checkbox"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Visible dans la boutique</label><label className="checkbox customization-admin-toggle"><input type="checkbox" checked={form.customization_enabled} onChange={e => setForm({ ...form, customization_enabled: e.target.checked })} /> Proposer broderie / impression et image de r&eacute;f&eacute;rence pour ce produit</label>{!product && <><h3>Tailles & couleurs</h3>{variants.map((v, i) => <div className="variant-row" key={i}><label>Taille<input required maxLength={30} value={v.size} onChange={e => setVariants(items => items.map((x, j) => j === i ? { ...x, size: e.target.value } : x))} /></label><ColorField value={v.color} onChange={color => setVariants(items => items.map((x, j) => j === i ? { ...x, color } : x))} disabled={busy} /><label>Stock<input type="number" required min="0" max="1000000" value={v.stock} onChange={e => setVariants(items => items.map((x, j) => j === i ? { ...x, stock: Number(e.target.value) } : x))} /></label><button type="button" className="secondary" disabled={variants.length === 1} onClick={() => setVariants(items => items.filter((_, j) => i !== j))}>Retirer</button></div>)}<button type="button" className="text-link" disabled={variants.length >= 100} onClick={() => setVariants([...variants, { size: '', color: '', stock: 0 }])}><Plus size={15} /> Ajouter une variante</button></>}</fieldset><button className="primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer le produit'}</button></form>{product && <><ProductPhotos product={product} request={request} /><h3>Tailles, couleurs & stock</h3>{variants.map(v => <VariantEditor key={`${v.id}-${v.stock}-${v.is_active}`} variant={v} busy={busy} save={(body, stockOnly) => action(async () => { await request(`/products/${product.id}/variants/${v.id}${stockOnly ? '/stock' : ''}`, { method: 'PATCH', body }); await refresh(); })} />)}<h3>Ajouter une variante</h3><form className="variant-row" onSubmit={e => { e.preventDefault(); action(async () => { await request(`/products/${product.id}/variants`, { method: 'POST', body: draft }); setDraft({ size: '', color: '', stock: 0 }); await refresh(); }); }}><label>Taille<input required value={draft.size} onChange={e => setDraft({ ...draft, size: e.target.value })} /></label><ColorField value={draft.color} onChange={color => setDraft({ ...draft, color })} disabled={busy} /><label>Stock<input required type="number" min="0" max="1000000" value={draft.stock} onChange={e => setDraft({ ...draft, stock: Number(e.target.value) })} /></label><button className="secondary" disabled={busy}>Ajouter</button></form></>}</div>;
}
function VariantEditor({ variant, save, busy }) {
  const [size, setSize] = useState(variant.size), [color, setColor] = useState(variant.color), [stock, setStock] = useState(variant.stock);
  return <div className="variant-panel">
    <div className="variant-heading">
      <strong>{variant.size} / {variant.color}</strong>
      <div className="variant-status"><span className={`badge ${variant.is_active ? 'delivered' : 'cancelled'}`}>{variant.is_active ? 'Active' : 'Masquée'}</span><button type="button" className="text-link" disabled={busy} onClick={() => save({ is_active: !variant.is_active }, false)}>{variant.is_active ? 'Désactiver' : 'Activer'}</button></div>
    </div>
    <div className="variant-details">
      <form className="variant-attributes" onSubmit={e => { e.preventDefault(); save({ size, color }, false); }}>
        <label>Taille<input required value={size} onChange={e => setSize(e.target.value)} /></label>
        <ColorField value={color} onChange={color => setColor(color)} disabled={busy} />
        <button className="secondary" disabled={busy}>Modifier</button>
      </form>
      <form className="variant-inventory" onSubmit={e => { e.preventDefault(); save({ stock: Number(stock), expected_stock: variant.stock }, true); }}>
        <label>Stock disponible<input required type="number" min="0" max="1000000" value={stock} onChange={e => setStock(e.target.value)} /></label>
        <button className="secondary" disabled={busy}>Mettre à jour le stock</button>
      </form>
    </div>
  </div>;
}
function Products({ request }) {
  const [products, setProducts] = useState([]), [editor, setEditor] = useState(null);
  const [page, setPage] = useState(1), [more, setMore] = useState(false), [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [tick, setTick] = useState(0);
  useEffect(() => { let active = true; setBusy(true); setError(''); request(`/products?page=${page}&search=${encodeURIComponent(search)}`).then(d => { if (active) { setProducts(d.products); setMore(d.pagination.has_more); setSelected([]); } }).catch(e => active && setError(e.message)).finally(() => active && setBusy(false)); return () => { active = false; }; }, [page, search, tick]);
  const visibleIds = products.map(product => product.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selected.includes(id));
  const toggle = id => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  async function removeSelected() {
    if (!selected.length || !window.confirm(`Supprimer définitivement ${selected.length} produit(s) sélectionné(s) ? Cette action est irréversible.`)) return;
    setBusy(true); setError('');
    try {
      const result = await request('/products/bulk-delete', { method: 'POST', body: { ids: selected } });
      setSelected([]);
      if (result.failed_images) setError(`Produits supprimés, mais ${result.failed_images} photo(s) n’ont pas pu être retirées du stockage.`);
      if (products.length === selected.length && page > 1) setPage(page - 1);
      else setTick(value => value + 1);
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  if (editor) return <ProductEditor key={editor.id || 'new'} product={editor === 'new' ? null : editor} request={request} done={created => { setEditor(created || null); setTick(t => t + 1); }} />;
  return <>
    <div className="section-heading"><div><span className="eyebrow">VOTRE COLLECTION</span><h2>Les produits</h2></div><button className="primary" disabled={busy} onClick={() => setEditor('new')}><Plus size={17} /> Ajouter un produit</button></div>
    <ErrorMessage error={error} />
    <input className="admin-search" aria-label="Rechercher un produit" placeholder="Rechercher un produit…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); setSelected([]); }} />
    {selected.length > 0 && <div className="bulk-actions"><span>{selected.length} produit(s) sélectionné(s)</span><button className="secondary danger" disabled={busy} onClick={removeSelected}>{busy ? 'Suppression…' : 'Supprimer la sélection'}</button></div>}
    <div className="table-wrap"><table><thead><tr><th className="select-column"><input type="checkbox" aria-label="Sélectionner tous les produits de cette page" checked={allSelected} disabled={busy || !products.length} onChange={() => setSelected(allSelected ? [] : visibleIds)} /></th><th>Produit</th><th>Prix</th><th>Variantes</th><th>Visibilité</th><th /></tr></thead><tbody>{products.map(p => <tr key={p.id}><td className="select-column"><input type="checkbox" aria-label={`Sélectionner ${p.name}`} checked={selected.includes(p.id)} disabled={busy} onChange={() => toggle(p.id)} /></td><td>{p.name}</td><td>{money(p.price)}</td><td>{p.variants.length}</td><td><span className={`badge ${p.is_active ? 'delivered' : 'cancelled'}`}>{p.is_active ? 'Visible' : 'Masqué'}</span></td><td><button className="text-link" disabled={busy} onClick={() => setEditor(p)}>Modifier <ArrowRight size={14} /></button></td></tr>)}</tbody></table></div>
    {!products.length && <div className="empty">{busy ? 'Chargement…' : 'Ajoutez votre premier T-shirt pour ouvrir la collection.'}</div>}
    <Pagination page={page} setPage={setPage} more={more} busy={busy} />
  </>;
}

function Delivery({ request }) {
  const [rates, setRates] = useState([]), [error, setError] = useState(''), [tick, setTick] = useState(0), [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; request('/delivery-rates').then(d => active && setRates(d.delivery_rates)).catch(e => active && setError(e.message)); return () => { active = false; }; }, [tick]);
  async function save(body) { setError(''); setBusy(true); try { await request('/delivery-rates', { method: 'PUT', body }); setTick(t => t + 1); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  return <><span className="eyebrow">LES FRAIS DE LIVRAISON</span><h2>De chez nous à chez vous.</h2><p>Ajoutez uniquement les wilayas que vous desservez.</p><ErrorMessage error={error} /><form className="variant-row" onSubmit={e => { e.preventDefault(); const form = e.currentTarget; save({ ...Object.fromEntries(new FormData(form)), is_active: true }); }}><label>Code wilaya<input name="wilaya_code" required maxLength={10} placeholder="16" /></label><label>Nom<input name="wilaya_name" required maxLength={120} placeholder="Alger" /></label><label>Frais (DA)<input name="fee" type="number" min="0" max="999999999" step="0.01" required /></label><button className="primary" disabled={busy}>Enregistrer</button></form><div className="table-wrap"><table><thead><tr><th>Wilaya</th><th>Frais</th><th>Statut</th><th /></tr></thead><tbody>{rates.map(r => <tr key={r.wilaya_code}><td>{r.wilaya_code} — {r.wilaya_name}</td><td>{money(r.fee)}</td><td>{r.is_active ? 'Disponible' : 'Désactivée'}</td><td><button className="text-link" disabled={busy} onClick={() => save({ wilaya_code: r.wilaya_code, wilaya_name: r.wilaya_name, fee: r.fee, is_active: !r.is_active })}>{r.is_active ? 'Désactiver' : 'Activer'}</button></td></tr>)}</tbody></table></div><small>Pour modifier un tarif, saisissez à nouveau le même code wilaya.</small></>;
}
const adminSessionKey = 'thread-admin-session';
function readAdminSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(adminSessionKey) || 'null');
    if (saved && typeof saved.token === 'string' && typeof saved.admin?.email === 'string'
      && Date.parse(saved.expires_at) > Date.now()) return saved;
    sessionStorage.removeItem(adminSessionKey);
  } catch { /* Storage may be unavailable in this browser. */ }
  return null;
}
export default function Admin() {
  const [target, setTarget] = useState(null);
  const [session, updateSession] = useState(readAdminSession), [tab, setTab] = useState('orders'), [error, setError] = useState('');
  function setSession(next) {
    try {
      if (next) sessionStorage.setItem(adminSessionKey, JSON.stringify(next));
      else sessionStorage.removeItem(adminSessionKey);
    } catch { /* Keep in-memory login working when storage is unavailable. */ }
    updateSession(next);
  }
  async function request(path, options = {}) { try { return await api(`/admin${path}`, { ...options, token: session.token }); } catch (e) { if (e.status === 401) setSession(null); throw e; } }
  if (!session) return <Login onLogin={setSession} />;
  return <section className="admin-layout section"><aside className="admin-sidebar"><span className="eyebrow">VOTRE BOUTIQUE</span><strong>Bonjour, admin.</strong><small>{session.admin.email}</small>{[['orders', ShoppingBag, 'Commandes'], ['products', Package, 'Produits'], ['delivery', Truck, 'Livraison']].map(([key, Icon, label]) => <button key={key} className={tab === key ? 'selected' : ''} onClick={() => setTab(key)}><Icon size={18} />{label}</button>)}<button onClick={async () => { try { await request('/logout', { method: 'POST' }); setSession(null); } catch (e) { setError(e.message); } }}><LogOut size={18} /> Déconnexion</button><ErrorMessage error={error} /></aside><div className="admin-content"><Notifications request={request} openOrder={id => { setTarget({ id }); setTab('orders'); }} />{tab === 'orders' ? <Orders request={request} target={target} /> : tab === 'products' ? <Products request={request} /> : <Delivery request={request} />}</div></section>;
}



