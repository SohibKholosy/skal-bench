import { areaFromDiameter } from "./math.js";

export const relPermSteady = (s, rows, fmt) => {
      const A = areaFromDiameter(s.D);
      const pts = rows
        .map((r) => {
          const ko = 1000 * (r.Qo * s.muo * s.L) / (A * r.dP);
          const kw = 1000 * (r.Qw * s.muw * s.L) / (A * r.dP);
          return { ...r, ko, kw, kro: ko / s.kabs, krw: kw / s.kabs };
        })
        .sort((a, b) => a.Sw - b.Sw);

      let crossoverSw = NaN;
      for (let i = 0; i < pts.length - 1; i++) {
        const d1 = pts[i].kro - pts[i].krw;
        const d2 = pts[i + 1].kro - pts[i + 1].krw;
        if (d1 === 0) { crossoverSw = pts[i].Sw; break; }
        if ((d1 > 0) !== (d2 > 0)) {
          const t = d1 / (d1 - d2);
          crossoverSw = pts[i].Sw + t * (pts[i + 1].Sw - pts[i].Sw);
          break;
        }
      }
      const krwAtSor = pts[pts.length - 1]?.krw;

      return {
        rows: pts,
        headline: { label: "Water saturation at kro = krw (crossover)", value: crossoverSw, unit: "fraction" },
        alt: { label: `krw at Sw=${fmt(pts[pts.length - 1]?.Sw, 3)} (highest Sw tested, ≈ residual-oil endpoint)`, value: krwAtSor, unit: "fraction" },
        chart: { type: "relperm", data: pts },
      };
};

// Johnson–Bossler–Naumann unsteady-state relative-permeability reduction.
export const relPermJBN = (s, rows, fmtForCentrifuge) => {
      const withQi = rows.filter((r) => r.QiD > 0).sort((a, b) => a.QiD - b.QiD);
      const pts0 = withQi.map((r) => {
        const NpD = r.Np / s.Vp;
        const IR = s.dP0 / r.dP;
        return { ...r, NpD, IR, x: 1 / r.QiD, y: 1 / (r.QiD * IR) };
      });
      // Savitzky–Golay quadratic smoother, 5-point window (coefficients [-3,12,17,12,-3]/35).
      // JBN takes two numerical derivatives of the production and pressure data, so raw scatter is
      // strongly amplified — especially just after breakthrough. Smoothing the monotone series NpD
      // and y before differentiating is the standard remedy (Savitzky & Golay, 1964, Anal. Chem.
      // 36(8), 1627–1639); endpoints are left untouched. Set the window to 0 to disable.
      if (s.smooth >= 5 && pts0.length >= 5) {
        const sg = (arr) => {
          const out = arr.slice();
          for (let i = 2; i < arr.length - 2; i++) {
            out[i] = (-3 * arr[i - 2] + 12 * arr[i - 1] + 17 * arr[i] + 12 * arr[i + 1] - 3 * arr[i + 2]) / 35;
          }
          return out;
        };
        const sNpD = sg(pts0.map((p) => p.NpD));
        const sY = sg(pts0.map((p) => p.y));
        pts0.forEach((p, i) => { p.NpD = sNpD[i]; p.y = sY[i]; });
      }
      const n = pts0.length;
      const derived = pts0.map((p, i) => {
        const prev = pts0[Math.max(0, i - 1)];
        const next = pts0[Math.min(n - 1, i + 1)];
        const dNpD = next.NpD - prev.NpD;
        const dQiD = next.QiD - prev.QiD;
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const fo = dQiD !== 0 ? dNpD / dQiD : NaN;
        const slope = dy !== 0 ? dx / dy : NaN;
        const kro = fo * slope;
        const krw = (1 - fo) * slope;
        const Sw2 = s.Swi + p.NpD - p.QiD * fo;
        return { ...p, fo, slope, kro, krw, Sw2 };
      });
      const clean = derived
        .filter((p) => Number.isFinite(p.kro) && Number.isFinite(p.krw) && Number.isFinite(p.Sw2) && p.kro >= 0 && p.krw >= 0 && p.Sw2 >= 0 && p.Sw2 <= 1)
        .sort((a, b) => a.Sw2 - b.Sw2);

      let crossoverSw = NaN;
      for (let i = 0; i < clean.length - 1; i++) {
        const d1 = clean[i].kro - clean[i].krw;
        const d2 = clean[i + 1].kro - clean[i + 1].krw;
        if (d1 === 0) { crossoverSw = clean[i].Sw2; break; }
        if ((d1 > 0) !== (d2 > 0)) {
          const t = d1 / (d1 - d2);
          crossoverSw = clean[i].Sw2 + t * (clean[i + 1].Sw2 - clean[i].Sw2);
          break;
        }
      }
      const krwAtEnd = clean[clean.length - 1]?.krw;

      return {
        rows: clean,
        headline: { label: "Water saturation at kro = krw (crossover)", value: crossoverSw, unit: "fraction" },
        alt: { label: `${clean.length} of ${n} points physically valid; krw at Sw=${fmtForCentrifuge(clean[clean.length - 1]?.Sw2, 3)}`, value: krwAtEnd, unit: "fraction" },
        chart: { type: "relperm", data: clean.map((p) => ({ Sw: p.Sw2, kro: p.kro, krw: p.krw })) },
      };
    };


// Corey-type endpoint prediction, retaining the application convention: kro is normalized to Kro@Swi.
export const coreyPredict = (v, colors) => {
  const { Swi, Sor, KroSwi, KrwSor, lambdaKro, lambdaKrw, muo, muw } = v;
  const krwMaxRatioRaw = KrwSor / KroSwi;
  const krwClipped = krwMaxRatioRaw > 1;
  const krwMaxRatio = Math.min(1, krwMaxRatioRaw);
  const span = 1 - Swi - Sor;
  const n = 50;
  const table = [];
  for (let i = 0; i < n; i++) {
    const Se = i / (n - 1);
    const Sw = Swi + Se * span;
    const kro = Math.pow(1 - Se, lambdaKro);
    const krw = krwMaxRatio * Math.pow(Se, lambdaKrw);
    const lw = krw / muw, lo = kro / muo;
    const fw = lw + lo > 0 ? lw / (lw + lo) : 0;
    table.push({ Sw, Se, kro, krw, fw });
  }

  let crossoverSw = NaN, crossoverK = NaN;
  for (let i = 0; i < table.length - 1; i++) {
    const d1 = table[i].kro - table[i].krw, d2 = table[i + 1].kro - table[i + 1].krw;
    if (d1 === 0) { crossoverSw = table[i].Sw; crossoverK = table[i].kro; break; }
    if ((d1 > 0) !== (d2 > 0)) {
      const t = d1 / (d1 - d2);
      crossoverSw = table[i].Sw + t * (table[i + 1].Sw - table[i].Sw);
      crossoverK = table[i].kro + t * (table[i + 1].kro - table[i].kro);
      break;
    }
  }

  let best = { slope: -Infinity, idx: -1 };
  table.forEach((p, i) => { if (p.Sw > Swi) { const m = p.fw / (p.Sw - Swi); if (m > best.slope) best = { slope: m, idx: i }; } });
  const front = table[best.idx] || { Sw: Swi, fw: 0 };
  const swMax = 1 - Sor;
  const swAtFw1 = best.slope > 0 ? Swi + 1 / best.slope : swMax;
  const tangentEndSw = Math.min(swMax, swAtFw1);
  const tangent = [{ Sw: Swi, fw: 0 }, { Sw: tangentEndSw, fw: best.slope * (tangentEndSw - Swi) }];
  const swBreakthrough = Math.min(swMax, swAtFw1);

  // Craig's rule 1: krw at Sor, normalized to kro at Swi (Craig's own reference convention)
  const krwSorNorm = krwMaxRatioRaw;
  let score = 0;
  if (krwSorNorm < 0.3) score += krwSorNorm < 0.15 ? 2 : 1;
  else if (krwSorNorm > 0.5) score -= krwSorNorm > 0.75 ? 2 : 1;
  // Craig's rule 2: crossover saturation vs 50%
  if (Number.isFinite(crossoverSw)) {
    if (crossoverSw > 0.5) score += crossoverSw > 0.65 ? 2 : 1;
    else score -= crossoverSw < 0.35 ? 2 : 1;
  }
  // Craig's rule 3: connate water saturation (half weight — flagged less reliable in the literature)
  if (Swi > 0.20) score += 0.5;
  else if (Swi < 0.15) score -= 0.5;

  let label, color;
  if (score >= 4) { label = "Strongly water-wet"; color = colors.teal; }
  else if (score >= 2) { label = "Moderately water-wet"; color = colors.teal; }
  else if (score >= 0.5) { label = "Weakly water-wet"; color = colors.teal; }
  else if (score > -0.5) { label = "Neutral / mixed-wet signals"; color = colors.amber; }
  else if (score > -2) { label = "Weakly oil-wet"; color = colors.clay; }
  else if (score > -4) { label = "Moderately oil-wet"; color = colors.clay; }
  else { label = "Strongly oil-wet"; color = colors.clay; }

  return {
    table, crossoverSw, crossoverK, front, tangent, swBreakthrough,
    krwSorNorm, score, label, color, krwClipped,
    rule1: krwSorNorm < 0.3 ? "water-wet" : krwSorNorm > 0.5 ? "oil-wet" : "ambiguous",
    rule2: Number.isFinite(crossoverSw) ? (crossoverSw > 0.5 ? "water-wet" : "oil-wet") : "n/a",
    rule3: Swi > 0.20 ? "water-wet" : Swi < 0.15 ? "oil-wet" : "ambiguous",
  };
}


