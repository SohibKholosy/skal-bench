import { linreg } from "./math.js";

// Empirical log-linear stress-sensitivity fit: c has inverse units of the supplied stress.
export const stressDependence = (s, rows, fmtForCentrifuge) => {
      const pts = rows.map((r) => ({ ...r, lk: Math.log(r.k) }))
        .filter((x) => Number.isFinite(x.lk) && Number.isFinite(x.sigma))
        .sort((a, b) => a.sigma - b.sigma);
      const fit = linreg(pts.map((x) => x.sigma), pts.map((x) => x.lk));
      const c = -fit.slope;                 // 1/psi
      const k0 = Math.exp(fit.intercept);   // extrapolated to zero net stress
      const kRes = k0 * Math.exp(-c * s.sigmaRes);
      const kAmb = pts.length ? pts[0].k : NaN;
      const retained = Number.isFinite(kAmb) && kAmb > 0 ? (kRes / kAmb) * 100 : NaN;
      return {
        rows: pts,
        headline: { label: `Permeability at ${fmtForCentrifuge(s.sigmaRes, 0)} psi net stress`, value: kRes, unit: "mD" },
        alt: { label: `Stress sensitivity c = ${(c * 1000).toFixed(4)} per 1000 psi · k₀ (zero stress) = ${fmtForCentrifuge(k0, 2)} mD · retains ${fmtForCentrifuge(retained, 1)}% of the lowest-stress value · ${pts.length} steps`, value: c, unit: "1/psi" },
        r2: fit.r2,
        chart: { type: "xyfit", points: pts.map((x) => ({ x: x.sigma, y: x.lk })), fit, xLabel: "Net confining stress (psi)", yLabel: "ln k (mD)" },
      };
    };


