const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export async function api(path, { token, body, headers, ...options } = {}) {
  const multipart = body instanceof FormData;
  const response = await fetch(`${base}/api${path}`, {
    ...options,
    headers: { ...(body === undefined || multipart ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }),
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error || 'Le serveur est indisponible. Réessayez dans un instant.');
    error.status = response.status;
    throw error;
  }
  return data;
}
export const imageUrl = url => url?.startsWith('/api/') ? `${base}${url}` : url;
export const money = value => `${new Intl.NumberFormat('fr-DZ', { maximumFractionDigits: 2 }).format(Number(value || 0))} DA`;
export const statusLabels = { new: 'Nouvelle', confirmed: 'Confirmée', shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée', returned: 'Retournée' };

