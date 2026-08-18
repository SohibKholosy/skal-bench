import { avg, linreg } from "./math.js";

// Winland r35 (base-10, k in mD, porosity in percent, r35 in um) and Amaefule RQI/FZI.
export const rockTyping = (s, rows, fmtForCentrifuge) => {
      const cls = (r) => (r > 10 ? "megaport" : r > 2 ? "macroport" : r > 0.5 ? "mesoport" : r > 0.1 ? "microport" : "nanoport");
      const pts = rows.map((r, i) => {
        const phiPct = r.phi * 100;
        const r35W = Math.pow(10, 0.732 + 0.588 * Math.log10(r.k) - 0.864 * Math.log10(phiPct));
        const r35P = Math.pow(10, 0.255 + 0.565 * Math.log10(r.k) - 0.523 * Math.log10(phiPct));
        const RQI = 0.0314 * Math.sqrt(r.k / r.phi);
        const phiz = r.phi / (1 - r.phi);
        const FZI = phiz > 0 ? RQI / phiz : NaN;
        return { ...r, plug: i + 1, r35W, r35P, RQI, phiz, FZI, port: cls(r35W) };
      }).filter((x) => Number.isFinite(x.r35W) && Number.isFinite(x.FZI));
      const meanR35 = avg(pts.map((x) => x.r35W));
      const meanFZI = avg(pts.map((x) => x.FZI));
      // A single hydraulic flow unit plots as a straight line of unit slope on log RQI vs log phiz.
      const fit = linreg(pts.map((x) => Math.log10(x.phiz)), pts.map((x) => Math.log10(x.RQI)));
      const counts = {};
      pts.forEach((x) => { counts[x.port] = (counts[x.port] || 0) + 1; });
      const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      return {
        rows: pts,
        headline: { label: "Mean Winland r35 pore-throat radius", value: meanR35, unit: "µm" },
        alt: { label: `Mean FZI = ${fmtForCentrifuge(meanFZI, 3)} µm · dominant port class: ${dominant ? dominant[0] : "—"} (${dominant ? dominant[1] : 0}/${pts.length}) · RQI–φz slope ${fmtForCentrifuge(fit.slope, 2)} (≈1 means a single flow unit; scatter means several)`, value: meanFZI, unit: "µm" },
        r2: fit.r2,
        chart: { type: "xyfit", points: pts.map((x) => ({ x: Math.log10(x.phiz), y: Math.log10(x.RQI) })), fit, xLabel: "log₁₀ φz  (normalised porosity)", yLabel: "log₁₀ RQI (µm)" },
      };
    };


// Dataset-specific porosity-permeability regressions; coefficients are not transferable outside the fitted data.
export const fitPowerLaw = (pts, fmtForCentrifuge) => { const xs=pts.map(p=>Math.log(p.phi)), ys=pts.map(p=>Math.log(p.k)); const {slope,intercept,r2}=linreg(xs,ys); return {c1:slope,c0:Math.exp(intercept),r2,evalAt:(phi)=>Math.exp(intercept)*Math.pow(phi,slope),eq:`k = ${fmtForCentrifuge(Math.exp(intercept),3)} · phi^${fmtForCentrifuge(slope,3)}`}; };
export const fitExponential = (pts, fmtForCentrifuge) => { const xs=pts.map(p=>p.phi), ys=pts.map(p=>Math.log(p.k)); const {slope,intercept,r2}=linreg(xs,ys); return {a:intercept,b:slope,r2,evalAt:(phi)=>Math.exp(intercept+slope*phi),eq:`k = exp(${fmtForCentrifuge(intercept,3)} + ${fmtForCentrifuge(slope,3)}·phi)`}; };
