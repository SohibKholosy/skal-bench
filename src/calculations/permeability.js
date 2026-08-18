import { areaFromDiameter, avg, linreg, linregOrigin, stdev } from "./math.js";

export const gasSteady = (s, rows) => {
  const A = areaFromDiameter(s.D);
  const pts = rows.map((r) => {
    const ka = 1000 * (2 * s.mu * s.L * r.P2 * r.Q) / (A * (r.P1 ** 2 - r.P2 ** 2));
    const Pm = (r.P1 + r.P2) / 2;
    return { ...r, A, ka, Pm, invPm: 1 / Pm };
  });
  const fit = linreg(pts.map((p) => p.invPm), pts.map((p) => p.ka));
  const kL = Math.max(0, fit.intercept);
  return {
    rows: pts,
    headline: { label: "Klinkenberg-corrected permeability (k∞)", value: kL, unit: "mD" },
    alt: { label: "Simple mean of apparent kₐ (uncorrected)", value: avg(pts.map((p) => p.ka)), unit: "mD" },
    fit, r2: fit.r2,
    chart: { type: "klinkenberg", data: pts, fit },
  };
};
export const gasSingle = (s, rows) => {
  const A = areaFromDiameter(s.D);
  const pts = rows.map((r, i) => {
    const ka = 1000 * (2 * s.mu * s.L * r.P2 * r.Q) / (A * (r.P1 ** 2 - r.P2 ** 2));
    return { ...r, A, ka, label: `Reading ${i + 1}` };
  });
  const mean = avg(pts.map((p) => p.ka));
  return {
    rows: pts,
    headline: { label: "Apparent gas permeability (mean)", value: mean, unit: "mD" },
    alt: pts.length > 1 ? { label: "Std. deviation across readings", value: stdev(pts.map((p) => p.ka)), unit: "mD" } : null,
    chart: { type: "bar", data: pts },
  };
};
export const pulseDecay = (s, rows) => {
  const A = areaFromDiameter(s.D);
  const pts = rows.map((r) => ({ ...r, lnDP: Math.log(r.dP) }));
  const fit = linreg(pts.map((p) => p.t), pts.map((p) => p.lnDP));
  const alpha = -fit.slope;
  const k = 1000 * alpha * s.mu * s.cf * s.L / (A * (1 / s.V1 + 1 / s.V2));
  return {
    rows: pts,
    headline: { label: "Pulse-decay permeability", value: k, unit: "mD" },
    alt: { label: "Decay constant α", value: alpha, unit: "1/s" },
    fit, r2: fit.r2,
    chart: { type: "decay", data: pts, fit },
  };
};
export const liquidCoreflood = (s, rows) => {
  const A = areaFromDiameter(s.D);
  const pts = rows.map((r) => ({ ...r, A, k: 1000 * r.Q * s.mu * s.L / (A * r.dP) }));
  const fitO = linregOrigin(pts.map((p) => p.dP), pts.map((p) => p.Q));
  const kFit = 1000 * fitO.slope * s.mu * s.L / A;
  const kMean = avg(pts.map((p) => p.k));
  return {
    rows: pts,
    headline: { label: "Best-fit permeability (origin regression)", value: kFit, unit: "mD" },
    alt: { label: "Simple mean of point permeabilities", value: kMean, unit: "mD" },
    fitOrigin: fitO, r2: fitO.r2,
    chart: { type: "coreflood", data: pts, fitOrigin: fitO, s },
  };
};
