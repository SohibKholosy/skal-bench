import { linreg } from "./math.js";

// Waxman–Smits conductive-clay formation-factor implementation extracted from App.jsx for regression testing.
export const waxmanSmits = (s, rows, fmtForCentrifuge) => {
      const Cw = s.Rw > 0 ? 1 / s.Rw : NaN;
      const pts = rows.map((r) => {
        const Fstar = r.Ro * (Cw + s.B * r.Qv);  // intrinsic, clay-corrected
        const Farchie = s.Rw > 0 ? r.Ro / s.Rw : NaN; // apparent, uncorrected
        return { ...r, Fstar, Farchie, lx: Math.log10(r.phi), ly: Math.log10(Fstar), lyA: Math.log10(Farchie) };
      }).filter((x) => Number.isFinite(x.lx) && Number.isFinite(x.ly));
      const fit = linreg(pts.map((x) => x.lx), pts.map((x) => x.ly));
      const mStar = -fit.slope;
      const aStar = Math.pow(10, fit.intercept);
      const fitA = linreg(pts.map((x) => x.lx), pts.map((x) => x.lyA));
      const mApp = -fitA.slope;
      return {
        rows: pts,
        headline: { label: "Clay-corrected cementation exponent m*", value: mStar, unit: "—" },
        alt: { label: `a* = ${fmtForCentrifuge(aStar, 3)} · uncorrected (clean-Archie) m would be ${fmtForCentrifuge(mApp, 3)}, biased low by clay conductivity · ${pts.length} plugs`, value: aStar, unit: "—" },
        r2: fit.r2,
        chart: { type: "xyfit", points: pts.map((x) => ({ x: x.lx, y: x.ly })), fit, xLabel: "log₁₀ porosity", yLabel: "log₁₀ F* (clay-corrected)" },
      };
    };


// Archie/Winsauer formation-factor fit; Arps correction expects Celsius temperatures.
export const formationFactorFit = (s, rows, fmtForCentrifuge) => {
      // Arps (1953): Rw2 = Rw1·(T1 + 21.5)/(T2 + 21.5) with T in °C (the °F form uses 6.77).
      // Brine resistivity is strongly temperature-dependent, so Rw must be stated at the same
      // temperature as Ro before the formation factor is formed.
      const RwT = (Number.isFinite(s.RwTemp) && Number.isFinite(s.testTemp))
        ? s.Rw * (s.RwTemp + 21.5) / (s.testTemp + 21.5) : s.Rw;
      const pts = rows.map((r) => {
        const F = RwT > 0 ? r.Ro / RwT : NaN;
        return { ...r, F, lx: Math.log10(r.phi), ly: Math.log10(F) };
      }).filter((x) => Number.isFinite(x.lx) && Number.isFinite(x.ly));
      const fit = linreg(pts.map((x) => x.lx), pts.map((x) => x.ly));
      const m = -fit.slope;
      const a = Math.pow(10, fit.intercept);
      // Archie's original law fixes a = 1, i.e. the line is forced through (0,0) in log-log space.
      let sxy = 0, sxx = 0;
      for (const x of pts) { sxy += x.lx * x.ly; sxx += x.lx * x.lx; }
      const mArchie = sxx > 0 ? -(sxy / sxx) : NaN;
      const corrNote = Math.abs(RwT - s.Rw) > 1e-9 ? ` · Rw corrected ${fmtForCentrifuge(s.Rw, 4)}→${fmtForCentrifuge(RwT, 4)} Ω·m (Arps)` : "";
      return {
        rows: pts,
        headline: { label: "Cementation exponent m (free a)", value: m, unit: "—" },
        alt: { label: `a = ${fmtForCentrifuge(a, 3)} · Archie-constrained (a=1) m = ${fmtForCentrifuge(mArchie, 3)} · Humble a≈0.62, m≈2.15 · ${pts.length} plugs${corrNote}`, value: a, unit: "—" },
        r2: fit.r2,
        chart: { type: "xyfit", points: pts.map((x) => ({ x: x.lx, y: x.ly })), fit, xLabel: "log₁₀ porosity", yLabel: "log₁₀ formation factor" },
      };
    };


export const resistivityIndexFit = (s, rows, fmtForCentrifuge) => {
      const pts = rows.map((r) => {
        const IR = s.Ro > 0 ? r.Rt / s.Ro : NaN;
        return { ...r, IR, lx: Math.log10(r.Sw), ly: Math.log10(IR) };
      }).filter((x) => Number.isFinite(x.lx) && Number.isFinite(x.ly));
      // Physically IR = 1 at Sw = 1, so log IR vs log Sw must pass through the origin. The
      // constrained (through-origin) slope is the correct estimator; an unconstrained fit lets the
      // intercept float and biases n on noisy data. Both are reported so the offset is visible.
      let sxy = 0, sxx = 0;
      for (const x of pts) { sxy += x.lx * x.ly; sxx += x.lx * x.lx; }
      const nConstrained = sxx > 0 ? -(sxy / sxx) : NaN;
      const free = linreg(pts.map((x) => x.lx), pts.map((x) => x.ly));
      const nFree = -free.slope;
      // R² of the constrained model, computed about the origin-forced prediction.
      let ssRes = 0, ssTot = 0;
      for (const x of pts) { const pred = -nConstrained * x.lx; ssRes += (x.ly - pred) ** 2; ssTot += x.ly ** 2; }
      const r2c = ssTot > 0 ? 1 - ssRes / ssTot : 1;
      const fit = { slope: -nConstrained, intercept: 0, r2: r2c };
      return {
        rows: pts,
        headline: { label: "Saturation exponent n (constrained through IR=1 at Sw=1)", value: nConstrained, unit: "—" },
        alt: { label: `Unconstrained fit n = ${fmtForCentrifuge(nFree, 3)} (intercept ${fmtForCentrifuge(free.intercept, 3)}) — a large offset means noisy or non-Archie data · clean water-wet rock ≈ 2 · ${pts.length} steps`, value: nFree, unit: "—" },
        r2: r2c,
        chart: { type: "xyfit", points: pts.map((x) => ({ x: x.lx, y: x.ly })), fit, xLabel: "log₁₀ water saturation", yLabel: "log₁₀ resistivity index" },
      };
};
