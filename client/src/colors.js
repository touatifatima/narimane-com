export const palette = [
  ['Noir', '#272724', 'black'], ['Blanc', '#ffffff', 'white'],
  ['Beige', '#d3c8b4', 'beige'], ['Écru', '#eee8d8', 'ecru'],
  ['Gris', '#aaa8a2', 'grey', 'gray'], ['Marron', '#775947', 'brown'],
  ['Bleu', '#526f8d', 'blue'], ['Bleu marine', '#293645', 'navy'],
  ['Bleu ciel', '#87ceeb', 'skyblue'], ['Vert', '#667260', 'green'],
  ['Olive', '#69715d', 'olive'], ['Kaki', '#85815b', 'khaki'],
  ['Rouge', '#c43d3d', 'red'], ['Bordeaux', '#800020', 'burgundy'],
  ['Rose', '#e8a0b5', 'pink'], ['Violet', '#8755a1', 'purple'],
  ['Lavande', '#b5a1d5', 'lavender'], ['Jaune', '#edcc4a', 'yellow'],
  ['Orange', '#e99140', 'orange'], ['Crème', '#fff3d6', 'cream'],
];
const normalize = value => value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
export function colorValue(value = '') {
  const normalized = normalize(value);
  const match = palette.find(([name, , ...aliases]) => [name, ...aliases].some(name => normalize(name) === normalized));
  if (match) return match[1];
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) return normalized;
  return null;
}
