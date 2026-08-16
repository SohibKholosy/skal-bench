export const areaFromDiameter = (D) => (Math.PI * D * D) / 4;
export const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export const stdev = (a) => {
  if (a.length < 2) return 0;
  const m = avg(a);
  return Math.sqrt(avg(a.map((x) => (x - m) ** 2)));
};
export const linreg = (xs, ys) => {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, r2: 0 };
  const mx = avg(xs);
  const my = avg(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const p = slope * xs[i] + intercept;
    ssRes += (ys[i] - p) ** 2;
    ssTot += (ys[i] - my) ** 2;
  }
  return { slope, intercept, r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot };
};
export const linregOrigin = (xs, ys) => {
  const n = xs.length;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumXY += xs[i] * ys[i];
    sumXX += xs[i] * xs[i];
  }
  const slope = sumXX === 0 ? 0 : sumXY / sumXX;
  const my = avg(ys);
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const p = slope * xs[i];
    ssRes += (ys[i] - p) ** 2;
    ssTot += (ys[i] - my) ** 2;
  }
  return { slope, r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot };
};
