import Hero from './Hero';
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, ArrowLeft, ShoppingBag, Search, X, Plus, Minus, Trash2, Truck, Banknote, Check, Package, Menu, SlidersHorizontal } from 'lucide-react';
import { api, money, imageUrl } from './api';
import { ProductGallery } from './ProductPhotos';
const Admin = lazy(() => import('./Admin'));
import './style.css';

const colors = { white: '#eeece6', blanc: '#eeece6', black: '#272724', noir: '#272724', olive: '#69715d', beige: '#d3c8b4', brown: '#775947', navy: '#293645', blue: '#526f8d', red: '#995448', green: '#667260', grey: '#aaa8a2' };
export function ProductImage({ product, color, className = '' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [product.image_url]);
  return <div className={`product-image ${className}`}>
    {product.image_url && !failed ? <img src={imageUrl(product.image_url)} alt={product.name} onError={() => setFailed(true)} loading="lazy" /> : <div className="image-placeholder"><Package size={32} strokeWidth={1} /><span>Photo à venir</span></div>}
  </div>;
}
function useRoute() {
  const [route, setRoute] = useState(location.hash.slice(1) || '/');
  useEffect(() => { const update = () => { setRoute(location.hash.slice(1) || '/'); window.scrollTo(0, 0); }; window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update); }, []);
  return route;
}
export function Notice({ children }) { return children ? <p className="notice" role="alert">{children}</p> : null; }
function Empty({ title, children }) { return <div className="empty"><ShoppingBag size={36} strokeWidth={1} /><h3>{title}</h3><p>{children}</p></div>; }
function Benefits() { return <div className="benefits"><div><Truck /><span><b>Livraison à domicile</b>Tarif selon votre wilaya</span></div><div><Banknote /><span><b>Paiement à la livraison</b>Aucun paiement en ligne</span></div><div><Package /><span><b>Une seule commande</b>Tous vos essentiels ensemble</span></div></div>; }
function Card({ product }) { return <a className="product-card" href={`#/product/${product.id}`}><ProductImage product={product} /><div className="card-label"><h3>{product.name}</h3><ArrowRight size={17} /></div><p>{money(product.price)}</p><div className="swatches">{[...new Set(product.variants.map(v => v.color))].slice(0, 6).map(color => <span key={color} style={{ background: colors[color.toLowerCase()] || '#b2aa9a' }} title={color} />)}</div></a>; }
function Catalog({ home = false }) {
  const [products, setProducts] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [page, setPage] = useState(1), [more, setMore] = useState(false), [query, setQuery] = useState(''), [sort, setSort] = useState('new'), [available, setAvailable] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    api(`/products?page=${page}&limit=${home ? 4 : 20}`).then(data => { if (active) { setProducts(old => page === 1 ? data.products : [...old, ...data.products]); setMore(data.pagination.has_more); } }).catch(e => active && setError(e.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [page, home, reload]);
  const visible = products.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) && (!available || p.variants.some(v => v.stock > 0))).sort((a, b) => sort === 'low' ? Number(a.price) - Number(b.price) : sort === 'high' ? Number(b.price) - Number(a.price) : b.id - a.id);
  return <section className="catalog section">
    <div className="section-heading"><div>{!home && <span className="eyebrow">LA COLLECTION</span>}<h2>{home ? 'Vos prochains essentiels.' : 'Les T-shirts'}</h2>{!home && <p>Des pièces simples. À porter à votre façon.</p>}</div>{home && <a className="text-link" href="#/shop">Toute la collection <ArrowRight size={16} /></a>}</div>
    {!home && <div className="catalog-toolbar"><label className="search-field"><Search size={17} /><input aria-label="Rechercher parmi les produits chargés" placeholder="Rechercher un T-shirt…" value={query} onChange={e => setQuery(e.target.value)} /></label><label className="check-filter"><SlidersHorizontal size={16} /><input type="checkbox" checked={available} onChange={e => setAvailable(e.target.checked)} /> En stock</label><select aria-label="Trier les produits chargés" value={sort} onChange={e => setSort(e.target.value)}><option value="new">Nouveautés</option><option value="low">Prix croissant</option><option value="high">Prix décroissant</option></select></div>}
    <Notice>{error}</Notice>{error && <button className="secondary" onClick={() => setReload(n => n + 1)}>Réessayer</button>}
    <div className="product-grid">{visible.map(p => <Card key={p.id} product={p} />)}{loading && Array.from({ length: home ? 4 : 4 }, (_, i) => <div className="skeleton" key={`s${i}`} />)}</div>
    {!loading && !error && !visible.length && <Empty title={products.length ? 'Aucun résultat' : 'La collection arrive bientôt'}>{products.length ? 'Essayez un autre nom ou retirez le filtre.' : 'Nos prochains essentiels seront présentés ici.'}</Empty>}
    {!home && more && <div className="center"><button className="secondary" disabled={loading} onClick={() => setPage(p => p + 1)}>Voir plus de produits <Plus size={16} /></button><small>La recherche et le tri s’appliquent aux produits chargés.</small></div>}
  </section>;
}
function Home() { return <><Hero /><Benefits /><Catalog home /><section className="story-banner"><span className="eyebrow">L’ESPRIT THREAD.</span><h2>Un T-shirt.<br />Mille façons d’être vous.</h2><a className="text-link" href="#/about">Notre univers <ArrowRight size={16} /></a><div className="story-type" aria-hidden="true">less,<br /><i>but better.</i></div></section></>; }
function Product({ id, add }) {
  const [product, setProduct] = useState(null), [error, setError] = useState(''), [color, setColor] = useState(''), [size, setSize] = useState(''), [qty, setQty] = useState(1);
  useEffect(() => { let active = true; setProduct(null); setError(''); api(`/products/${id}`).then(({ product }) => { if (active) { setProduct(product); setColor(product.variants[0]?.color || ''); setSize(''); setQty(1); } }).catch(e => active && setError(e.message)); return () => { active = false; }; }, [id]);
  if (error) return <section className="section"><Notice>{error}</Notice><a href="#/shop">Retour à la collection</a></section>;
  if (!product) return <div className="section skeleton" aria-label="Chargement du produit" />;
  const variant = product.variants.find(v => v.color === color && v.size === size);
  return <section className="section"><a className="breadcrumb" href="#/shop"><ArrowLeft size={14} /> Collection / {product.name}</a><div className="product-detail"><ProductGallery product={product} /><div className="product-info"><span className="eyebrow">LES ESSENTIELS THREAD.</span><h1>{product.name}</h1><p className="price">{money(product.price)}</p><p className="description">{product.description || 'Un essentiel à associer à votre quotidien.'}</p><fieldset><legend>Couleur : <b>{color || 'Indisponible'}</b></legend><div className="choices">{[...new Set(product.variants.map(v => v.color))].map(c => <button key={c} className={`color-choice ${color === c ? 'selected' : ''}`} aria-pressed={color === c} onClick={() => { setColor(c); setSize(''); setQty(1); }}><span style={{ background: colors[c.toLowerCase()] || '#aaa18f' }} />{c}</button>)}</div></fieldset><fieldset><legend>Taille</legend><div className="choices">{product.variants.filter(v => v.color === color).map(v => <button key={v.id} disabled={!v.stock} aria-pressed={size === v.size} className={`size-choice ${size === v.size ? 'selected' : ''}`} onClick={() => { setSize(v.size); setQty(1); }}>{v.size}</button>)}</div></fieldset><div className="purchase"><div className="quantity"><button aria-label="Diminuer la quantité" disabled={qty <= 1} onClick={() => setQty(q => q - 1)}><Minus size={14} /></button><span>{qty}</span><button aria-label="Augmenter la quantité" disabled={!variant || qty >= Math.min(99, variant.stock)} onClick={() => setQty(q => q + 1)}><Plus size={14} /></button></div><button className="primary" disabled={!variant?.stock} onClick={() => add(product, variant, qty)}>{variant ? 'Ajouter au panier' : 'Choisissez votre taille'}<ShoppingBag size={18} /></button></div><p className="muted"><Truck size={16} /> Livraison selon votre wilaya</p><p className="muted"><Banknote size={16} /> Paiement à la réception</p><details><summary>Description</summary><p>{product.description || 'Les détails de cette pièce seront ajoutés prochainement.'}</p></details><details><summary>Commande & livraison</summary><p>Indiquez votre wilaya au moment de commander pour connaître les frais de livraison. Vos articles sont regroupés en une seule commande, à payer à la réception.</p></details></div></div></section>;
}
function CartItems({ cart, update, remove, compact = false }) { return <div className="cart-items">{cart.map(item => <div className="cart-item" key={item.variant_id}><ProductImage product={item} /><div className="cart-item-body"><a href={`#/product/${item.product_id}`}>{item.name}</a><small>{item.color} / {item.size}</small><b>{money(item.price)}</b>{!compact && <div className="quantity"><button aria-label={`Diminuer ${item.name}`} disabled={item.quantity <= 1} onClick={() => update(item.variant_id, item.quantity - 1)}><Minus size={12} /></button><span>{item.quantity}</span><button aria-label={`Augmenter ${item.name}`} disabled={item.quantity >= Math.min(99, item.stock)} onClick={() => update(item.variant_id, item.quantity + 1)}><Plus size={12} /></button></div>}{compact && <small>Quantité : {item.quantity}</small>}</div>{!compact && <button className="icon" aria-label={`Retirer ${item.name}`} onClick={() => remove(item.variant_id)}><Trash2 size={15} /></button>}</div>)}</div>; }
function Drawer({ close, cart, update, remove }) {
  const dialog = useRef(null);
  useEffect(() => { const el = dialog.current; el.showModal(); const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = previous; }; }, []);
  return <dialog ref={dialog} className="cart-dialog" onCancel={close} onClick={e => { if (e.target === dialog.current) close(); }}><div className="drawer-head"><h2>Votre panier ({cart.reduce((s, i) => s + i.quantity, 0)})</h2><button autoFocus className="icon" onClick={close} aria-label="Fermer le panier"><X /></button></div>{cart.length ? <><CartItems cart={cart} update={update} remove={remove} /><div className="drawer-bottom"><div className="total-row"><b>Sous-total</b><b>{money(cart.reduce((s, i) => s + Number(i.price) * i.quantity, 0))}</b></div><p className="muted">Livraison calculée à l’étape suivante.</p><a href="#/checkout" className="primary full" onClick={close}>Passer commande <ArrowRight size={17} /></a><button className="text-link center" onClick={close}>Continuer mes achats</button></div></> : <Empty title="Votre panier vous attend">Découvrez la collection et ajoutez vos essentiels.<a className="primary" href="#/shop" onClick={close}>Voir la collection <ArrowRight size={16} /></a></Empty>}</dialog>;
}
function Checkout({ cart, clear }) {
  const [rates, setRates] = useState([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [confirmation, setConfirmation] = useState(null);
  const [form, setForm] = useState({ customer_name: '', phone: '', wilaya_code: '', commune: '', address: '', notes: '' });
  const pending = useRef(null), submitting = useRef(false);
  useEffect(() => { api('/delivery-rates').then(d => setRates(d.delivery_rates)).catch(e => setError(e.message)); }, []);
  const subtotal = cart.reduce((s, i) => s + Number(i.price) * i.quantity, 0), rate = rates.find(r => r.wilaya_code === form.wilaya_code);
  async function submit(e) {
    e.preventDefault(); if (submitting.current) return; submitting.current = true; setBusy(true); setError('');
    const body = { ...form, items: cart.map(i => ({ variant_id: i.variant_id, quantity: i.quantity })) };
    const signature = JSON.stringify(body);
    try {
      if (!pending.current) { try { pending.current = JSON.parse(sessionStorage.getItem('thread-checkout')); } catch {} }
      if (pending.current?.signature !== signature) pending.current = { signature, key: crypto.randomUUID() };
      try { sessionStorage.setItem('thread-checkout', JSON.stringify(pending.current)); } catch {}
      const data = await api('/orders', { method: 'POST', body, headers: { 'Idempotency-Key': pending.current.key } });
      setConfirmation(data.order); clear(); pending.current = null; try { sessionStorage.removeItem('thread-checkout'); } catch {}
    } catch (e) { setError(e.message); } finally { submitting.current = false; setBusy(false); }
  }
  if (confirmation) return <section className="confirmation section"><span className="success-icon"><Check size={32} /></span><span className="eyebrow">MERCI POUR VOTRE COMMANDE</span><h1>Vos essentiels sont réservés.</h1><p>Votre commande a bien été enregistrée. Conservez votre référence.</p><div className="confirmation-box"><small>RÉFÉRENCE</small><strong>{confirmation.reference}</strong><div className="total-row"><span>À payer à la livraison</span><b>{money(confirmation.total)}</b></div></div><a href="#/shop" className="primary">Retour à la collection <ArrowRight size={17} /></a></section>;
  if (!cart.length) return <Empty title="Votre panier est vide"><a href="#/shop">Découvrir la collection</a></Empty>;
  return <section className="section"><a className="breadcrumb" href="#/shop"><ArrowLeft size={15} /> Continuer mes achats</a><div className="section-heading"><div><span className="eyebrow">LA DERNIÈRE ÉTAPE</span><h1>À vous de jouer.</h1><p>Vos informations, votre adresse. Et c’est tout.</p></div></div><div className="checkout-grid"><form onSubmit={submit} className="checkout-form"><h3>01 — Vos coordonnées</h3><div className="form-grid">{[['customer_name', 'Nom complet', 'name'], ['phone', 'Téléphone', 'tel']].map(([name, label, auto]) => <label key={name}>{label}<input required maxLength={name === 'phone' ? 30 : 120} autoComplete={auto} type={name === 'phone' ? 'tel' : 'text'} value={form[name]} onChange={e => setForm({ ...form, [name]: e.target.value })} /></label>)}</div><h3>02 — Votre livraison</h3><div className="form-grid"><label>Wilaya<select aria-label="Wilaya" required value={form.wilaya_code} onChange={e => setForm({ ...form, wilaya_code: e.target.value })}><option value="">Choisir votre wilaya</option>{rates.map(r => <option key={r.wilaya_code} value={r.wilaya_code}>{r.wilaya_code} — {r.wilaya_name}</option>)}</select></label><label>Commune<input required maxLength={120} value={form.commune} onChange={e => setForm({ ...form, commune: e.target.value })} /></label><label className="span-2">Adresse complète<input required maxLength={300} autoComplete="street-address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></label><label className="span-2">Instructions de livraison <span className="muted">(facultatif)</span><textarea maxLength={1000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label></div><div className="payment"><Banknote /><div><b>Paiement à la livraison</b><p>Réglez votre commande à sa réception.</p></div><Check size={18} /></div><Notice>{error}</Notice>{!rates.length && <p className="notice">La livraison n’est pas encore configurée. Réessayez plus tard.</p>}<button className="primary full" disabled={busy || !rate}>{busy ? 'Enregistrement…' : `Confirmer ma commande${rate ? ` · ${money(subtotal + Number(rate.fee))}` : ''}`}<ArrowRight size={17} /></button></form><aside className="order-summary"><h3>Votre commande</h3><CartItems cart={cart} compact /><div className="total-row"><span>Sous-total estimé</span><span>{money(subtotal)}</span></div><div className="total-row"><span>Livraison</span><span>{rate ? money(rate.fee) : 'Choisir une wilaya'}</span></div><div className="total-row grand-total"><b>Total estimé</b><b>{money(subtotal + Number(rate?.fee || 0))}</b></div><small>Les prix et le stock sont vérifiés à la confirmation.</small></aside></div></section>;
}
function About() { return <section className="about section"><span className="eyebrow">L’ESPRIT THREAD.</span><h1>Simple à porter.<br /><i>Simplement vous.</i></h1><p>Un T-shirt est le point de départ. À vous d’écrire la suite. THREAD. rassemble les essentiels d’une garde-robe facile à vivre, dans des couleurs qui trouvent naturellement leur place.</p><a className="primary" href="#/shop">Explorer la collection <ArrowRight size={16} /></a><Benefits /></section>; }
function readCart() { try { const value = JSON.parse(localStorage.getItem('thread-cart') || '[]'); return Array.isArray(value) ? value.filter(i => Number.isInteger(i.variant_id) && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity <= 99 && Number.isFinite(Number(i.price)) && Number(i.price) >= 0 && typeof i.name === 'string').slice(0, 50) : []; } catch { return []; } }
function App() {
  const route = useRoute(), [cart, setCart] = useState(readCart), [drawer, setDrawer] = useState(false), [mobile, setMobile] = useState(false), [message, setMessage] = useState('');
  useEffect(() => { try { localStorage.setItem('thread-cart', JSON.stringify(cart)); } catch {} }, [cart]);
  useEffect(() => { setMobile(false); setDrawer(false); }, [route]);
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 5000); return () => clearTimeout(timer); }, [message]);
  function add(product, variant, quantity) {
    const old = cart.find(i => i.variant_id === variant.id);
    if ((old?.quantity || 0) + quantity > Math.min(99, variant.stock)) { setMessage('La quantité disponible est déjà dans votre panier.'); return; }
    if (!old && cart.length >= 50) { setMessage('Votre panier contient déjà 50 articles différents.'); return; }
    setCart(items => old ? items.map(i => i.variant_id === variant.id ? { ...i, quantity: i.quantity + quantity, stock: variant.stock, price: product.price } : i) : [...items, { variant_id: variant.id, product_id: product.id, name: product.name, image_url: product.image_url, color: variant.color, size: variant.size, stock: variant.stock, price: product.price, quantity }]); setDrawer(true);
  }
  return <><div className="announcement">Le style, tout simplement. <span>Paiement à la livraison.</span></div><header className="site-header"><div className="header-inner"><button className="icon mobile-only" aria-label="Ouvrir le menu" aria-expanded={mobile} onClick={() => setMobile(!mobile)}><Menu /></button><a className="wordmark" href="#/">THREAD<span>.</span></a><nav className={mobile ? 'open' : ''} aria-label="Navigation principale"><a className={route === '/' ? 'active' : ''} href="#/">Accueil</a><a className={route === '/shop' ? 'active' : ''} href="#/shop">La collection</a><a className={route === '/about' ? 'active' : ''} href="#/about">Notre univers</a></nav><div className="header-actions"><a className="icon search-link" href="#/shop" aria-label="Rechercher"><Search size={20} /></a><button className="icon bag-button" onClick={() => setDrawer(true)} aria-label={`Ouvrir le panier, ${cart.reduce((s, i) => s + i.quantity, 0)} articles`}><ShoppingBag size={20} />{cart.length > 0 && <span className="bag-count">{cart.reduce((s, i) => s + i.quantity, 0)}</span>}</button></div></div></header><main>{route === '/' ? <Home /> : route === '/shop' ? <Catalog /> : route.startsWith('/product/') ? <Product id={route.split('/')[2]} add={add} /> : route === '/checkout' ? <Checkout cart={cart} clear={() => setCart([])} /> : route === '/about' ? <About /> : <Empty title="Page introuvable"><a href="#/">Retour à l’accueil</a></Empty>}</main><footer><div><a className="wordmark" href="#/">THREAD.</a><p>Les essentiels. Tout simplement.</p></div><div><a href="#/shop">La collection</a><a href="#/about">Notre univers</a></div><small>© {new Date().getFullYear()} THREAD. · Algérie<br />Paiement à la livraison</small></footer>{drawer && <Drawer close={() => setDrawer(false)} cart={cart} update={(id, quantity) => setCart(items => items.map(i => i.variant_id === id ? { ...i, quantity } : i))} remove={id => setCart(items => items.filter(i => i.variant_id !== id))} />}{message && <div className="toast" role="status">{message}</div>}</>;
}
function AdminPage() {
  useEffect(() => { document.title = 'THREAD. — Administration'; }, []);
  return <><header className="admin-page-header"><a className="wordmark" href="/">THREAD.</a><span>ADMINISTRATION</span></header><main><Suspense fallback={<p className="section">Chargement…</p>}><Admin /></Suspense></main></>;
}
const isAdminPage = /^\/admin\/?$/.test(location.pathname);
createRoot(document.getElementById('root')).render(isAdminPage ? <AdminPage /> : <App />);




