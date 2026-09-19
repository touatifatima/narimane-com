import { useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { statusLabels } from './api';

export default function Notifications({ request, openOrder }) {
  const [open, setOpen] = useState(false), [items, setItems] = useState([]), [count, setCount] = useState(0), [cursor, setCursor] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const latestRequest = useRef(request), root = useRef(null), version = useRef(0), mounted = useRef(true), panelOpen = useRef(false);
  latestRequest.current = request; panelOpen.current = open;
  async function load(before) {
    const run = ++version.current;
    try {
      const data = await latestRequest.current(`/notifications${before ? `?before=${before}` : ''}`);
      if (!mounted.current || run !== version.current) return;
      setItems(old => before ? [...old, ...data.notifications] : data.notifications); setCount(data.unread_count); setCursor(data.next_cursor); setError('');
    } catch (e) { if (mounted.current && run === version.current) setError(e.message); }
  }
  useEffect(() => {
    mounted.current = true; load();
    const timer = setInterval(() => { if (!document.hidden && !panelOpen.current) load(); }, 15000);
    const focus = () => { if (!panelOpen.current) load(); };
    const outside = e => { if (!root.current?.contains(e.target)) setOpen(false); };
    const key = e => { if (e.key === 'Escape' && panelOpen.current) { setOpen(false); root.current?.querySelector('button')?.focus(); } };
    window.addEventListener('focus', focus); document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key);
    return () => { mounted.current = false; version.current++; clearInterval(timer); window.removeEventListener('focus', focus); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); };
  }, []);
  async function read(item) {
    setBusy(true);
    try { await request(`/notifications/${item.id}/read`, { method: 'PATCH' }); await load(); setOpen(false); openOrder(item.order_id); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="notifications" ref={root}><button className="notification-bell" aria-label={`Notifications, ${count} non lues`} aria-expanded={open} aria-controls="notification-panel" onClick={() => { if (!open) load(); setOpen(!open); }}><Bell size={20} /><span>Notifications</span>{count > 0 && <b>{count > 99 ? '99+' : count}</b>}</button>
    {open && <section id="notification-panel" className="notification-panel" aria-label="Notifications administrateur"><div className="notification-heading"><h3>Vos notifications</h3><button className="icon" aria-label="Fermer les notifications" onClick={() => setOpen(false)}><X size={18} /></button></div><div className="notification-actions"><button className="text-link" onClick={() => load()}>Actualiser</button><button className="text-link" disabled={busy || !items.length || !count} onClick={async () => { setBusy(true); try { await request('/notifications/read-all', { method: 'PATCH', body: { through: items[0].id } }); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); } }}>Tout marquer comme lu</button></div>{error && <p className="notice" role="alert">{error}</p>}<div className="notification-list">{items.map(item => <button className={`notification-item ${item.is_read ? '' : 'unread'}`} disabled={busy} key={item.id} onClick={() => read(item)}><strong>{item.kind === 'new_order' ? 'Nouvelle commande' : item.status === 'returned' ? 'Retour de colis reçu' : `Commande ${statusLabels[item.status]?.toLowerCase() || item.status}`}</strong><span>Commande #{item.order_id}</span><small>{new Date(item.created_at).toLocaleString('fr-FR')}</small>{!item.is_read && <i aria-label="Non lue" />}</button>)}{!items.length && !error && <p className="empty">Aucune notification pour le moment.</p>}</div>{cursor && <button className="secondary full" disabled={busy} onClick={() => load(cursor)}>Voir les précédentes</button>}<small className="notification-note">Actualisation toutes les 15 secondes lorsque ce panneau est fermé.</small></section>}
  </div>;
}
