// Fixed brand order = fixed colour slot (colour follows the brand, never its rank).
export const BRANDS = [
  { code: 'SB', name: 'Shaadi Bells', slot: 1 },
  { code: '99M', name: '99 Marketing Services', slot: 2 },
  { code: '99S', name: '99 Staffing Services', slot: 3 },
  { code: 'PE', name: 'Property Experts Group', slot: 4 },
  { code: 'SC', name: 'Skyline Capital', slot: 5 },
];
export const brandVar = (code) => `var(--series-${(BRANDS.find((b) => b.code === code) || { slot: 1 }).slot})`;
