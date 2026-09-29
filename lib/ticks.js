/** Clean axis: step from 1/2/5 x 10^n, about 4 ticks, whole numbers only. */
export function niceTicks(v) {
  v = Math.max(v, 1);
  const raw = v / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p;
  const step = Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p);
  const max = Math.ceil(v / step) * step, ticks = [];
  for (let t = 0; t <= max + 1e-9; t += step) ticks.push(Math.round(t));
  return { max, ticks };
}

