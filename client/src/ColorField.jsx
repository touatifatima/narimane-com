import { useId } from 'react';
import { colorValue, palette } from './colors';

export default function ColorField({ value, onChange, disabled = false }) {
  const id = useId();
  const color = colorValue(value);
  return <label className="color-field">Couleur
    <span className="color-field-control">
      <span className={`color-preview${color ? '' : ' unknown'}`} style={color ? { backgroundColor: color } : undefined} aria-hidden="true" />
      <input required maxLength={60} list={id} value={value} disabled={disabled} placeholder="Ex. : bleu marine" onChange={e => onChange(e.target.value)} />
    </span>
    <datalist id={id}>{palette.map(([name]) => <option key={name} value={name} />)}</datalist>
    {value.trim() && !color && <small className="color-field-hint">Couleur personnalisée : aperçu indisponible.</small>}
  </label>;
}
