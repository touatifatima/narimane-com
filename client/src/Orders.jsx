import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';
import OrderItem from './OrderItem';
import { money, statusLabels } from './api';

const transitions = {
  new: ['confirmed', 'cancelled'], confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'], delivered: ['returned'], cancelled: [], returned: [],
};

export default function Orders({ request, target }) {
  const [orders, setOrders] = useState([]), [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]), [status, setStatus] = useState('');
  const [search, setSearch] = useState(''), [page, setPage] = useState(1), [more, setMore] = useState(false);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    setBusy(true); setError('');
    request(`/orders?page=${page}${status ? `&status=${status}` : ''}&search=${encodeURIComponent(search)}`)
      .then(data => { if (active) { setOrders(data.orders); setMore(data.pagination.has_more); setSelectedIds([]); } })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [page, status, search, tick]);
  useEffect(() => { if (target) open(target.id); }, [target]);

  async function open(id) {
    setError('');
    try { setSelectedOrder((await request(`/orders/${id}`)).order); }
    catch (error) { setError(error.message); }
  }
  async function change(next) {
    if (next === 'returned' && !window.confirm('Confirmer la réception physique du retour ? Les articles seront remis en stock.')) return;
    if (next === 'cancelled' && !window.confirm('Annuler cette commande et remettre les articles en stock ?')) return;
    setBusy(true); setError('');
    try {
      await request(`/orders/${selectedOrder.id}/status`, { method: 'PATCH', body: { status: next } });
      await open(selectedOrder.id);
      setTick(value => value + 1);
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  async function removeSelected() {
    if (!selectedIds.length) return;
    const count = selectedIds.length;
    const message = `Supprimer définitivement ${count} commande(s) sélectionnée(s) ?\n\nLes commandes nouvelles ou confirmées remettront leurs articles en stock. Les commandes expédiées ou livrées ne remettront pas le stock. Cette action est irréversible.`;
    if (!window.confirm(message)) return;
    setBusy(true); setError('');
    try {
      await request('/orders/bulk-delete', { method: 'POST', body: { ids: selectedIds } });
      setSelectedIds([]);
      if (orders.length === count && page > 1) setPage(page - 1);
      else setTick(value => value + 1);
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  const visibleIds = orders.map(order => order.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
  const toggle = id => setSelectedIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);

  return <>
    <div className="section-heading"><div><span className="eyebrow">VOTRE ACTIVITÉ</span><h2>Les commandes</h2></div><button className="icon" aria-label="Actualiser les commandes" onClick={() => setTick(value => value + 1)}><RefreshCw size={18} /></button></div>
    {error && <p role="alert" className="notice">{error}</p>}
    {selectedOrder ? <div className="admin-detail">
      <button className="text-link" onClick={() => setSelectedOrder(null)}><ArrowLeft size={16} /> Toutes les commandes</button>
      <div className="section-heading"><h3>Commande #{selectedOrder.id}</h3><span className={`badge ${selectedOrder.status}`}>{statusLabels[selectedOrder.status]}</span></div>
      <small className="reference">{selectedOrder.reference}</small>
      <div className="admin-columns"><div><h3>{selectedOrder.customer_name}</h3><p>{selectedOrder.phone}</p><p>{selectedOrder.address}<br />{selectedOrder.commune}, {selectedOrder.wilaya}</p>{selectedOrder.notes && <p>Note : {selectedOrder.notes}</p>}</div><div>{selectedOrder.order_items.map(item => <OrderItem key={item.id} item={item} />)}<div className="total-row"><span>Livraison</span><span>{money(selectedOrder.delivery_fee)}</span></div><div className="total-row"><b>Total à payer</b><b>{money(selectedOrder.total)}</b></div></div></div>
      <div className="choices">{transitions[selectedOrder.status].map(next => <button disabled={busy} className={next === 'cancelled' ? 'secondary danger' : 'primary'} key={next} onClick={() => change(next)}>{next === 'cancelled' ? 'Annuler la commande' : next === 'returned' ? 'Confirmer le retour reçu' : `Marquer : ${statusLabels[next]}`}</button>)}</div>
    </div> : <>
      <div className="catalog-toolbar"><input placeholder="Nom ou téléphone…" aria-label="Rechercher une commande" value={search} onChange={event => { setSearch(event.target.value); setPage(1); setSelectedIds([]); }} /><select aria-label="Filtrer par statut" value={status} onChange={event => { setStatus(event.target.value); setPage(1); setSelectedIds([]); }}><option value="">Tous les statuts</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      {selectedIds.length > 0 && <div className="bulk-actions"><span>{selectedIds.length} commande(s) sélectionnée(s)</span><button className="secondary danger" disabled={busy} onClick={removeSelected}>{busy ? 'Suppression…' : 'Supprimer la sélection'}</button></div>}
      <div className="table-wrap"><table><thead><tr><th className="select-column"><input type="checkbox" aria-label="Sélectionner toutes les commandes de cette page" checked={allSelected} disabled={busy || !orders.length} onChange={() => setSelectedIds(allSelected ? [] : visibleIds)} /></th><th>Commande</th><th>Client</th><th>Wilaya</th><th>Total</th><th>Statut</th><th /></tr></thead><tbody>{orders.map(order => <tr key={order.id}><td className="select-column"><input type="checkbox" aria-label={`Sélectionner la commande ${order.id}`} checked={selectedIds.includes(order.id)} disabled={busy} onChange={() => toggle(order.id)} /></td><td>#{order.id}<small>{new Date(order.created_at).toLocaleDateString('fr-FR')}</small></td><td>{order.customer_name}<small>{order.phone}</small></td><td>{order.wilaya}</td><td>{money(order.total)}</td><td><span className={`badge ${order.status}`}>{statusLabels[order.status]}</span></td><td><button className="text-link" onClick={() => open(order.id)}>Voir <ArrowRight size={14} /></button></td></tr>)}</tbody></table></div>
      {!orders.length && <p className="empty">{busy ? 'Chargement…' : 'Aucune commande pour le moment.'}</p>}
      <div className="pagination"><button className="secondary" disabled={page === 1 || busy} onClick={() => setPage(value => value - 1)}>Précédent</button><span>Page {page}</span><button className="secondary" disabled={!more || busy} onClick={() => setPage(value => value + 1)}>Suivant</button></div>
    </>}
  </>;
}
