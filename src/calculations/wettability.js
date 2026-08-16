import { avg } from "./math.js";

export const amottUsbm = (s, rows, fmt) => {
      const pts = rows.map((r, i) => {
        const dw = r.Vwt > 0 ? r.Vwsp / r.Vwt : 0;
        const doo = r.Vot > 0 ? r.Vosp / r.Vot : 0;
        const Iah = dw - doo;
        const usbm = r.A1 > 0 && r.A2 > 0 ? Math.log10(r.A1 / r.A2) : NaN;
        return { ...r, sample: i + 1, dw, doo, Iah, usbm };
      }).filter((x) => Number.isFinite(x.Iah));
      const meanIah = avg(pts.map((x) => x.Iah));
      const cls = meanIah >= 0.3 ? "water-wet" : meanIah <= -0.3 ? "oil-wet" : "intermediate / neutral-wet";
      const usbmVals = pts.map((x) => x.usbm).filter(Number.isFinite);
      const usbmMean = usbmVals.length ? avg(usbmVals) : NaN;
      return {
        rows: pts,
        headline: { label: "Amott–Harvey index (mean)", value: meanIah, unit: "—" },
        alt: { label: `${cls}${usbmVals.length ? ` · USBM W = ${fmt(usbmMean, 3)}` : ""} · ${pts.length} sample(s)`, value: usbmVals.length ? usbmMean : meanIah, unit: "—" },
        chart: { type: "xyfit", points: pts.map((x) => ({ x: x.sample, y: x.Iah })), connect: false, xLabel: "Sample #", yLabel: "Amott–Harvey index" },
      };
};

/* ============================== CONTACT ANGLE (SESSILE DROP) ============================== */
/* Contact angle is defined, per Young's equation, as the angle measured through the liquid at the
 * three-phase (solid-liquid-vapor) contact line. This tool implements the classical manual tangent-line
 * (goniometric) method: the user marks the solid surface baseline and two points along each side of the
 * drop profile near the contact line; the angle between each tangent and the baseline is the contact angle.
 * This is a real, textbook method — distinct from (and simpler than) automated axisymmetric drop-shape
 * analysis (ADSA) or B-spline snake fitting (e.g. the EPFL Drop Analysis tool), which require edge-detection
 * and energy-minimization image processing beyond what a lightweight browser tool can reliably reproduce.
 * Accuracy here depends on careful, consistent point placement — zoom in before clicking.
 *
 * Wettability classification: combined Chilingar, G.V. & Yen, T.F. (1983), "Some Notes on Wettability and
 * Relative Permeabilities of Carbonate Reservoir Rocks, II," Energy Sources 7(1), 67–75, and Morrow, N.R.
 * (1990), "Wettability and Its Effect on Oil Recovery," JPT 42(12), 1476–1484 — a seven-band scale widely
 * reproduced in the SCAL literature. */
const CA_BANDS = [
  { max: 20, label: "Strongly water-wet", color: null },
  { max: 62, label: "Water-wet", color: null },
  { max: 80, label: "Slightly water-wet", color: null },
  { max: 100, label: "Neutral-wet", color: null },
  { max: 133, label: "Slightly oil-wet", color: null },
  { max: 160, label: "Oil-wet", color: null },
  { max: 181, label: "Strongly oil-wet", color: null },
];
function classifyContactAngle(theta) {
  for (const b of CA_BANDS) if (theta <= b.max) return b.label;
  return "Strongly oil-wet";
}
/* Drop-fluid setups. The tangent construction measures the angle through the drop/bubble phase
 * (θ_drop). The wettability bands above are defined on the angle through the water/brine phase
 * (θ_water), so θ_water = θ_drop for a water/brine drop and θ_water = 180° − θ_drop for an oil drop
 * or an air/gas (captive) bubble — the external/supplementary angle (Young, T., 1805; convention per
 * Craig, F.F. (1971), "The Reservoir Engineering Aspects of Waterflooding," SPE Monograph 3, and
 * Anderson, W.G. (1986), "Wettability Literature Survey — Part 2," JPT 38(11), 1246–1262). The
 * hydrophilic/hydrophobic split is the surface-science 90° rule applied to θ_water. */
export const CA_SETUPS = [
  { k: "water_air", l: "Water / brine drop — in air", geo: "sessile", dropIsWater: true },
  { k: "water_oil", l: "Water / brine drop — under oil", geo: "sessile", dropIsWater: true },
  { k: "oil_air", l: "Oil drop — in air", geo: "sessile", dropIsWater: false },
  { k: "oil_water", l: "Oil drop — under brine / water", geo: "sessile", dropIsWater: false },
  { k: "captive", l: "Air / gas bubble — under water (captive)", geo: "captive", dropIsWater: false },
];
export const caSetup = (k) => CA_SETUPS.find((x) => x.k === k) || CA_SETUPS[0];
function classifySurface(thetaWater) {
  if (thetaWater < 90) return "hydrophilic (water-wet surface)";
  if (thetaWater > 90) return "hydrophobic (oil-wet surface)";
  return "neutral (θ ≈ 90°)";
}

function angleBetween(v1, v2) {
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m1 = Math.hypot(v1.x, v1.y), m2 = Math.hypot(v2.x, v2.y);
  if (m1 === 0 || m2 === 0) return NaN;
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}
function lineIntersect(p1, p2, p3, p4) {
  const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(denom) < 1e-9) return null;
  const a = p1.x * p2.y - p1.y * p2.x, b = p3.x * p4.y - p3.y * p4.x;
  return {
    x: (a * (p3.x - p4.x) - (p1.x - p2.x) * b) / denom,
    y: (a * (p3.y - p4.y) - (p1.y - p2.y) * b) / denom,
  };
}


export const contactAngle = (points, mode) => {
    if (points.baseline.length < 2 || points.left.length < 2 || points.right.length < 2) return null;
    const [b1, b2] = points.baseline;
    const baselineDir = b2.x >= b1.x ? { x: b2.x - b1.x, y: b2.y - b1.y } : { x: b1.x - b2.x, y: b1.y - b2.y };
    const [l1, l2] = points.left;
    const leftTangent = { x: l2.x - l1.x, y: l2.y - l1.y };
    const [r1, r2] = points.right;
    const rightTangent = { x: r2.x - r1.x, y: r2.y - r1.y };
    const rawLeft = angleBetween(baselineDir, leftTangent);
    const rawRight = angleBetween({ x: -baselineDir.x, y: -baselineDir.y }, rightTangent);
    // The tangent construction measures the angle through the drop/bubble phase (θ_drop). Wettability
    // bands are defined on the angle through the water phase, so θ_water = θ_drop for a water/brine drop
    // and θ_water = 180° − θ_drop for an oil drop or an air/gas (captive) bubble (see CA_SETUPS note).
    const rawAvg = (rawLeft + rawRight) / 2;
    const setup = caSetup(mode);
    const thetaWater = setup.dropIsWater ? rawAvg : 180 - rawAvg;
    const leftContact = lineIntersect(b1, b2, l1, l2) || l1;
    const rightContact = lineIntersect(b1, b2, r1, r2) || r1;
    return { leftAngle: rawLeft, rightAngle: rawRight, rawAvg, thetaWater, leftContact, rightContact, label: classifyContactAngle(thetaWater), surface: classifySurface(thetaWater), setup };
};
