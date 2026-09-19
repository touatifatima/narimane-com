import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { imageUrl, money } from './api';

export default function OrderItem({ item }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [item.image_url]);
  return <div className="admin-order-item">
    <div className="admin-order-photo">
      {item.image_url && !failed
        ? <a href={imageUrl(item.image_url)} target="_blank" rel="noopener noreferrer" aria-label={`Agrandir la photo de ${item.product_name}`}><img src={imageUrl(item.image_url)} alt={item.product_name} onError={() => setFailed(true)} /></a>
        : <span className="image-placeholder"><Package size={22} /><small>Sans photo</small></span>}
    </div>
    <div><b>{item.product_name}</b><small>{item.size} / {item.color}</small><small>Quantité : {item.quantity}</small></div>
    <strong>{money(item.line_total)}</strong>
  </div>;
}
