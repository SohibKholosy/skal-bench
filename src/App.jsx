import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ComposedChart, Scatter, Line, Bar, BarChart, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceDot, ReferenceLine,
} from "recharts";
import * as XLSX from "xlsx";
import { calculationFunctions } from "./calculations/index.js";
import {
  Wind, Droplets, Activity, Beaker, ArrowLeft, Download, Upload, Plus, Trash2,
  Lock, CheckCircle2, AlertCircle, Loader2, FlaskConical, ChevronRight,
  Menu, X as CloseIcon, Sun, Moon,
  Calculator as CalcIcon, Layers, Zap, GitBranch, TrendingUp, Waves,
  Image as ImageIcon, ZoomIn, ZoomOut, Undo2, RotateCcw, Crop as CropIcon,
  Ruler, Copy, Scale, FileText, RefreshCw,
} from "lucide-react";

/* ============================== DESIGN TOKENS ============================== */
/* ---------- Palettes ----------
 * Accent colours (rust, amber, teal, clay, blue, moss, plum, cyan, danger, good, slate) are
 * deliberately IDENTICAL in both themes. They are the brand, they read acceptably on both light and
 * dark grounds, and — importantly — a few of them are captured outside the render path (the MICP
 * print-colour map and one chart useMemo). Holding them constant means those cannot go stale when
 * the theme changes. Only the neutrals and the soft accent washes are swapped.
 * C is a single mutable object so that all ~1100 existing `C.x` reads keep working untouched;
 * applyTheme() rewrites it in place and the App then re-renders, recomputing every inline style. */
const ACCENTS = {
  rust: "#BE7530", amber: "#C9A227", teal: "#5CA79E", clay: "#A85C46",
  blue: "#5C86A6", moss: "#8A9A63", plum: "#9A6B8C", cyan: "#4C9AA8",
  slate: "#6E7681", danger: "#C15B4A", good: "#6FA37A",
};
const PALETTES = {
  dark: {
    ...ACCENTS,
    bg: "#1B1D20", bgSoft: "#202226", panel: "#24272B", panel2: "#2B2E33",
    border: "#383C42", borderSoft: "#2F3237",
    text: "#EDEAE4", textDim: "#A5A6A4", textFaint: "#75767a",
    rustSoft: "#3A2C1D", amberSoft: "#332C16", tealSoft: "#1C2C2A", claySoft: "#2E211D",
    blueSoft: "#1B2833", mossSoft: "#232A1B", plumSoft: "#2A1F27", cyanSoft: "#1A2A2C",
    overlay: "rgba(0,0,0,0.55)", headerBg: "rgba(27,29,32,0.92)",
  },
  light: {
    ...ACCENTS,
    bg: "#FAF9F7", bgSoft: "#F1EFEA", panel: "#FFFFFF", panel2: "#F6F4F0",
    border: "#D9D4CB", borderSoft: "#E7E3DB",
    text: "#1C2733", textDim: "#4C535B", textFaint: "#7C838B",
    rustSoft: "#F7EADD", amberSoft: "#F8F1D9", tealSoft: "#E2F0ED", claySoft: "#F8E8E3",
    blueSoft: "#E5EDF4", mossSoft: "#EEF2E3", plumSoft: "#F3E9F0", cyanSoft: "#E2EFF1",
    overlay: "rgba(28,39,51,0.38)", headerBg: "rgba(250,249,247,0.92)",
  },
};
const C = { ...PALETTES.dark };

/* ---------- Release identity ----------
 * Semantic versioning: MAJOR.MINOR.PATCH. Bump PATCH for a fix that changes no results, MINOR when
 * a module or feature is added, MAJOR if a calculation's output changes such that an earlier result
 * would no longer reproduce. That last rule is the one that matters for a scientific tool: a user
 * quoting a number from this software needs to be able to say which version produced it. */
const APP_VERSION = "1.0.9";
const APP_RELEASED = "August 2026";
/* Citation string, assembled from the version constants so it can never quote a stale version.
 * APP_URL should become the live address once deployed — until then the citation still resolves
 * because the software name and version identify the release unambiguously. */
const APP_URL = "https://doi.org/10.5281/zenodo.21763629"; // <-- update after deploying DONE
const citationText = () =>
  `Kholosy, S. (${APP_RELEASED.split(" ")[1]}). SKAL Bench: Routine and Special Core Analysis ` +
  `(Version ${APP_VERSION}) [Computer software]. ${APP_URL}`;
/* BibTeX for LaTeX users. @software is the correct entry type in modern biblatex; the title is
   brace-protected so BibTeX does not lowercase "SKAL Bench" under a title-case style. */
const citationBibtex = () => {
  const year = APP_RELEASED.split(" ")[1];
  return [
    `@software{kholosy_skalbench_${year},`,
    `  author  = {Kholosy, Sohaib},`,
    `  title   = {{SKAL Bench: Routine and Special Core Analysis}},`,
    `  year    = {${year}},`,
    `  version = {${APP_VERSION}},`,
    `  url     = {${APP_URL}},`,
    `  note    = {Computer software}`,
    `}`,
  ].join("\n");
};
function applyTheme(name) {
  Object.assign(C, PALETTES[name] || PALETTES.dark);
}
const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
`;
const fDisplay = { fontFamily: "'Space Grotesk', sans-serif" };
const fBody = { fontFamily: "'Inter', sans-serif" };
const fMono = { fontFamily: "'JetBrains Mono', monospace" };

/* ============================== MATH HELPERS ============================== */
function linreg(xs, ys) {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, r2: 0 };
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) { const p = slope * xs[i] + intercept; ssRes += (ys[i] - p) ** 2; ssTot += (ys[i] - my) ** 2; }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}
function linregOrigin(xs, ys) {
  const n = xs.length;
  let sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) { sumXY += xs[i] * ys[i]; sumXX += xs[i] * xs[i]; }
  const slope = sumXX === 0 ? 0 : sumXY / sumXX;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) { const p = slope * xs[i]; ssRes += (ys[i] - p) ** 2; ssTot += (ys[i] - my) ** 2; }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { slope, r2 };
}
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const stdev = (a) => { if (a.length < 2) return 0; const m = avg(a); return Math.sqrt(avg(a.map((x) => (x - m) ** 2))); };
const fmt = (n, d = 3) => (Number.isFinite(n) ? n.toFixed(d) : "—");
const refNote = (ref) => (ref ? `Default per: ${ref}` : undefined);
const UNIT_HELP = {
  "cm": "Centimeters — length",
  "cm²": "Square centimeters — cross-sectional area",
  "cm³": "Cubic centimeters (cc) — volume",
  "cm³/s": "Cubic centimeters per second — volumetric flow rate",
  "g": "Grams — mass",
  "g/cm³": "Grams per cubic centimeter — density",
  "mD": "Millidarcies — permeability",
  "cp": "Centipoise — dynamic viscosity",
  "atm": "Atmospheres — pressure",
  "psi": "Pounds per square inch — pressure",
  "fraction": "Expressed as a decimal fraction of 1 (not a percentage)",
  "1/atm": "Inverse atmospheres — compressibility",
  "1/s": "Inverse seconds — rate constant",
  "s": "Seconds — elapsed time",
  "Ω·m": "Ohm-meters — electrical resistivity",
  "—": "Dimensionless",
};
const unitHelp = (unit) => UNIT_HELP[unit] || unit;
const areaFromDiameter = (D) => (Math.PI * D * D) / 4;
const uid = () => `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/* ============================== MODULE DEFINITIONS ============================== */
const MODULES = [
  {
    id: "gasSteady",
    category: "Permeability",
    name: "Steady-State Gas Permeameter",
    short: "Multi-pressure gas flow, Klinkenberg-corrected",
    icon: Wind,
    color: C.rust,
    soft: C.rustSoft,
    formula: "kₐ = 1000 · (2·μ·L·P₂·Q) / (A·(P₁²−P₂²))   →   fit kₐ vs 1/Pm,  k∞ = intercept",
    blurb:
      "Run the plug at three or more mean pore pressures and record the upstream/downstream pressure and flow rate at each one. The console fits apparent permeability against 1/mean-pressure and extrapolates to infinite pressure to remove gas-slippage (Klinkenberg) effects.",
    needs: [
      "Plug length and diameter",
      "Gas viscosity used (N₂ or air)",
      "At least 3 pressure/flow runs per plug, spanning a wide pressure range",
    ],
    sampleFields: [
      { key: "L", label: "Plug length", unit: "cm", default: 5 },
      { key: "D", label: "Plug diameter", unit: "cm", default: 3.8 },
      { key: "mu", label: "Gas viscosity", unit: "cp", default: 0.0185, ref: "Air / N₂ at ~20°C, core-analysis reference tables" },
    ],
    rowFields: [
      { key: "P1", label: "Upstream pressure P₁", unit: "atm" },
      { key: "P2", label: "Downstream pressure P₂", unit: "atm" },
      { key: "Q", label: "Flow rate at P₂", unit: "cm³/s" },
    ],
    minRows: 3,
    calc: calculationFunctions.gasSteady,
  },
  {
    id: "gasSingle",
    category: "Permeability",
    name: "Single-Point Gas Permeability",
    short: "One pressure/flow reading per plug",
    icon: FlaskConical,
    color: C.clay,
    soft: C.claySoft,
    formula: "kₐ = 1000 · (2·μ·L·P₂·Q) / (A·(P₁²−P₂²))",
    blurb:
      "Quick screening measurement at a single mean pressure. No Klinkenberg correction is applied — use the Steady-State module if you need the gas-slip-free value. Enter replicate readings if you took more than one.",
    needs: ["Plug length and diameter", "Gas viscosity used", "One or more P₁/P₂/Q readings"],
    sampleFields: [
      { key: "L", label: "Plug length", unit: "cm", default: 5 },
      { key: "D", label: "Plug diameter", unit: "cm", default: 3.8 },
      { key: "mu", label: "Gas viscosity", unit: "cp", default: 0.0185, ref: "Air / N₂ at ~20°C, core-analysis reference tables" },
    ],
    rowFields: [
      { key: "P1", label: "Upstream pressure P₁", unit: "atm" },
      { key: "P2", label: "Downstream pressure P₂", unit: "atm" },
      { key: "Q", label: "Flow rate at P₂", unit: "cm³/s" },
    ],
    minRows: 1,
    calc: calculationFunctions.gasSingle,
  },
  {
    id: "pulseDecay",
    category: "Permeability",
    name: "Pulse-Decay (Unsteady-State)",
    short: "Low-permeability plugs via pressure decay",
    icon: Activity,
    color: C.amber,
    soft: C.amberSoft,
    formula: "α = −slope[ln ΔP vs t]   →   k = 1000 · α·μ·cf·L / (A·(1/V₁+1/V₂))",
    blurb:
      "For tight/low-permeability plugs. A pressure pulse is applied between upstream and downstream reservoirs and the differential pressure decays exponentially over time. The console fits ln(ΔP) against time to get the decay constant and back-calculates permeability.",
    needs: [
      "Plug length and diameter",
      "Fluid viscosity and system compressibility",
      "Upstream and downstream reservoir volumes",
      "A time series of ΔP as the pulse decays (4+ points)",
    ],
    sampleFields: [
      { key: "L", label: "Plug length", unit: "cm", default: 5 },
      { key: "D", label: "Plug diameter", unit: "cm", default: 3.8 },
      { key: "mu", label: "Fluid viscosity", unit: "cp", default: 0.0185, ref: "Air / N₂ at ~20°C, core-analysis reference tables" },
      { key: "cf", label: "System compressibility", unit: "1/atm", default: 0.0001 },
      { key: "V1", label: "Upstream reservoir volume", unit: "cm³", default: 20 },
      { key: "V2", label: "Downstream reservoir volume", unit: "cm³", default: 20 },
    ],
    rowFields: [
      { key: "t", label: "Elapsed time", unit: "s" },
      { key: "dP", label: "Differential pressure ΔP", unit: "atm" },
    ],
    minRows: 4,
    calc: calculationFunctions.pulseDecay,
  },
  {
    id: "liquidCoreflood",
    category: "Permeability",
    name: "Baseline Liquid (Water) Permeability",
    short: "Coreflood, Darcy steady-state liquid flow",
    icon: Droplets,
    color: C.teal,
    soft: C.tealSoft,
    formula: "k = 1000 · Q·μ·L / (A·ΔP)   —   best fit: forced-origin regression of Q vs ΔP",
    blurb:
      "Baseline brine/water permeability from your coreflood rig. Enter one or more flow-rate/pressure-drop pairs (ideally at 2-3 rates) — the console reports both a simple average and a best-fit permeability from a forced-through-origin regression of flow rate against pressure drop.",
    needs: ["Plug length and diameter", "Fluid (brine) viscosity", "One or more Q/ΔP steady-state readings"],
    sampleFields: [
      { key: "L", label: "Plug length", unit: "cm", default: 5 },
      { key: "D", label: "Plug diameter", unit: "cm", default: 3.8 },
      { key: "mu", label: "Fluid viscosity", unit: "cp", default: 1.0, ref: "Fresh water at ~20°C" },
    ],
    rowFields: [
      { key: "Q", label: "Flow rate", unit: "cm³/s" },
      { key: "dP", label: "Pressure drop ΔP", unit: "atm" },
    ],
    minRows: 1,
    calc: calculationFunctions.liquidCoreflood,
  },
  {
    id: "relPermSteady",
    category: "Relative Permeability",
    hidden: true,
    name: "Relative Permeability (Steady-State)",
    short: "Two-phase oil-water kro/krw curves",
    icon: GitBranch,
    color: C.moss,
    soft: C.mossSoft,
    formula: "kro = 1000·Qo·μo·L / (A·ΔP·k_abs)    krw = 1000·Qw·μw·L / (A·ΔP·k_abs)",
    blurb:
      "At each fixed oil:water injection ratio, hold flow until the pressure drop stabilizes, then record the water saturation in the plug and the stabilized differential pressure. The console converts each step's phase flow rates into effective permeabilities, normalizes by the absolute (100%-saturated) permeability from a prior baseline test, and plots the kro/krw curves against water saturation.",
    needs: [
      "Plug length, diameter, and absolute permeability (from a prior baseline permeability test)",
      "Oil and water/brine viscosities at test conditions",
      "At least 5 steady-state points spanning the saturation range: water saturation, oil flow rate, water flow rate, and stabilized ΔP at each",
    ],
    sampleFields: [
      { key: "L", label: "Plug length", unit: "cm", default: 5 },
      { key: "D", label: "Plug diameter", unit: "cm", default: 3.8 },
      { key: "kabs", label: "Absolute permeability (base)", unit: "mD", default: 100 },
      { key: "muo", label: "Oil viscosity", unit: "cp", default: 2.0, ref: "Typical dead oil at reservoir temperature" },
      { key: "muw", label: "Water/brine viscosity", unit: "cp", default: 1.0, ref: "Fresh water at ~20°C" },
    ],
    rowFields: [
      { key: "Sw", label: "Water saturation", unit: "fraction" },
      { key: "Qo", label: "Oil flow rate", unit: "cm³/s" },
      { key: "Qw", label: "Water flow rate", unit: "cm³/s" },
      { key: "dP", label: "Stabilized pressure drop ΔP", unit: "atm" },
    ],
    minRows: 5,
    calc: calculationFunctions.relPermSteady,
  },
  {
    id: "relPermJBN",
    category: "Relative Permeability",
    hidden: true,
    name: "Relative Permeability (Unsteady-State — JBN)",
    short: "kro/krw from a single waterflood displacement",
    icon: Activity,
    color: C.moss,
    soft: C.mossSoft,
    formula: "kro = fo·d(1/QiD)/d(1/(QiD·IR))    krw = (1−fo)·d(1/QiD)/d(1/(QiD·IR))",
    reference: "Johnson, E.F., Bossler, D.P., and Naumann, V.O. (1959). \"Calculation of Relative Permeability from Displacement Experiments.\" Petroleum Transactions, AIME, Vol. 216, pp. 370–372.",
    blurb:
      "Inject water at a constant rate into an oil-saturated plug and track cumulative oil produced, pore volumes injected, and pressure drop over time. The console applies the classical Johnson–Bossler–Naumann (Welge/JBN) interpretation to back out kro and krw at the outlet face — no absolute-permeability normalization needed, since kro is inherently referenced to the single-phase oil permeability at the start of the flood. This is the standard, fast unsteady-state method, but it is more numerically sensitive than steady-state testing: points immediately after water breakthrough are often noisy and are filtered out automatically if they come out negative or unphysical.",
    needs: [
      "Pore volume, Vp (from your baseline/routine core analysis)",
      "Initial (connate) water saturation, Swi — from the oil-flood stage that established it",
      "Baseline pressure drop at 100% oil saturation (Sw = Swi), just before water injection begins",
      "At least 6 time steps during the waterflood: pore volumes injected (PV injected), cumulative oil produced, and pressure drop at each — this matches the columns most unsteady-state coreflood software already exports",
    ],
    sampleFields: [
      { key: "Vp", label: "Pore volume", unit: "cm³", default: 25, ref: "Illustrative plug pore volume — replace with your measured value" },
      { key: "Swi", label: "Initial (connate) water saturation", unit: "fraction", default: 0.20, ref: "Typical connate water saturation — replace with your value" },
      { key: "dP0", label: "Baseline ΔP at 100% oil (Sw=Swi)", unit: "psi", default: 50, ref: "Illustrative baseline ΔP — replace with your first waterflood reading" },
      { key: "smooth", label: "Smoothing window (0 = off, 5 = 5-point)", unit: "points", default: 5, ref: "JBN differentiates the data twice, so scatter is amplified; a 5-point Savitzky–Golay quadratic smoother is the standard remedy (Savitzky & Golay, 1964)" },
    ],
    rowFields: [
      { key: "QiD", label: "Pore volumes injected (PV injected)", unit: "fraction" },
      { key: "Np", label: "Cumulative oil produced", unit: "cm³" },
      { key: "dP", label: "Pressure drop at this point", unit: "psi" },
    ],
    minRows: 6,
    calc: calculationFunctions.relPermJBN,
  },
  {
    id: "relPermCorey",
    category: "Relative Permeability",
    hidden: true,
    special: "corey",
    name: "Brooks-Corey Fit",
    short: "Fit a Corey-type power-law model + fractional flow",
    icon: TrendingUp,
    color: C.moss,
    soft: C.mossSoft,
    formula: "krw = krw_max·Se^Nw,  kro = kro_max·(1−Se)^No,  Se = (Sw−Swc)/(1−Swc−Sor)",
    reference: "Corey, A.T. (1954). \"The Interrelation Between Gas and Oil Relative Permeabilities.\" Producers Monthly, 19(1), 38–41. Brooks, R.H. and Corey, A.T. (1964). \"Hydraulic Properties of Porous Media.\" Hydrology Papers No. 3, Colorado State University.",
    blurb:
      "Fit the standard Corey-type power-law relative permeability model to a set of (Sw, kro, krw) points — from your JBN interpretation, a steady-state test, or entered independently. The console normalizes each point to effective saturation Se using your connate and residual saturations, then log-linear regresses to find the Corey exponents (Nw, No) and endpoint permeabilities (krw_max, kro_max). It then builds the fractional-flow curve fw(Sw) from the fitted curves and your fluid viscosities, and draws the Welge tangent construction from Swc — the standard graphical method for reading off the shock-front (frontal) saturation and the average water saturation at breakthrough.",
    needs: [
      "Connate (irreducible) water saturation, Swc, and residual oil saturation, Sor",
      "Oil and water viscosities at test conditions (needed only for the fractional-flow curve, not the kr fit itself)",
      "At least 4 (Sw, kro, krw) data points spanning the mobile saturation range",
    ],
    sampleFields: [
      { key: "Swc", label: "Connate water saturation", unit: "fraction", default: 0.20, ref: "Typical connate water saturation — replace with your value" },
      { key: "Sor", label: "Residual oil saturation", unit: "fraction", default: 0.30, ref: "Typical residual oil saturation — confirm the flood reached a true production plateau before trusting a value here" },
      { key: "muo", label: "Oil viscosity", unit: "cp", default: 10, ref: "Typical dead oil at ~20°C" },
      { key: "muw", label: "Water/brine viscosity", unit: "cp", default: 1.0, ref: "Fresh water / light brine at ~20°C" },
    ],
    rowFields: [
      { key: "Sw", label: "Water saturation", unit: "fraction" },
      { key: "kro", label: "Oil relative permeability", unit: "fraction" },
      { key: "krw", label: "Water relative permeability", unit: "fraction" },
    ],
    minRows: 4,
    calc: (s, rows) => {
      const pts = rows
        .map((r) => ({ ...r, Se: (r.Sw - s.Swc) / (1 - s.Swc - s.Sor) }))
        .filter((p) => p.Se > 0 && p.Se < 1 && p.kro > 0 && p.krw > 0);

      const wFit = linreg(pts.map((p) => Math.log(p.Se)), pts.map((p) => Math.log(p.krw)));
      const Nw = wFit.slope, krwMax = Math.exp(wFit.intercept);
      const oFit = linreg(pts.map((p) => Math.log(1 - p.Se)), pts.map((p) => Math.log(p.kro)));
      const No = oFit.slope, kroMax = Math.exp(oFit.intercept);

      const curve = [];
      for (let i = 0; i <= 40; i++) {
        const Se = i / 40;
        const Sw = s.Swc + Se * (1 - s.Swc - s.Sor);
        curve.push({ Sw, kro: kroMax * Math.pow(1 - Se, No), krw: krwMax * Math.pow(Se, Nw) });
      }

      // Fractional flow of water: fw = (krw/muw) / (krw/muw + kro/muo)
      const fwCurve = curve.map((p) => {
        const lw = p.krw / s.muw, lo = p.kro / s.muo;
        return { Sw: p.Sw, fw: lw + lo > 0 ? lw / (lw + lo) : 0 };
      });

      // Welge tangent from (Swc, 0): the tangent point maximizes the secant slope fw/(Sw-Swc)
      let best = { slope: -Infinity, idx: -1 };
      fwCurve.forEach((p, i) => {
        if (p.Sw > s.Swc) {
          const m = p.fw / (p.Sw - s.Swc);
          if (m > best.slope) best = { slope: m, idx: i };
        }
      });
      const front = fwCurve[best.idx] || { Sw: s.Swc, fw: 0 };
      const swMax = 1 - s.Sor;
      const swAtFw1 = best.slope > 0 ? s.Swc + 1 / best.slope : swMax;
      const tangentEndSw = Math.min(swMax, swAtFw1);
      const tangent = [{ Sw: s.Swc, fw: 0 }, { Sw: tangentEndSw, fw: best.slope * (tangentEndSw - s.Swc) }];
      const swBreakthrough = Math.min(swMax, swAtFw1);

      return {
        rows: pts,
        headline: { label: "Water Corey exponent (Nw)", value: Nw, unit: "—" },
        alt: { label: `Oil exponent No=${fmt(No, 3)}, fitted endpoints krw_max=${fmt(krwMax, 3)}, kro_max=${fmt(kroMax, 3)}`, value: No, unit: "—" },
        r2: Math.min(wFit.r2, oFit.r2),
        chart: { type: "corey", data: pts, curve },
        chart2: {
          type: "fracflow", curve: fwCurve, tangent,
          frontSw: front.Sw, frontFw: front.fw, swBreakthrough,
        },
      };
    },
  },
  {
    id: "relPermHub",
    category: "Relative Permeability",
    name: "Relative Permeability",
    short: "Steady-state, unsteady-state (JBN), or Brooks-Corey fit",
    icon: GitBranch,
    color: C.moss,
    soft: C.mossSoft,
    special: "relperm-hub",
  },
  {
    id: "contactAngle",
    category: "Capillary Pressure & Wettability",
    name: "Contact Angle",
    short: "Sessile drop or captive bubble — measure the angle by tangent lines",
    icon: ImageIcon,
    color: C.plum,
    soft: C.plumSoft,
    special: "contactAngle",
  },
  {
    id: "nmrPetrophysics",
    category: "NMR Petrophysics",
    name: "NMR Porosity & Permeability",
    short: "Fit T2 decay (ExpDec3), derive φ, CBW, BVI, FFI, and Coates/SDR permeability",
    icon: Waves,
    color: C.cyan,
    soft: C.cyanSoft,
    special: "nmr",
  },
  {
    id: "capillaryHub",
    category: "Capillary Pressure & Wettability",
    name: "Capillary Pressure (MICP)",
    short: "Penetrometer selection, then high-pressure intrusion analysis",
    icon: Beaker,
    color: C.amber,
    soft: C.amberSoft,
    special: "capillary-hub",
  },
  {
    id: "micpIntrusion",
    category: "Capillary Pressure & Wettability",
    hidden: true,
    name: "High-Pressure Intrusion Analysis",
    short: "Upload the AutoPore export, get the full Pc-curve report",
    icon: Activity,
    color: C.amber,
    soft: C.amberSoft,
    special: "micpIntrusion",
  },
  {
    id: "penetrometerSelector",
    category: "Capillary Pressure & Wettability",
    hidden: true,
    name: "Penetrometer Selection Tool",
    short: "Pick the right bulb size and stem volume for your sample",
    icon: Beaker,
    color: C.amber,
    soft: C.amberSoft,
    special: "penetrometerSelector",
  },
  {
    id: "phiKCorrelation",
    category: "Correlations & Trends",
    name: "Porosity–Permeability Correlation",
    short: "Fit k = f(φ) across your core dataset",
    icon: TrendingUp,
    color: C.blue,
    soft: C.blueSoft,
    special: "correlation",
  },
  {
    id: "porosityGrain",
    category: "Porosity & Volumetrics",
    name: "Porosity & Grain Density",
    short: "Bulk, pore & grain volume, porosity and grain density by the gravimetric (Archimedes) method",
    icon: Layers,
    color: C.teal,
    soft: C.tealSoft,
    formula: "Vb=(Wsat−Wimm)/ρf   Vp=(Wsat−Wdry)/ρf   Vg=Vb−Vp   φ=Vp/Vb   ρg=Wdry/Vg",
    reference: `American Petroleum Institute (1998). "Recommended Practices for Core Analysis" (API RP 40), 2nd ed. — bulk volume by Archimedes buoyancy and pore volume by the gravimetric (saturation) method.`,
    blurb: `Enter one row per plug: the dry mass, the mass fully saturated in air, and the saturated mass suspended (immersed) in the saturating fluid. Bulk volume comes from Archimedes buoyancy, pore volume from the mass of imbibed fluid, and grain volume from their difference — giving porosity and grain density per plug plus a dataset mean. Use the same fluid for saturation and immersion and enter its density.`,
    needs: [
      `Dry mass of each cleaned, oven-dried plug (g)`,
      `Mass of each plug fully saturated with the test fluid, weighed in air (g)`,
      `Mass of each saturated plug weighed while suspended (immersed) in the same fluid (g)`,
      `Density of the saturating/immersion fluid (g/cm³) — e.g. formation or synthetic brine`,
    ],
    sampleFields: [
      { key: "rhoF", label: "Saturating fluid density", unit: "g/cm³", default: 1.0, ref: `Fresh water ≈ 1.00 at 20°C; use your measured brine density (~1.05 for typical formation brine)` },
    ],
    rowFields: [
      { key: "Wdry", label: "Dry mass", unit: "g" },
      { key: "Wsat", label: "Saturated mass (in air)", unit: "g" },
      { key: "Wimm", label: "Saturated mass (immersed in fluid)", unit: "g" },
    ],
    minRows: 1,
    calc: (s, rows) => {
      const pts = rows.map((r, i) => {
        const Vb = (r.Wsat - r.Wimm) / s.rhoF;
        const Vp = (r.Wsat - r.Wdry) / s.rhoF;
        const Vg = Vb - Vp;
        const phi = Vb > 0 ? Vp / Vb : NaN;
        const rhoG = Vg > 0 ? r.Wdry / Vg : NaN;
        return { ...r, plug: i + 1, Vb, Vp, Vg, phi, rhoG };
      }).filter((x) => Number.isFinite(x.phi));
      const meanPhi = avg(pts.map((x) => x.phi));
      const meanRhoG = avg(pts.map((x) => x.rhoG));
      return {
        rows: pts,
        headline: { label: "Mean porosity", value: meanPhi, unit: "fraction" },
        alt: { label: `Mean grain density = ${fmt(meanRhoG, 3)} g/cm³ (quartz ≈ 2.65) · ${pts.length} plug(s)`, value: meanRhoG, unit: "g/cm³" },
        chart: { type: "xyfit", points: pts.map((x) => ({ x: x.plug, y: x.phi * 100 })), connect: true, xLabel: "Plug #", yLabel: "Porosity (%)" },
      };
    },
  },
  {
    id: "centrifugePc",
    category: "Capillary Pressure & Wettability",
    name: "Capillary Pressure (Centrifuge)",
    short: "Drainage Pc curve from multi-speed centrifuge data (Hassler–Brunner)",
    icon: Activity,
    color: C.amber,
    soft: C.amberSoft,
    formula: "ω=2πN/60   Pc1=½·Δρ·ω²·(r2²−r1²)   S1=S̄+Pc1·dS̄/dPc1",
    reference: `Hassler, G.L. & Brunner, E. (1945). "Measurement of Capillary Pressures in Small Core Samples." Trans. AIME 160, 114–123. Inlet-face correction after Forbes, P. (1994), The Log Analyst 35(4), 31–53; see also API RP 40 (1998).`,
    blurb: `Enter one row per centrifuge speed: the rotational speed and the measured equilibrium average water saturation at that speed. The capillary pressure at the inner (inlet) face is computed from the speed and the plug's radial position, and the average saturation is converted to the inlet-face saturation by the Hassler–Brunner first approximation. The result is the drainage capillary-pressure curve, from which the maximum Pc and irreducible saturation are read.`,
    needs: [
      `Fluid density difference Δρ between the displacing and displaced phases (g/cm³)`,
      `Radius from the centrifuge axis to the inner (near) core face, r1 (cm)`,
      `Radius from the axis to the outer (far) core face, r2 (cm)`,
      `For each speed step: rotational speed (RPM) and the equilibrium average water saturation (fraction)`,
    ],
    sampleFields: [
      { key: "drho", label: "Fluid density difference Δρ", unit: "g/cm³", default: 1.0, ref: `Δρ = ρ_water − ρ_air ≈ 1.0 for gas–brine drainage; use ρ_brine − ρ_oil for oil–brine` },
      { key: "r1", label: "Axis-to-inner-face radius r1", unit: "cm", default: 5.0, ref: `From your centrifuge core-holder geometry` },
      { key: "r2", label: "Axis-to-outer-face radius r2", unit: "cm", default: 8.0, ref: `r2 = r1 + plug length; from core-holder geometry` },
    ],
    rowFields: [
      { key: "rpm", label: "Rotational speed", unit: "RPM" },
      { key: "Sbar", label: "Average water saturation", unit: "fraction" },
    ],
    minRows: 4,
    calc: calculationFunctions.centrifugePc,
  },
  {
    id: "wettability",
    category: "Capillary Pressure & Wettability",
    name: "Wettability (Amott / USBM)",
    short: "Amott–Harvey relative displacement index, plus the USBM wettability index",
    icon: Droplets,
    color: C.plum,
    soft: C.plumSoft,
    formula: "δw=Vwsp/Vwt   δo=Vosp/Vot   I(AH)=δw−δo    USBM: W=log₁₀(A1/A2)",
    reference: `Amott, E. (1959). "Observations Relating to the Wettability of Porous Rock." Trans. AIME 216, 156–162. USBM: Donaldson, E.C., Thomas, R.D. & Lorenz, P.B. (1969). "Wettability Determination and Its Effect on Recovery Efficiency." SPE Journal 9(1), 13–20. Review & bands: Anderson, W.G. (1986). "Wettability Literature Survey — Part 2." JPT 38(11), 1246–1262.`,
    blurb: `Enter, per sample, the oil volume displaced by spontaneous water imbibition and by total water displacement, and the water volume displaced by spontaneous oil imbibition and by total oil displacement. The console returns the Amott displacement-by-water and displacement-by-oil ratios and the Amott–Harvey index (+1 strongly water-wet to −1 strongly oil-wet). Enter the areas under the two forced-displacement Pc curves as well and the USBM index is reported alongside.`,
    needs: [
      `Vwsp — oil volume displaced by spontaneous water imbibition (cm³)`,
      `Vwt — total oil displaced by water: spontaneous + forced (cm³)`,
      `Vosp — water volume displaced by spontaneous oil imbibition (cm³)`,
      `Vot — total water displaced by oil: spontaneous + forced (cm³)`,
      `Optional (USBM): areas A1 and A2 under the oil-drive and brine-drive Pc curves`,
    ],
    sampleFields: [],
    rowFields: [
      { key: "Vwsp", label: "Oil displaced — spontaneous water imbibition", unit: "cm³" },
      { key: "Vwt", label: "Oil displaced — total (spont. + forced water)", unit: "cm³" },
      { key: "Vosp", label: "Water displaced — spontaneous oil imbibition", unit: "cm³" },
      { key: "Vot", label: "Water displaced — total (spont. + forced oil)", unit: "cm³" },
      { key: "A1", label: "USBM area, oil-drive curve (optional)", unit: "—" },
      { key: "A2", label: "USBM area, brine-drive curve (optional)", unit: "—" },
    ],
    minRows: 1,
    calc: calculationFunctions.amottUsbm,
  },
  {
    id: "formationFactorFit",
    category: "Electrical Properties",
    name: "Formation Factor & Cementation (a, m)",
    short: "Fit F = a·φ⁻ᵐ across brine-saturated plugs to get the formation-factor law",
    icon: Beaker,
    color: C.blue,
    soft: C.blueSoft,
    formula: "F = Ro/Rw = a·φ⁻ᵐ  ⇒  log F = log a − m·log φ",
    reference: `Archie, G.E. (1942). "The Electrical Resistivity Log as an Aid in Determining Some Reservoir Characteristics." Trans. AIME 146, 54–62. Tortuosity/lithology factor a: Winsauer, W.O., Shearin, H.M., Masson, P.H. & Williams, M. (1952). "Resistivity of Brine-Saturated Sands in Relation to Pore Geometry." AAPG Bulletin 36(2), 253–277.`,
    blurb: `Enter one row per brine-saturated plug: its porosity and its resistivity at 100% brine saturation (Ro). With the brine resistivity (Rw), each plug's formation factor F = Ro/Rw is computed, then a straight line is fitted to log F versus log φ. The slope gives the cementation exponent m and the intercept the tortuosity/lithology factor a (Archie's original a = 1; Humble formula a ≈ 0.62, m ≈ 2.15 for sandstones).`,
    needs: [
      `Brine resistivity Rw at the test temperature (Ω·m)`,
      `For each plug: porosity φ (fraction) and resistivity at 100% brine, Ro (Ω·m)`,
      `At least ~4 plugs spanning a range of porosity for a reliable fit`,
    ],
    sampleFields: [
      { key: "Rw", label: "Brine resistivity Rw", unit: "Ω·m", default: 0.1, ref: `Measured on the synthetic/formation brine` },
      { key: "RwTemp", label: "Temperature Rw was measured at", unit: "°C", default: 20, ref: `Arps (1953) temperature correction — set equal to the test temperature to disable` },
      { key: "testTemp", label: "Temperature of the Ro measurements", unit: "°C", default: 20, ref: `Rw is corrected to this temperature before F is formed` },
    ],
    rowFields: [
      { key: "phi", label: "Porosity", unit: "fraction" },
      { key: "Ro", label: "Resistivity at 100% brine (Ro)", unit: "Ω·m" },
    ],
    minRows: 4,
    calc:calculationFunctions.formationFactorFit,
  },
  {
    id: "resistivityIndexFit",
    category: "Electrical Properties",
    name: "Resistivity Index & Saturation Exponent (n)",
    short: "Fit IR = Sw⁻ⁿ across a desaturation series to get Archie's saturation exponent",
    icon: Zap,
    color: C.cyan,
    soft: C.cyanSoft,
    formula: "IR = Rt/Ro = Sw⁻ⁿ  ⇒  log IR = −n·log Sw",
    reference: `Archie, G.E. (1942). "The Electrical Resistivity Log as an Aid in Determining Some Reservoir Characteristics." Trans. AIME 146, 54–62 (the second Archie relation). Saturation-exponent dependence on wettability: Keller, G.V. (1953) and Sweeney, S.A. & Jennings, H.Y. (1960).`,
    blurb: `Enter one row per desaturation step on a single plug: the water saturation and the resistivity Rt at that saturation. With the plug's resistivity at 100% brine (Ro), the resistivity index IR = Rt/Ro is computed and a straight line is fitted to log IR versus log Sw. The negative slope is Archie's saturation exponent n (≈ 2 for clean water-wet rock; higher for oil-wet or fractured systems).`,
    needs: [
      `Resistivity of the plug at 100% brine saturation, Ro (Ω·m)`,
      `For each desaturation step: water saturation Sw (fraction) and resistivity Rt (Ω·m)`,
      `At least ~4 saturation steps for a reliable slope`,
    ],
    sampleFields: [
      { key: "Ro", label: "Resistivity at 100% brine (Ro)", unit: "Ω·m", default: 1.0, ref: `The plug's own Ro measured at Sw = 1 before desaturation` },
    ],
    rowFields: [
      { key: "Sw", label: "Water saturation", unit: "fraction" },
      { key: "Rt", label: "Resistivity at this Sw (Rt)", unit: "Ω·m" },
    ],
    minRows: 4,
    calc: calculationFunctions.resistivityIndexFit,
  },
  {
    id: "heliumPorosimetry",
    category: "Porosity & Volumetrics",
    name: "Helium Porosimetry (Boyle's Law)",
    short: "Grain volume and porosity by double-cell helium expansion — the routine-lab standard",
    icon: FlaskConical,
    color: C.moss,
    soft: C.mossSoft,
    formula: "P1·Vr = P2·(Vr + Vc − Vg)  ⇒  Vg = Vc − Vr·(P1/P2 − 1)   Vp = Vb − Vg   φ = Vp/Vb",
    reference: `American Petroleum Institute (1998). "Recommended Practices for Core Analysis" (API RP 40), 2nd ed., §4 — Boyle's-law double-cell helium expansion. Helium is used because its small molecule accesses fine pore throats and it does not adsorb appreciably on most reservoir minerals.`,
    blurb: `The routine-lab method for grain volume. Helium is charged into a calibrated reference cell at pressure P1, then expanded into the sample chamber holding the plug, settling at pressure P2. Boyle's law gives the grain volume directly, and with the plug's bulk volume you get pore volume, porosity and grain density. Enter absolute pressures — if your gauge reads gauge pressure, add atmospheric (≈14.7 psi) first.`,
    needs: [
      `Reference cell volume Vr and sample chamber volume Vc, from the instrument calibration (cm³)`,
      `For each plug: bulk volume Vb (caliper or Archimedes), charge pressure P1 and expanded pressure P2 (absolute)`,
      `Dry mass of each plug, if you want grain density as well (g)`,
    ],
    sampleFields: [
      { key: "Vr", label: "Reference cell volume Vr", unit: "cm³", default: 50, ref: `From the porosimeter calibration certificate` },
      { key: "Vc", label: "Sample chamber volume Vc (empty)", unit: "cm³", default: 100, ref: `From the porosimeter calibration certificate` },
    ],
    rowFields: [
      { key: "Vb", label: "Bulk volume", unit: "cm³" },
      { key: "P1", label: "Charge pressure P1 (absolute)", unit: "psia" },
      { key: "P2", label: "Expanded pressure P2 (absolute)", unit: "psia" },
      { key: "Wdry", label: "Dry mass (optional)", unit: "g" },
    ],
    minRows: 1,
    calc: (s, rows) => {
      const pts = rows.map((r, i) => {
        const Vg = s.Vc - s.Vr * (r.P1 / r.P2 - 1);
        const Vp = r.Vb - Vg;
        const phi = r.Vb > 0 ? Vp / r.Vb : NaN;
        const rhoG = Vg > 0 && r.Wdry > 0 ? r.Wdry / Vg : NaN;
        return { ...r, plug: i + 1, Vg, Vp, phi, rhoG };
      }).filter((x) => Number.isFinite(x.phi));
      const meanPhi = avg(pts.map((x) => x.phi));
      const rhoVals = pts.map((x) => x.rhoG).filter(Number.isFinite);
      const meanRho = rhoVals.length ? avg(rhoVals) : NaN;
      return {
        rows: pts,
        headline: { label: "Mean porosity", value: meanPhi, unit: "fraction" },
        alt: { label: `${rhoVals.length ? `Mean grain density = ${fmt(meanRho, 3)} g/cm³ (quartz ≈ 2.65, calcite ≈ 2.71, dolomite ≈ 2.87) · ` : ""}${pts.length} plug(s)`, value: rhoVals.length ? meanRho : meanPhi, unit: rhoVals.length ? "g/cm³" : "fraction" },
        chart: { type: "xyfit", points: pts.map((x) => ({ x: x.plug, y: x.phi * 100 })), connect: true, xLabel: "Plug #", yLabel: "Porosity (%)" },
      };
    },
  },
  {
    id: "waxmanSmits",
    category: "Electrical Properties",
    name: "Waxman–Smits (Shaly Sand)",
    short: "Clay-corrected formation factor F* and cementation exponent m* for clay-bearing rock",
    icon: Layers,
    color: C.clay,
    soft: C.claySoft,
    formula: "Co = (1/F*)·(Cw + B·Qv)  ⇒  F* = Ro·(1/Rw + B·Qv)   F* = a*·φ^−m*",
    reference: `Waxman, M.H. & Smits, L.J.M. (1968). "Electrical Conductivities in Oil-Bearing Shaly Sands." SPE Journal 8(2), 107–122. Counterion conductance B correlation: Juhász, I. (1981), SPWLA 22nd Annual Logging Symposium. Compare with the clean-sand case of Archie, G.E. (1942), Trans. AIME 146, 54–62.`,
    blurb: `In clay-bearing sandstone the clay's counterion conductivity short-circuits the rock, so the apparent Archie formation factor is too low and the cementation exponent comes out wrong. Waxman–Smits separates the two conduction paths: enter each plug's porosity, Ro, and cation exchange capacity per unit pore volume (Qv), and the console removes the clay contribution to give the intrinsic F*, then fits F* = a*·φ^−m*. The clean-Archie fit is reported alongside so you can see how much the clay was biasing it.`,
    needs: [
      `Brine resistivity Rw at test temperature (Ω·m)`,
      `Counterion conductance B (S·cm²/meq) — from the Juhász or Waxman–Smits correlation at your Rw and temperature`,
      `For each plug: porosity φ, resistivity at 100% brine Ro, and Qv (meq/cm³ of pore volume, from CEC titration)`,
    ],
    sampleFields: [
      { key: "Rw", label: "Brine resistivity Rw", unit: "Ω·m", default: 0.1, ref: `At the measurement temperature` },
      { key: "B", label: "Counterion conductance B", unit: "S·cm²/meq", default: 4.6, ref: `Waxman–Smits (1968) / Juhász (1981); B rises with temperature and falls with brine salinity — 4–6 is typical at ~25°C for moderately saline brine` },
    ],
    rowFields: [
      { key: "phi", label: "Porosity", unit: "fraction" },
      { key: "Ro", label: "Resistivity at 100% brine (Ro)", unit: "Ω·m" },
      { key: "Qv", label: "Cation exchange capacity per pore volume (Qv)", unit: "meq/cm³" },
    ],
    minRows: 4,
    calc: calculationFunctions.waxmanSmits,
  },
  {
    id: "stressDependence",
    category: "Permeability",
    name: "Stress Dependence of Permeability",
    short: "Correct ambient plug permeability to reservoir net confining stress",
    icon: Activity,
    color: C.slate,
    soft: C.borderSoft,
    formula: "k(σ) = k₀·exp(−c·σ)  ⇒  ln k = ln k₀ − c·σ",
    reference: `American Petroleum Institute (1998). "Recommended Practices for Core Analysis" (API RP 40), §5 — measurement at net confining stress. Stress sensitivity of permeability: Fatt, I. & Davis, D.H. (1952), Trans. AIME 195, 329–336; Jones, F.O. & Owens, W.W. (1980), "A Laboratory Study of Low-Permeability Gas Sands," JPT 32(9), 1631–1640.`,
    blurb: `Permeability measured on an unconfined plug overstates the reservoir value, sometimes by a large factor in tight or microfractured rock. Measure permeability at three or more net confining stresses, and this module fits an exponential decline, reports the stress-sensitivity coefficient, and predicts permeability at your reservoir net stress. Net confining stress is the confining pressure minus the pore pressure — enter that, not the raw confining pressure.`,
    needs: [
      `Permeability measured at 3 or more net confining stresses on the same plug (mD)`,
      `The net confining stress at each step (psi) — confining minus pore pressure`,
      `The reservoir net effective stress you want the corrected value at (psi)`,
    ],
    sampleFields: [
      { key: "sigmaRes", label: "Reservoir net effective stress", unit: "psi", default: 4000, ref: `Overburden minus pore pressure at reservoir depth — roughly 1 psi/ft overburden minus 0.45 psi/ft hydrostatic` },
    ],
    rowFields: [
      { key: "sigma", label: "Net confining stress", unit: "psi" },
      { key: "k", label: "Permeability at this stress", unit: "mD" },
    ],
    minRows: 3,
    calc:calculationFunctions.stressDependence,
  },
  {
    id: "rockTyping",
    category: "Correlations & Trends",
    name: "Rock Typing (Winland r35 / FZI)",
    short: "Pore-throat radius and flow-zone indicator from routine φ–k data",
    icon: GitBranch,
    color: C.plum,
    soft: C.plumSoft,
    formula: "log r35 = 0.732 + 0.588·log k − 0.864·log φ    RQI = 0.0314√(k/φ)    FZI = RQI/(φ/(1−φ))",
    reference: `Winland r35 as published in Kolodzie, S. (1980), SPE 9382; refined regressions in Pittman, E.D. (1992), "Relationship of Porosity and Permeability to Various Parameters Derived from Mercury Injection–Capillary Pressure Curves for Sandstone," AAPG Bulletin 76(2), 191–198. Flow-zone indicator: Amaefule, J.O., Altunbay, M., Tiab, D., Kersey, D.G. & Keelan, D.K. (1993), SPE 26436. Port-size classes after Hartmann, D.J. & Beaumont, E.A. (1999), AAPG Treatise.`,
    blurb: `Turns an ordinary porosity–permeability table into rock types. For each plug the console computes the Winland r35 pore-throat radius (the throat size at 35% mercury saturation, which best correlates with flow), the Pittman r35 regression for comparison, and the reservoir quality index and flow-zone indicator. Plugs sharing an FZI belong to the same hydraulic flow unit and should fall on one line in the RQI–φz plot, which is the basis for permeability prediction in uncored intervals.`,
    needs: [
      `Porosity (fraction) and permeability (mD) for each plug — routine core analysis output`,
      `At least a handful of plugs; more is better for identifying distinct flow units`,
    ],
    sampleFields: [],
    rowFields: [
      { key: "phi", label: "Porosity", unit: "fraction" },
      { key: "k", label: "Permeability", unit: "mD" },
    ],
    minRows: 3,
    calc:calculationFunctions.rockTyping,
  },
  {
    id: "uncertaintyBudget",
    category: "Permeability",
    name: "Measurement Uncertainty (Darcy k)",
    short: "Propagate instrument tolerances into an uncertainty band on permeability",
    icon: AlertCircle,
    color: C.amber,
    soft: C.amberSoft,
    formula: "k = 1000·Q·μ·L/(A·ΔP),  A = πD²/4   ⇒   (u_k/k)² = (u_Q/Q)² + (u_μ/μ)² + (u_L/L)² + (2u_D/D)² + (u_ΔP/ΔP)²",
    reference: `JCGM 100:2008, "Evaluation of Measurement Data — Guide to the Expression of Uncertainty in Measurement" (GUM), §5 — first-order propagation of uncertainty for a product-form model, with the expanded uncertainty U = k·u_c for a coverage factor k = 2 (≈95% confidence).`,
    blurb: `A permeability is only as good as the instruments behind it. Enter each measured quantity together with its uncertainty — the gauge tolerance, flow-meter accuracy, caliper resolution — and this module propagates them through Darcy's law. Because the model is a pure product, the relative variances simply add, with diameter counting twice since area goes as D². The output is the permeability with its expanded uncertainty at roughly 95% confidence, plus a ranked contribution list showing which instrument is actually limiting your accuracy.`,
    needs: [
      `Flow rate Q and its uncertainty (cm³/s)`,
      `Fluid viscosity μ and its uncertainty (cp)`,
      `Plug length L and diameter D with their uncertainties (cm)`,
      `Differential pressure ΔP and its uncertainty (atm)`,
    ],
    sampleFields: [],
    rowFields: [
      { key: "Q", label: "Flow rate Q", unit: "cm³/s" },
      { key: "uQ", label: "Uncertainty in Q", unit: "cm³/s" },
      { key: "mu", label: "Viscosity μ", unit: "cp" },
      { key: "umu", label: "Uncertainty in μ", unit: "cp" },
      { key: "L", label: "Length L", unit: "cm" },
      { key: "uL", label: "Uncertainty in L", unit: "cm" },
      { key: "D", label: "Diameter D", unit: "cm" },
      { key: "uD", label: "Uncertainty in D", unit: "cm" },
      { key: "dP", label: "Differential pressure ΔP", unit: "atm" },
      { key: "udP", label: "Uncertainty in ΔP", unit: "atm" },
    ],
    minRows: 1,
    calc: (s, rows) => {
      const pts = rows.map((r, i) => {
        const A = (Math.PI * r.D * r.D) / 4;
        const k = (1000 * r.Q * r.mu * r.L) / (A * r.dP);
        const terms = [
          { name: "flow rate Q", v: r.uQ / r.Q },
          { name: "viscosity μ", v: r.umu / r.mu },
          { name: "length L", v: r.uL / r.L },
          { name: "diameter D (counts twice, A ∝ D²)", v: 2 * (r.uD / r.D) },
          { name: "pressure ΔP", v: r.udP / r.dP },
        ].filter((t) => Number.isFinite(t.v));
        const relVar = terms.reduce((acc, t) => acc + t.v * t.v, 0);
        const rel = Math.sqrt(relVar);
        const ranked = terms.slice().sort((a, b) => b.v * b.v - a.v * a.v);
        const dominant = ranked[0];
        const share = relVar > 0 && dominant ? (dominant.v * dominant.v) / relVar * 100 : NaN;
        return { ...r, plug: i + 1, k, rel, relPct: rel * 100, U95: 2 * rel * k, dominant: dominant ? dominant.name : "—", share };
      }).filter((x) => Number.isFinite(x.k) && Number.isFinite(x.rel));
      const first = pts[0];
      return {
        rows: pts,
        headline: { label: "Permeability", value: first ? first.k : NaN, unit: "mD" },
        alt: { label: first ? `Expanded uncertainty U₉₅ = ±${fmt(first.U95, 3)} mD (±${fmt(first.relPct * 2, 1)}%, k = 2) · largest contributor: ${first.dominant}, ${fmt(first.share, 0)}% of the variance · ${pts.length} plug(s)` : "—", value: first ? first.U95 : NaN, unit: "mD" },
        chart: { type: "xyfit", points: pts.map((x) => ({ x: x.plug, y: x.relPct * 2 })), connect: true, xLabel: "Plug #", yLabel: "Expanded uncertainty U₉₅ (%)" },
      };
    },
  },
];

const CATEGORIES = [
  { name: "Permeability", icon: Wind, note: "Flow-based transport properties" },
  { name: "Porosity & Volumetrics", icon: Layers, note: "Bulk, pore and grain volume properties" },
  { name: "Capillary Pressure & Wettability", icon: Droplets, note: "Fluid displacement and rock-fluid interaction" },
  { name: "Electrical Properties", icon: Zap, note: "Archie's relations, resistivity and formation factor" },
  { name: "Relative Permeability", icon: GitBranch, note: "Multiphase flow behaviour" },
  { name: "NMR Petrophysics", icon: Waves, note: "Porosity components and permeability from T2 relaxation" },
  { name: "Correlations & Trends", icon: TrendingUp, note: "Extend sparse core data across the well" },
];

const COMING_SOON = [];

/* ============================== QUICK CALCULATOR DEFINITIONS ============================== */
const QUICK_CALCS = [
  {
    category: "Geometry",
    items: [
      {
        id: "bulkVol", title: "Bulk Volume",
        inputs: [{ key: "L", label: "Plug length", unit: "cm" }, { key: "D", label: "Plug diameter", unit: "cm" }],
        compute: (v) => (Math.PI * v.D * v.D * v.L) / 4, unit: "cm³", equation: "Vb = (π / 4) · D² · L", fraction: false,
      },
      {
        id: "coreArea", title: "Core Cross-Sectional Area",
        inputs: [{ key: "D", label: "Plug diameter", unit: "cm" }],
        compute: (v) => (Math.PI * v.D * v.D) / 4, unit: "cm²", equation: "A = (π / 4) · D²", fraction: false,
      },
      {
        id: "grainVol", title: "Grain Volume",
        inputs: [{ key: "Vb", label: "Bulk volume", unit: "cm³" }, { key: "Vp", label: "Pore volume", unit: "cm³" }],
        compute: (v) => v.Vb - v.Vp, unit: "cm³", equation: "Vg = Vb − Vp", fraction: false,
      },
    ],
  },
  {
    category: "Porosity & Saturation",
    items: [
      {
        id: "porosity", title: "Porosity", grouped: true,
        options: [
          {
            key: "byPoreVol", label: "From bulk & pore volume",
            inputs: [{ key: "Vb", label: "Bulk volume", unit: "cm³" }, { key: "Vp", label: "Pore volume", unit: "cm³" }],
            compute: (v) => v.Vp / v.Vb, unit: "fraction", equation: "φ = Vp / Vb", fraction: true,
          },
          {
            key: "byGrainVol", label: "From bulk & grain volume",
            inputs: [{ key: "Vb", label: "Bulk volume", unit: "cm³" }, { key: "Vg", label: "Grain volume", unit: "cm³" }],
            compute: (v) => (v.Vb - v.Vg) / v.Vb, unit: "fraction", equation: "φ = (Vb − Vg) / Vb", fraction: true,
          },
        ],
      },
      {
        id: "poreVolume", title: "Pore Volume", grouped: true,
        options: [
          {
            key: "fromPorosity", label: "From porosity & bulk volume",
            inputs: [{ key: "phi", label: "Porosity", unit: "fraction" }, { key: "Vb", label: "Bulk volume", unit: "cm³" }],
            compute: (v) => v.phi * v.Vb, unit: "cm³", equation: "Vp = φ · Vb", fraction: false,
          },
          {
            key: "byWeightDiff", label: "From wet/dry weight difference",
            inputs: [
              { key: "Msat", label: "Saturated (wet) mass", unit: "g" },
              { key: "Mdry", label: "Dry mass", unit: "g" },
              { key: "rhof", label: "Saturating fluid density", unit: "g/cm³", default: 1.0, ref: "Fresh water density, ~20°C" },
            ],
            compute: (v) => (v.Msat - v.Mdry) / v.rhof, unit: "cm³",
            equation: "Vp = (M_sat − M_dry) / ρ_fluid", fraction: false,
          },
        ],
      },
      {
        id: "density", title: "Density", grouped: true,
        options: [
          {
            key: "grain", label: "Grain density",
            inputs: [{ key: "M", label: "Dry mass", unit: "g" }, { key: "Vg", label: "Grain volume", unit: "cm³" }],
            compute: (v) => v.M / v.Vg, unit: "g/cm³", equation: "ρg = M_dry / Vg", fraction: false,
          },
          {
            key: "bulk", label: "Bulk density",
            inputs: [{ key: "M", label: "Mass (dry or sat.)", unit: "g" }, { key: "Vb", label: "Bulk volume", unit: "cm³" }],
            compute: (v) => v.M / v.Vb, unit: "g/cm³", equation: "ρb = M / Vb", fraction: false,
          },
        ],
      },
      {
        id: "fluidSat", title: "Fluid Saturation", grouped: true,
        options: [
          {
            key: "water", label: "Water saturation (Sw)",
            inputs: [{ key: "Vw", label: "Water volume", unit: "cm³" }, { key: "Vp", label: "Pore volume", unit: "cm³" }],
            compute: (v) => v.Vw / v.Vp, unit: "fraction", equation: "Sw = Vw / Vp", fraction: true,
          },
          {
            key: "oil", label: "Oil saturation (So)",
            inputs: [{ key: "Vo", label: "Oil volume", unit: "cm³" }, { key: "Vp", label: "Pore volume", unit: "cm³" }],
            compute: (v) => v.Vo / v.Vp, unit: "fraction", equation: "So = Vo / Vp", fraction: true,
          },
          {
            key: "gas", label: "Gas saturation (Sg)",
            inputs: [{ key: "Vg", label: "Gas volume", unit: "cm³" }, { key: "Vp", label: "Pore volume", unit: "cm³" }],
            compute: (v) => v.Vg / v.Vp, unit: "fraction", equation: "Sg = Vg / Vp", fraction: true,
          },
        ],
      },
    ],
  },
  {
    category: "Permeability",
    items: [
      {
        id: "permeability", title: "Permeability (Darcy)", grouped: true,
        options: [
          {
            key: "gas", label: "Gas (compressible Darcy)",
            inputs: [
              { key: "mu", label: "Gas viscosity", unit: "cp", default: 0.0185, ref: "Air / N₂ at ~20°C, core-analysis reference tables" }, { key: "L", label: "Length", unit: "cm" },
              { key: "A", label: "Area", unit: "cm²" }, { key: "P1", label: "Upstream P₁", unit: "atm" },
              { key: "P2", label: "Downstream P₂", unit: "atm" }, { key: "Q", label: "Flow rate at P₂", unit: "cm³/s" },
            ],
            compute: (v) => 1000 * (2 * v.mu * v.L * v.P2 * v.Q) / (v.A * (v.P1 ** 2 - v.P2 ** 2)),
            unit: "mD", equation: "kₐ = 1000 · (2·μ·L·P₂·Q) / (A·(P₁²−P₂²))", fraction: false,
          },
          {
            key: "liquid", label: "Liquid (incompressible Darcy)",
            inputs: [
              { key: "Q", label: "Flow rate", unit: "cm³/s" }, { key: "mu", label: "Fluid viscosity", unit: "cp", default: 1.0, ref: "Fresh water at ~20°C" },
              { key: "L", label: "Length", unit: "cm" }, { key: "A", label: "Area", unit: "cm²" },
              { key: "dP", label: "Pressure drop ΔP", unit: "atm" },
            ],
            compute: (v) => 1000 * v.Q * v.mu * v.L / (v.A * v.dP),
            unit: "mD", equation: "k = 1000 · Q·μ·L / (A·ΔP)", fraction: false,
          },
        ],
      },
      {
        id: "klink2pt", title: "Klinkenberg k∞ (two-point)",
        inputs: [
          { key: "ka1", label: "kₐ at run 1", unit: "mD" }, { key: "Pm1", label: "Mean pressure 1", unit: "atm" },
          { key: "ka2", label: "kₐ at run 2", unit: "mD" }, { key: "Pm2", label: "Mean pressure 2", unit: "atm" },
        ],
        compute: (v) => { const b = (v.ka1 - v.ka2) / (1 / v.Pm1 - 1 / v.Pm2); return v.ka1 - b / v.Pm1; },
        unit: "mD", equation: "kL = kₐ − b/Pm,  b = (kₐ1−kₐ2)/(1/Pm1−1/Pm2)", fraction: false,
      },
    ],
  },
  {
    category: "Electrical Properties",
    items: [
      {
        id: "formationFactor", title: "Formation Factor", grouped: true,
        options: [
          {
            key: "archie", label: "Archie's equation (a, φ, m)",
            inputs: [
              { key: "a", label: "Tortuosity constant a", unit: "—", default: 1.0, ref: "Archie (1942) original relation" },
              { key: "phi", label: "Porosity", unit: "fraction" },
              { key: "m", label: "Cementation exponent m", unit: "—", default: 2.0, ref: "Archie (1942), typical consolidated sandstone" },
            ],
            compute: (v) => v.a / Math.pow(v.phi, v.m), unit: "—", equation: "F = a / φ^m", fraction: false,
          },
          {
            key: "resistivities", label: "From resistivities (Ro, Rw)",
            inputs: [{ key: "Ro", label: "Resistivity, 100% brine (Ro)", unit: "Ω·m" }, { key: "Rw", label: "Brine resistivity (Rw)", unit: "Ω·m" }],
            compute: (v) => v.Ro / v.Rw, unit: "—", equation: "F = Ro / Rw", fraction: false,
          },
        ],
      },
      {
        id: "resIndex", title: "Resistivity Index",
        inputs: [{ key: "Rt", label: "True resistivity (Rt)", unit: "Ω·m" }, { key: "Ro", label: "Resistivity, 100% brine (Ro)", unit: "Ω·m" }],
        compute: (v) => v.Rt / v.Ro, unit: "—", equation: "I = Rt / Ro", fraction: false,
      },
      {
        id: "archieSw", title: "Water Saturation (Archie)",
        inputs: [
          { key: "a", label: "Tortuosity constant a", unit: "—", default: 1.0, ref: "Archie (1942) original relation" },
          { key: "Rw", label: "Brine resistivity Rw", unit: "Ω·m" },
          { key: "phi", label: "Porosity", unit: "fraction" },
          { key: "m", label: "Cementation exponent m", unit: "—", default: 2.0, ref: "Archie (1942), typical consolidated sandstone" },
          { key: "Rt", label: "True resistivity Rt", unit: "Ω·m" },
          { key: "n", label: "Saturation exponent n", unit: "—", default: 2.0, ref: "Archie (1942), common default" },
        ],
        compute: (v) => Math.pow((v.a * v.Rw) / (Math.pow(v.phi, v.m) * v.Rt), 1 / v.n),
        unit: "fraction", equation: "Sw = [ (a·Rw) / (φ^m · Rt) ]^(1/n)", fraction: true,
      },
      {
        id: "satExp", title: "Saturation Exponent (n)",
        inputs: [{ key: "I", label: "Resistivity Index (I)", unit: "—" }, { key: "Sw", label: "Water saturation", unit: "fraction" }],
        compute: (v) => Math.log(v.I) / Math.log(1 / v.Sw), unit: "—", equation: "n = ln(I) / ln(1/Sw)", fraction: false,
      },
    ],
  },
];

/* ============================== UNIT CONVERTER ENGINE ==============================
 * Every category converts through a single SI base unit. Linear units carry a factor
 * `f` (value_in_base = value · f). Affine units (temperature) carry to/from functions.
 * Units are tagged "lab" or "field" so the same engine powers the Field ↔ Lab
 * interchange. The lab units here are exactly the ones the app's test modules and the
 * Quick Calculator accept (cm, cm³, atm, psi, mD, cp, cm³/s, g/cm³, 1/atm, dyne/cm),
 * so a value can be moved straight between a field report and a bench measurement. */

const PSI = 6894.757293168;      // Pa per psi
const ATM = 101325;              // Pa per atm
const BBL = 0.158987294928;      // m³ per US oil barrel (42 US gal)
const FT = 0.3048;               // m per ft
const DARCY = 9.869233e-13;      // m² per darcy
const LB = 0.45359237;           // kg per lb
const RHO_W60 = 0.999016;        // g/cm³, density of water at 60°F (for API/SG)

const CONVERT_CATEGORIES = [
  {
    id: "length", name: "Length", icon: Ruler, base: "m",
    note: "Plug/interval length, depth",
    units: [
      { u: "cm", f: 0.01, tag: "lab" },
      { u: "mm", f: 0.001 },
      { u: "µm", f: 1e-6, help: "Micron — conventional pore-throat scale" },
      { u: "nm", f: 1e-9, help: "Nanometre — tight-rock and shale pore throats" },
      { u: "Å", f: 1e-10, help: "Ångström — molecular scale" },
      { u: "m", f: 1 },
      { u: "in", f: 0.0254 },
      { u: "ft", f: FT, tag: "field" },
      { u: "km", f: 1000 },
      { u: "mile", f: 1609.344 },
    ],
  },
  {
    id: "area", name: "Area", icon: Layers, base: "m²",
    note: "Cross-sectional / drainage area",
    units: [
      { u: "cm²", f: 1e-4, tag: "lab" },
      { u: "mm²", f: 1e-6 },
      { u: "m²", f: 1 },
      { u: "in²", f: 6.4516e-4 },
      { u: "ft²", f: 0.09290304, tag: "field" },
      { u: "acre", f: 4046.8564224, tag: "field" },
      { u: "hectare", f: 1e4 },
      { u: "km²", f: 1e6 },
    ],
  },
  {
    id: "volume", name: "Volume", icon: Beaker, base: "m³",
    note: "Pore / bulk / produced volume",
    units: [
      { u: "cm³", f: 1e-6, tag: "lab", help: "Cubic centimeter (cc) — lab volume" },
      { u: "mL", f: 1e-6, tag: "lab" },
      { u: "L", f: 1e-3 },
      { u: "m³", f: 1 },
      { u: "in³", f: 1.6387064e-5 },
      { u: "ft³", f: 0.028316846592, tag: "field" },
      { u: "US gal", f: 0.003785411784 },
      { u: "bbl", f: BBL, tag: "field", help: "US oil barrel = 42 US gal" },
      { u: "Mcf", f: 28.316846592, tag: "field", help: "Thousand ft³ (gas)" },
      { u: "MMcf", f: 28316.846592, tag: "field", help: "Million ft³ (gas)" },
      { u: "acre-ft", f: 1233.48183754752, tag: "field" },
    ],
  },
  {
    id: "mass", name: "Mass", icon: Activity, base: "kg",
    note: "Dry / saturated plug mass",
    units: [
      { u: "g", f: 1e-3, tag: "lab" },
      { u: "mg", f: 1e-6 },
      { u: "kg", f: 1 },
      { u: "grain", f: 6.479891e-5 },
      { u: "oz", f: 0.028349523125 },
      { u: "lb", f: LB, tag: "field" },
      { u: "tonne", f: 1000 },
      { u: "US ton", f: 907.18474, tag: "field" },
    ],
  },
  {
    id: "density", name: "Density", icon: Droplets, base: "kg/m³",
    note: "Grain / bulk / fluid density",
    units: [
      { u: "g/cm³", f: 1000, tag: "lab" },
      { u: "g/mL", f: 1000, tag: "lab" },
      { u: "kg/m³", f: 1 },
      { u: "kg/L", f: 1000 },
      { u: "SG (water=1)", f: 1000, help: "Specific gravity relative to water" },
      { u: "lb/ft³", f: 16.018463374, tag: "field" },
      { u: "lb/gal", f: 119.826427317, tag: "field", help: "ppg — mud weight" },
      { u: "lb/bbl", f: LB / BBL, tag: "field" },
    ],
  },
  {
    id: "pressure", name: "Pressure", icon: Wind, base: "Pa",
    note: "Confining / pore / capillary pressure",
    units: [
      { u: "atm", f: ATM, tag: "lab" },
      { u: "psi", f: PSI, tag: "field" },
      { u: "bar", f: 1e5 },
      { u: "mbar", f: 100 },
      { u: "kPa", f: 1000 },
      { u: "MPa", f: 1e6 },
      { u: "Pa", f: 1 },
      { u: "kg/cm²", f: 98066.5, help: "Technical atmosphere (at)" },
      { u: "mmHg", f: 133.322387415 },
      { u: "inHg", f: 3386.389 },
      { u: "psf", f: PSI / 144, tag: "field", help: "lbf/ft²" },
      { u: "dyne/cm²", f: 0.1 },
    ],
  },
  {
    id: "permeability", name: "Permeability", icon: FlaskConical, base: "m²",
    note: "Absolute / effective permeability",
    units: [
      { u: "mD", f: DARCY * 1e-3, tag: "lab", help: "Millidarcy — the usual SCAL unit" },
      { u: "µD", f: DARCY * 1e-6, help: "Microdarcy — tight rock" },
      { u: "nD", f: DARCY * 1e-9, help: "Nanodarcy — shale" },
      { u: "darcy", f: DARCY, tag: "field" },
      { u: "D", f: DARCY, tag: "field" },
      { u: "cm²", f: 1e-4 },
      { u: "m²", f: 1 },
      { u: "ft²", f: 0.09290304 },
    ],
  },
  {
    id: "viscosity", name: "Viscosity (dynamic)", icon: Waves, base: "Pa·s",
    note: "Oil / brine / gas viscosity",
    units: [
      { u: "cp", f: 1e-3, tag: "lab", help: "Centipoise = mPa·s" },
      { u: "mPa·s", f: 1e-3, tag: "field" },
      { u: "poise", f: 0.1 },
      { u: "µPa·s", f: 1e-6 },
      { u: "Pa·s", f: 1 },
      { u: "lb/(ft·s)", f: 1.488163944 },
      { u: "lb/(ft·hr)", f: 4.1337887e-4, tag: "field" },
    ],
  },
  {
    id: "flow", name: "Flow rate", icon: Droplets, base: "m³/s",
    note: "Coreflood / production rate",
    units: [
      { u: "cm³/s", f: 1e-6, tag: "lab", help: "cc/s — pump rate at the bench" },
      { u: "cm³/min", f: 1e-6 / 60, tag: "lab" },
      { u: "cm³/hr", f: 1e-6 / 3600, tag: "lab" },
      { u: "mL/min", f: 1e-6 / 60, tag: "lab" },
      { u: "L/min", f: 1e-3 / 60 },
      { u: "L/s", f: 1e-3 },
      { u: "m³/s", f: 1 },
      { u: "gal/min", f: 0.003785411784 / 60, help: "US gpm" },
      { u: "bbl/day", f: BBL / 86400, tag: "field", help: "≈ STB/day" },
      { u: "bbl/hr", f: BBL / 3600, tag: "field" },
      { u: "ft³/day", f: 0.028316846592 / 86400, tag: "field" },
      { u: "Mcf/day", f: 28.316846592 / 86400, tag: "field" },
      { u: "MMscf/day", f: 28316.846592 / 86400, tag: "field" },
    ],
  },
  {
    id: "temperature", name: "Temperature", icon: Zap, base: "°C", affine: true,
    note: "Test / reservoir temperature",
    units: [
      { u: "°C", tag: "lab", toBase: (x) => x, fromBase: (c) => c },
      { u: "°F", tag: "field", toBase: (x) => (x - 32) * 5 / 9, fromBase: (c) => c * 9 / 5 + 32 },
      { u: "K", toBase: (x) => x - 273.15, fromBase: (c) => c + 273.15 },
      { u: "°R", toBase: (x) => (x - 491.67) * 5 / 9, fromBase: (c) => c * 9 / 5 + 491.67, help: "Rankine" },
    ],
  },
  {
    id: "compressibility", name: "Compressibility", icon: Activity, base: "1/Pa",
    note: "Rock / fluid compressibility",
    units: [
      { u: "1/atm", f: 1 / ATM, tag: "lab" },
      { u: "1/psi", f: 1 / PSI, tag: "field" },
      { u: "1/bar", f: 1e-5 },
      { u: "1/kPa", f: 1e-3 },
      { u: "1/MPa", f: 1e-6 },
      { u: "1/Pa", f: 1 },
      { u: "microsip", f: 1e-6 / PSI, tag: "field", help: "1e-6 /psi — reservoir compressibility" },
    ],
  },
  {
    id: "ift", name: "Interfacial tension", icon: Droplets, base: "N/m",
    note: "Surface / interfacial tension",
    units: [
      { u: "dyne/cm", f: 1e-3, tag: "lab" },
      { u: "mN/m", f: 1e-3, tag: "field" },
      { u: "N/m", f: 1 },
      { u: "lbf/ft", f: 14.5939029 },
    ],
  },
  {
    id: "gor", name: "Gas-Oil Ratio", icon: GitBranch, base: "sm³/sm³",
    note: "Solution / producing GOR",
    units: [
      { u: "scf/STB", f: 1 / 5.614583, tag: "field", help: "Standard ft³ per stock-tank barrel" },
      { u: "scf/bbl", f: 1 / 5.614583, tag: "field" },
      { u: "sm³/sm³", f: 1, tag: "lab", help: "Standard m³ per m³" },
      { u: "L/L", f: 1 },
    ],
  },
  {
    id: "time", name: "Time", icon: Activity, base: "s",
    note: "Elapsed / injection time",
    units: [
      { u: "s", f: 1, tag: "lab" },
      { u: "min", f: 60 },
      { u: "hr", f: 3600 },
      { u: "day", f: 86400, tag: "field" },
      { u: "year", f: 31557600, tag: "field" },
    ],
  },
];

const findCat = (id) => CONVERT_CATEGORIES.find((c) => c.id === id);
const findUnit = (cat, u) => cat.units.find((x) => x.u === u);

/** Convert `x` (given in unit `fromU` of category `cat`) into the category's base unit. */
function toBase(cat, fromU, x) {
  const un = findUnit(cat, fromU);
  if (!un) return NaN;
  return cat.affine ? un.toBase(x) : x * un.f;
}
/** Convert a base-unit value `b` into unit `toU` of category `cat`. */
function fromBase(cat, toU, b) {
  const un = findUnit(cat, toU);
  if (!un) return NaN;
  return cat.affine ? un.fromBase(b) : b / un.f;
}
/** Direct conversion between two units of the same category. */
function convert(cat, fromU, toU, x) {
  return fromBase(cat, toU, toBase(cat, fromU, x));
}

/* Export a converter session to Excel — the full category table for the current value. */
function exportConversion(cat, fromU, value) {
  const rows = cat.units.map((un) => [un.u, Number(convert(cat, fromU, un.u, value).toPrecision(8))]);
  const aoa = [
    [`${cat.name} conversion`],
    [`Input`, value, fromU],
    [],
    ["Unit", "Value"],
    ...rows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Conversion");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([out], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${cat.id}_conversion.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* ============================== EXCEL TEMPLATE / IMPORT ============================== */
function buildHeaders(mod) {
  return [
    "SampleID",
    ...mod.sampleFields.map((f) => `${f.label} (${f.unit})`),
    ...mod.rowFields.map((f) => `${f.label} (${f.unit})`),
  ];
}
function downloadTemplate(mod) {
  const headers = buildHeaders(mod);
  const exampleSampleVals = mod.sampleFields.map((f) => f.default);
  const blankRowVals = mod.rowFields.map(() => "");
  const exRows = [];
  const n = Math.max(mod.minRows, 3);
  for (let i = 0; i < n; i++) {
    exRows.push([
      "PLUG-001",
      ...(i === 0 ? exampleSampleVals : mod.sampleFields.map(() => "")),
      ...blankRowVals,
    ]);
  }
  const dataSheet = XLSX.utils.aoa_to_sheet([headers, ...exRows]);
  const instrSheet = XLSX.utils.aoa_to_sheet([
    [mod.name],
    [""],
    ["Formula:", mod.formula],
    [""],
    ["What to fill in:"],
    ...mod.needs.map((n2) => ["", n2]),
    [""],
    ["Rules:"],
    ["", "One row per measurement. Repeat the SampleID for every row that belongs to the same plug."],
    ["", "Sample-level fields (length, diameter, viscosity...) only need to be filled on the FIRST row of each plug — leave them blank on the rest."],
    ["", `Each plug needs at least ${mod.minRows} data row(s).`],
    ["", "Do not reorder or delete columns on the Data sheet."],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, dataSheet, "Data");
  XLSX.utils.book_append_sheet(wb, instrSheet, "Instructions");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([out], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${mod.id}_template.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function parseWorkbook(mod, arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const wsName = wb.SheetNames.includes("Data") ? "Data" : wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const dataRows = aoa.slice(1).filter((r) => r.some((c) => c !== "" && c !== undefined));
  const nSample = mod.sampleFields.length;
  const groups = {};
  dataRows.forEach((r) => {
    const sampleId = String(r[0] ?? "").trim();
    if (!sampleId) return;
    if (!groups[sampleId]) groups[sampleId] = { sampleId, sampleVals: {}, rows: [] };
    mod.sampleFields.forEach((f, i) => {
      const raw = r[1 + i];
      if (raw !== "" && raw !== undefined && groups[sampleId].sampleVals[f.key] === undefined) {
        const num = parseFloat(raw);
        if (Number.isFinite(num)) groups[sampleId].sampleVals[f.key] = num;
      }
    });
    const rowVals = {};
    let complete = true;
    mod.rowFields.forEach((f, i) => {
      const raw = r[1 + nSample + i];
      const num = parseFloat(raw);
      if (!Number.isFinite(num)) complete = false;
      rowVals[f.key] = num;
    });
    if (complete) groups[sampleId].rows.push(rowVals);
  });
  return Object.values(groups);
}

function exportResults(mod, results) {
  const headers = ["SampleID", mod.calc ? "Headline value" : "", "Unit", "R²", "# points"];
  const rows = results.map((r) => [
    r.sampleId,
    Number.isFinite(r.calc?.headline?.value) ? Number(r.calc.headline.value.toFixed(4)) : "",
    r.calc?.headline?.unit ?? "",
    Number.isFinite(r.calc?.r2) ? Number(r.calc.r2.toFixed(4)) : "",
    r.calc?.rows?.length ?? 0,
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Results");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([out], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${mod.id}_results.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ============================== SMALL UI PRIMITIVES ============================== */
function Button({ children, onClick, variant = "solid", color = C.rust, style, disabled, icon: Icon }) {
  const base = {
    display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px",
    borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid transparent", transition: "all .15s ease", opacity: disabled ? 0.5 : 1, ...fBody,
  };
  const variants = {
    solid: { background: color, color: "#181818", border: `1px solid ${color}` },
    outline: { background: "transparent", color: C.text, border: `1px solid ${C.border}` },
    ghost: { background: "transparent", color: C.textDim, border: "1px solid transparent" },
  };
  return (
    <button onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant], ...style }} disabled={disabled}>
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}
function Field({ label, unit, value, onChange, placeholder, step = "any", note }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, color: C.textDim, ...fBody }}>
        {label} {unit ? <span style={{ color: C.textFaint, cursor: "help", borderBottom: `1px dotted ${C.textFaint}` }} title={unitHelp(unit)}>({unit})</span> : null}
      </span>
      <input
        type="number" step={step} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 7,
          padding: "9px 10px", color: C.text, fontSize: 13.5, outline: "none", ...fMono,
        }}
      />
      {note && (
        <span style={{ fontSize: 9.5, lineHeight: 1.4, color: C.textFaint, fontStyle: "italic", ...fBody }}>
          {note}
        </span>
      )}
    </label>
  );
}

/* ============================== HOME PAGE ============================== */
/* Derived from the module table rather than written into the copy, so the headline figure cannot
   fall out of step when modules are added. Navigation hubs are excluded — they open a sub-menu
   rather than being a test in their own right. */
const TEST_COUNT = MODULES.filter((m) => !(typeof m.special === "string" && m.special.includes("hub"))).length;

function Home({ onOpen, onOpenCalculator, onOpenConverter }) {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
      {/* HERO */}
      <div style={{ display: "flex", gap: 28, alignItems: "stretch", padding: "56px 0 40px", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 420px" }}>
          <div style={{ fontSize: 12, letterSpacing: 2, color: C.rust, ...fMono, marginBottom: 14 }}>
            SKAL BENCH · ROUTINE &amp; SPECIAL CORE ANALYSIS
          </div>
          <h1 style={{ fontSize: 40, lineHeight: 1.12, margin: 0, color: C.text, ...fDisplay, fontWeight: 700 }}>
            Every result, with the equation<br />and the source behind it.
          </h1>
          <p style={{ marginTop: 18, fontSize: 15.5, lineHeight: 1.65, color: C.textDim, maxWidth: 560, ...fBody }}>
            {TEST_COUNT} tests across routine and special core analysis. Each one tells you exactly what
            to measure, hands you a ready-made spreadsheet, and returns the result with its
            best-fit curve — one plug by hand, or a batch at once.
          </p>
          <p style={{ marginTop: 12, fontSize: 15.5, lineHeight: 1.65, color: C.textDim, maxWidth: 560, ...fBody }}>
            Every equation and the published source behind it is shown, and the fitted
            coefficients can be calibrated to your own core — so you can check a number
            rather than take it on trust.
          </p>
        </div>
        {/* SIGNATURE: core strip */}
        <div style={{ width: 92, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}`, position: "relative", background: "linear-gradient(180deg, #6b4425 0%, #8a5a30 12%, #7a4d29 24%, #55371f 38%, #93643a 50%, #4b3220 64%, #6f4a2a 78%, #3c2818 90%, #2a1c11 100%)" }}>
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} style={{ position: "absolute", left: 0, right: 0, top: `${(i / 14) * 100}%`, display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 10, height: 1, background: "rgba(0,0,0,0.35)" }} />
              <span style={{ fontSize: 7.5, color: "rgba(237,234,228,0.55)", ...fMono }}>{(i * 0.5).toFixed(1)}m</span>
            </div>
          ))}
        </div>
      </div>

      {/* CALCULATOR ENTRY POINT */}
      <button
        onClick={onOpenCalculator}
        style={{
          width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 16,
          background: `linear-gradient(90deg, ${C.amberSoft}, ${C.panel})`, border: `1px solid ${C.amber}66`,
          borderRadius: 12, padding: "18px 20px", cursor: "pointer", marginBottom: 36,
        }}
      >
        <div style={{ width: 42, height: 42, borderRadius: 10, background: C.amberSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <CalcIcon size={20} color={C.amber} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: C.text, ...fDisplay }}>SCAL Quick Calculator</div>
          <div style={{ fontSize: 12.5, color: C.textDim, marginTop: 2, ...fBody }}>
            Porosity, pore/bulk/grain volume, core area, densities, saturations, permeability and Archie's electrical relations — instant, with equation and units shown.
          </div>
        </div>
        <ChevronRight size={18} color={C.amber} style={{ flexShrink: 0 }} />
      </button>

      {/* CONVERTER ENTRY POINT */}
      <button
        onClick={onOpenConverter}
        style={{
          width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 16,
          background: `linear-gradient(90deg, ${C.tealSoft}, ${C.panel})`, border: `1px solid ${C.teal}66`,
          borderRadius: 12, padding: "18px 20px", cursor: "pointer", marginBottom: 36,
        }}
      >
        <div style={{ width: 42, height: 42, borderRadius: 10, background: C.tealSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Scale size={20} color={C.teal} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: C.text, ...fDisplay }}>Petroleum Unit Converter</div>
          <div style={{ fontSize: 12.5, color: C.textDim, marginTop: 2, ...fBody }}>
            Full unit list for length, volume, pressure, permeability, viscosity, flow, density and more, plus an °API / specific-gravity / density tool.
          </div>
        </div>
        <ChevronRight size={18} color={C.teal} style={{ flexShrink: 0 }} />
      </button>

      {/* MODULES BY CATEGORY */}
      {CATEGORIES.map((cat) => {
        const mods = MODULES.filter((m) => m.category === cat.name && !m.hidden);
        const soon = COMING_SOON.filter((s) => s.category === cat.name);
        if (!mods.length && !soon.length) return null;
        const CatIcon = cat.icon;
        return (
          <div key={cat.name} style={{ marginBottom: 34 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <CatIcon size={13} color={C.textFaint} />
              <div style={{ fontSize: 11, letterSpacing: 1.5, color: C.textFaint, ...fMono }}>{cat.name.toUpperCase()}</div>
              <div style={{ fontSize: 11, color: C.textFaint, opacity: 0.6, ...fBody }}>— {cat.note}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 14 }}>
              {mods.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    onClick={() => onOpen(m.id)}
                    style={{
                      textAlign: "left", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12,
                      padding: 18, cursor: "pointer", color: C.text, display: "flex", flexDirection: "column", gap: 12,
                      transition: "border-color .15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = m.color)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: m.soft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon size={17} color={m.color} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, ...fDisplay }}>{m.name}</div>
                      <div style={{ fontSize: 12.5, color: C.textDim, marginTop: 4, lineHeight: 1.5, ...fBody }}>{m.short}</div>
                    </div>
                    <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: m.color, ...fBody, fontWeight: 600 }}>
                      Open test <ChevronRight size={13} />
                    </div>
                  </button>
                );
              })}
              {soon.map((m, i) => {
                const Icon = m.icon;
                return (
                  <div key={i} style={{ background: C.bgSoft, border: `1px dashed ${C.border}`, borderRadius: 12, padding: 18, display: "flex", gap: 12, alignItems: "center", opacity: 0.65 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: C.panel2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={15} color={C.slate} />
                    </div>
                    <div style={{ fontSize: 13, color: C.textDim, ...fBody }}>{m.name}</div>
                    <Lock size={13} color={C.slate} style={{ marginLeft: "auto", flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <VisitorCounter />
    </div>
  );
}

/* ============================== CHART RENDER ============================== */
/* ============================== VISITOR COUNTER ==============================
 * A self-styled visit counter. Rather than embedding a third-party badge image, this fetches a
 * plain number from a free counting API and renders it with the app's own typography and palette,
 * so it reads as part of the interface instead of a bolted-on widget.
 *
 * Why not the map badges: the hosted visitor-map services have proved unreliable — RevolverMaps
 * shut down in 2024, ClustrMaps went unreachable in 2026, and the original countapi.xyz died in
 * 2026 as well. The endpoint used here is an actively maintained open-source revival of that API
 * (github.com/syntaxerror019/countapi). If it ever disappears too, the component fails quietly:
 * the counter simply hides itself rather than showing a broken image or an error.
 *
 * TO ACTIVATE:
 *   1. Change COUNTER_KEY below to something unique to this deployment. Keys are a shared global
 *      namespace with no accounts, so a generic key would collide with someone else's counter.
 *      Keep the random suffix, or replace it with another unguessable string.
 *   2. That's it — no signup, no API key, no account.
 *
 * Behaviour: the count increments once per browser session (sessionStorage), not once per render,
 * so navigating between modules doesn't inflate it. Counting is best-effort — visitors who block
 * third-party requests are not counted, and the number is a visit count, not unique people. */
const COUNTER_API = "https://countapi.mileshilliard.com/api/v1";
const COUNTER_KEY = "skalbench_visits_sk2888mn"; // <-- make this unique to your deployment
const COUNTER_SESSION_FLAG = "skalbench_counted";

function VisitorCounter() {
  const [count, setCount] = useState(null);
  const [dead, setDead] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Count a visit once per browser session; afterwards just read the value.
    let alreadyCounted = false;
    try {
      alreadyCounted = window.sessionStorage.getItem(COUNTER_SESSION_FLAG) === "1";
    } catch (e) { /* sessionStorage unavailable (private mode / sandbox) — fall through and read only */ }
    const endpoint = alreadyCounted ? "get" : "hit";

    fetch(`${COUNTER_API}/${endpoint}/${COUNTER_KEY}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (cancelled) return;
        const v = parseInt(d && d.value, 10);
        if (!Number.isFinite(v)) throw new Error("bad payload");
        setCount(v);
        if (!alreadyCounted) {
          try { window.sessionStorage.setItem(COUNTER_SESSION_FLAG, "1"); } catch (e) { /* ignore */ }
        }
      })
      .catch(() => { if (!cancelled) setDead(true); });

    return () => { cancelled = true; };
  }, []);

  // Fail quietly: an unreachable counter should leave no trace on the page.
  if (dead) return null;

  return (
    <div style={{ marginTop: 34, paddingTop: 18, borderTop: `1px solid ${C.borderSoft}`, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: 10.5, letterSpacing: 1.5, color: C.textFaint, ...fMono }}>VISITS</span>
      <span style={{ fontSize: 25, fontWeight: 700, color: C.rust, ...fDisplay, fontVariantNumeric: "tabular-nums", minWidth: 60 }}>
        {count === null ? "—" : count.toLocaleString()}
      </span>
      <span style={{ fontSize: 11.5, color: C.textFaint, ...fBody }}>
        recorded visits to SKAL Bench
      </span>
    </div>
  );
}

/* ---------- Chart display overrides ----------
 * Applied as prop spreads at the end of each axis/grid element, so they win over the defaults
 * without those defaults having to be rewritten per chart type. Overrides affect presentation
 * only — the plotted data and every fitted parameter are untouched. */
function axOv(ov, axis) {
  if (!ov) return {};
  const out = {};
  const label = axis === "x" ? ov.xLabel : ov.yLabel;
  const mn = axis === "x" ? ov.xMin : ov.yMin;
  const mx = axis === "x" ? ov.xMax : ov.yMax;
  if (label) {
    out.label = axis === "x"
      ? { value: label, position: "insideBottom", fill: C.textFaint, fontSize: 11, dy: 12, style: { textAnchor: "middle" } }
      : { value: label, angle: -90, fill: C.textFaint, fontSize: 11, position: "insideLeft", style: { textAnchor: "middle" } };
  }
  const hasMn = Number.isFinite(mn), hasMx = Number.isFinite(mx);
  if (hasMn || hasMx) {
    // allowDataOverflow lets the stated limits clip the series rather than being widened to fit it.
    out.domain = [hasMn ? mn : "auto", hasMx ? mx : "auto"];
    out.allowDataOverflow = true;
  }
  return out;
}
const axOvX = (ov) => axOv(ov, "x");
const axOvY = (ov) => axOv(ov, "y");
// Hiding the grid by making it transparent keeps the chart's layout identical.
const gridOv = (ov) => (ov && ov.grid === false ? { stroke: "transparent" } : {});

function ResultChart({ chart, color, ov }) {
  if (!chart) return null;
  if (chart.type === "bar") {
    return (
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={chart.data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={C.borderSoft} strokeDasharray="3 3" {...gridOv(ov)} />
          <XAxis dataKey="label" tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} {...axOvX(ov)} />
          <YAxis tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} label={{ value: "Apparent Permeability, kₐ (mD)", angle: -90, fill: C.textFaint, fontSize: 11, position: "insideLeft", style: { textAnchor: "middle" } }} {...axOvY(ov)} />
          <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, fontSize: 12 }} labelStyle={{ color: C.text }} />
          <Bar dataKey="ka" radius={[4, 4, 0, 0]}>
            {chart.data.map((_, i) => <Cell key={i} fill={color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (chart.type === "klinkenberg") {
    const xs = chart.data.map((p) => p.invPm);
    const xMin = 0, xMax = Math.max(...xs) * 1.1;
    const line = chart.fit
      ? [{ x: xMin, y: chart.fit.slope * xMin + chart.fit.intercept }, { x: xMax, y: chart.fit.slope * xMax + chart.fit.intercept }]
      : null;
    return (
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart margin={{ top: 10, right: 24, left: 0, bottom: 10 }}>
          <CartesianGrid stroke={C.borderSoft} strokeDasharray="3 3" {...gridOv(ov)} />
          <XAxis type="number" dataKey="x" domain={[0, "auto"]} tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} label={{ value: "1 / Mean Pressure, 1/Pm (1/atm)", position: "insideBottom", fill: C.textFaint, fontSize: 11, dy: 12, style: { textAnchor: "middle" } }} {...axOvX(ov)} />
          <YAxis type="number" dataKey="y" tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} label={{ value: "Apparent Permeability, kₐ (mD)", angle: -90, fill: C.textFaint, fontSize: 11, position: "insideLeft", style: { textAnchor: "middle" } }} {...axOvY(ov)} />
          <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, fontSize: 12 }} labelStyle={{ color: C.text }} />
          <Scatter data={chart.data.map((p) => ({ x: p.invPm, y: p.ka }))} fill={color} />
          {line && <Line data={line} dataKey="y" stroke={color} dot={false} strokeWidth={2} activeDot={false} />}
        {ov && ov.fitCurve && <Line data={ov.fitCurve} dataKey="y" stroke={color} strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={false} isAnimationActive={false} />}
          </ComposedChart>
      </ResponsiveContainer>
    );
  }
  if (chart.type === "xyfit") {
    const pts = (chart.points || []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    const xs = pts.map((p) => p.x);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const fitLine = chart.fit
      ? [{ x: xMin, y: chart.fit.slope * xMin + chart.fit.intercept }, { x: xMax, y: chart.fit.slope * xMax + chart.fit.intercept }]
      : null;
    return (
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart margin={{ top: 10, right: 24, left: 6, bottom: 14 }}>
          <CartesianGrid stroke={C.borderSoft} strokeDasharray="3 3" {...gridOv(ov)} />
          <XAxis type="number" dataKey="x" domain={["auto", "auto"]} tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} label={{ value: chart.xLabel || "x", position: "insideBottom", fill: C.textFaint, fontSize: 11, dy: 12, style: { textAnchor: "middle" } }} {...axOvX(ov)} />
          <YAxis type="number" dataKey="y" domain={["auto", "auto"]} tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} label={{ value: chart.yLabel || "y", angle: -90, fill: C.textFaint, fontSize: 11, position: "insideLeft", style: { textAnchor: "middle" } }} {...axOvY(ov)} />
          <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, fontSize: 12 }} labelStyle={{ color: C.text }} />
          {chart.connect && <Line data={pts} dataKey="y" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} activeDot={false} />}
          <Scatter data={pts} fill={color} />
          {fitLine && <Line data={fitLine} dataKey="y" stroke={color} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={false} />}
        {ov && ov.fitCurve && <Line data={ov.fitCurve} dataKey="y" stroke={color} strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={false} isAnimationActive={false} />}
          </ComposedChart>
      </ResponsiveContainer>
    );
  }
  if (chart.type === "decay") {
    const ts = chart.data.map((p) => p.t);
    const tMin = Math.min(...ts), tMax = Math.max(...ts);
    const line = chart.fit
      ? [{ x: tMin, y: chart.fit.slope * tMin + chart.fit.intercept }, { x: tMax, y: chart.fit.slope * tMax + chart.fit.intercept }]
      : null;
    return (
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart margin={{ top: 10, right: 24, left: 0, bottom: 10 }}>
          <CartesianGrid stroke={C.borderSoft} strokeDasharray="3 3" {...gridOv(ov)} />
          <XAxis type="number" dataKey="x" tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} label={{ value: "Time (s)", position: "insideBottom", fill: C.textFaint, fontSize: 11, dy: 12, style: { textAnchor: "middle" } }} {...axOvX(ov)} />
          <YAxis type="number" dataKey="y" tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} label={{ value: "ln(ΔP)", angle: -90, fill: C.textFaint, fontSize: 11, position: "insideLeft", style: { textAnchor: "middle" } }} {...axOvY(ov)} />
          <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, fontSize: 12 }} labelStyle={{ color: C.text }} />
          <Scatter data={chart.data.map((p) => ({ x: p.t, y: p.lnDP }))} fill={color} />
          {line && <Line data={line} dataKey="y" stroke={color} dot={false} strokeWidth={2} activeDot={false} />}
        {ov && ov.fitCurve && <Line data={ov.fitCurve} dataKey="y" stroke={color} strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={false} isAnimationActive={false} />}
          </ComposedChart>
      </ResponsiveContainer>
    );
  }
  if (chart.type === "coreflood") {
    const dPs = chart.data.map((p) => p.dP);
    const dMax = Math.max(...dPs) * 1.15;
    const line = chart.fitOrigin
      ? [{ x: 0, y: 0 }, { x: dMax, y: chart.fitOrigin.slope * dMax }]
      : null;
    return (
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart margin={{ top: 10, right: 24, left: 0, bottom: 10 }}>
          <CartesianGrid stroke={C.borderSoft} strokeDasharray="3 3" {...gridOv(ov)} />
          <XAxis type="number" dataKey="x" domain={[0, "auto"]} tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} label={{ value: "Pressure Drop, ΔP (atm)", position: "insideBottom", fill: C.textFaint, fontSize: 11, dy: 12, style: { textAnchor: "middle" } }} {...axOvX(ov)} />
          <YAxis type="number" dataKey="y" tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} label={{ value: "Flow Rate, Q (cm³/s)", angle: -90, fill: C.textFaint, fontSize: 11, position: "insideLeft", style: { textAnchor: "middle" } }} {...axOvY(ov)} />
          <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, fontSize: 12 }} labelStyle={{ color: C.text }} />
          <Scatter data={chart.data.map((p) => ({ x: p.dP, y: p.Q }))} fill={color} />
          {line && <Line data={line} dataKey="y" stroke={color} dot={false} strokeWidth={2} activeDot={false} />}
        {ov && ov.fitCurve && <Line data={ov.fitCurve} dataKey="y" stroke={color} strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={false} isAnimationActive={false} />}
          </ComposedChart>
      </ResponsiveContainer>
    );
  }
  if (chart.type === "relperm") {
    const data = chart.data.map((p) => ({ x: p.Sw, kro: p.kro, krw: p.krw }));
    return (
      <div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 24, right: 24, left: 0, bottom: 10 }}>
            <CartesianGrid stroke={C.borderSoft} strokeDasharray="3 3" {...gridOv(ov)} />
            <XAxis type="number" dataKey="x" domain={[0, 1]} tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} label={{ value: "Water Saturation, Sw (fraction)", position: "insideBottom", fill: C.textFaint, fontSize: 11, dy: 12, style: { textAnchor: "middle" } }} {...axOvX(ov)} />
            <YAxis type="number" domain={[0, "auto"]} tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} label={{ value: "Relative Permeability (fraction)", angle: -90, fill: C.textFaint, fontSize: 11, position: "insideLeft", style: { textAnchor: "middle" } }} {...axOvY(ov)} />
            <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, fontSize: 12 }} labelStyle={{ color: C.text }} />
            <Line type="monotone" dataKey="kro" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="krw" stroke={C.teal} strokeWidth={2} dot={{ r: 3, fill: C.teal }} activeDot={{ r: 4 }} />
            {Number.isFinite(chart.crossoverSw) && Number.isFinite(chart.crossoverK) && (
              <ReferenceDot x={chart.crossoverSw} y={chart.crossoverK} r={5} fill={C.danger} stroke="none"
                label={{ value: `Crossover Sw = ${fmt(chart.crossoverSw, 2)}`, position: "top", fill: C.text, fontSize: 11, style: { textAnchor: "middle" } }} />
            )}
          {ov && ov.fitCurve && <Line data={ov.fitCurve} dataKey="y" stroke={color} strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={false} isAnimationActive={false} />}
          </ComposedChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 11.5, color: C.textDim, ...fBody }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 2, background: color, display: "inline-block" }} /> kro (oil)</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 2, background: C.teal, display: "inline-block" }} /> krw (water)</span>
        </div>
      </div>
    );
  }
  if (chart.type === "corey") {
    const kroScatter = chart.data.map((p) => ({ x: p.Sw, y: p.kro }));
    const krwScatter = chart.data.map((p) => ({ x: p.Sw, y: p.krw }));
    const kroCurve = chart.curve.map((p) => ({ x: p.Sw, y: p.kro }));
    const krwCurve = chart.curve.map((p) => ({ x: p.Sw, y: p.krw }));
    return (
      <div>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart margin={{ top: 10, right: 24, left: 0, bottom: 10 }}>
            <CartesianGrid stroke={C.borderSoft} strokeDasharray="3 3" {...gridOv(ov)} />
            <XAxis type="number" dataKey="x" domain={[0, 1]} tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} label={{ value: "Water Saturation, Sw (fraction)", position: "insideBottom", fill: C.textFaint, fontSize: 11, dy: 12, style: { textAnchor: "middle" } }} {...axOvX(ov)} />
            <YAxis type="number" dataKey="y" domain={[0, "auto"]} tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} label={{ value: "Relative Permeability (fraction)", angle: -90, fill: C.textFaint, fontSize: 11, position: "insideLeft", style: { textAnchor: "middle" } }} {...axOvY(ov)} />
            <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, fontSize: 12 }} labelStyle={{ color: C.text }} />
            <Scatter data={kroScatter} fill={color} />
            <Scatter data={krwScatter} fill={C.teal} />
            <Line data={kroCurve} dataKey="y" stroke={color} dot={false} strokeWidth={2} activeDot={false} />
            <Line data={krwCurve} dataKey="y" stroke={C.teal} dot={false} strokeWidth={2} activeDot={false} />
          {ov && ov.fitCurve && <Line data={ov.fitCurve} dataKey="y" stroke={color} strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={false} isAnimationActive={false} />}
          </ComposedChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 11.5, color: C.textDim, ...fBody }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 2, background: color, display: "inline-block" }} /> kro fit (points + curve)</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 2, background: C.teal, display: "inline-block" }} /> krw fit (points + curve)</span>
        </div>
      </div>
    );
  }
  if (chart.type === "krokrw") {
    const data = chart.data.map((p) => ({ x: p.kro, y: p.krw }));
    const maxVal = Math.max(...data.map((p) => Math.max(p.x, p.y))) * 1.08 || 1;
    return (
      <div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart margin={{ top: 24, right: 24, left: 0, bottom: 10 }}>
            <CartesianGrid stroke={C.borderSoft} strokeDasharray="3 3" {...gridOv(ov)} />
            <XAxis type="number" dataKey="x" domain={[0, maxVal]} tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} label={{ value: "Kro (fraction)", position: "insideBottom", fill: C.textFaint, fontSize: 11, dy: 12, style: { textAnchor: "middle" } }} {...axOvX(ov)} />
            <YAxis type="number" dataKey="y" domain={[0, maxVal]} tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} label={{ value: "Krw (fraction)", angle: -90, fill: C.textFaint, fontSize: 11, position: "insideLeft", style: { textAnchor: "middle" } }} {...axOvY(ov)} />
            <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, fontSize: 12 }} labelStyle={{ color: C.text }} />
            <ReferenceLine segment={[{ x: 0, y: 0 }, { x: maxVal, y: maxVal }]} stroke={C.textFaint} strokeDasharray="4 4" />
            <Line data={data} dataKey="y" stroke={color} dot={{ r: 2, fill: color }} strokeWidth={2} activeDot={{ r: 4 }} />
            {Number.isFinite(chart.crossoverK) && (
              <ReferenceDot x={chart.crossoverK} y={chart.crossoverK} r={5} fill={C.danger} stroke="none"
                label={{ value: `Crossover kr = ${fmt(chart.crossoverK, 2)}`, position: "top", fill: C.text, fontSize: 11, style: { textAnchor: "middle" } }} />
            )}
          {ov && ov.fitCurve && <Line data={ov.fitCurve} dataKey="y" stroke={color} strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={false} isAnimationActive={false} />}
          </ComposedChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap", fontSize: 11.5, color: C.textDim, ...fBody }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 2, background: color, display: "inline-block" }} /> kro vs krw (parametric in Sw)</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 2, borderTop: `2px dashed ${C.textFaint}`, display: "inline-block" }} /> 1:1 line (kro = krw)</span>
        </div>
      </div>
    );
  }
  if (chart.type === "nmrIlt") {
    const data = chart.bins.map((t2, i) => ({ x: t2, y: chart.f[i] }));
    return (
      <div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 24, right: 24, left: 0, bottom: 10 }}>
            <CartesianGrid stroke={C.borderSoft} strokeDasharray="3 3" {...gridOv(ov)} />
            <XAxis type="number" dataKey="x" scale="log" domain={["auto", "auto"]} tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border}
              label={{ value: "T2 (ms, log scale)", position: "insideBottom", fill: C.textFaint, fontSize: 11, dy: 12, style: { textAnchor: "middle" } }} {...axOvX(ov)} />
            <YAxis type="number" tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border}
              label={{ value: "Amplitude", angle: -90, fill: C.textFaint, fontSize: 11, position: "insideLeft", style: { textAnchor: "middle" } }} {...axOvY(ov)} />
            <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, fontSize: 12 }} labelStyle={{ color: C.text }} />
            <Line type="monotone" dataKey="y" stroke={color} strokeWidth={2} dot={{ r: 2, fill: color }} activeDot={{ r: 4 }} />
            <ReferenceLine x={chart.cbwCutoff} stroke={C.amber} strokeDasharray="4 3" label={{ value: `CBW ${chart.cbwCutoff}ms`, position: "top", fill: C.amber, fontSize: 10, style: { textAnchor: "middle" } }} />
            <ReferenceLine x={chart.bviCutoff} stroke={C.danger} strokeDasharray="4 3" label={{ value: `BVI ${chart.bviCutoff}ms`, position: "top", fill: C.danger, fontSize: 10, style: { textAnchor: "middle" } }} />
          {ov && ov.fitCurve && <Line data={ov.fitCurve} dataKey="y" stroke={color} strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={false} isAnimationActive={false} />}
          </ComposedChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap", fontSize: 11.5, color: C.textDim, ...fBody }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 2, background: color, display: "inline-block" }} /> T2 distribution (via ILT)</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 2, borderTop: `2px dashed ${C.amber}`, display: "inline-block" }} /> CBW cutoff</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 2, borderTop: `2px dashed ${C.danger}`, display: "inline-block" }} /> BVI cutoff</span>
        </div>
      </div>
    );
  }
  if (chart.type === "nmrRaw") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chart.channels} margin={{ top: 10, right: 24, left: 0, bottom: 10 }}>
          <CartesianGrid stroke={C.borderSoft} strokeDasharray="3 3" {...gridOv(ov)} />
          <XAxis type="number" dataKey="x" tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border}
            label={{ value: `Time (${chart.timeUnit || "acquisition X unit"})`, position: "insideBottom", fill: C.textFaint, fontSize: 11, dy: 12, style: { textAnchor: "middle" } }} {...axOvX(ov)} />
          <YAxis type="number" tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border}
            label={{ value: "Machine signal units", angle: -90, fill: C.textFaint, fontSize: 11, position: "insideLeft", style: { textAnchor: "middle" } }} {...axOvY(ov)} />
          <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, fontSize: 12 }} labelStyle={{ color: C.text }} />
          <Line dataKey="real" stroke={C.clay} dot={false} strokeWidth={1.5} activeDot={false} />
          <Line dataKey="imaginary" stroke={C.cyan} dot={false} strokeWidth={1.5} activeDot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }
  if (chart.type === "nmrFit") {
    return (
      <div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart margin={{ top: 10, right: 24, left: 0, bottom: 10 }}>
            <CartesianGrid stroke={C.borderSoft} strokeDasharray="3 3" {...gridOv(ov)} />
            <XAxis type="number" dataKey="x" tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border}
              label={{ value: "Time (ms)", position: "insideBottom", fill: C.textFaint, fontSize: 11, dy: 12, style: { textAnchor: "middle" } }} {...axOvX(ov)} />
            <YAxis type="number" dataKey="y" scale="log" domain={["auto", "auto"]} tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border}
              label={{ value: "Echo Amplitude (log scale)", angle: -90, fill: C.textFaint, fontSize: 11, position: "insideLeft", style: { textAnchor: "middle" } }} {...axOvY(ov)} />
            <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, fontSize: 12 }} labelStyle={{ color: C.text }} />
            <Scatter data={chart.raw} fill={C.textFaint} />
            <Line data={chart.fitted} dataKey="y" stroke={color} dot={false} strokeWidth={2} activeDot={false} />
          {ov && ov.fitCurve && <Line data={ov.fitCurve} dataKey="y" stroke={color} strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={false} isAnimationActive={false} />}
          </ComposedChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap", fontSize: 11.5, color: C.textDim, ...fBody }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, background: C.textFaint, display: "inline-block", borderRadius: 4 }} /> Measured decay (downsampled)</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 2, background: color, display: "inline-block" }} /> ExpDec3 fit</span>
        </div>
      </div>
    );
  }
  if (chart.type === "fracflow") {
    const curveData = chart.curve.map((p) => ({ x: p.Sw, y: p.fw }));
    const tangentData = chart.tangent.map((p) => ({ x: p.Sw, y: p.fw }));
    return (
      <div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart margin={{ top: 24, right: 24, left: 0, bottom: 10 }}>
            <CartesianGrid stroke={C.borderSoft} strokeDasharray="3 3" {...gridOv(ov)} />
            <XAxis type="number" dataKey="x" domain={[0, 1]} tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} label={{ value: "Water Saturation, Sw (fraction)", position: "insideBottom", fill: C.textFaint, fontSize: 11, dy: 12, style: { textAnchor: "middle" } }} {...axOvX(ov)} />
            <YAxis type="number" dataKey="y" domain={[0, 1]} tick={{ fill: C.textDim, fontSize: 11 }} stroke={C.border} label={{ value: "Water Fractional Flow, fw (fraction)", angle: -90, fill: C.textFaint, fontSize: 11, position: "insideLeft", style: { textAnchor: "middle" } }} {...axOvY(ov)} />
            <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, fontSize: 12 }} labelStyle={{ color: C.text }} />
            <Line data={curveData} dataKey="y" stroke={color} dot={false} strokeWidth={2} activeDot={false} />
            <Line data={tangentData} dataKey="y" stroke={C.amber} dot={false} strokeWidth={2} strokeDasharray="6 4" activeDot={false} />
            <Scatter data={[{ x: chart.frontSw, y: chart.frontFw }]} fill={C.danger} />
            <ReferenceDot x={chart.frontSw} y={chart.frontFw} r={5} fill={C.danger} stroke="none"
              label={{ value: `Swf = ${fmt(chart.frontSw, 2)}, fw = ${fmt(chart.frontFw, 2)}`, position: "top", fill: C.text, fontSize: 11, style: { textAnchor: "middle" } }} />
            <ReferenceLine x={chart.swBreakthrough} stroke={C.amber} strokeDasharray="2 2"
              label={{ value: `S̄w breakthrough = ${fmt(chart.swBreakthrough, 2)}`, position: "insideTopRight", fill: C.amber, fontSize: 11, style: { textAnchor: "middle" } }} />
          {ov && ov.fitCurve && <Line data={ov.fitCurve} dataKey="y" stroke={color} strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={false} isAnimationActive={false} />}
          </ComposedChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap", fontSize: 11.5, color: C.textDim, ...fBody }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 2, background: color, display: "inline-block" }} /> fw(Sw) curve</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 2, borderTop: `2px dashed ${C.amber}`, display: "inline-block" }} /> Welge tangent from Swc</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: C.danger, display: "inline-block" }} /> frontal (shock) point</span>
        </div>
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, fontSize: 12.5 }}>
          <div><span style={{ color: C.textDim, ...fBody }}>Frontal saturation Swf</span><br /><span style={{ color: C.text, ...fMono }}>{fmt(chart.frontSw, 3)}</span></div>
          <div><span style={{ color: C.textDim, ...fBody }}>Frontal fw</span><br /><span style={{ color: C.text, ...fMono }}>{fmt(chart.frontFw, 3)}</span></div>
          <div><span style={{ color: C.textDim, ...fBody }}>Avg Sw at breakthrough</span><br /><span style={{ color: C.text, ...fMono }}>{fmt(chart.swBreakthrough, 3)}</span></div>
        </div>
      </div>
    );
  }
  return null;
}

/* ============================== FIGURE EXPORT (JOURNAL / CONFERENCE PRESETS) ============================== */
/* Specs marked verified:true are taken directly from each venue's published author/artwork guidelines
 * (checked at build time — always confirm against the current Guide for Authors before final submission,
 * since journals do revise these). Specs marked verified:false use general academic-publishing convention
 * because the venue does not publish a detailed figure-resolution spec. */
const EXPORT_PRESETS = [
  { key: "default", name: "Default (screen / presentation)", widthIn: 8, dpi: 150, fontPt: 11, color: true, verified: true,
    note: "Balanced quality for slides, reports, or on-screen use — not a journal spec." },
  { key: "spe", name: "SPE — single column", widthIn: 3.33, dpi: 300, fontPt: 8, color: false, verified: true,
    note: "300 dpi minimum; SPE recommends grayscale — color figures incur a reproduction fee.", source: "SPE Technical Publications Style Guide" },
  { key: "spe_full", name: "SPE — full page width", widthIn: 6.83, dpi: 300, fontPt: 8, color: false, verified: true,
    note: "Same standard as SPE single-column, sized for a full-width figure.", source: "SPE Technical Publications Style Guide" },
  { key: "aapg", name: "AAPG Bulletin", widthIn: 3.35, dpi: 1000, fontPt: 8, color: true, verified: true,
    note: "1000 ppi line-art standard — by far the largest file of any preset here.", source: "AAPG Bulletin Instructions to Authors" },
  { key: "elsevier", name: "Elsevier (JPSE, Fuel, Marine & Petroleum Geology)", widthIn: 3.5, dpi: 500, fontPt: 7, color: true, verified: true,
    note: "500 dpi combination-art standard; exact column width varies slightly by journal — check that journal's Guide for Authors.", source: "Elsevier Artwork Instructions" },
  { key: "spwla", name: "SPWLA — Petrophysics Journal", widthIn: 3.25, dpi: 300, fontPt: 8, color: true, verified: true,
    note: "300 dpi at publication size; full color permitted (subject to fee).", source: "SPWLA Petrophysics Journal author guidelines" },
  { key: "sca", name: "Society of Core Analysts (SCA) Symposium", widthIn: 3.3, dpi: 300, fontPt: 9, color: true, verified: false,
    note: "SCA doesn't publish a detailed figure-resolution spec — general convention shown. Confirm against the current call for papers." },
  { key: "energyfuels", name: "Energy & Fuels (ACS)", widthIn: 3.3, dpi: 300, fontPt: 8, color: true, verified: false,
    note: "General ACS two-column convention. Confirm against the journal's current Author Guidelines." },
  { key: "petroleumgeoscience", name: "Petroleum Geoscience (EAGE / GSL)", widthIn: 3.3, dpi: 300, fontPt: 8, color: true, verified: false,
    note: "General academic-journal convention. Confirm against the journal's current Instructions for Authors." },
];

/* Grayscale presets need line styles that survive losing color. Assigning distinct
 * lightness plus a distinct dash pattern keeps series separable in print. */
const PRINT_GRAY_RAMP = ["#111111", "#7A7A7A", "#4A4A4A", "#A6A6A6", "#2E2E2E", "#8E8E8E"];
const PRINT_GRAY_DASH = ["", "7 3", "2 2.5", "9 3 2 3", "4 4", "1.5 3"];

function restyleSvgForPrint(svgEl, preset) {
  const clone = svgEl.cloneNode(true);

  // White paper behind everything.
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", "0"); bg.setAttribute("y", "0");
  bg.setAttribute("width", "100%"); bg.setAttribute("height", "100%");
  bg.setAttribute("fill", "#ffffff");
  clone.insertBefore(bg, clone.firstChild);

  // Recharts-rendered figures.
  clone.querySelectorAll("[class*='recharts-cartesian-grid'] line").forEach((l) => l.setAttribute("stroke", "#cccccc"));
  clone.querySelectorAll("[class*='recharts-cartesian-axis-line'], [class*='recharts-cartesian-axis-tick-line']").forEach((l) => l.setAttribute("stroke", "#333333"));
  clone.querySelectorAll("[class*='recharts-legend']").forEach((l) => { l.style.color = "#111111"; });

  // Hand-built SVG figures tag their parts with data-role. Without this the
  // dark-theme grid and frame strokes stay near-black on white paper.
  clone.querySelectorAll("[data-role='grid']").forEach((l) => l.setAttribute("stroke", "#cccccc"));
  clone.querySelectorAll("[data-role='frame']").forEach((l) => l.setAttribute("stroke", "#333333"));

  // Text: black, print face, and a size hierarchy rather than one flat size.
  clone.querySelectorAll("text").forEach((t) => {
    t.setAttribute("fill", "#111111");
    t.style.fill = "#111111";
    t.setAttribute("font-family", "Arial, Helvetica, sans-serif");
    if (preset.fontPt) {
      const role = t.getAttribute("data-role");
      const scale = (role === "tick" || role === "legend") ? 0.9 : 1;
      t.setAttribute("font-size", `${(preset.fontPt * scale).toFixed(2)}pt`);
    }
  });

  // Grayscale presets: recolor series here so vector exports match the raster ones.
  // The PNG path also applies a canvas filter, but SVG has no such step.
  if (!preset.color) {
    const series = clone.querySelectorAll("[data-role='series'], [class*='recharts-line-curve'], [class*='recharts-area-area']");
    series.forEach((el, i) => {
      const g = PRINT_GRAY_RAMP[i % PRINT_GRAY_RAMP.length];
      if (el.getAttribute("stroke") && el.getAttribute("stroke") !== "none") el.setAttribute("stroke", g);
      if (el.getAttribute("fill") && el.getAttribute("fill") !== "none") el.setAttribute("fill", g);
      if (!el.getAttribute("stroke-dasharray")) {
        const d = PRINT_GRAY_DASH[i % PRINT_GRAY_DASH.length];
        if (d) el.setAttribute("stroke-dasharray", d);
      }
    });
    clone.querySelectorAll("[data-role='dot'], [data-role='legend-swatch']").forEach((el, i) => {
      const g = PRINT_GRAY_RAMP[i % PRINT_GRAY_RAMP.length];
      if (el.getAttribute("fill") && el.getAttribute("fill") !== "none") el.setAttribute("fill", g);
      if (el.getAttribute("stroke") && el.getAttribute("stroke") !== "none") el.setAttribute("stroke", g);
    });
  }
  return clone;
}

function svgToDataUrl(svgEl) {
  const s = new XMLSerializer().serializeToString(svgEl);
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(s)))}`;
}

function downloadBlobUrl(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}

async function exportChartPng(svgEl, preset, filenameBase) {
  const bbox = svgEl.getBoundingClientRect();
  const aspect = bbox.height / bbox.width;
  const targetW = Math.round(preset.widthIn * preset.dpi);
  const targetH = Math.round(targetW * aspect);
  const styled = restyleSvgForPrint(svgEl, preset);
  styled.setAttribute("width", targetW);
  styled.setAttribute("height", targetH);
  const dataUrl = svgToDataUrl(styled);
  const img = new window.Image();
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = dataUrl; });
  const canvas = document.createElement("canvas");
  canvas.width = targetW; canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, targetW, targetH);
  if (!preset.color) ctx.filter = "grayscale(1)";
  ctx.drawImage(img, 0, 0, targetW, targetH);
  downloadBlobUrl(canvas.toDataURL("image/png"), `${filenameBase}_${preset.key}_${preset.dpi}dpi.png`);
}

function exportChartSvg(svgEl, preset, filenameBase) {
  const styled = restyleSvgForPrint(svgEl, preset);
  const s = new XMLSerializer().serializeToString(styled);
  const blob = new Blob([s], { type: "image/svg+xml" });
  const reader = new FileReader();
  reader.onload = () => downloadBlobUrl(reader.result, `${filenameBase}_${preset.key}_vector.svg`);
  reader.readAsDataURL(blob);
}

function ExportModal({ svgRef, filenameBase, onClose }) {
  const [presetKey, setPresetKey] = useState("default");
  const [busy, setBusy] = useState(false);
  const preset = EXPORT_PRESETS.find((p) => p.key === presetKey);

  const doExport = async (asVector) => {
    const svgEl = svgRef.current?.querySelector("svg");
    if (!svgEl) return;
    setBusy(true);
    try {
      if (asVector) exportChartSvg(svgEl, preset, filenameBase);
      else await exportChartPng(svgEl, preset, filenameBase);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, ...fDisplay, marginBottom: 4 }}>Export figure</div>
        <div style={{ fontSize: 12, color: C.textFaint, marginBottom: 16, ...fBody }}>Pick a target — sizing, resolution, and color mode are set to match that venue's published figure guidelines.</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, color: C.textDim, ...fBody }}>Journal / conference</span>
          <select
            value={presetKey}
            onChange={(e) => setPresetKey(e.target.value)}
            style={{
              background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 7,
              padding: "10px 12px", color: C.text, fontSize: 13, outline: "none", cursor: "pointer", ...fBody,
            }}
          >
            {EXPORT_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>{p.name}{!p.verified ? " (general convention)" : ""}</option>
            ))}
          </select>
        </div>

        {preset && (
          <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 9, background: C.bgSoft, border: `1px solid ${C.borderSoft}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, ...fBody }}>
              {preset.name} {!preset.verified && <span style={{ fontSize: 10, color: C.textFaint }}>(general convention)</span>}
            </div>
            <div style={{ fontSize: 11, color: C.textFaint, marginTop: 4, ...fMono }}>{preset.widthIn}in wide · {preset.dpi} dpi · {preset.fontPt}pt · {preset.color ? "color" : "grayscale"}</div>
            <div style={{ fontSize: 11, color: C.textFaint, marginTop: 6, lineHeight: 1.5, ...fBody }}>{preset.note}</div>
            {preset.source && <div style={{ fontSize: 10, color: C.textFaint, marginTop: 4, fontStyle: "italic", ...fBody }}>Source: {preset.source}</div>}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
          <Button color={C.rust} icon={Download} onClick={() => doExport(false)} disabled={busy}>{busy ? "Exporting…" : "Save as PNG"}</Button>
          <Button variant="outline" icon={Download} onClick={() => doExport(true)} disabled={busy}>Save as SVG (vector)</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
        <div style={{ fontSize: 10.5, color: C.textFaint, marginTop: 12, ...fBody }}>
          Vector (SVG) is preferred by most venues when accepted — it scales losslessly regardless of DPI. Always check the venue's current guidelines before final submission; publishers do revise these.
        </div>
      </div>
    </div>
  );
}

/* ============================== CHART SMOOTHING & DATA EXPORT ==============================
 * A single place that (a) smooths any chart series and (b) turns any chart or table into CSV,
 * so every figure in the app gets the same two controls without per-module wiring.
 *
 * Smoothing uses Savitzky-Golay quadratic kernels, which preserve peak height and position far
 * better than a plain moving average — important for NMR T2 distributions and pore-throat spectra
 * where the peak IS the measurement (Savitzky, A. & Golay, M.J.E., 1964, "Smoothing and
 * Differentiation of Data by Simplified Least Squares Procedures," Analytical Chemistry 36(8),
 * 1627-1639). Endpoints are left unsmoothed rather than extrapolated. Smoothing is a display aid
 * only: it never feeds the fitted parameters, which are always computed from the raw data. */
const SG_KERNELS = {
  5: { c: [-3, 12, 17, 12, -3], d: 35 },
  7: { c: [-2, 3, 6, 7, 6, 3, -2], d: 21 },
  9: { c: [-21, 14, 39, 54, 59, 54, 39, 14, -21], d: 231 },
};
function sgSmooth(arr, w) {
  const K = SG_KERNELS[w];
  if (!K || !Array.isArray(arr) || arr.length < w) return arr;
  const h = (w - 1) / 2;
  const out = arr.slice();
  for (let i = h; i < arr.length - h; i++) {
    let acc = 0, ok = true;
    for (let j = -h; j <= h; j++) {
      const v = arr[i + j];
      if (!Number.isFinite(v)) { ok = false; break; }
      acc += K.c[j + h] * v;
    }
    if (ok) out[i] = acc / K.d;
  }
  return out;
}
/* Which array and which numeric fields carry the plotted series, per chart type. Bar charts are
 * categorical and are deliberately excluded — smoothing across categories is meaningless. */
const CHART_SERIES = {
  klinkenberg: { arr: "data", keys: ["ka"] },
  xyfit: { arr: "points", keys: ["y"] },
  decay: { arr: "data", keys: ["lnDP"] },
  coreflood: { arr: "data", keys: ["Q"] },
  relperm: { arr: "data", keys: ["kro", "krw"] },
  corey: { arr: "data", keys: ["kro", "krw"] },
  krokrw: { arr: "data", keys: ["krw"] },
  nmrFit: { arr: "raw", keys: ["y"] },
  fracflow: { arr: "curve", keys: ["fw"] },
};
function smoothChart(chart, w) {
  if (!chart || !w || !SG_KERNELS[w]) return chart;
  if (chart.type === "nmrIlt") {
    if (!Array.isArray(chart.f)) return chart;
    return { ...chart, f: sgSmooth(chart.f, w) };
  }
  const spec = CHART_SERIES[chart.type];
  if (!spec) return chart;
  const src = chart[spec.arr];
  if (!Array.isArray(src) || src.length < w) return chart;
  const next = src.map((o) => ({ ...o }));
  for (const key of spec.keys) {
    const sm = sgSmooth(src.map((o) => o[key]), w);
    next.forEach((o, i) => { o[key] = sm[i]; });
  }
  return { ...chart, [spec.arr]: next };
}
const csvCell = (v) => {
  if (v === null || v === undefined) return "";
  const t = String(v);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const toCsv = (headers, rows) =>
  [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n");
/* Turn a chart's plotted series back into a table of the actual data points. */
function chartToCsv(chart) {
  if (!chart) return null;
  const num = (v) => (Number.isFinite(v) ? v : "");
  switch (chart.type) {
    case "bar":
      return toCsv(["label", "ka_mD"], (chart.data || []).map((p) => [p.label, num(p.ka)]));
    case "klinkenberg":
      return toCsv(["inv_mean_pressure_1_per_atm", "apparent_permeability_mD"], (chart.data || []).map((p) => [num(p.invPm), num(p.ka)]));
    case "xyfit":
      return toCsv([chart.xLabel || "x", chart.yLabel || "y"], (chart.points || []).map((p) => [num(p.x), num(p.y)]));
    case "decay":
      return toCsv(["time_s", "ln_dP"], (chart.data || []).map((p) => [num(p.t), num(p.lnDP)]));
    case "coreflood":
      return toCsv(["differential_pressure", "flow_rate"], (chart.data || []).map((p) => [num(p.dP), num(p.Q)]));
    case "relperm":
    case "corey":
      return toCsv(["Sw_fraction", "kro", "krw"], (chart.data || []).map((p) => [num(p.Sw), num(p.kro), num(p.krw)]));
    case "krokrw":
      return toCsv(["kro", "krw"], (chart.data || []).map((p) => [num(p.kro), num(p.krw)]));
    case "nmrIlt":
      return toCsv(["T2_ms", "amplitude"], (chart.bins || []).map((t2, i) => [num(t2), num((chart.f || [])[i])]));
    case "nmrFit": {
      const raw = chart.raw || [], fit = chart.fitted || [];
      const same = fit.length === raw.length;
      return toCsv(same ? ["time_ms", "observed", "fitted"] : ["time_ms", "observed"],
        raw.map((p, i) => (same ? [num(p.x), num(p.y), num(fit[i] && fit[i].y)] : [num(p.x), num(p.y)])));
    }
    case "fracflow": {
      const curve = chart.curve || [], tan = chart.tangent || [];
      return [
        toCsv(["Sw_fraction", "fw_fractional_flow"], curve.map((p) => [num(p.Sw), num(p.fw)])),
        "",
        toCsv(["tangent_Sw", "tangent_fw"], tan.map((p) => [num(p.Sw), num(p.fw)])),
        "",
        toCsv(["front_Sw", "front_fw"], [[num(chart.frontSw), num(chart.frontFw)]]),
      ].join("\n");
    }
    default:
      return null;
  }
}
/* Any array of computed row objects -> CSV, skipping internal bookkeeping keys. */
function rowsToCsv(rows) {
  if (!Array.isArray(rows) || !rows.length) return null;
  const skip = new Set(["id", "_id", "setup"]);
  const headers = [];
  for (const r of rows) for (const k of Object.keys(r)) {
    if (!skip.has(k) && !headers.includes(k) && (typeof r[k] !== "object" || r[k] === null)) headers.push(k);
  }
  if (!headers.length) return null;
  return toCsv(headers, rows.map((r) => headers.map((h) => {
    const v = r[h];
    return Number.isFinite(v) ? v : (v === undefined || v === null ? "" : v);
  })));
}
/* MICP figures pass their data as [x, y] pairs rather than objects, so they get their own
 * thin wrappers around the same Savitzky-Golay smoother and CSV writer. */
function smoothPts(pts, w) {
  if (!Array.isArray(pts) || pts.length < w) return pts;
  const ys = sgSmooth(pts.map((q) => (Array.isArray(q) ? q[1] : NaN)), w);
  return pts.map((q, i) => (Array.isArray(q) ? [q[0], ys[i]] : q));
}
function micpSeriesToCsv(series, xLabel, yLabel) {
  if (!Array.isArray(series) || !series.length) return null;
  const named = series.filter((s2) => Array.isArray(s2.pts) && s2.pts.length);
  if (!named.length) return null;
  const multi = named.length > 1;
  const headers = multi ? ["series", xLabel || "x", yLabel || "y"] : [xLabel || "x", yLabel || "y"];
  const rows = [];
  named.forEach((s2, i) => {
    const label = s2.label || `series_${i + 1}`;
    s2.pts.forEach((q) => {
      if (!Array.isArray(q)) return;
      rows.push(multi ? [label, q[0], q[1]] : [q[0], q[1]]);
    });
  });
  return toCsv(headers, rows);
}
function downloadCsv(text, filename) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  downloadBlobUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- User-applied curve fitting ----------
 * Charts that plot discrete measurements can have a trend fitted from the Modify panel. Only the
 * four scatter-style charts are eligible; fitting a relative-permeability curve or an NMR
 * distribution would be meaningless, so the control is disabled for those.
 * The fit here is a display aid chosen by the user — it never feeds the module's reported result,
 * which is always computed by the module's own calc function from the raw data. */
const CHART_FIT_XY = {
  klinkenberg: (c) => (c.data || []).map((p) => ({ x: p.invPm, y: p.ka })),
  xyfit: (c) => (c.points || []).map((p) => ({ x: p.x, y: p.y })),
  decay: (c) => (c.data || []).map((p) => ({ x: p.t, y: p.lnDP })),
  coreflood: (c) => (c.data || []).map((p) => ({ x: p.dP, y: p.Q })),
};
const chartFittable = (chart) => !!(chart && CHART_FIT_XY[chart.type]);
function chartFitXY(chart) {
  const f = chart && CHART_FIT_XY[chart.type];
  if (!f) return [];
  return f(chart).filter((q) => Number.isFinite(q.x) && Number.isFinite(q.y));
}
const fmtCoef = (v) => {
  if (!Number.isFinite(v)) return "?";
  const a = Math.abs(v);
  if (a !== 0 && (a < 1e-3 || a >= 1e5)) return v.toExponential(3);
  return parseFloat(v.toPrecision(5)).toString();
};
/* Least squares in the space each model linearises to, with R² reported against the real data so
 * the three models can be compared on equal terms. */
function fitChartPoints(pts, mode) {
  if (!Array.isArray(pts) || pts.length < 2 || mode === "off" || mode === "default") return null;
  let use = pts, tx = (x) => x, ty = (y) => y;
  if (mode === "power") { use = pts.filter((q) => q.x > 0 && q.y > 0); tx = Math.log; ty = Math.log; }
  else if (mode === "exp") { use = pts.filter((q) => q.y > 0); ty = Math.log; }
  if (use.length < 2) return { error: mode === "power" ? "A power fit needs all x and y greater than zero." : "An exponential fit needs all y greater than zero." };
  const X = use.map((q) => tx(q.x)), Y = use.map((q) => ty(q.y));
  const n = X.length;
  const mx = X.reduce((a, b) => a + b, 0) / n, my = Y.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (X[i] - mx) * (Y[i] - my); den += (X[i] - mx) ** 2; }
  if (!(den > 0)) return { error: "The points do not vary along x, so no trend can be fitted." };
  const b = num / den, a0 = my - b * mx;
  const predict = mode === "power" ? (x) => Math.exp(a0) * Math.pow(x, b)
    : mode === "exp" ? (x) => Math.exp(a0) * Math.exp(b * x)
    : (x) => a0 + b * x;
  // R² against the untransformed measurements.
  const ys = use.map((q) => q.y);
  const ym = ys.reduce((a, c) => a + c, 0) / ys.length;
  let ssr = 0, sst = 0;
  use.forEach((q) => { const e = q.y - predict(q.x); ssr += e * e; sst += (q.y - ym) ** 2; });
  const r2 = sst > 0 ? 1 - ssr / sst : 1;
  const xs = use.map((q) => q.x);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const N = mode === "linear" ? 2 : 60;   // a straight line needs only its endpoints
  const curve = [];
  for (let i = 0; i < N; i++) {
    const x = xMin + ((xMax - xMin) * i) / (N - 1);
    const y = predict(x);
    if (Number.isFinite(y)) curve.push({ x, y });
  }
  const eq = mode === "power" ? `y = ${fmtCoef(Math.exp(a0))} · x^${fmtCoef(b)}`
    : mode === "exp" ? `y = ${fmtCoef(Math.exp(a0))} · e^(${fmtCoef(b)}x)`
    : `y = ${fmtCoef(b)}x ${a0 < 0 ? "−" : "+"} ${fmtCoef(Math.abs(a0))}`;
  return { curve, eq, r2, n };
}

function ExportableChart({ chart, color, title }) {
  const containerRef = useRef(null);
  const [showExport, setShowExport] = useState(false);
  const [showModify, setShowModify] = useState(false);
  const [smooth, setSmooth] = useState(0);
  const BLANK = { title: "", xLabel: "", yLabel: "", xMin: "", xMax: "", yMin: "", yMax: "", grid: true, fitMode: "default", showEq: true };
  const [form, setForm] = useState(BLANK);
  if (!chart) return null;
  const filenameBase = (title || chart.type || "chart").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const smoothable = chart.type === "nmrIlt" || !!CHART_SERIES[chart.type];
  const shown = smooth ? smoothChart(chart, smooth) : chart;
  const csv = chartToCsv(shown);

  // Blank fields mean "leave the chart's own default alone", so empty strings become undefined.
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : undefined; };
  const fittable = chartFittable(chart);
  const userFit = fittable && form.fitMode !== "default" && form.fitMode !== "off"
    ? fitChartPoints(chartFitXY(shown), form.fitMode) : null;
  const ov = {
    xLabel: form.xLabel.trim() || undefined,
    yLabel: form.yLabel.trim() || undefined,
    xMin: num(form.xMin), xMax: num(form.xMax),
    yMin: num(form.yMin), yMax: num(form.yMax),
    grid: form.grid,
    fitCurve: userFit && userFit.curve ? userFit.curve : undefined,
  };
  /* A user fit replaces the module's own trend line rather than being drawn on top of it, and
     "off" removes the line entirely. Both fit keys are cleared because coreflood stores its
     forced-through-origin fit under a different name. */
  const chartForRender = (form.fitMode === "off" || userFit)
    ? { ...shown, fit: undefined, fitOrigin: undefined }
    : shown;
  const modified = form.title.trim() !== "" || form.fitMode !== "default"
    || Object.keys(ov).some((k) => (k === "grid" ? ov.grid === false : k === "fitCurve" ? false : ov[k] !== undefined));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const fieldStyle = { background: C.bgSoft, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 9px", fontSize: 12.5, width: "100%", ...fBody };
  const labelStyle = { fontSize: 10.5, letterSpacing: 0.8, color: C.textFaint, ...fMono, display: "block", marginBottom: 4 };

  return (
    <div>
      {/* The title sits inside the captured element so it is carried into the exported figure. */}
      <div ref={containerRef}>
        {form.title.trim() && (
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, textAlign: "center", padding: "2px 0 8px", ...fDisplay }}>
            {form.title}
          </div>
        )}
        <ResultChart chart={chartForRender} color={color} ov={ov} />
        {form.showEq && userFit && userFit.eq && (
          <div style={{ textAlign: "center", fontSize: 12, color: C.textDim, paddingTop: 6, ...fMono }}>
            {userFit.eq}  ·  R² = {fmt(userFit.r2, 4)}
          </div>
        )}
      </div>
      <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {smoothable && (
          <div title="Savitzky-Golay quadratic smoothing, applied to the plotted series only. Fitted parameters are always computed from the raw data and do not change."
            style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11.5, color: C.textFaint, ...fBody }}>Smoothing</span>
            <select value={smooth} onChange={(e) => setSmooth(parseInt(e.target.value, 10))}
              style={{ background: C.bgSoft, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 8px", fontSize: 12, cursor: "pointer", ...fBody }}>
              <option value={0}>Off (raw)</option>
              <option value={5}>Light (5-pt)</option>
              <option value={7}>Medium (7-pt)</option>
              <option value={9}>Strong (9-pt)</option>
            </select>
          </div>
        )}
        <Button variant="outline" icon={Ruler} onClick={() => setShowModify(true)}>
          {modified ? "Modify ✓" : "Modify"}
        </Button>
        {csv && (
          <Button variant="outline" icon={Download}
            onClick={() => downloadCsv(csv, `${filenameBase}${smooth ? `_smoothed_${smooth}pt` : ""}_plotted_points.csv`)}>
            Plotted points (CSV)
          </Button>
        )}
        <Button variant="outline" icon={Download} onClick={() => setShowExport(true)}>Export figure</Button>
      </div>
      {smooth > 0 && (
        <div style={{ fontSize: 10.5, color: C.textFaint, marginTop: 6, textAlign: "right", ...fBody }}>
          Showing a {smooth}-point Savitzky–Golay smoothing of the plotted curve — reported values and fits still come from the raw data.
        </div>
      )}

      {showModify && (
        <>
          <div onClick={() => setShowModify(false)} aria-hidden="true"
            style={{ position: "fixed", inset: 0, background: C.overlay, zIndex: 50 }} />
          <div role="dialog" aria-label="Modify chart"
            style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 51,
              width: 660, maxWidth: "94vw", maxHeight: "90vh", overflowY: "auto", background: C.panel,
              border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,0.45)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: `1px solid ${C.borderSoft}` }}>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: C.text, ...fDisplay }}>Modify chart</span>
              <button onClick={() => setShowModify(false)} aria-label="Close"
                style={{ marginLeft: "auto", background: "none", border: "none", color: C.textFaint, cursor: "pointer", padding: 4, display: "flex" }}>
                <CloseIcon size={17} />
              </button>
            </div>

            <div style={{ padding: "16px 20px" }}>
              {/* Live preview, so every change is visible before the figure is exported. */}
              <div style={{ background: C.bgSoft, border: `1px solid ${C.borderSoft}`, borderRadius: 9, padding: "10px 12px", marginBottom: 18 }}>
                {form.title.trim() && (
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text, textAlign: "center", padding: "2px 0 6px", ...fDisplay }}>
                    {form.title}
                  </div>
                )}
                <ResultChart chart={chartForRender} color={color} ov={ov} />
                {form.showEq && userFit && userFit.eq && (
                  <div style={{ textAlign: "center", fontSize: 11.5, color: C.textDim, paddingTop: 4, ...fMono }}>
                    {userFit.eq}  ·  R² = {fmt(userFit.r2, 4)}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>CHART TITLE / SAMPLE NAME OR NUMBER</label>
                <input value={form.title} onChange={set("title")} placeholder="e.g. Plug 63 — Klinkenberg correction" style={fieldStyle} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>X-AXIS LABEL</label>
                  <input value={form.xLabel} onChange={set("xLabel")} placeholder="leave blank to keep default" style={fieldStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Y-AXIS LABEL</label>
                  <input value={form.yLabel} onChange={set("yLabel")} placeholder="leave blank to keep default" style={fieldStyle} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 6 }}>
                <div><label style={labelStyle}>X MIN</label><input value={form.xMin} onChange={set("xMin")} placeholder="auto" style={fieldStyle} /></div>
                <div><label style={labelStyle}>X MAX</label><input value={form.xMax} onChange={set("xMax")} placeholder="auto" style={fieldStyle} /></div>
                <div><label style={labelStyle}>Y MIN</label><input value={form.yMin} onChange={set("yMin")} placeholder="auto" style={fieldStyle} /></div>
                <div><label style={labelStyle}>Y MAX</label><input value={form.yMax} onChange={set("yMax")} placeholder="auto" style={fieldStyle} /></div>
              </div>
              <div style={{ fontSize: 10.5, color: C.textFaint, marginBottom: 16, ...fBody }}>
                Limits apply to numeric axes. Points outside the range are clipped from view — the fit and every
                reported value still use the full dataset.
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>TREND LINE</label>
                <select value={form.fitMode} disabled={!fittable}
                  onChange={(e) => setForm((f) => ({ ...f, fitMode: e.target.value }))}
                  style={{ ...fieldStyle, cursor: fittable ? "pointer" : "not-allowed", opacity: fittable ? 1 : 0.5 }}>
                  <option value="default">Module default</option>
                  <option value="off">Off — data points only</option>
                  <option value="linear">Linear fit — y = mx + c</option>
                  <option value="power">Power fit — y = a·x^b</option>
                  <option value="exp">Exponential fit — y = a·e^(bx)</option>
                </select>
                {!fittable && (
                  <div style={{ fontSize: 10.5, color: C.textFaint, marginTop: 5, ...fBody }}>
                    Fitting is available on charts of discrete measurements. This chart plots a continuous
                    curve or a distribution, where a trend line would not be meaningful.
                  </div>
                )}
                {userFit && userFit.error && (
                  <div style={{ fontSize: 10.5, color: C.danger, marginTop: 5, ...fBody }}>{userFit.error}</div>
                )}
                {userFit && userFit.eq && (
                  <div style={{ fontSize: 11, color: C.textFaint, marginTop: 6, ...fMono }}>
                    {userFit.eq} · R² = {fmt(userFit.r2, 4)} · {userFit.n} points
                  </div>
                )}
                <div style={{ fontSize: 10.5, color: C.textFaint, marginTop: 6, ...fBody }}>
                  A trend chosen here is for the figure only — the module&rsquo;s reported result is always
                  computed from the raw data by its own method.
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: fittable ? "pointer" : "not-allowed", marginBottom: 12, opacity: fittable ? 1 : 0.5 }}>
                <input type="checkbox" checked={form.showEq} disabled={!fittable}
                  onChange={(e) => setForm((f) => ({ ...f, showEq: e.target.checked }))}
                  style={{ width: 15, height: 15, accentColor: C.rust, cursor: "pointer" }} />
                <span style={{ fontSize: 12.5, color: C.textDim, ...fBody }}>Show equation and R² beneath the chart</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", marginBottom: 18 }}>
                <input type="checkbox" checked={form.grid} onChange={(e) => setForm((f) => ({ ...f, grid: e.target.checked }))}
                  style={{ width: 15, height: 15, accentColor: C.rust, cursor: "pointer" }} />
                <span style={{ fontSize: 12.5, color: C.textDim, ...fBody }}>Show gridlines</span>
              </label>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", borderTop: `1px solid ${C.borderSoft}`, paddingTop: 16 }}>
                <Button color={color} icon={Download} onClick={() => { setShowModify(false); setShowExport(true); }}>
                  Export figure
                </Button>
                {csv && (
                  <Button variant="outline" icon={Download}
                    onClick={() => downloadCsv(csv, `${filenameBase}${smooth ? `_smoothed_${smooth}pt` : ""}_plotted_points.csv`)}>
                    Plotted points (CSV)
                  </Button>
                )}
                <Button variant="outline" icon={RotateCcw} onClick={() => setForm(BLANK)}>Reset</Button>
                <Button variant="outline" onClick={() => setShowModify(false)} style={{ marginLeft: "auto" }}>Done</Button>
              </div>
            </div>
          </div>
        </>
      )}

      {showExport && <ExportModal svgRef={containerRef} filenameBase={filenameBase} onClose={() => setShowExport(false)} />}
    </div>
  );
}

/* ============================== RESULT CARD ============================== */
function ResultCard({ mod, calc, sampleId }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${mod.color}55`, borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 11, letterSpacing: 1.2, color: C.textFaint, ...fMono, marginBottom: 8 }}>RESULT — {sampleId || "unnamed plug"}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 34, fontWeight: 700, color: mod.color, ...fDisplay }}>{fmt(calc.headline.value, 3)}</div>
        <div style={{ fontSize: 14, color: C.textDim, ...fBody }}>{calc.headline.unit}</div>
      </div>
      <div style={{ fontSize: 13, color: C.textDim, marginTop: 2, ...fBody }}>{calc.headline.label}</div>

      {calc.alt && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.borderSoft}`, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span style={{ color: C.textDim, ...fBody }}>{calc.alt.label}</span>
          <span style={{ color: C.text, ...fMono }}>{fmt(calc.alt.value, calc.alt.unit === "1/s" ? 5 : 3)} {calc.alt.unit}</span>
        </div>
      )}
      {Number.isFinite(calc.r2) && (
        <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span style={{ color: C.textDim, ...fBody }}>Fit quality (R²)</span>
          <span style={{ color: calc.r2 > 0.9 ? C.good : C.danger, ...fMono }}>{fmt(calc.r2, 4)}</span>
        </div>
      )}

      {/* Kept with the numbers rather than the figure: this exports the computed results table,
          including intermediate columns the chart never shows. */}
      {rowsToCsv(calc.rows) && (
        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
          <Button variant="outline" icon={Download}
            onClick={() => downloadCsv(rowsToCsv(calc.rows), `${(mod.name + "_" + (sampleId || "plug")).toLowerCase().replace(/[^a-z0-9]+/g, "_")}_full_results.csv`)}>
            Full results (CSV)
          </Button>
        </div>
      )}

      <div style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid ${C.borderSoft}` }}>
        <ExportableChart chart={calc.chart} color={mod.color} title={`${mod.name}_${sampleId}`} />
      </div>

      {calc.chart2 && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.borderSoft}` }}>
          <div style={{ fontSize: 11, letterSpacing: 1, color: C.textFaint, ...fMono, marginBottom: 10 }}>FRACTIONAL FLOW — WELGE TANGENT CONSTRUCTION</div>
          <ExportableChart chart={calc.chart2} color={mod.color} title={`${mod.name}_${sampleId}_fracflow`} />
        </div>
      )}

    </div>
  );
}

/* ============================== ROWS TABLE (manual entry) ============================== */
function RowsTable({ fields, rows, setRows, color }) {
  const update = (id, key, val) => setRows(rows.map((r) => (r.id === id ? { ...r, [key]: val } : r)));
  const remove = (id) => setRows(rows.filter((r) => r.id !== id));
  const add = () => setRows([...rows, { id: uid(), ...Object.fromEntries(fields.map((f) => [f.key, ""])) }]);
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {fields.map((f) => (
              <th key={f.key} style={{ textAlign: "left", padding: "6px 8px", color: C.textFaint, fontWeight: 500, fontSize: 11.5, borderBottom: `1px solid ${C.border}`, ...fBody }}
                title={f.help || unitHelp(f.unit)}
              >
                {f.label} <span style={{ color: C.textFaint, cursor: "help", borderBottom: `1px dotted ${C.textFaint}` }}>({f.unit})</span>
              </th>
            ))}
            <th style={{ borderBottom: `1px solid ${C.border}` }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {fields.map((f) => (
                <td key={f.key} style={{ padding: "4px 8px" }}>
                  <input
                    type="number" step="any" value={r[f.key]}
                    onChange={(e) => update(r.id, f.key, e.target.value)}
                    style={{ width: 100, background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 8px", color: C.text, fontSize: 12.5, outline: "none", ...fMono }}
                  />
                </td>
              ))}
              <td>
                <button onClick={() => remove(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textFaint, padding: 6 }}>
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 10 }}>
        <Button variant="outline" icon={Plus} onClick={add}>Add row</Button>
      </div>
    </div>
  );
}

/* ============================== MODULE SCREEN ============================== */
function ModuleScreen({ mod, onBack, embedded = false }) {
  const [mode, setMode] = useState("manual");
  const [sampleId, setSampleId] = useState("PLUG-001");
  const [sampleValues, setSampleValues] = useState(() => Object.fromEntries(mod.sampleFields.map((f) => [f.key, f.default])));
  const [rows, setRows] = useState(() => Array.from({ length: mod.minRows }, () => ({ id: uid(), ...Object.fromEntries(mod.rowFields.map((f) => [f.key, ""])) })));

  const [batchGroups, setBatchGroups] = useState(null);
  const [batchError, setBatchError] = useState("");
  const [selectedBatch, setSelectedBatch] = useState(0);

  useEffect(() => {
    setMode("manual"); setBatchGroups(null); setBatchError("");
    setSampleValues(Object.fromEntries(mod.sampleFields.map((f) => [f.key, f.default])));
    setRows(Array.from({ length: mod.minRows }, () => ({ id: uid(), ...Object.fromEntries(mod.rowFields.map((f) => [f.key, ""])) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mod.id]);

  const numericRows = useMemo(
    () => rows.map((r) => Object.fromEntries(mod.rowFields.map((f) => [f.key, parseFloat(r[f.key])])))
      .filter((r) => mod.rowFields.every((f) => Number.isFinite(r[f.key]))),
    [rows, mod]
  );
  const sampleReady = mod.sampleFields.every((f) => Number.isFinite(sampleValues[f.key]));
  const canCalc = sampleReady && numericRows.length >= mod.minRows;
  const calc = useMemo(() => (canCalc ? mod.calc(sampleValues, numericRows) : null), [canCalc, sampleValues, numericRows, mod]);

  const analysePreparedSignal = async (acquisition, mode) => {
    setFitResult(null); setChartData(null); setDecayXY(null);
    const prepared = calculationFunctions.nmrPrepareSignal(acquisition, mode);
    setPreparedSignal(prepared);
    if (prepared.validity !== "valid") {
      setFileError(prepared.warnings.join(" ") || "The selected signal is unsuitable for analysis.");
      return;
    }
    const idxAll = prepared.time.map((_, index) => index);
    const idxFit = calculationFunctions.nmrDownsampleLog(idxAll, 5000);
    const xFit = idxFit.map((index) => prepared.time[index]);
    const yFit = idxFit.map((index) => prepared.values[index]);
    setDecayXY({ x: xFit, y: yFit });
    await new Promise((resolve) => setTimeout(resolve, 30));
    const fit = calculationFunctions.nmrFitExpDec3(xFit, yFit);
    setFitResult(fit);
    const idxChart = calculationFunctions.nmrDownsampleEven(idxAll, 400);
    const raw = idxChart.map((index) => ({ x: prepared.time[index], y: prepared.values[index] }));
    const rawChannels = idxChart.map((index) => ({ x: acquisition.rawTime[index], real: acquisition.rawReal[index], imaginary: acquisition.rawImaginary[index] }));
    const tMin = prepared.time[0], tMax = prepared.time[prepared.time.length - 1];
    const fitted = [];
    for (let index = 0; index <= 150; index++) {
      const time = tMin + ((tMax - tMin) * index) / 150;
      let value = fit.y0;
      fit.comps.forEach((component) => { value += component.A * Math.exp(-time / component.T2); });
      fitted.push({ x: time, y: value });
    }
    setChartData({ raw, rawChannels, fitted });
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileError(""); setRawAcquisition(null); setPreparedSignal(null); setFitResult(null); setChartData(null); setDecayXY(null);
    setFileLoading(true);
    try {
      let acquisition;
      if (file.name.toLowerCase().endsWith(".txt")) {
        acquisition = calculationFunctions.nmrParseGeoSpecMaranT2(await file.text(), { filename: file.name });
      } else if (file.name.toLowerCase().endsWith(".xls") || file.name.toLowerCase().endsWith(".xlsx")) {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        acquisition = calculationFunctions.nmrParseSpreadsheetT2(XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }), { filename: file.name });
      } else {
        throw new Error("Supported LF-NMR acquisition formats are .txt, .xls, and .xlsx.");
      }
      setRawAcquisition(acquisition);
      if (acquisition.calibrationConstant !== null) {
        setCalibMode("constant"); setCalibValue(String(acquisition.calibrationConstant)); setCalibrationSource("imported");
      } else {
        setCalibMode("none"); setCalibValue(""); setCalibrationSource("unavailable");
      }
      await analysePreparedSignal(acquisition, signalMode);
      const importWarnings = acquisition.warnings.filter((warning) => warning.level !== "error").map((warning) => warning.message);
      if (importWarnings.length) setFileError(importWarnings.join(" "));
    } catch (err) {
      setFileError(`Couldn't import that acquisition (${err?.message || "unknown error"}).`);
    }
    setFileLoading(false);
  };

  const changeSignalMode = async (mode) => {
    setSignalMode(mode);
    if (!rawAcquisition) return;
    setFileError(""); setFileLoading(true);
    try { await analysePreparedSignal(rawAcquisition, mode); }
    catch (err) { setFileError(`Couldn't prepare the selected signal (${err?.message || "unknown error"}).`); }
    setFileLoading(false);
  };
 { y += c.A * Math.exp(-t / c.T2); });
        fitted.push({ x: t, y });
      }
      setChartData({ raw, fitted });
    } catch (err) {
      setFileError(`Couldn't read that file (${err?.message || "unknown error"}).`);
    }
    setFileLoading(false);
  };

  const openCoeffModal = () => { setDraftCoeffs(JSON.parse(JSON.stringify(calculationFunctions.nmrLithologyDefaults[lithKey]))); setShowModal(true); };
  const confirmCoeffs = () => { setCoeffs(draftCoeffs); setShowModal(false); };

  const analysis = useMemo(() => {
    if (!fitResult) return null;
    const metrics = calculationFunctions.nmrT2Metrics(fitResult.comps, coeffs.cbwCutoff, coeffs.t2CutoffBVI);
    const { total: totalA, cbw: cbwA, bvi: bviA, ffi: ffiA, t2lm } = metrics;
    const comps = fitResult.comps.map((c, i) => ({ ...c, label: `Component ${i + 1}`, pctOfTotal: (100 * c.A) / totalA }));

    let calib = { phi: null, cbw: null, bvi: null, ffi: null, t2lm, sdrK: null, coatesK: null, derivedCalib: null };
    const calNum = parseFloat(calibValue);
    if (calibMode === "constant" && Number.isFinite(calNum) && calNum > 0) {
      const phi = (totalA * calNum) / bulkVolume;
      calib = { phi, cbw: phi * (cbwA / totalA), bvi: phi * (bviA / totalA), ffi: phi * (ffiA / totalA), t2lm, sdrK: null, coatesK: null, derivedCalib: null };
    } else if (calibMode === "referencePorosity" && Number.isFinite(calNum) && calNum > 0) {
      const phi = calNum;
      const derivedCalib = (phi * bulkVolume) / totalA; // back-calculated calibration constant, reusable for other samples from this same run
      calib = { phi, cbw: phi * (cbwA / totalA), bvi: phi * (bviA / totalA), ffi: phi * (ffiA / totalA), t2lm, sdrK: null, coatesK: null, derivedCalib };
    }
    const bviFrac = metrics.bviFrac;
    if (calib.phi !== null) {
      calib.sdrK = calculationFunctions.nmrSDR(calib.phi, calib.t2lm, coeffs.sdr);
      calib.coatesK = bviFrac >= calculationFunctions.nmrMinBviFraction ? calculationFunctions.nmrTimurCoates(calib.phi, calib.ffi, calib.bvi, coeffs.coates) : null;
    }
    return { totalA, cbwA, bviA, ffiA, bviFrac, t2lm, comps, calib };
  }, [fitResult, coeffs, calibMode, calibValue, bulkVolume]);

  const iltResult = useMemo(() => {
    if (!decayXY) return null;
    const ilt = calculationFunctions.nmrComputeT2DistributionILT(decayXY.x, decayXY.y, { nBins: 30, lambdaRel: iltLambda });
    const metrics = calculationFunctions.nmrT2Metrics(
      ilt.bins.map((T2, i) => ({ T2, A: ilt.f[i] })),
      coeffs.cbwCutoff,
      coeffs.t2CutoffBVI,
      true,
    );
    const { total: totalF, cbw: cbwF, bvi: bviF, ffi: ffiF, t2lm } = metrics;

    let calib = { phi: null, cbw: null, bvi: null, ffi: null, t2lm, sdrK: null, coatesK: null, derivedCalib: null };
    const calNum = parseFloat(calibValue);
    if (calibMode === "constant" && Number.isFinite(calNum) && calNum > 0) {
      const phi = (totalF * calNum) / bulkVolume;
      calib = { phi, cbw: phi * (cbwF / totalF), bvi: phi * (bviF / totalF), ffi: phi * (ffiF / totalF), t2lm, sdrK: null, coatesK: null, derivedCalib: null };
    } else if (calibMode === "referencePorosity" && Number.isFinite(calNum) && calNum > 0) {
      const phi = calNum;
      const derivedCalib = (phi * bulkVolume) / totalF;
      calib = { phi, cbw: phi * (cbwF / totalF), bvi: phi * (bviF / totalF), ffi: phi * (ffiF / totalF), t2lm, sdrK: null, coatesK: null, derivedCalib };
    }
    const bviFrac = metrics.bviFrac;
    if (calib.phi !== null) {
      calib.sdrK = calculationFunctions.nmrSDR(calib.phi, calib.t2lm, coeffs.sdr);
      calib.coatesK = bviFrac >= calculationFunctions.nmrMinBviFraction ? calculationFunctions.nmrTimurCoates(calib.phi, calib.ffi, calib.bvi, coeffs.coates) : null;
    }
    return { ...ilt, totalF, cbwF, bviF, ffiF, bviFrac, t2lm, calib };
  }, [decayXY, iltLambda, coeffs, calibMode, calibValue, bulkVolume]);

  const Icon = mod.icon;
  const lith = calculationFunctions.nmrLithologyDefaults[lithKey];

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "0 24px 80px" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 13, padding: "24px 0 8px", ...fBody }}>
        <ArrowLeft size={14} /> All tests
      </button>
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 6 }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: mod.soft, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={20} color={mod.color} />
        </div>
        <div>
          <h1 style={{ fontSize: 24, margin: 0, color: C.text, ...fDisplay, fontWeight: 700 }}>{mod.name}</h1>
          <div style={{ fontSize: 12.5, color: C.textDim, ...fBody }}>{mod.short}</div>
        </div>
      </div>

      <p style={{ marginTop: 18, fontSize: 14, lineHeight: 1.65, color: C.textDim, maxWidth: 720, ...fBody }}>
        Upload your raw T2 decay export. The console fits it to a tri-exponential model (A1·e<sup>-t/T2₁</sup> + A2·e<sup>-t/T2₂</sup> + A3·e<sup>-t/T2₃</sup> + baseline)
        using variable-projection least squares with multiple restarts, reports the fit quality, and derives T2LM and the relative
        pore-size split (CBW/BVI/FFI as % of total signal) — all of which need no calibration.
      </p>
      <p style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.6, color: C.textFaint, maxWidth: 720, fontStyle: "italic", ...fBody }}>
        NMR Total Porosity, φ, is defined as the total area under the T2 distribution of a <strong>100%-saturated</strong> sample —
        i.e. Σ(component amplitudes) from the fit above, or Σf(T2) from the ILT distribution, converted from raw signal units into
        a volume fraction of bulk volume via a calibration constant: <strong>φ = (Area × calibration constant) ÷ bulk volume</strong>.
        This assumes the uploaded T2 data was acquired at 100% water saturation, per standard practice — if your sample wasn't fully
        saturated when this run was taken, the resulting φ will read low.
      </p>

      <div style={{ background: C.bgSoft, border: `1px solid ${C.borderSoft}`, borderRadius: 10, padding: 16, marginTop: 18 }}>
        <div style={{ fontSize: 11, letterSpacing: 1, color: C.textFaint, ...fMono, marginBottom: 10 }}>PLUG DIMENSIONS</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <Field label="Diameter" unit="cm" value={diameter} onChange={(v) => setDiameter(v === "" ? "" : parseFloat(v))} />
          <Field label="Length" unit="cm" value={length} onChange={(v) => setLength(v === "" ? "" : parseFloat(v))} />
          <div><div style={{ fontSize: 12, color: C.textDim, ...fBody, marginBottom: 6 }}>Bulk volume</div><div style={{ fontSize: 15, color: C.text, ...fMono, paddingTop: 4 }}>{fmt(bulkVolume, 3)} cc</div></div>
        </div>

        <div style={{ fontSize: 11, letterSpacing: 1, color: C.textFaint, ...fMono, margin: "18px 0 4px" }}>CALIBRATION (OPTIONAL — NEEDED FOR ABSOLUTE φ &amp; PERMEABILITY)</div>
        <div style={{ fontSize: 11, color: C.textFaint, marginBottom: 10, ...fBody }}>φ = (total area under the 100%-saturated T2 distribution × calibration constant) ÷ bulk volume</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {[{ k: "none", l: "None (relative results only)" }, { k: "constant", l: "Calibration constant" }, { k: "referencePorosity", l: "Reference porosity" }].map((o) => (
            <button key={o.k} onClick={() => setCalibMode(o.k)}
              style={{
                border: `1px solid ${calibMode === o.k ? mod.color : C.border}`, borderRadius: 7, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", ...fBody,
                background: calibMode === o.k ? `${mod.color}22` : "transparent", color: calibMode === o.k ? mod.color : C.textFaint,
              }}>
              {o.l}
            </button>
          ))}
        </div>
        {calibMode !== "none" && (
          <Field
            label={calibMode === "constant" ? "Calibration constant (cc per signal unit)" : "Known reference porosity for this sample"}
            unit={calibMode === "constant" ? "cc/unit" : "fraction"}
            value={calibValue} onChange={(value) => { setCalibValue(value); setCalibrationSource("manual"); }}
          />
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 18, alignItems: "center" }}>
        <label>
          <input type="file" accept=".txt,.xlsx,.xls" onChange={handleFile} style={{ display: "none" }} />
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 8, background: mod.color, color: "#181818", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
            <Upload size={15} /> Import LF-NMR acquisition (.txt, .xls, .xlsx)
          </span>
        </label>
        {fileLoading && (
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.textFaint, ...fBody }}>
            <Loader2 size={14} className="spin" /> Fitting ExpDec3 (multiple restarts)… this can take a few seconds.
          </span>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <select value={lithKey} onChange={(e) => setLithKey(e.target.value)}
            style={{ background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 7, padding: "8px 10px", color: C.text, fontSize: 12.5, outline: "none", cursor: "pointer", ...fBody }}>
            {Object.entries(calculationFunctions.nmrLithologyDefaults).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
          </select>
        </div>
        <Button variant="outline" icon={CalcIcon} onClick={openCoeffModal}>Coefficients</Button>
      </div>
      {rawAcquisition && (
        <div style={{ background: C.bgSoft, border: `1px solid ${C.borderSoft}`, borderRadius: 10, padding: 14, marginTop: 16, fontSize: 12, color: C.textDim, ...fBody }}>
          <div style={{ fontSize: 11, letterSpacing: 1, color: C.textFaint, ...fMono, marginBottom: 8 }}>LF-NMR ACQUISITION</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
            <span>{rawAcquisition.filename}</span><span>{rawAcquisition.format}</span><span>TestType {rawAcquisition.testType ?? "not declared"}</span><span>{rawAcquisition.pointCount.toLocaleString()} points</span><span>{rawAcquisition.timeUnit}</span><span>X: {fmt(rawAcquisition.rawTime[0], 4)}–{fmt(rawAcquisition.rawTime.at(-1), 4)}</span><span>Calibration: {rawAcquisition.calibrationConstant ?? "unavailable"} ({calibrationSource})</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
            <span style={{ color: C.textFaint }}>LF-NMR Analysis Signal</span>
            {[["automatic", "Automatic phase-corrected"], ["imaginary", "Imaginary"], ["real", "Real"]].map(([value, label]) => <button key={value} onClick={() => changeSignalMode(value)} style={{ border: `1px solid ${signalMode === value ? mod.color : C.border}`, borderRadius: 6, padding: "5px 8px", background: signalMode === value ? `${mod.color}22` : "transparent", color: signalMode === value ? mod.color : C.textFaint, cursor: "pointer", ...fBody }}>{label}</button>)}
          </div>
          {preparedSignal && <div style={{ marginTop: 9, color: preparedSignal.validity === "valid" ? C.good : C.danger }}>Prepared signal: {preparedSignal.validity}; phase {preparedSignal.phaseAngle === null ? "not applied" : `${fmt(preparedSignal.phaseAngle, 5)} rad`}; global inversion {preparedSignal.globallyInverted ? "yes" : "no"}; noise estimate {fmt(preparedSignal.noiseEstimate, 4)}</div>}
        </div>
      )}
      {chartData?.rawChannels && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginTop: 16 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.2, color: C.textFaint, ...fMono, marginBottom: 12 }}>RAW LF-NMR SIGNAL — UNMODIFIED ACQUISITION CHANNELS</div>
          <ExportableChart chart={{ type: "nmrRaw", channels: chartData.rawChannels, timeUnit: rawAcquisition?.timeUnit }} color={mod.color} title={`nmr_raw_${sampleId}`} />
        </div>
      )}
      {fileError && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", color: C.danger, fontSize: 13, marginTop: 12, ...fBody }}>
          <AlertCircle size={15} /> {fileError}
        </div>
      )}

      {showModal && <NmrCoefficientsModal lith={lith} draft={draftCoeffs} setDraft={setDraftCoeffs} onConfirm={confirmCoeffs} onClose={() => setShowModal(false)} />}

      {analysis && (
        <>
          <div style={{ background: C.panel, border: `1px solid ${mod.color}66`, borderRadius: 12, padding: 20, marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 11, letterSpacing: 1.2, color: C.textFaint, ...fMono }}>EXPDEC3 FIT</div>
              <div style={{ fontSize: 13, ...fMono, color: fitResult.r2 > 0.99 ? C.good : fitResult.r2 > 0.95 ? C.amber : C.danger }}>R² = {fmt(fitResult.r2, 5)}</div>
            </div>
            <div style={{ marginTop: 12, fontSize: 11.5, color: C.textFaint, ...fMono, lineHeight: 1.8 }}>
              y(t) = {analysis.comps.map((c, i) => `${fmt(c.A, 1)}·exp(−t/${fmt(c.T2, 2)})`).join(" + ")} + {fmt(fitResult.y0, 1)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginTop: 14 }}>
              {analysis.comps.map((c, i) => (
                <div key={i}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: mod.color, ...fDisplay }}>T2 = {fmt(c.T2, 2)} ms</div>
                  <div style={{ fontSize: 11.5, color: C.textDim, ...fBody }}>{c.label} — {fmt(c.pctOfTotal, 1)}% of signal</div>
                </div>
              ))}
            </div>
            {chartData && (
              <div style={{ marginTop: 16 }}>
                <ExportableChart chart={{ type: "nmrFit", raw: chartData.raw, fitted: chartData.fitted }} color={mod.color} title={`nmr_fit_${sampleId}`} />
              </div>
            )}
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginTop: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: 1.2, color: C.textFaint, ...fMono, marginBottom: 12 }}>RELATIVE PORE-SIZE SPLIT (needs no calibration)</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
              <div><div style={{ fontSize: 20, fontWeight: 700, color: C.text, ...fDisplay }}>{fmt(100 * analysis.cbwA / analysis.totalA, 1)}%</div><div style={{ fontSize: 11.5, color: C.textDim, ...fBody }}>CBW (T2 ≤ {coeffs.cbwCutoff} ms)</div></div>
              <div><div style={{ fontSize: 20, fontWeight: 700, color: C.text, ...fDisplay }}>{fmt(100 * analysis.bviA / analysis.totalA, 1)}%</div><div style={{ fontSize: 11.5, color: C.textDim, ...fBody }}>BVI (T2 ≤ {coeffs.t2CutoffBVI} ms)</div></div>
              <div><div style={{ fontSize: 20, fontWeight: 700, color: C.text, ...fDisplay }}>{fmt(100 * analysis.ffiA / analysis.totalA, 1)}%</div><div style={{ fontSize: 11.5, color: C.textDim, ...fBody }}>FFI</div></div>
              <div><div style={{ fontSize: 20, fontWeight: 700, color: C.text, ...fDisplay }}>{fmt(analysis.t2lm, 1)} ms</div><div style={{ fontSize: 11.5, color: C.textDim, ...fBody }}>T2LM</div></div>
            </div>
            <div style={{ fontSize: 10.5, color: C.textFaint, marginTop: 10, ...fBody }}>From the 3-component ExpDec3 fit above — coarse by construction (a component either falls entirely inside or outside a cutoff).</div>
          </div>

          {iltResult && (
            <div style={{ background: C.panel, border: `1px solid ${mod.color}66`, borderRadius: 12, padding: 20, marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontSize: 11, letterSpacing: 1.2, color: C.textFaint, ...fMono }}>T2 DISTRIBUTION — INVERSE LAPLACE TRANSFORM</div>
                <div style={{ fontSize: 13, ...fMono, color: iltResult.r2 > 0.99 ? C.good : iltResult.r2 > 0.95 ? C.amber : C.danger }}>R² = {fmt(iltResult.r2, 5)}</div>
              </div>
              <p style={{ fontSize: 11.5, color: C.textFaint, marginTop: 8, lineHeight: 1.6, ...fBody }}>
                Full 30-bin distribution recovered directly from the decay curve via regularized non-negative least squares (Lawson &amp;
                Hanson, 1974) — resolves sub-structure the 3-component fit can't. Regularization trades resolution for stability: too low and
                the distribution gets noisy/oscillatory, too high and real peaks blur together.
              </p>
              <div style={{ marginTop: 10, maxWidth: 280 }}>
                <Field label="Regularization strength (λ)" unit="—" value={iltLambda} onChange={(v) => setIltLambda(v === "" ? "" : parseFloat(v))} />
              </div>
              <div style={{ marginTop: 14 }}>
                <ExportableChart chart={{ type: "nmrIlt", bins: iltResult.bins, f: iltResult.f, cbwCutoff: coeffs.cbwCutoff, bviCutoff: coeffs.t2CutoffBVI }} color={mod.color} title={`nmr_ilt_${sampleId}`} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.borderSoft}` }}>
                <div><div style={{ fontSize: 20, fontWeight: 700, color: C.text, ...fDisplay }}>{fmt(100 * iltResult.cbwF / iltResult.totalF, 1)}%</div><div style={{ fontSize: 11.5, color: C.textDim, ...fBody }}>CBW (from full distribution)</div></div>
                <div><div style={{ fontSize: 20, fontWeight: 700, color: C.text, ...fDisplay }}>{fmt(100 * iltResult.bviF / iltResult.totalF, 1)}%</div><div style={{ fontSize: 11.5, color: C.textDim, ...fBody }}>BVI (from full distribution)</div></div>
                <div><div style={{ fontSize: 20, fontWeight: 700, color: C.text, ...fDisplay }}>{fmt(100 * iltResult.ffiF / iltResult.totalF, 1)}%</div><div style={{ fontSize: 11.5, color: C.textDim, ...fBody }}>FFI (from full distribution)</div></div>
                <div><div style={{ fontSize: 20, fontWeight: 700, color: C.text, ...fDisplay }}>{fmt(iltResult.t2lm, 1)} ms</div><div style={{ fontSize: 11.5, color: C.textDim, ...fBody }}>T2LM (from full distribution)</div></div>
              </div>
              <div style={{ fontSize: 10.5, color: C.textFaint, marginTop: 10, ...fBody }}>
                Small differences from the ExpDec3-based split above are normal — the two methods make different modeling assumptions. Neither is "more true"; ILT gives finer resolution, ExpDec3 gives a simpler, more stable summary.
              </div>

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.borderSoft}` }}>
                <div style={{ fontSize: 11, letterSpacing: 1, color: C.textFaint, ...fMono, marginBottom: 12 }}>ABSOLUTE POROSITY &amp; PERMEABILITY — FROM ILT DISTRIBUTION</div>
                {iltResult.calib.phi !== null ? (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14 }}>
                      <div><div style={{ fontSize: 20, fontWeight: 700, color: mod.color, ...fDisplay }}>{fmt(iltResult.calib.phi, 4)}</div><div style={{ fontSize: 11.5, color: C.textDim, ...fBody }}>φ (fraction)</div></div>
                      <div><div style={{ fontSize: 20, fontWeight: 700, color: C.text, ...fDisplay }}>{fmt(iltResult.calib.cbw, 4)}</div><div style={{ fontSize: 11.5, color: C.textDim, ...fBody }}>CBW</div></div>
                      <div><div style={{ fontSize: 20, fontWeight: 700, color: C.text, ...fDisplay }}>{fmt(iltResult.calib.bvi, 4)}</div><div style={{ fontSize: 11.5, color: C.textDim, ...fBody }}>BVI</div></div>
                      <div><div style={{ fontSize: 20, fontWeight: 700, color: C.text, ...fDisplay }}>{fmt(iltResult.calib.ffi, 4)}</div><div style={{ fontSize: 11.5, color: C.textDim, ...fBody }}>FFI</div></div>
                    </div>
                    {iltResult.calib.derivedCalib !== null && (
                      <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 9, background: C.bgSoft, border: `1px solid ${C.borderSoft}`, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 11.5, color: C.textDim, ...fBody }}>
                          Effective calibration constant (from ILT total): <span style={{ color: C.text, ...fMono }}>{iltResult.calib.derivedCalib.toExponential(4)} cc/unit</span>
                        </div>
                        <Button variant="outline" onClick={() => { setCalibMode("constant"); setCalibValue(String(iltResult.calib.derivedCalib)); }}>
                          Use as calibration constant
                        </Button>
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.borderSoft}` }}>
                      <div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: mod.color, ...fDisplay }}>{fmt(iltResult.calib.sdrK, 3)} <span style={{ fontSize: 13, color: C.textDim }}>mD</span></div>
                        <div style={{ fontSize: 12, color: C.textDim, ...fBody }}>SDR model</div>
                        <div style={{ fontSize: 10.5, color: C.textFaint, marginTop: 6, ...fMono }}>k = a·φ^m·T2LM^n = {coeffs.sdr.a}×{fmt(iltResult.calib.phi, 3)}^{coeffs.sdr.m}×{fmt(iltResult.calib.t2lm, 1)}^{coeffs.sdr.n}</div>
                      </div>
                      <div>
                        {iltResult.calib.coatesK !== null ? (
                          <>
                            <div style={{ fontSize: 24, fontWeight: 700, color: C.text, ...fDisplay }}>{fmt(iltResult.calib.coatesK, 3)} <span style={{ fontSize: 13, color: C.textDim }}>mD</span></div>
                            <div style={{ fontSize: 12, color: C.textDim, ...fBody }}>Coates model</div>
                            <div style={{ fontSize: 10.5, color: C.textFaint, marginTop: 6, ...fMono }}>k = (φ/C)^p·(FFI/BVI)^q = ({fmt(iltResult.calib.phi, 3)}/{coeffs.coates.C})^{coeffs.coates.p}×({fmt(iltResult.calib.ffi, 3)}/{fmt(iltResult.calib.bvi, 3)})^{coeffs.coates.q}</div>
                          </>
                        ) : (
                          <div style={{ fontSize: 12.5, color: C.textFaint, ...fBody }}>Coates not applicable — only {fmt(100 * iltResult.bviFrac, 1)}% of the signal falls below the BVI cutoff ({coeffs.t2CutoffBVI} ms). With almost no bound water the FFI/BVI ratio is unstable and Coates would blow up, which is expected for clean, near-irreducible rock. Use the (calibrated) SDR estimate here.</div>
                        )}
                      </div>
                    </div>
                    <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 9, background: C.bgSoft, border: `1px solid ${C.borderSoft}` }}>
                      <div style={{ fontSize: 11, letterSpacing: 1, color: C.textFaint, ...fMono, marginBottom: 8 }}>CALIBRATE SDR TO CORE PERMEABILITY</div>
                      <div style={{ fontSize: 11.5, color: C.textDim, lineHeight: 1.6, marginBottom: 10, ...fBody }}>
                        The default coefficients are generic literature values and commonly miss measured permeability by a factor of several. If you have a routine air or Klinkenberg permeability for this plug, enter it to back-solve the SDR coefficient <span style={{ ...fMono }}>a = k / (φ^m · T2LM^n)</span> from this sample&rsquo;s own φ and T2LM, holding m and n fixed. The fitted value replaces <span style={{ ...fMono }}>a</span> (currently {coeffs.sdr.a}) for every {lith.name.toLowerCase()} sample this session and updates both estimates above.
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                        <div style={{ width: 190 }}>
                          <Field label="Measured core k" unit="mD" value={coreK} onChange={setCoreK} />
                        </div>
                        <Button variant="outline" onClick={() => {
                          const kv = parseFloat(coreK);
                          const phi = iltResult.calib.phi, t2lm = iltResult.calib.t2lm;
                          if (Number.isFinite(kv) && kv > 0 && phi > 0 && t2lm > 0) {
                            const aStar = kv / (Math.pow(phi, coeffs.sdr.m) * Math.pow(t2lm, coeffs.sdr.n));
                            setCoeffs((c) => ({ ...c, sdr: { ...c.sdr, a: parseFloat(aStar.toPrecision(4)) } }));
                          }
                        }}>Calibrate a</Button>
                      </div>
                    </div>
                    <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 9, background: C.bgSoft, border: `1px solid ${C.borderSoft}` }}>
                      <div style={{ fontSize: 11, letterSpacing: 1, color: C.textFaint, ...fMono, marginBottom: 8 }}>DERIVE T2 CUTOFF FROM CORE Swirr</div>
                      <div style={{ fontSize: 11.5, color: C.textDim, lineHeight: 1.6, marginBottom: 10, ...fBody }}>
                        The BVI cutoff (currently {coeffs.t2CutoffBVI} ms) is an empirical Gulf-of-Mexico default, not a universal constant — Straley et al. (1997) stress that it shifts with rock and region. If you have an irreducible saturation from centrifuge or porous plate on this plug, enter it and the console finds the T2 that splits the distribution at exactly that saturation, which is the defensible way to set the cutoff for your rock. The derived value replaces the cutoff for every {lith.name.toLowerCase()} sample this session.
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                        <div style={{ width: 190 }}>
                          <Field label="Measured core Swirr" unit="fraction" value={coreSwirr} onChange={setCoreSwirr} />
                        </div>
                        <Button variant="outline" onClick={() => {
                          const sw = parseFloat(coreSwirr);
                          const bins = iltResult.bins, f = iltResult.f;
                          const total = f.reduce((a, b) => a + b, 0);
                          if (!(Number.isFinite(sw) && sw > 0 && sw < 1 && total > 0)) return;
                          // Walk the distribution from the short-T2 end until the cumulative amplitude
                          // reaches the measured irreducible fraction; interpolate within the bin.
                          const target = sw * total;
                          let acc = 0, cutoff = bins[0];
                          for (let i = 0; i < bins.length; i++) {
                            if (acc + f[i] >= target) {
                              const need = target - acc;
                              const frac = f[i] > 0 ? need / f[i] : 0;
                              const prev = i > 0 ? bins[i - 1] : bins[0];
                              cutoff = Math.exp(Math.log(prev) + frac * (Math.log(bins[i]) - Math.log(prev)));
                              break;
                            }
                            acc += f[i];
                            cutoff = bins[i];
                          }
                          setCoeffs((c) => ({ ...c, t2CutoffBVI: parseFloat(cutoff.toPrecision(4)) }));
                        }}>Derive cutoff</Button>
                      </div>
                    </div>
                    <div style={{ fontSize: 10.5, color: C.textFaint, marginTop: 12, lineHeight: 1.6, ...fBody }}>
                      Generally the more reliable of the two permeability estimates in this tool, since BVI/FFI here come from the full
                      resolved distribution rather than a 3-component approximation — particularly for CBW-bearing or heterogeneous samples.
                    </div>
                  </>
                ) : (
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: C.amberSoft, border: `1px solid ${C.amber}66`, borderRadius: 9, padding: 14 }}>
                    <AlertCircle size={16} color={C.amber} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: C.text, fontWeight: 600, ...fBody }}>Not computed yet — this needs one more input.</div>
                      {calibMode === "none" ? (
                        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                          <Button color={mod.color} onClick={() => setCalibMode("constant")}>Enter calibration constant</Button>
                          <Button variant="outline" onClick={() => setCalibMode("referencePorosity")}>Enter reference porosity</Button>
                        </div>
                      ) : (
                        <div style={{ marginTop: 10, maxWidth: 320 }}>
                          <Field
                            label={calibMode === "constant" ? "Calibration constant (cc per signal unit)" : "Known reference porosity for this sample"}
                            unit={calibMode === "constant" ? "cc/unit" : "fraction"}
                            value={calibValue} onChange={setCalibValue}
                          />
                          <button onClick={() => setCalibMode("none")} style={{ background: "none", border: "none", color: C.textFaint, fontSize: 11, cursor: "pointer", marginTop: 6, padding: 0, ...fBody }}>← choose a different option</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ background: C.panel, border: `1px solid ${mod.color}66`, borderRadius: 12, padding: 20, marginTop: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: 1.2, color: C.textFaint, ...fMono, marginBottom: 12 }}>ABSOLUTE POROSITY &amp; PERMEABILITY</div>
            {analysis.calib.phi !== null ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14 }}>
                  <div><div style={{ fontSize: 20, fontWeight: 700, color: mod.color, ...fDisplay }}>{fmt(analysis.calib.phi, 4)}</div><div style={{ fontSize: 11.5, color: C.textDim, ...fBody }}>φ (fraction)</div></div>
                  <div><div style={{ fontSize: 20, fontWeight: 700, color: C.text, ...fDisplay }}>{fmt(analysis.calib.cbw, 4)}</div><div style={{ fontSize: 11.5, color: C.textDim, ...fBody }}>CBW</div></div>
                  <div><div style={{ fontSize: 20, fontWeight: 700, color: C.text, ...fDisplay }}>{fmt(analysis.calib.bvi, 4)}</div><div style={{ fontSize: 11.5, color: C.textDim, ...fBody }}>BVI</div></div>
                  <div><div style={{ fontSize: 20, fontWeight: 700, color: C.text, ...fDisplay }}>{fmt(analysis.calib.ffi, 4)}</div><div style={{ fontSize: 11.5, color: C.textDim, ...fBody }}>FFI</div></div>
                </div>
                {analysis.calib.derivedCalib !== null && (
                  <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 9, background: C.bgSoft, border: `1px solid ${C.borderSoft}`, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 12, color: C.textDim, ...fBody }}>
                      Effective calibration constant for this run: <span style={{ color: C.text, ...fMono }}>{analysis.calib.derivedCalib.toExponential(4)} cc/unit</span>
                      — reuse this for other samples from the same acquisition setup instead of needing a reference porosity each time.
                    </div>
                    <Button variant="outline" onClick={() => { setCalibMode("constant"); setCalibValue(String(analysis.calib.derivedCalib)); }}>
                      Use as calibration constant
                    </Button>
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.borderSoft}` }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: mod.color, ...fDisplay }}>{fmt(analysis.calib.sdrK, 3)} <span style={{ fontSize: 13, color: C.textDim }}>mD</span></div>
                    <div style={{ fontSize: 12, color: C.textDim, ...fBody }}>SDR model</div>
                    <div style={{ fontSize: 10.5, color: C.textFaint, marginTop: 6, ...fMono }}>k = a·φ^m·T2LM^n = {coeffs.sdr.a}×{fmt(analysis.calib.phi, 3)}^{coeffs.sdr.m}×{fmt(analysis.calib.t2lm, 1)}^{coeffs.sdr.n}</div>
                  </div>
                  <div>
                    {analysis.calib.coatesK !== null ? (
                      <>
                        <div style={{ fontSize: 24, fontWeight: 700, color: C.text, ...fDisplay }}>{fmt(analysis.calib.coatesK, 3)} <span style={{ fontSize: 13, color: C.textDim }}>mD</span></div>
                        <div style={{ fontSize: 12, color: C.textDim, ...fBody }}>Coates model</div>
                        <div style={{ fontSize: 10.5, color: C.textFaint, marginTop: 6, ...fMono }}>k = (φ/C)^p·(FFI/BVI)^q = ({fmt(analysis.calib.phi, 3)}/{coeffs.coates.C})^{coeffs.coates.p}×({fmt(analysis.calib.ffi, 3)}/{fmt(analysis.calib.bvi, 3)})^{coeffs.coates.q}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12.5, color: C.textFaint, ...fBody }}>Coates not applicable — only {fmt(100 * analysis.bviFrac, 1)}% of the signal falls below the BVI cutoff ({coeffs.t2CutoffBVI} ms). With almost no bound water the FFI/BVI ratio is unstable and Coates would blow up, which is expected for clean, near-irreducible rock. Use the (calibrated) SDR estimate here.</div>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 10.5, color: C.textFaint, marginTop: 14, lineHeight: 1.6, ...fBody }}>
                  Coefficients are commonly-cited starting points for {lith.name.toLowerCase()} — recalibrate against core permeability data whenever available.
                </div>
              </>
            ) : (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: C.amberSoft, border: `1px solid ${C.amber}66`, borderRadius: 9, padding: 14 }}>
                <AlertCircle size={16} color={C.amber} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 600, ...fBody }}>Not computed yet — this needs one more input.</div>
                  <div style={{ fontSize: 12, color: C.textDim, marginTop: 4, lineHeight: 1.6, ...fBody }}>
                    The fitted amplitudes are in raw signal units, not porosity — pick one below to convert them.
                  </div>
                  {calibMode === "none" ? (
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      <Button color={mod.color} onClick={() => setCalibMode("constant")}>Enter calibration constant</Button>
                      <Button variant="outline" onClick={() => setCalibMode("referencePorosity")}>Enter reference porosity</Button>
                    </div>
                  ) : (
                    <div style={{ marginTop: 10, maxWidth: 320 }}>
                      <Field
                        label={calibMode === "constant" ? "Calibration constant (cc per signal unit)" : "Known reference porosity for this sample"}
                        unit={calibMode === "constant" ? "cc/unit" : "fraction"}
                        value={calibValue} onChange={setCalibValue}
                      />
                      <button onClick={() => setCalibMode("none")} style={{ background: "none", border: "none", color: C.textFaint, fontSize: 11, cursor: "pointer", marginTop: 6, padding: 0, ...fBody }}>← choose a different option</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <Field label="Sample ID" value={sampleId} onChange={setSampleId} step={undefined} />
            <Button variant="outline" icon={Download} onClick={() => exportNmrReport(sampleId, fitResult, analysis.comps, analysis.totalA, analysis.calib, coeffs)} style={{ marginTop: 20 }}>
              Export report (Excel)
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================== UNIT CONVERTER SCREEN ============================== */
/* Plain decimal formatting for every displayed/edited value — no scientific notation.
 * Shows `sig` significant figures as an ordinary decimal, trims trailing zeros, and
 * never uses e-notation or ×10ⁿ. Very large values render as full integers; very small
 * ones as leading-zero decimals. */
function plainNum(n, sig = 6) {
  if (n === 0) return "0";
  const exp = Math.floor(Math.log10(Math.abs(n)));
  const decimals = Math.min(20, Math.max(0, sig - 1 - exp));
  let s = n.toFixed(decimals);
  if (s.indexOf(".") >= 0) s = s.replace(/\.?0+$/, "");
  return s;
}
function plain(n, sig = 6) {
  return Number.isFinite(n) ? plainNum(n, sig) : "—";
}
function fmtInput(n, sig = 6) {
  return Number.isFinite(n) ? plainNum(n, sig) : "";
}

/* Example magnitudes (expressed in each category's lab/source unit) used only as
 * grayed-out placeholders — nothing is pre-filled into the working cells. */
const CONVERT_EXAMPLES = {
  length: 1, area: 10, volume: 10, mass: 100, density: 2.65, pressure: 1,
  permeability: 100, viscosity: 1, flow: 1, temperature: 25,
  compressibility: 0.000003, ift: 30, gor: 100, time: 60,
};
const API_EXAMPLE = { sg: 0.85 };

function UnitSelect({ cat, value, onChange, accent = C.teal, width }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{
        width: width || "100%", background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 7,
        padding: "9px 10px", color: C.text, fontSize: 13, outline: "none", cursor: "pointer", ...fMono,
      }}
      onFocus={(e) => (e.target.style.borderColor = accent)}
      onBlur={(e) => (e.target.style.borderColor = C.border)}
    >
      {cat.units.map((u) => (
        <option key={u.u} value={u.u}>{u.u}</option>
      ))}
    </select>
  );
}

/* ---- Convert: a value in one unit → every unit in the category (plain decimals) ---- */
function ConvertPanel({ cat, accent }) {
  const firstLab = cat.units.find((u) => u.tag === "lab") || cat.units[0];
  const firstField = cat.units.find((u) => u.tag === "field") || cat.units[1] || cat.units[0];
  const [value, setValue] = useState("");
  const [fromU, setFromU] = useState(firstLab.u);
  const [toU, setToU] = useState(firstField.u);
  const [copied, setCopied] = useState(false);

  const x = parseFloat(value);
  const hasInput = Number.isFinite(x);
  const exVal = CONVERT_EXAMPLES[cat.id] ?? 1;
  // Example is defined in the category's lab/source unit; shift it into the chosen "from" unit.
  const exFrom = convert(cat, firstLab.u, fromU, exVal);
  const basis = hasInput ? x : exFrom;

  const result = convert(cat, fromU, toU, basis);
  const swap = () => { setFromU(toU); setToU(fromU); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(fmtInput(result)); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch (e) {}
  };
  const fromHelp = findUnit(cat, fromU)?.help;
  const toHelp = findUnit(cat, toU)?.help;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "end" }}>
        <div>
          <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6, ...fBody }}>Source value</div>
          <input type="number" step="any" value={value} placeholder={`e.g. ${fmtInput(exFrom)}`} onChange={(e) => setValue(e.target.value)}
            style={{ width: "100%", background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 7, padding: "10px 11px", color: C.text, fontSize: 15, outline: "none", marginBottom: 8, ...fMono }}
            onFocus={(e) => (e.target.style.borderColor = accent)} onBlur={(e) => (e.target.style.borderColor = C.border)} />
          <UnitSelect cat={cat} value={fromU} onChange={setFromU} accent={accent} />
        </div>

        <button onClick={swap} title="Swap source and target units"
          style={{ marginBottom: 8, height: 40, padding: "0 12px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.panel2, color: accent, cursor: "pointer", fontSize: 11.5, fontWeight: 600, letterSpacing: 0.4, ...fMono }}>
          SWAP
        </button>

        <div>
          <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6, ...fBody }}>Converted value</div>
          <div style={{ width: "100%", background: hasInput ? accent + "14" : C.bgSoft, border: `1px solid ${hasInput ? accent + "55" : C.borderSoft}`, borderRadius: 7, padding: "10px 11px", marginBottom: 8, display: "flex", alignItems: "center", gap: 8, minHeight: 43 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: hasInput ? accent : C.textFaint, ...fMono, wordBreak: "break-all", fontStyle: hasInput ? "normal" : "italic" }}>
              {plain(result)}
            </span>
            {hasInput && (
              <button onClick={copy} title="Copy" style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: copied ? C.good : C.textFaint, flexShrink: 0 }}>
                {copied ? <CheckCircle2 size={14} /> : <Copy size={13} />}
              </button>
            )}
          </div>
          <UnitSelect cat={cat} value={toU} onChange={setToU} accent={accent} />
        </div>
      </div>

      {(fromHelp || toHelp) && (
        <div style={{ fontSize: 10.5, color: C.textFaint, marginTop: 10, lineHeight: 1.5, ...fBody }}>
          {fromHelp && <div>{fromU} — {fromHelp}</div>}
          {toHelp && toHelp !== fromHelp && <div>{toU} — {toHelp}</div>}
        </div>
      )}

      {/* Full list — plain decimals, empty until a source value is entered (grayed example shown meanwhile) */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.borderSoft}` }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.2, color: C.textFaint, ...fMono }}>
            FULL LIST — {hasInput ? `SOURCE IN EVERY UNIT` : `EXAMPLE (${fmtInput(exFrom)} ${fromU})`}
          </div>
          <button onClick={() => hasInput && exportConversion(cat, fromU, x)} disabled={!hasInput}
            style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 9px", color: hasInput ? C.textDim : C.textFaint, fontSize: 11, cursor: hasInput ? "pointer" : "not-allowed", ...fBody }}>
            <Download size={12} /> Export
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 8 }}>
          {cat.units.map((un) => {
            const v = convert(cat, fromU, un.u, basis);
            const isFrom = un.u === fromU, isTo = un.u === toU;
            return (
              <button key={un.u} onClick={() => setToU(un.u)}
                style={{
                  textAlign: "left", cursor: "pointer",
                  background: isTo && hasInput ? accent + "18" : C.bgSoft,
                  border: `1px solid ${isTo ? accent + "88" : isFrom ? C.border : C.borderSoft}`,
                  borderRadius: 8, padding: "9px 11px", display: "flex", flexDirection: "column", gap: 3,
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, color: C.textDim, ...fMono }}>{un.u}</span>
                  {isFrom && <span style={{ fontSize: 9, color: C.textFaint, ...fMono, marginLeft: "auto" }}>SOURCE</span>}
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600, ...fMono, wordBreak: "break-all", color: hasInput ? (isTo ? accent : C.text) : C.textFaint, fontStyle: hasInput ? "normal" : "italic" }}>
                  {plain(v)}
                </div>
              </button>
            );
          })}
        </div>
        {!hasInput && (
          <div style={{ fontSize: 10.5, color: C.textFaint, marginTop: 10, fontStyle: "italic", ...fBody }}>
            Values shown are a grayed example. Enter a source value above to populate the cells.
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Oil gravity: °API ⇄ SG ⇄ density (empty by default, grayed examples) ---- */
function ApiGravityPanel({ accent }) {
  const densityCat = findCat("density");
  const [sg, setSg] = useState(null);            // null until the user enters something
  const [focus, setFocus] = useState(null);      // { field, str }

  const sgFromExample = API_EXAMPLE.sg;
  const has = Number.isFinite(sg) && sg > 0;
  const basis = has ? sg : sgFromExample;

  const deriveFrom = (s) => ({
    api: 141.5 / s - 131.5,
    sg: s,
    gcm3: s * RHO_W60,
    lbft3: convert(densityCat, "g/cm³", "lb/ft³", s * RHO_W60),
    kgm3: s * RHO_W60 * 1000,
  });
  const derived = deriveFrom(basis);
  const toSg = {
    api: (x) => 141.5 / (x + 131.5),
    sg: (x) => x,
    gcm3: (x) => x / RHO_W60,
    lbft3: (x) => convert(densityCat, "lb/ft³", "g/cm³", x) / RHO_W60,
    kgm3: (x) => x / 1000 / RHO_W60,
  };
  const onEdit = (f, v) => {
    setFocus({ field: f, str: v });
    const n = parseFloat(v);
    if (Number.isFinite(n)) {
      const s = toSg[f](n);
      if (Number.isFinite(s) && s > 0) setSg(s);
    } else {
      setSg(null);
    }
  };
  const inputVal = (f) => (focus?.field === f ? focus.str : has ? fmtInput(derived[f]) : "");

  const fields = [
    { f: "api", label: "API gravity", unit: "°API", col: C.rust },
    { f: "sg", label: "Specific gravity", unit: "SG 60/60°F", col: accent },
    { f: "gcm3", label: "Density", unit: "g/cm³", col: C.teal },
    { f: "lbft3", label: "Density", unit: "lb/ft³", col: C.rust },
    { f: "kgm3", label: "Density", unit: "kg/m³", col: C.textDim },
  ];
  const cls = derived.api >= 31.1 ? "Light" : derived.api >= 22.3 ? "Medium" : derived.api >= 10 ? "Heavy" : "Extra-heavy / bitumen";

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, ...fDisplay, marginBottom: 4 }}>Oil gravity converter</div>
      <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16, ...fBody }}>
        Edit any field — API gravity, specific gravity and density stay in sync. Water reference = {RHO_W60} g/cm³ at 60°F.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        {fields.map((fd) => (
          <label key={fd.f} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11.5, color: C.textDim, ...fBody }}>{fd.label} <span style={{ color: C.textFaint, ...fMono }}>({fd.unit})</span></span>
            <input type="number" step="any" value={inputVal(fd.f)} placeholder={`e.g. ${fmtInput(deriveFrom(sgFromExample)[fd.f])}`}
              onChange={(e) => onEdit(fd.f, e.target.value)} onBlur={() => setFocus(null)}
              style={{ background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 7, padding: "9px 10px", color: fd.col, fontSize: 14, fontWeight: 600, outline: "none", ...fMono }}
              onFocus={(e) => (e.target.style.borderColor = fd.col)} />
            <span style={{ fontSize: 10, color: C.textFaint, ...fMono, fontStyle: has ? "normal" : "italic" }}>{plain(derived[fd.f])}</span>
          </label>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16, flexWrap: "wrap", opacity: has ? 1 : 0.5 }}>
        <span style={{ fontSize: 11.5, color: C.textDim, ...fBody }}>Classification:</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: accent, padding: "3px 10px", background: accent + "18", borderRadius: 6, ...fMono }}>{has ? cls : "—"}</span>
        <span style={{ fontSize: 10.5, color: C.textFaint, ...fBody }}>(light ≥ 31.1, medium 22.3–31.1, heavy 10–22.3)</span>
      </div>
      <div style={{ fontSize: 10.5, color: C.textFaint, marginTop: 14, lineHeight: 1.6, ...fMono }}>
        SG = 141.5 / (°API + 131.5)   ·   °API = 141.5 / SG − 131.5   ·   ρ = SG × {RHO_W60} g/cm³
      </div>
    </div>
  );
}

function ConverterScreen({ onBack }) {
  const accent = C.teal;
  const [tab, setTab] = useState("length");     // category id | "api"
  const cat = findCat(tab);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 13, padding: "24px 0 8px", ...fBody }}>
        <ArrowLeft size={14} /> All tests
      </button>

      <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 6 }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: C.tealSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Scale size={20} color={accent} />
        </div>
        <div>
          <h1 style={{ fontSize: 24, margin: 0, color: C.text, ...fDisplay, fontWeight: 700 }}>Petroleum Unit Converter</h1>
          <div style={{ fontSize: 12.5, color: C.textDim, ...fBody }}>Full unit list for every SCAL quantity, as plain decimals</div>
        </div>
      </div>

      <p style={{ marginTop: 16, fontSize: 13.5, lineHeight: 1.6, color: C.textDim, maxWidth: 760, ...fBody }}>
        Converts across the units used in this console's equations — length, area, volume, pressure, permeability, viscosity,
        flow rate, density, compressibility, interfacial tension, temperature and GOR. Enter a value, pick a source and target
        unit, and the full list updates. Results are shown as plain decimal numbers.
      </p>

      {/* Unified tab group: unit categories + °API */}
      <div style={{ display: "flex", gap: 6, marginTop: 22, flexWrap: "wrap", alignItems: "center" }}>
        {CONVERT_CATEGORIES.map((c) => {
          const on = c.id === tab;
          const Ic = c.icon;
          return (
            <button key={c.id} onClick={() => setTab(c.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                border: `1px solid ${on ? accent + "88" : C.borderSoft}`, borderRadius: 8, padding: "7px 11px",
                background: on ? accent + "18" : C.panel, color: on ? accent : C.textDim, fontSize: 12.5, fontWeight: 600, ...fBody,
              }}>
              <Ic size={13} /> {c.name}
            </button>
          );
        })}

        <span style={{ width: 1, alignSelf: "stretch", background: C.border, margin: "2px 4px" }} />

        {[{ k: "api", label: "°API Gravity" }].map((t) => {
          const on = t.k === tab;
          return (
            <button key={t.k} onClick={() => setTab(t.k)}
              style={{
                cursor: "pointer", border: `1px solid ${on ? accent : C.border}`, borderRadius: 8, padding: "7px 12px",
                background: on ? accent : "transparent", color: on ? "#181818" : C.text, fontSize: 12.5, fontWeight: 700, ...fBody,
              }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {cat && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginTop: 18 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, ...fDisplay }}>{cat.name}</div>
            <div style={{ fontSize: 11.5, color: C.textFaint, ...fBody }}>{cat.note} · base {cat.base}</div>
          </div>
          <ConvertPanel key={cat.id} cat={cat} accent={accent} />
        </div>
      )}

      {tab === "api" && (
        <div style={{ marginTop: 18, maxWidth: 640 }}>
          <ApiGravityPanel accent={accent} />
        </div>
      )}
    </div>
  );
}

/* ============================== APP ROOT ============================== */
/* ---- Embedded mobile home-screen icon (core-plug set + crude-oil beaker, cropped from the
   lab-bench render). Baked in as data URIs so the whole app stays a single file with no side
   assets, manifest, or index.html edits. Injected into <head> by the effect in App(). ---- */
const APP_ICON_180 = "data:image/png;base64,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";
const APP_ICON_192 = "data:image/jpeg;base64,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";
const APP_ICON_512 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAQDAwQDAwQEBAQFBQQFBwsHBwYGBw4KCggLEA4RERAOEA8SFBoWEhMYEw8QFh8XGBsbHR0dERYgIh8cIhocHRz/2wBDAQUFBQcGBw0HBw0cEhASHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBz/wAARCAIAAgADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD41oooqgCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA6rw34Vh1zTpbl5JVdZTGAhGOAD6e9dN4Q+HOka5rMOn315dxmRwuVYIPz2N/Kug+DnhPUNe8LXlzaLalEvXjPm3kMTZ8uM9HcEjnrjFdzonw517S9fiu5ItPWJWDbv7TtTj8BJXbClCVO/U5JVJqduhy+pfs/afaeLxpMd/KLPbuMjXIJxjP3vJH/oNeceK/AltoN7NHb3MksSsQuSGyPXOBn8hX1drWjX13fNcxS2DNt25+3wDt/v15x4l+GHiHVJd0FtZSZ9NRth/OSlToxb94dSrK3ungeleGUv9+9pRt/ukf4VoP4LgTrJP+Y/wr13RfhT4jsmcS2NsD7ajan/2rWrN8MvEBB26dCTj/n9tv/jlaOhT6Gca07angFx4atYI3cyygKCSWIA/lXQ+Gfh5p+tadf3U0t7+4+4YiuDxnn5TXplz8J/E8sMgXSFfKkALdW5/9qVX0P4Sa/awzR3PhyeMsOHhnRM/98SURows9hSqzutzw6/0WG1mkRGlIU4G7H+FQRabFI2C0n4Y/wAK9kv/AIKeIC5MOgXcwPPEpP8A7PVaD4K+Jdw3+F78D6sf/Zq1VCn2X3mXtavn9x5xJ4XhXS5bsNPuQgDOMfyrmxbTSZMaEoON2ODXudx8JfE8Vq8UHgm8dyeHaDcR9NxrCl+Enjxgf+KU1Xb/ANch/jR7Ck+we2qra55V9klH3toq1HYRsgLO2favQG+EHjk8/wDCKasc9MQ5/rSj4QeOvu/8IlrAPp9n/wDr1LoU+g1Xq9Tg49Ngc43yfmP8KsDRrc/8tJPzH+Fdsvwh8cqcjwlrHPpb5/rU6/Cbxz38J6zkdvsxqHQgaKtPqcKNDtj/AMtJfzH+FB0O2/56S/mP8K7ofCnx0P8AmUdc/Czeg/Cnx2f+ZP18/wDbjJ/hUuhEr20jhBolt/fl/Mf4Uf2JbZ+/Lj6j/Cu8Hwp8dk/8idr5/wC3CT/ClPwq8cLjd4P18c4/48JP8KToxH7WRwP9iW/9+X8x/hR/Ytv/AH5fzH+Fd2fhf41Xr4R18dv+QfL/AIUp+F/jX/oUNf8A/BfL/wDE0OjEPayOC/sW3/vy/mP8KQ6Nbj+OX8x/hXef8Kw8bf8AQn+IMdP+QdL/APE0w/DHxp/0KHiD/wAFs3/xNL2MR+1kcMdHt/78n5j/AApv9k2+fvy/mP8ACu6/4Vl407+EPEOP+wbN/wDE0f8ACsPGfX/hEPEP/gtm/wDiafsYi9rI4X+ybbP35fzH+FJ/ZNv/AH5PzH+Fdyfhn4yXr4R8QD/uGzf/ABNM/wCFceL1OD4T18f9wyf/AOJpexiHtZHFf2Rb/wB+T8x/hR/ZFv8A35PzH+Fdv/wrvxbjP/CK69/4LZ//AImj/hXniz/oVtdz/wBg2f8A+Ip+xiHtZHDnSrcf8tJPzH+FIdLtwP8AWSfmP8K7M/D7xQp+bwzrgPvps/8A8RTX8BeI1yG8O60pHrp8/wD8RTVCIvbSOM/s23/vyfmP8KT+zrf+/J+Y/wAK61/BGvp97QNXH1sJh/7LUf8AwhmuHONE1X/wBl/+JoWHXYXt2cv/AGbb/wB9/wAx/hS/2Xb/APPR/wAx/hXTjwZrffRNU/8AAKX/AOJobwfrSjJ0bUx/25S//E0/q67B7dnL/wBmQf35PzH+FH9mQf33/Mf4V0n/AAier4/5BOpf+Acv/wATTG8MaovXS9QH1tJf/iaFh12D27Od/syH++/5j/Cl/suL++35it4+G9SHXTb7/wABZP8A4mmnw/qC8GwvR9baT/ChYdXD27MBtNjA++1VprURqSrEn0rqR4fv36WF2f8At3f/AAqKTQL1c/6Bd5/64P8A4UfVk3YX1lnFM8wJ+VfyrpfCehwa9eNBcPIiiPdmMgc49wasf2Fd85sLn8YH/wAK2fD2ly2N20n2K+iZ1ILQiSI/oMGqWGSe1yJYmT0vYxtU8O2ti+1HmIz/ABMP8Kzk0yFzjMn5j/Cu+v8Aw7PdhSGv5O+GYH/2WqEHhScvt8u/B684/wDia1eHh2Jdea6mTF4UtnsWnMkwYf7Qx/KsSfSSsoWLcVxzmvTBpRtdNeJxqLkn7vm4X8Qqg/rWEtk0Tt5dq6AnJ+ViT9SeaUsPBraw1XmnucvBoLP98OPoR/hVxfDUJ6vKPxH+FdCsMo6o3/fJqVYsdeKhYeC6F+3mc9H4Wt2YAyTY9iP8Kz/EGjQ6SLYwtI3m7s7yD0x6D3rt0RQ3LL+dc545240/BU/6zoc/3ayrUoxg2ka0akpSs2chRRRXEdYUUUUAFFFFABRRRQAUUUUAFFFFAGrpl5cQW7JDNJGpYnCuQM4FXxqt9/z+XBzx/rW/xqto+g69qls02l6JeX8AcoZIANobAJXk9cEH8alm0HxRbX9nYS+FdWW7vVd7ePysmZUOGK4+9g9cdK76c7QSOKpG8mOOp3pbm8uM9P8AWN/jQdTvDybqYn1LmrZ8FeNQOfBeuAf9e5preDfGYH/Ima7ycf8AHsa05n5/iZ8hB/al7g5upuf9o80f2leMTm4lP/AzU48HeMz08F69n2tTSDwh4yHP/CF+IP8AwDajnfn+IuQgF/c5H7+TP+90p66ndqABcygD0c08+FPGQ5PgrxDj1+xt/hTv+ES8YgZ/4QrxD/4Bt/hT5w5SI6nef8/Mv/fZpv8Aad7j/j7m/wC+zU48KeMP+hL8Q/T7E3+FH/CK+L+o8FeIsf8AXk/+FHMw5CA6tfA/8fcwOc/6w0n9rahnIvbj/v4f8alfwv4uB58F+Igf+vF/8KQ+GPFpHPgzxD/4Av8A4Uc4cgLrN+M/6ZPyMH94aQ61qBP/AB+3H/fxv8aD4Z8WDr4N8Qj/ALcX/wAKYfDfir/oT/EP/gC/+FHMHKO/trUAMfbbjH/XVv8AGnLr+pJyt9cDPHErf41H/wAI34q7eEPEHH/Tg/8AhQfDfikZB8I+IM9/9Bk/wpc4+UnHiTV8H/iZ3n/f5vw70o8UayAAuq3oxxxOw/rVYeG/FB/5lDxB/wCAMn+FMbw54oBwfCPiHP8A2D5M/wAqOcOUvjxVrIyf7Vveev8ApD8/rQ3inWTz/a19z63D/wCNUh4c8Uf9Cf4iJ/7B0v8AhT/+EZ8U4/5E/wASD/uGy/4Uc4uQtjxfrmCP7XvsHgj7Q5z+tP8A+Eu1w4xq9/x289x/Ws8eG/E+f+RR8Rf+C2X/AOJpf+Ed8UDg+EfEfH/UNl/+Jo5/MfI+xf8A+Eu10jP9s6hknP8Ax8P/AI0qeMvEEfK65qakc5W7kH9apnw34o2knwf4jx/2DZf/AImmHw74lHXwn4i986bL/wDE0c+m4cr7GiPGviLode1PHp9rk/xpw8c+JEGF1/UwPa7k/wAayv7B8SZP/FJ+IR/3DZv/AImmnQ/Eg6+FPEH/AILZv/iaOdW3DkfY1W8c+JWYsdf1Tcep+1Sc/rSr468Socrr+qD6Xcn+NZA0LxCevhfX/wDwXTf/ABNL/YXiEdfC+v8A/gtm/wDiaFNW3DkfY2B468SDpr2p8dvtkn/xVB8deJeca/qgyc8Xkn+NY39i+IP+hZ176/2bN/8AE0jaRrmf+Rc138dOm/8AiaPaLuHI+xvL8QvFSjA8R6t26Xkvbp/FVgfE3xigwvijWQPQX0o/9mrmf7J1vv4e1z/wXTf/ABNH9l60f+Ze1zA/6h83/wATSU13DlfY6j/hafjQHjxVrfTb/wAf0vT/AL6oPxU8aEH/AIqjWB0/5fJOfr81csdJ1onH/CPa5/4Lpf8A4mkbStZXJPh7Wx9dPl/+JoU49w5Zdjqx8VvGnB/4SnWf/A2X/wCKqUfFrxxtx/wlutj1Ivpef/Hq41dN1gf8wHWvxsJf/iaUWOq5/wCQHrA/7cJf/iaFUj3Dlkdkfi545zn/AIS3WjgY/wCP6X/4qkHxe8dZ58X63z2N9Lz/AOPVxzWOp5/5A2rj62Ev/wATTfsOojJbSNW/Gxl/+Jo549w5Zdjtk+MHjvGD4v1wj/r9kP8AWpB8ZPH69PGOtjjp9tf/ABrgzDerydL1MH3spf8A4mkzcjg6dqI/7c5f/iaOeN9w5ZdjvD8ZvHy5x4v1nH/X2/8AjSf8Ln8fE/8AI36ySP8Ap7f/ABrgpBcYy1hfj62cg/8AZaZi4I4sr8/Szk/+Jo5433Dll2PQU+NHj/8A6G/WSP8Ar7f/ABqUfGvx8Mf8VdrH43Tf415yrzL1sr4f9ukn+FBnZetreD62sn+FHPG+4csux6OPjb4/UkjxZqx/7bmp0+O3xBAJHi3UyRwD5xry/wC1jvDdfjbSf4Un2xR1juMf9cJP/iaHOI+WXmep/wDC+viEGBPivUT7GSj/AIXz8Qxgf8JXqJAORmTNeV/b49x+S4A/64P/AIUn9ow9/NH/AGxf/ChziDjI9WX49/ENTkeKr8H1LjmpD8f/AIiMMHxPeEEd8GvJ/wC0occmQf8AbJv8KT+0oSPvN/3w3+FNzjYOWR6yPj38Qc8+JrsjOcYUj+VcZ4+8ea/42GnjXNQlvFs/MMPmKBs37d2MDvtH5Vy/9qW+cGT81b/Cori6iudvlvu29eCP51lWknTZpSTUlchooorhOwKKKKACiiigAooooAKKKKACiiigDQsot1uWxzuI6+wrb0/VdQ0+CRLW9uIQYpYf3UrLhHZN6jB4DbRnHXFZGnsBasO+4/yFXIz+5fj+E8/8CWu+l8KOGp8TFbULv/n7ucD/AKbPx+tIdRve17dA9c+c/wDjUDdelJ19q1uZE51G9UjF9d59ftD/AONKNW1BcEaheA9Mi4fp+dVzk+mO9MIyc9zRcZe/trUQMDUr8Z7faZAP/QqX+29V/wCgrqB/7e5P/iqoAc9TmnDpijURfGv6uP8AmLah/wCBcn/xVKfEGskc6vqOP+vuX/4qqHXHX8aQjoaYF7/hItaHTWNSHv8AbJP/AIql/wCEk1oHI1nUs+93J/8AFVnEEc+tBXjk5ouwNL/hJNbP/Ma1Pngj7XJ/8VSnxHrW0A6xqWPe7k/+KrMH4Uv4cfWi7Cxf/wCEh1kH/kL6j9ftUn+NL/wkWsgkjV9RBPU/apP8azscf0pcemetF2FjTHiTW/8AoMal/wCBUn+NO/4SjXVOf7b1MfS8lH/s1ZYzk+vtSnnpnBouwNT/AIS/xCP+Y9qv1+2y/wDxVOPi/wARkf8AIwatjGMfbZcf+hVi4weOtKvrRdgbJ8W+Im5Ovat9ftsv/wAVS/8ACWeIlyP7d1YZPP8ApsvPv96sgcnsKCMAe3pRdga58W+ISedf1XGf+fyX/wCKo/4S3xHnjXtV+v22X/4qsfHUcUZxz2pXYG4fGXiUEkeItX+pvZMn/wAepf8AhNvE4xjxFq5wMZF9L/8AFVhHApQMnOOBRd2A2v8AhNPE2Cf+Ei1cZ4P+my//ABVSDxz4qyCPE2tcHP8Ax/S//FVhYx+NJwad3YEbp8b+KSP+Rl1nP/X9Lx/49Sp498Vpjb4m1lT1/wCP6X/GsHGcHI/Kl7mhN2GbyePvFqjC+J9bCnsL+X/4qpD8Q/GBBB8U63g9f9Pl/wDiq5voMHr7UYA9c0lJgkdL/wALE8Y9/FOt89/t8vP/AI9Tz8SPGQz/AMVXrY3Dn/T5Of8Ax6uYzg/1oA9BQm7gjqf+FmeNCefFmu+n/H/L/wDFUn/Cy/Ggx/xVmuEgY/4/pf8AGuXA59AaOnQ0XdxWOsHxQ8bLlf8AhLdcx/1/Sf40f8LN8a5z/wAJZrfXqb2T/GuU5/GnZ46Yptgzqh8TvGp/5mzWuuebx+f1p3/C0/HC/d8Wazkc8XTVyY44JxSMM+g+pobYNHXL8WvHadPF+s/+BbUf8La8d4wPF2tfjdtXHYOMECgLihtgdqPi549JIbxdrPPBzdNTx8XPHo4Hi/WQfa7auJX5T0p278KLsDtR8ZPH+7d/wmGsZP8A08GnH4yfEAnP/CX6v0x/r+35Vw4GT2pduD7ii7GdsPjH8QCQf+Eu1bIBH+tH+FPX4zeP8g/8JZqhI7+YD/SuGwP73vS++evWk2I7f/hcfj7gjxVqRI4GXU/0oHxj8eHH/FUahn0JX/4muI24ySPpSD6cUN6DO8b4zePMg/8ACT3hPrtj/wDia5Txr4z17xaLEa3qc199l8zyvNA+Tdt3YwB12j8qo/oT3qhqX/LLPv8A0rOt/DZrR+NFCiiivPO0KKKKACiiigAooooAKKKKACiiigDQsB+6b/eq/ECYn/3T/wChLVCxH7lsf3q0oh+7kwOAp/8AQlrvpfCjhqfGysw5HBPpzRTnHzdR+dMrUyDHHrSY9RQTS59aAEIwfajvSnP1pDwcfyoAcCePzpT/AJFIKOmKYCY600npmn9/600j8PxpDEwMe1JS/rSYFAgJ55pByR7UHPuKD24oAeM8U7PGOaaoHb+VPOeewzQA3HvRjPGORTSeccfzpQexAoAcB74pccHmmg59z7UpJHOM+1MBCMEUhGO+e3FOHI46Uhz1H6UgEHH+GaUAf/qFIDzj9DSn8Pwo6AOxjAPp+tJnqDk896M8dRxQMnHXHpT6AGMZ70E8YPPb6UpGB/jSAHkfypJaDQ3AxjuKCMf4ZpcZJ5GKPfBpIEJg5PA+mKUAdeGpOMnA/KjvkYwaOoCjr3p2BnHX3pgGe1PGO+cdab3Bh909BThjqensaaWzjknHTnpSnI+vrmhgxCQBgHIpQc8YznsKQ9cnB+tGcHJx6U+gDiOOvPpSEdMYpQx4OPoaMn0+lHQXQO/I+tIRxgA07+lJ3+nakhoTH0z2xT9wA5A59KQ8E4H5HPFMIznHFCBEysp6hsHsGqQD92QrK2RyjnH4j3quD6/nmlxzj8M0AStCVViA26M4ZgQQPTmoSPcU49Ae30oGD/jQAAHoByOoqjqYx5X4/wBK0YyEY5RWBUj5h09x71n6rwYunfp6cVlW/hs1o/GjOooorgO0KKKKACiiigAooooAKKKKACiiigDQsTiFs9N3r7CrP2uK3jKyuE8xWC57nKn+VVLPHlN9aqa7bie3sVP/AD2YH/vkV2021BNHFJXqO5oG9tz0mTP+9SG8t/8Anun51if2LH1C/rWfqdn9kkiAXCsD+NDqyWrQKnFu1zqftVuf+W6H8aUXduP+W6fnXD5IbrVi0AaQhgD9aj6w+xXsF3Ow+12/Xz4/zpRd23/PdPzrm/Ij/wCea/lThbxHrEv5UfWH2D2C7nSC7t/+e8f50fa7cHHnof8AgVc+LaH/AJ4p+VH2WLH+pT8qPrD7B7Bdzfa8t8589PzpBeQD/lsn51gizi/54rTvscX/ADxX8qf1h9g9gu5tm6t8f66M/jR9qg/57J+dYZs4v+eK/lQLOH/niv5UfWH2D2K7m4bq3PSZPzpPtMP/AD1T8DWL9jh6+SufxoNnD/zxX9aFiH2D2C7m2LmDOPOjx9akFzAR/ro/zrnxZQ/88V/Wl+xwZ/1K/rS+sPsHsV3N0zxEf6+P/vqk8+Hp5qfnWF9jh/54r+tIbOL/AJ5D9af1h9g9iu5u/aIgeZY/++qcLiH/AJ7IP+BCue+xxZ/1Q/Wj7JF3jH60fWH2D2K7nRfaIf8AnqmPrSGeL/nqh9t1c+bSL/nn+ppv2SLP3P1NCxD7B7DzOiWeL/nqmD707zoT0lT/AL6rnPskX9z9TSfZYv7n6mj6w+wew8zpDNETxKv/AH1SiaHHMqfnXNfZYv7v6mk+zRj+E/maf1nTYXsPM6gTw9pk+gOKQTw8/vkA/wB6uY+zR/3D+ZpPs8Z/gP8A30aFiNNhqh5nUCWI5/eofowprSxZz5iEH3Fc0LeMfwn8zR5EY52n8zSWI8hKh5nSGaPvIv50qyxkf61PzFcz5Mf91v8Avo0fZoz/AAn/AL6NH1jXYPYeZ05ljBz5iH33Uvmxg/6yPI/2hXMi3j/un/vo04WsXo3/AH0aHiNdgdHzOl8yM8+an/fQpd8f/PVB/wACFcw1tH6N/wB9GkMCY6N/30abr+QOj5nU+ZH/AM9E/wC+hSFk/vr/AN9CuUMC4/i/76NJ5I/2v++qf1jTYPY+Z1e5MEhl59xzSh1AwGX6bhXJGPA6t/31SbP9pvzoWI02BUfM67eoz8yfnR5gJ++v5iuQ2H+84/4FSFD/AH3/AO+qSxHkCo+Z2G9SM5XB9xSgg5+YfmK4/a399/8Avqkww/jf86FiPIFQ8zs9y/31/MZoMinByuD3Brizv/vt+dNy/wDz0f8AOksR5AqPmdvuBJ+cfXNKGUHJbnsc1w+6T++350b5f+ej/nT+seQew8zvAUPAPH1rO1XH7nBz17/SuVE0w6St+dXLB3fzN7lsYxn8aipX5ouNi6dLlle5dooormOkKKKKACiiigAooooAKKKKACiiigC7aH92f96m6iP3dlx1nYf+O0Wv+rP1pb7/AFNjn/n4b/0Gu2n8KOKfxsuogx0H4VjeKYgLeycDu4rdToPpWX4pX/QLI9fneqqL3WTB+8jjz98VZs/9fVdvvCrFl/rxXEdZqEAgU5RSL1p6mgZIoqRV56VGtSrxQIeExyRTtmaAaXOaYCFAaTy+afuzRmgBuwUhQU84ozQIZsFGwelOzilNAxmz86aUFSk5FJQIj2CmmPNSGkpgRlBSbPbipaQ4pARYFIVFSEUhoAj2ikKg08mkJoAjKikIx2qQ0w0ANIGKaRTzTSKAGYxSgUpppNAD1GKeKjU04HNMGPxml2DHSgU7NNiZGU46UwoKmNNNN7CICgPak8v2qfbkgdycD1J9BXe+F/gv408Wo89lo0lvZRDMt3fHyIox6knp+NS2orUpJvY878sEdKQQbuletT/DbwdoDsmu+PEvLhDhrbQLXzyD3HmMdtbOgWfw9uLkW2j/AA817xHcAjBvtRIB/wCARfypJ6XRSi+p4a0SoPmZV/3jin29lLdtttoZZ2PaGNpD/wCOg197+EfCqWaRtY/Cbw9oRx8s2rTKWHuFEeT/AN9V6Cth4w+xlbS80Gy42qbXT5JcfnIQfyqVIagfnHa/DvxZfANbeFtdmU9GXT5cfmVArYtvgl8Qrpcx+DtVA9ZUSP8A9CYV9ua74e8ZyW5e6+Il7aRgc/ZNBhU/mwBr55+IFhpUMjy634+8bahj5S39nJs+mPtAH6Uou4+VHmP/AAobx7n95okEP/XfUrVP5yUH4E+MVyJE0KEjjEuvWa/+1KheHwH5nzXfieYeps7VCfzlNRuvgQE4tPEjj1L2i/0NPW4lYs/8KL8UjO678LL9fEdn/wDF1ja94G1TwX5H9pTaVL9r3eX/AGfqUN3jbjO7y2O37wxnrzjoatl/Ai5zpviPPb/SrUf+06y9UfQn8r+xbfUYcZ837bLE+em3b5arjvnOe1Iehn0UUUDCiiigAooooAKKKKACiiigAooooAtW33D9afe4MFgcf8vDf+g1Fb8qfrU9wN1rYn0uW/8AQK7afwo4qnxsug8dfxrP8T86bZf77j+VaGPpxVHxKM6XYj/po/8ASrnsyF8SONcYIqa04mWmyryKfbZEq1wvc7EaYPNOB5zTB6UopDJ1NPDVCKkANMCUNT81GqkU8CmIcDRSY5oxQA7NGaZg0c0AOzS5pueKTNAD8ik3UzNFAhxNJ0pv1ooGOLUmaYTSZoEP4ppNISKbmgANJmgmkzQAv4000ZzSE0ABpDSE0h70AITzTSaQnmm5oAeDTlaoieacDQwLANLuqFWxTt1UJkma3vCvhHUPFt7JDamKC1tlEl3fXGRBaR/3nI5JPRVGWY8Ad60vhl8OtV+JfiKPS9OHlwrhrm6cfJAnPJzxnAY88AAk8A16+9np+pwS6F4cuJrLwNosmyS8tYTNearckc+RF1kkbHDthUT5iVBCnOpO2iLUerKfw/sNK0mWey8K+HZ9e8Wyti0e5UmRYh1lZEyV3E8ICoUY3OSTW94xhjubCGD4h+OL/ULuGQ7fD3h9Yzb2xH8LNxAjDvjzGFZ/h3TvE1pqsscfha90Lw5JbXEIi3hJctEwSSV2ZXlfdjJOAM8KBxXnOoeFPE1rDcPLpF+9ui/I8Seci5+8fkJAqLx7mkk7Wsai+KtNtGlHhXwfpQaAZM98G1KdQO5Mm2MfgmKztR+LfjWVTb3Gv6pbw4x5FpKLWID0CQhBiuM0USRarIgZklKMMdGHI4xTtQ+WZw3YtjFaN9CGtD2bwH8f9X8N6GLWLTrKa8jkbF86qkrKcYDsF3MRz8xOTVjWv2iPHOpBj/aMECY4VIt2P++ia8Y0oEwsc9WNX7mPETcn8BT0SC7SL+q+PPEOtOxvdbvZc9i+F/IcVyOsXlzcShJ7mWRVGRvbPJpS2SSM1U1HLyIfVBSFcrLMFI+XP1Jqy82UwIYx9F/rVMRnP+NWQcKQfSkNFRmPPOM1JEQQfWo3/rUkQGDQwRJRRRSKCiiigAooooAKKKKACiiigAooooA9M8BfCLUPGvhi68QRazpGnWFvd/ZHN88gYvtQ8BVOc+YAB1JzXo8X7KHiC40uCZvEWjwrHK0pW4imjYfLjBBHHNbf7NFnqS/D3UL3SbW2E0mpT289y1m1xL5fkwEKuDhcElslSCTXt1lq9ykWoSeLF2WdjsuEnMLReWFAKlmKqpYnngk5JGAKj284uyK9hCWrPmh/2Z/FrmI2V9pF9G+4mW2eZokA9X8vHPp1rnPEv7O/xE+wwRW+hxX88OZZIbG9hmljVuhZNwYZ+lfbF1eyauyS6Vcxy3mFASe6dV2kHgiMNj6YB/Ks+bRINQtblb220Z53l/dlIpJURlwSpKlGkORnnvxz0qnip9RPDQPzQ8ReF9Y8MXCwa1pN9psxyFW8t2i3fQkYP4VlwxlZATX6Z6xb6l4i8Mxfbo9SS0vsfaLFdFiLFDwVInL4OOemenSvnj47/s96B4f8LSeLPClrqOnfYVV77TrlMxtEWCmZCMhCCwyucEZwBjBXtbvUJUrao+YQKkVc/Wjbg8/jX0z8HP2al1rSLPxL4ttbyW0u1Wa00u3dYzJGeQ8xJDYYchFwcHJIzilUqxpLmkFOlKo7RPnTT9PudSuVtbK3murp+BDbxtI5/wCAqCa9H0z9n74lanGksfg/UYIX6SXhS3H1w7A/pX3FYaNo2g2iQ2GkDSbOTagjtLLyUAHZjH2/3s1dhjhinY6ff3W7/lpDFLke2eMA/wA68+WYyv7sTujgF9qR8fWv7KHjhkDXE+kW4IGB50khz6HanFXLH9kvxdcAC41fQreQkjYskk2PTJVOM+lfYIk1SA4Ey7SS5WTLOG/DiobjXJoi7XEqQyEbsFByB+H4ZrN4+oarBUz5Duf2S/GNvBJIup6E5UjarTSxl89+UwPxrmdS/Zz+IenoXXQkvVHX7DdRyt/3zkE/gK+2LfU7ieJzE8pY/OROqhiPTr/KpPtupOu9rI7dv+rc7Wb25bH9KI5hUXn8glgKfofnHr3hfWPDE4h1vSb7TZT0F5btFn6EjB/A1jmMjr1r9M5keZHsmsEu4ZxtktJ5Ee32/wC4dwP5V8u/G74A6raatJrPhHw3GdGNsJLm20x9/kygkMUiPzbSNpwoIHPArtw2MVX3ZKzOOvhHTXMndHzXikqxJC0UjpIrI6EqysCCCOoIPQ0zbzXakcRDijFTeXmgxcZ6CiwEAFGMCpAAS2CDtGTjnA9/Spo7SeZd0UEsijqUjZh+YFAymRxTeasvbyrkGKQEcnKHj9Kh+XONw3DtnmgCM0hNSsuKjK0CGkUhpxFNoATrTSSaWkwc0ANJpCafjHamlTikBETzTSacw56UwimwAnmnA1HmnZoYMkBqQGoQ2KcDimDPZ/gjrul2kGoaZczw299czHaZZnjWeF4wjxnaw3Djlc5IY4zyK9FvNU8eS/aLDwnoUOlaRA2x7smKzhK9iSSoAPX5ixr5VGDkMAQeoNd58PPHEehXg03WVS58O3R2SpOnmfZSf+WidwB/EB25HIGearRu+bfyNY1NovQ9a0WHxrBrot7a+0XxDqU6MFs7PUkl2n1Gwr8w7cnPvW3D491PwjFJZ+OfBl3FcI52agiNDPH7MDtD/UMD9a45vDz+CPGun3kbNLpk8uzcGzhW9GHXggg/4jP1Tqs+pat8Mi1xcO99aLcQpPIA4nWPBXerAhgQccisZ8jtob69zw6L4n+F9fdYr6O3vI1PypfwJM4Ht5oDj8JKoav4Y+EGsHe0k2kzN1a3lngGf92QSofwYVxN3p+n62GeXTbGCdsnMMXlqT9BwPwFcZqaLpbNEPtEKHkKJNyke3rVunquWTQpS7q57HD8CtFns/tOg+L57i1Zsh7jSJZkz6eZblh/47XP6x8H9agjZbbVfD91xx/pxtm/75nRK4Xw74g1nTJd2i61fWMhOcRS7M/gDXotr8Zvitp0QU+IZ7qIcbLuMyKR9DkVrLnXW5D5H0OFk+E/jKPcY/D0t2B0aznhuB+Hluc1zur+DfFFgwN34a1q2UDq+nygfntr1pvj5r7NjVfDHhvUG7u+mwbj+JQH9aefjlbHBTQG0x/WwjdAPwjnX+VDlJLYXLHoz59nhlt2/fxSxMOokRl/mKjM8WMCaPp3cV9BN8fNQjVhB4n1e2z0E1lNOq/g0rCqMvxw1u4BD+MdHnHpfeEo3/UoaSqPt+Yez8zwZnQniRD/AMCFSx4OcEH6GvbR8Xr2Q/vdQ+HVx7z+EEBP5RiuM+IXiv8A4SgaadnhVTb+Zk+H9J+wk7tv+s4G/px6fN601O7tYXJbW5xFFFFWIKKKKACiiigAooooAKKKKACiiigD7F/ZV0s3fwr8QywLNcXTalKgs2lYQyYgixkAjGdxyQQSAB2r04Pouo6ZYHxJFplvc6VJGqx31iV+zyD5lWNZHbdkY6bz69K8V/Zo8bX/AIV8B6oITbS2S6m0kkDRgyFmjhXIOR1wPyNeg678RD4s1Q2UPh6wnvfJlEV1LYC5+zOn3XBf7mCfpnHWuWckpHRFe6jttH8R2Gq31zaJdaZc/aZ2gE8E0awXDf3BECHD44IJP1x01ZvBcd3Z2lmhhns7WPy4LN5XETrng70G8FcEBuQMevNeHfErV5YfCptLLR9KMptpAp+wRiRpQB+9DLgxumC24dScGtHT/iP4g1mDR7aO9EthZ7RqFwJRHvwuCCy4JYHBPaplLS5Sj0Z7HrXiEeFz9o16zlt7BZFtjNHdpOFZh8jFSAwU9N3J9RivH/jR4xl1T4e+J9NsZjJbvppmkldQHaJgSqtjjqvbHT2rO8RagfEUDTvDPFb2crwtBMWRpJCQmfm6jyzIwx61g+P7O1tvh/4omtJgHvNLZm+ZmURxqEjRQcfwknJ/vGiMm7DaVmfKMoHlyA9Cp/lX6E/DT4kaZrWjWWkXshtNZtbeNCzECOVQqgFSTw2MfKfTOa/PSQ5SQexr6RtdOttV0+3l8ya2nEUeXifHmgAcN+Xt0qMerqIYB2cj7JUIMBjMCo3Da3OT14qi0IvJS0sbRSIRu8kRSyFewJZPlz9a+fNG8ReK/B9q0Wl3Md7au24JKqyFFPoG4J9ORxXQWXx91WOJ49R023kcHPmuphDAfw7QBz2yR9Aa8xJ3PTuj09tImTZ5D3qAEsY55llXr3IAbPcYJArO1LQLjWrW4W4jsrS4ziKcxG4woI5fdgc/XAz1zXIx/tKeG2M8N9YXcFwhUKkDrJlSMli/AHPGBk/nUqftD+EpILlxBqUr8FUCKd49zu4qeR32f3FKen/BO90+0tdOEpjt7dJmYGaREABAHBz3HpzxWlEqiXckRSMgv5kbDbnrzz3znOK8wPx+8LxNG62eplHIz8iD5e/G41Yt/jto8zzJa2GI4s+UZXAeUf7ozz7fmaFCS6BzJnp8JuQAVeRRtwHLhjk9sY/XvVG8uo9PsUkvr82EJbiR4g7Ak4AAB5yT+vavLm+L11fXb2tjLp9jDJEpj8yJTsc/eLYJ5HZenrWDquvWcUayXuoHUrtj5Y2Pu2DPJ9voMZOOBinBSbskS3FK7Z4N8ebyLUfijrF9DHtW6jglZiADI3lAFyOxbbk1wWlaRe65fx2Wn2zz3D87VHCr3Zj2Uep/nXTfFYzHxlO9wAs721u7KvRCUyF/AYFdx8Fb/T7bQ9QtlZU1a4mMhLEAvGoAXHzAnac8DJyc19BSly0o+iPDnFSqyXmUdK+Etra2889/LNql9ASh0yBmsxuHJzK6knjkDaufUV1Om6L4It9Ka9GlWdiiEKZbxt0xLDIwZGZcYzzwDjORxnsbi4llSaT7FdPAq4eSIvID04K8k9f7ufasW10vS7m3fQLnwzcHTLU7BBc20iQjedxdGkITOecKAew9KjmbepaikSaHqmiX9vdReGL6N7dZRvU28IRmVfmUbBhgRgkn0yDU2nTwXMDuixSRQ7vJazlzA8bHIIcYRWOSGTJIPcCucuLDWvCmiX58LXEF85cRWio1vD9jGed8QUb37A5wepFZfhy28d3mrQJ4judK0/TmDPNHM8Z+0r6LHEAyn/ayB9elK4zqNI1nxDcG5XUPDn9lWSIVgvUu1ad2B4BRdwIPc5/nVmX7HfxXEV3ZxSRzupje4SOR0bHzbkYEqQRwcFcVRu9Rie1Fnc2r35kMUckKEoJckqzhn2liPXgnpnvU0egW8NzI9lbxhY4/IEU7F9oIyF+bLqCcHGcAA8DGaBmVL8O/Dc8cr3Xh2EzOvyGGZoBnnJ+QjJx7AAjoa4vVvgt59tLcaDc3asi7ha6mqKWOfurKMfmygH1716lYaHceH7e2kbT7Oa7kcRyvZuYY4oyclsOzE446YJ4rRhtbWxubi7WztDcybI8AsNyBuB1PIJJyO/rVKTWxLgn0PkbUtNu9JvZrK+tpba7hO2SGVcMp/wAPQ9D2qnt54r2X49/ZTdaKEKfbIBLFKFXG1W2uoPf1OCTjPbNeQ29vLdTxQQRPLPKwjjjjUszsTgKAOpJIAFbwfMrnPJWdiILnFOEfGT09a+qvh1+ybpU9qt7478VQwT8b9H0m5iMkJP8ADNOSQreqopx03V7t4U+BXwu8ONH/AGdo+k314q8TakftknH8RDEr+Sis1WjexcaUmfm9tUtgOpJ7AgmtK38La1fQrNa6LqtxE/KvDZSup+hCkGv1R0zwToVp5dzZ6Posc4yFms7aOBlB64worTaynss+RLdShQP3e4n8iDgfTFR7Z32KVFdWfktfeF9b0+8js7vRdUtruXiOCaylR3/3VK5P4VWvvD+p6aM3ul6ha573FrJGP/HlFfq1farBJrVpoc17cWl9cI88UMgYCVVGW2v0OM5IH40XV2trandqUr4yxhtmWeRh7IG6e+KTrO+w/YLufkoEVj8rKT6A0hjIJGOa/Tv/AIRfw54n1ea5v/CVhrtreou24k0aFZAV6iV32k+xHX8K4vxN+yj8PPEckn2LQ9X8NzsC32i0u0MKn/rlIzg/QYq/bJilRaZ+euCDS9K9w+Kf7NHiT4eWt1q+n3MHiLw3bjdLfWSFZLcdzLEc8DuyFlHfFeJFMHmtlJPYxkmnZjQakUnNR4pw47UxH0L8HPEMWsaGtlqUX2weHJorh7c/fex3AFlz18snaR/cdT/BX1745uLXT/AKmzytq1lc3EW7glZG+XPvgivz9+EerTaN4mN7BgyRRjKtysiFgrIw7qykqfY19cfE3xlaXPh8aTYvLIsVrEo3xiMRQqPkTAPJ55bviuOrC09DqpyutT59QFrWQZwXViMdRiuf8QxC88OtcP8A66BlYEDqCcGumKbLRGA5FuTj6iodY05LLwVqKsAZPLUsffcP5U+oM5PQbJbvSwxUbgxAOKbcJLbk7JXXHoxFWdKm+w6RFGflY5P5mqVy7SZPIFb2MmU5NQu1OPPcj3Oazb28lDDDAg9sCrskXNZmogBwAO1DQrsiW/bOCPyOKttIXj3B3Ax3NZI5PStIri2yP7vSkwRUa7bPDt+VRyytKqktnr2qDnmnD7ooAKKKKYwooooAKKKKACiiigAooooAKKKKAO7+G92qT39qZ2mnlhZ7fSyny3ki/MF35+Q/L168da9e8F+IbSSVLBLm6GpXricoqtEilufKTnLICSAT97k8Vwnw1sorvwbfQpHGL28vGgSZQBLGAiNuLdRGCBkDrnHeuv8ACdlpOlLHpcKLeX0IEt2qqXlEzDPydsde4ABFc1TVm8NEjrALPXGuCtiWinVoJmYErOqtjAbowyOq9QRWNea7YeArorevJLY6u7XmYrfJhBAHlFVwGXjHqAea7jSw9taW7TCRbS8mBMcs4/cL2UbSVAyBkA4rK8beF1knSSS0gluLKUPpcCynNxM5H319A2CR7elQaPa5eFpaeILfR57lmkggi+3xPJu3b1UiIBfbLZHc8V578WtSP9halHAF8r7BOpKsQDHhQFxj5trE8+y981JHqOtwarDHHFBCuohLQqMjyo1VowzR/wAI81d/Xpn61zvxWjSysdWj8pZLyWxRLm5DEgE85+Y5UsUPA4xRBaoTd0zwNTlW+hr6C8NausCxW8m8RhAfMAOM7QQMjofrXz+qhQa9z8PRo+mRSIHysYD443L6d6WMV0hYJ2kz0O2mJSNoZPNWVCRscDPp1/yO9DTxzuEWSIEjcEckM34H09q5q2uDbRsjyTQKR/q1IIJ9scNnuePpU0ermdmVYonYOVRl/h44OT0PY15ii0z0+ZM0Z5YlMrLpkQnOcedtwfU7gORiqN7Zx6htTUY4XihA2C0QBkB6gdOnsf1pP7UseZZrW6imB2ghgM+pDAkt+VLFf2V8+2RpGK/Kim4xu+oIGD+dGqYaPQqnwzpRWJdJ1GW0dW3f6R+8VvUdSUP0/EVD/wAIXcpA8lrch5o3/wBW0JiyPXe3auq0+1tyZRDasRkO7Fhhj+APPHX1rWtESFNr3iuzNvNswJwhPTPQc9ucY5FCqyT3D2UX0OMtfDWoP5aT3sETAYaNpBwv4cnt2rcstGs9OkS6urgtMkmRIHY+UhHG31bB4Y9Ooxit29lsfI2yRQeVGxZBJIA644JBUcfhgfWuC8U+JrbTfMt7aOZmZwNzZAYDJDHu2TwO5xkkCqjUnN2QuSMNzzD4ozLP4xuiudgihUZOTgJjr+FYWmXM1msc9vKyTRsSAoJJGf8A9fWo/EkzT6n5jZ3tGhbJ74OarWx2xIRw2WPXqK9mCtSijx2/3smej6X8VNRsZ47W8MMsYJzOUUyvxkckHOMdQAfeupsfi5o97JJbahFcWwmUHzUZXWPGMdArY45IOc89q8J8iRr17yTcrBTEinB3A85GexH86ttGsOZAhVyoIJGUAz0x3P8AL61NtSr6nuWnar4bbVkkl8UXt1fCRivnTTqka4yBsUbZBz9/nPermrzz3el3Vzo/9gT67dKYmkd4VedMjKuzY2jHOCQQQBXz3carMVithFtAyQyIPl74BHOKoQ6pOlwS87CIjcVjbcsmOzZ6n602hNn0fbXHhoWsFrcX2k6Vf2oCsIr6QAFhh9ro3zAjgHkZHtT9K8S+EfDF1LJb6m5szD8kkkvnoADghsfdbPOTljnGcV4F5dnqkkchslW8ZAjedMTHj+9GvZvqcDrVa70a8up4nh+a35eS4LDHB4Le+B785osO571f/EDw3Osd3Y3V7cXEO6MGANGmSckMSQ6+oZQcZwQaxdS+Jt1crbWto1ytrfkRc4aSE/3TIijeG47AgA9a86skf7FMIIklu9nmI+CA5AwBgcE46VqaJI9rCEYNDIqJuRpdrDGDjHB7e/WkgRH493Pp+lysXcyO585zzJ8i4J98Ec1sfs76jb6R8YPDd/dRJJHbNNIN67gjeUwD4/2Sc/hWB40nW4sbFk3GNJnRGzwV2Kfl9iSTmqvw9mkt/E9vNHndFFKxx6bcN+hNaJtQdjPT2iP0407xFJr1rFfaFpv27TrgZS8j8qGKUAkZUnLMODjjmjUNN+wzXOoanrRW1BEiRvBEBAgHKhgu4g+/NfO3w08SXmi6BYW1jPIiRwKmFYjcBXvGkfEWKSBZLi0tjM3/AC0VdpJrlU9bM6uWz0OgstOslka6he8cygYUSFkI7EL0/Gmahc3lhcmaPzTZKgyi2+9t2euQd2OnY1ir8SUu728svL+xSRgbZEUOSD/Hg9R7Vv2WtWM0bRvqomkhX5neEKWbGc8H+VEZxbsmLlkndowZtavvtUr30VpbpbjfFL5TMwjbgtuKjbnoR+BrT01tDuC89t/Z77ARK8IRTn3x/Wrs+o6XPAySXhRpBt3InA/A9a5W4lt9LvZooNV0q4sp8FLOezZdvr8y5HPXpQnZ7jSv0OoW606WIm1WSVOnyMQoP1z/ACqhDqF/LfpEEW3t1U7nJRwx7DJO4H8MVxh+NdlbardaXLapDPbSLFxKCpJ6cYHB7YrXsvicl1pyzDTjb3T7j5ch4HJGenPShTTdrhyNdDpDe3Fik0+oahbfY48lhLbqwKY+YEA9xnjuDX5WeOrS1svGfiS2solis4dSuUgiUYCRiVtqgdgBgCvvrxRrs2qXUT3kz7Lry4WVB0BYjJA7D17V8D+Oz/xWfiQ/9RK5/wDRrVvQk3JmFdWSOaxRgUvU0vU11JanKdX8P8jVLkjqIl/9GLX0p4wtwJbgjjzLCBv/ABxa+a/AX/ISu/8Arkn/AKNWvpvxcAxYZwTp9v8A+grXPV+I6KWxwpiSO1tiy9Y1GPXgVQ8TSM/hHVwTzhf/AEIVMjPKgLdiEA9AvH+NQa3FLdeGtThhjaSRguEQZP3h2qF8RbZwunqZdPhOcnn+dWJbdtuQMe9aXh/Q7mZLW1le1tC5OZLy4WKNMk8sx6V6zo3wY07U0Qz+LftOeqaHot1eD/v4yon61rOpCHxOxmqcpbK54HNCck8Gsi/iZnHtX1p/wovwfawhp7TxleEDl5rqwsE/Is7AVxXiPwd8NrMSQJNYWFwON934glu2U+6RW4U/TNc88bRjvL8GzWOGqS2R84eWQ3vWm64tf+A16aPDXw+g/wBd43sScdLfSZH/AFZxVr+yvhjHGPM8Y37nH/Lvo0Y/nLWDzKh5/wDgMv8AI0WDq+X3o8Q2gZORSsPkXp3r2c2fwvBAHiXxAQT1Glwf/F1xfxBg8KQDTf8AhGNT1G9z5n2j7baRwbPu7duxjnPzZz0wPWtKOOp1ZqEU9e6a/QieFnCPNK33o4miiiu0wCiiigAooooAKKKKACiiigAooooA9k+DWhQXWmXmoTXLo/nmCOJJihYhVJ4H3uo49q9Mh094ZWi0oQyXcJBlMkbAAbCFyOCwH97pxgd64n4LrEPB1zKRI1ympMIVSMMSxjjG0dzkZyPbORXdeMrzUbTR7ZLeG7jvHuERR5yJCELfMkr4G1doxnnnGK5Z/EdEdkeVeD/ilq+jahfWN5byXV+GmlPy7Ix32lRyQe2MdsZrudH1XUvHXiPT7ibT7mHTUtZYLi5husS/aGUARDadyKgOPds59Kx9T8LanrXinTdSsJ10q4nhaO9mCrJHAuOgfoSQcA8c88Yr0zQtei0u0sNLgNsdNuVLxzRttCMCFCRDvk4JzznJ70Tta6Gr7My9U0WLS7TThZ3F3B/ZUr25A5e7BiPznaeRlS3PPX1FeQ/EqSKaLWbgXcdyZYo8Do+csC3PVeeo4yfpXovxH0nW10Oedr+0gt55JYQqq/mBMZhHX5pHcbG7AOOwryPxU8tz4cSW4gRJ1h8osrZJUFQvPuBnHvmiHRhJ6NHmWTj0r3PwLNILJWRSUEYYgNtII44PQ/Q14iFFem+DrqaC2ilt3ZGHyMd2FJ7Ent6U8VDmiRhJ8sme0adJHqSNAYYS7OGHy5H1PowqrfeGPstuTEqwebkHyiWDn1x+mfwrO0vXHmUreGDzBLmQTLtf8CO3pjNdGJEtHmEksbIW8sRyPyuf97Ax9a8mzjI9SLUmc5J4ZuYreOeVLdgsX7wq6qUYZyDng8Y6HPtVVtLlkw40J7nzIyASi7Pbkuf5dK25fEGlW0zWyhopASrCK4GI16kKAGC59FrRtbl7sQpFYak1uFJjuUw7v6AAKDn3PPrQ5NMLK5yMlrfWSQT3OnfZFLCP/RQI5EJOMbc5I/kOela2kafq0c08aizt4oyY0dJPOkTuCcDZn9PrXQQI1rcRGPTr6NXOHa4zv3djsC85HGQT7iprq8WG6SPZNmItE4uC37rvtVMAuPfO0ds1LbvsWlZ7lS30q1BjZ55ZkiVlcgqrO57bQMfy9fXPmfi26hs7eTyYkEmMOW+8uOOW6k13uqz3EVtJNdTQqSCyCNkDlPTKnkY+npXlfja5VYTtcBUAIIPDZGc579ccdwevWrpJuRFR2TPN9Ul8y73f7C020bcwU8Kcg844qCaYzurnqVx+RNJazSC88jKrG6EgnuR1Fe3a0EeLf94y8ZEgjjRnZGO4LGxI3KOgH500xzFS0aqkMa4bA4BJ6g9z7GorGVrpVlaBWmDFlUtyGHygjPRSKdNukk8ld0alt25lwZOMHGevNR1LZUIS2jJYtuXLh92CPUA9f/11LYJYGGHyoZBMrZeN4woKnurZ6k8dMYpz226d4zJIIiMAKygcddx/WporKziict9sCSsdrr95S390H0x3psCnPj7TALUzNNHOpnUQbmRD3JHBq7HP/ZWoOZvM+xpLtVo3CLuI3AMrDpj8uaaEWzLK11KdmzbOsRG/03KTnjke/Oa0rK5keVnSFoifuhNwD4Gd4DHJHPTtn3oYFv7K3222eK1vrc2ykm6P+qdeuY1A42k5JBORk1e0eaK5DsGE6R4MJVyVXaeD0PHXnqe/Ga499Rn/AOEj+zTX0l1ZlBHslLNlMcLtPI9BXQtplra2BWJ5bYp5iqhlbygACVfHXIOAcZ5HoaVhoreJnjSzsba33G3hJ2O/VsjnjsAcgfSl8AySReJIWSQIfKlUk+hXBH5Vk6hcG4ZQ3LYVi2MZyo/+vWv4GCHxFArjKtHIuPfHFaW9wyv+8R9M+FSVt/s427oiYwV4GB0/pXdQ3CiGRsgOCNwPUHFePaPrcekT3b3Uj7jIsj7v4TtCZwO3yjn3r0nT9ZtC4WSVBJPh2jyMqCMBq4na+p29dC894gvoHM6JO4KB2xvA9AO/NP0DX5beyWO5LOZDuaVztwx5OB6elYN9pEVzfG7v3T+zCw2M77Nqr7+hPbNAu45Yfs9mVlkjxHuzlQex/LBrOMU53NW2jptR8UhHjgiYmQ8DJ6j2qtuCTfa7nLSINmWYkjPORVew054pRLceW7oMDHQe9SeIryKx0553X5VByEGSSB6dqtRSdyFJ3scxJHZa14yjs7hliRQtyHx87kcDn0HSuxsZDHqV3BIWkCSFkdmyxjIyP1yBWJZaPFqdlbXYhFvO5SVdzASRkdSfUe1XtX0rUHkjv7LVBEYI2Xm3XMicFh16cHBPelB6t2C13a5pTTvfXkf7pzFaoZG28Bcgqo9+p4/Gvh7xpGreL/ELI29DqFxtb1HmtzX2Fp8slmmo3dzNI485p1Iy2zCHan8ufXNfH/in/kZdaB/5/p//AEY1deE95tnLiNNDn/Ko8vFWcUhFdiWpydTofAoxqFz7pF/6OSvprX4nvXiiiQvPLZ2iKijJYlRgAdzmvmbwVKqawLfBL3IUJj1Vw5/QH8q9v+I9xezCzsbCfykubG3aSRDtYrg4w3Yd+Ov0rlrfHZHTR2uZUeu+HNAuPs2pGa9ulZ/MgtcMYmz91gSBnPXLHH92pde+Jmmy+Fr600zwm6yGMYkur1pAhDAgmGJUjA+ufrXBrb6XpGFgBupgpJOdqHHv1/Kuj1uLy/BWq7AqD7OrOsY2ryy9u/45rJxTeprdp6GB4V8feMJNTX+yYdLSaL5gRaJti9yeAPxJr06bxv48uLZpNV8ZXUa/88tOtYgx9vMcHH4A15T8N5Ng1DHdox/Ou/vnJsiTzgimqNOHwxSFKpKW7OM1rxzJeNJFcrqOpYJBOqavcSqf+2cZjT9K4rV/EzKipa6RoVmpHLQachf/AL6fcaZdOzTy/wC8T+tYupklkBz0rSxHMxDrF6ek5A/2VVf5CpZdXvASv225AA4xKw/rWfGi5XccDv3pZWXJx93OBnrSsguyT+1Lsg5vLj/v63+NSw3Utyv72aSTb03uWx+dZzAZxnNW7MY3/hTS1E2WqKKK0JCiiigAooooAKKKKACiiigAooooA9g+EPiVNHt7GwS4xd32oS4ja33qiLCpL7+qk9O4PORWvPPrnxI1bUrC6itR/Zh8vCDLK79Sj5PIx2BFZHwqmsdJ8L6lq18tyvk3WyOa3iEjgbUZ1AP3cgLknt05r1/wxrGj6/LdR+HZ0jnwsxuFOSpYcbgo+RsZABJ4rmnpJm8dUjmtb8NNaQMLu+urO8ikRbWRYXcxdnZnBwSwPK4yDisK+tNX8Hajot7Hbzajo8M7LcrIoLLI+BvCL9wjGOCT1z1r1O4sTayWNrb4nWGVpLlwcor7dwJGSQSe2e9cl4516/8ADVg0ktlIyLAJmu7chYxNu4JUnKenGeSPSou9i2la5JeapceIp5pLhZtN0u2ixK0hIDXBXJOWGfkUgA9iee1eMePLCHTLNYLcNIsUajzWyRgjCqD3wuCPr6V6Xdw6dbXKaRMrxafqkb37RlWIkCqHaU4zxxtz3OeOK858W3Umo6deTSMyiYtKqGPZ8uMIAp5ACr+tXDoTLZnm5HB9a9B0qKSyaIx5QSqGjI75HYd+9efnivYfCtrDfaZaJMCyqQVfupx0FViHypMzwseZsvRXTTR+XKhJUhlf19eeg/EGn2SLJLAscyyrGd/2MFQWG4blyw2k47H8BWjL4au0QNlZcgcDluT39ePTv2rN1TTnR2jO4MoMbI+MgnuQ2D+nQVyRcZPQ67Siy3ca3Jotzci10Y2hY5bZCVLjPAHJBx1+XvUT+NLy7ds3qW8bYDwoWSRh6lmxg/Sqdpqmo2ESBJZ47M/8s1HmJkdcbsj2xxip0voL5IUkv9P+0/NgtbbZOeqtuJB9P61DppO7RaqN7M2YvHMsit5lzNJ0+dbrPHTkd8+xGfSpoPFEnlSRTXJdVctGEjd0Vey7cZ/PNUl0GW+813n0wWsYEe1IyNrY9mGT78+gqnLosmm/u1vLaZmX5m3kSDHYLkg+3pUctK5fNUJtQ8R2xAKeTBbM2RFbQAmMf3jkABj6dq898VXL6u8jBDHFGcszEsQO3zHqTXcXOnWwhYAyySE7VJyqgeyDGc+5zXF+LJRFYlWAUAk4DdauHLf3UZzT+0zhDt+XbwAMY/E1NFgkfKMg4LYycd6qwuZI0cjr0+mTVq1UiZzuxkdeeOMV6j0gjzV8bF+zC5nQOM7egYMNoHI5GMgjIq8t1i4eRmVdh3F3IyueO/SoYLbylTyo22JhW+bO0ZJOT+VVjYSz6jHdRsJCI8Msg+Rx3z0+v5VmaMnublbi1lPni1cqVEofOTnpu6emRVWwj1KVre9u9ReRAGZBGQwYZwQfXPfvU95NZxfI8CzbMMqBcsQRzgDjHfkUW0wjtEtFYSqqnaVRWCKTkgj1+h4oBlmGOCOdhNOWXdkCSEFI/YKex7/n1q21zPLJbtcTbBHKZXihPEmeAeOT9OM1zF/4laxuWggjU+U5DMSTkj03ZIrZ0zVU+xw3S3EsUaAdhknJ+Xjt+I9aGtAuav8AY2kS3o1+1kiibBSS0EbgF+m5eOAeM54HPNTf2hcR3caNbwQXcsDCaPzDksDjK5zhQO/o2BUFrCS7TRz3KQlPljeTEUeeWJB5JPJ/HvxWbbXWoTxRyTxGC0WR0ZWTGIxjYB3OT6dcUkMoXG37ZOFyF4wvZR0rofAeF8T2bHoA38q5p23X9z0zhckAgE85xmuk8FA/2/EF4YxyBfrgVsvguY/8vD3i/tg+oLLb2Qna6g2l2cIEKMC2T6lT+lbUGjrresW+qAkmxy0YP3S307gDjB4NZ+l3zGzt4ViXzfuMrAnOQQw9iMV33h5VdWTyvLcnoB0rheszu2LExkvdPWOSCLAOQyrwfbb0rIj0pdLN1cglS4LSKqZJfj5vy4rr3XEYVFGc4x0P1rLubM7+5PU7jjNEldgnqVre41C4gh+wWpPnLuSN8ZK565z0rPvo9Q1W78m5g8iOJ1UpuGXYHJB9APTvW3Yahc29qtvFBhYmEJfco6kkcHkjHpRI8kcxlLZVwRyBk57gdqiN29S9E9DT0/RY1xJKcl+MJy2am1G1ieCRE3KHRkGDztIxVmzkRLdBkKuAFPcmluJ0jRhIyDIK+nbrmtIrUz6nKWckWnwPbzqqvKQ0YB+XDEjaff5T+Br4u8TKT4k1o9M3tx/6NavsS0t7fWUs5pI5IoYAIkd1+dWOckenDAZ7g18ea+M69q/PS8nHH/XVq3wfxMwxWljJwe1Jip9lGyu62px9Q08sutaUVJDCckEHBBCk5zXQt8Q57W5ihviHiaHYzkEgjPcD7vU8rxz0rAtF26vppz/G/wD6LasDXnzPH/uf1FcdeCc7nTRk1E9QtZ7LWIBLZ3CA7G+RyBgZAJz0xnA5x1rqvErMvg/WS6Ff9HjQeh/eJXzpDPJCrvFI0bEYJUkZHofUVuQeM9Tt7N7KWYT2jtueNvl38cAkdgeQPWsXzp9za8X5HpPw3Tcmoem+P+TV6LfxAaa2AcHtXkHhTxxZaOWb7DIscygyBm8z5h0wRggc9813R+Jeg6hElozvC8i7t4YFVPodwU/zq3UXXT+vuFyaaHnE6ZkY+5rD1UDzFyRkL0IruP7Gju8y2l9bTIRuGcoSM/QisDW9Iubabd9iWXA+8H3j8gaanGWzJcZLdHKKucAEGpTbNtJ4GD3p0nn55RlHoq4FRZcf3s1RI3ycZ+fj6VatU2b+c5x2qt5hA+7+pqe0bcX4x0prcTLVFFFWIKKKKACiiigAooooAKKKKACiiigD1/4Uw6TqPhy/sNUinmV7h8IciPDIgyCD9/IB+gHvXSab9l8O6lqNrta5sdRceVbQptbYkaqM7SM8A8jkn8a858E+ArnxPpYvIp71bf7WYZltSq7dqqwYlmGfvH34reN1fwPpN74b025e50qSRb6O9BeTeRhdzEYGVyVIxz+vNNXbN4uyuex2epRyrFb6bp8IgVF84KGXZznB2ckgdQc9awfjC9omgTo00sskZWeKOJQ0bIWCpv3DO1SWxjnOM0aP46sdIY26W80F/K6QW1kluQZy3O7PTAY4z1yDUniKw/4SHV5PD819KLyFkvrjzEEgSMnhfmPyjI3beg4JqFpuXJ3WhyxS5m1NvEtm88lrOZIRDKjoPL8vbuU9AC4yAPT3rjPHUqtpssrSvLNBE8Qdht3MQNxx+HHsK9e1q9u4bAafpUa3VvbxuC0ueAFJUJ/eBJxjgDPHSvEfHM91d6RLdag2yZkk/drlsSjAYZPbgj8KqPRky2Z5qdRcA5RfwNe1+DwTp0EiAqJFVWPXnA5x+leBNJ8pFe4+DZZraGFFQPCyq21j0yByPfr7UsU24oMIkpM9ZtbhZLRQzIqsdgcgbRx0JPOTjjg03V7bTbuFXvJ7YNHtMbMWDKScEnPQE9hxxWLBeBgyOjrA+XXgMEI64B6Z9jwam+zWzzxSSoZOjxHaz7vb+XX+lebF2dz0bX3MuTQ7TzTLaamrOWyFnVo1YngEMoH6jHrXO3Bi3zxXERjvIXCGOSPY+7PYY2sO/HrXdTSv5rSW9vlkfKBlIXGe7Y9B/hWg32u9sprS+i064SReIBLksf7uMfkRyDWkK7T1M3RT2OEsNVWxUF4jIWyh+YjB9QAD+uK3bTxJb/uIWsZPmbaW3KTn3Udffn8quS+C1Mz+Xqk6qVBVYkaUIf7hycn65rNPhDUis9tLJHCVG9ti71I9xkc89Oferc6ctWQo1IvQra5rMSRvDZJcPKBt37RtfPXoeg7Y6+wrzLXobjUxLIVYW8XyFmAUKfQAd69BuPB5tnjGq6us0USl0trdSoJ7Bmz/AC7dxXIeKL5LezFnCsR8oYIjGOT/ACqoSinaBM4yavI87vdRS1lWMRkqsagfTFWrSc3UIkBaJCDyO5zj865/Vy63YDfe8tM/lWrooP2RHDAKA+5SM5weOK9C7cUjhaSk2ajQyLdyyxk7ZCWMXq2ABjt2qY3yx3EFpKDE1wWAL7cdDwWA55rPi1NXvHgygbAbPbr6/rWmmbeaKeFdjxtxIOFAI5x7+4pMZTuftKRkWMtvZB1BeVUOZvqRkgA9ulTNcGLaskm9YSrFyvDe+1cd/rT9+pmW4lvUjR5cSIyleV+o7Y9eapSXb296sQjdoXj37WKlWUDtjrQDLlz4BM9011DIDYuvnnzJFEqr3LIDkDPQ/SrcCmGzH2CCCOOJNpEsQYkA5yS3f19Pes6yube5iWZUaHOSCwzk56buv4VeivI5d8NtLBcCWXy2hDnLsf7u7rz6UPYXQfquuJatCTGoNywwCilwxwGy390DGAOOamvbiRI48BiQpYhf4gOgOfrnj61ivod1d3MBusRNa/I1uEOEwSc56dRgjrWjeaghurdGT91KGdQBxgDj6dT+Yo6DWxz0t6ttO7Ohy+AQOx5J/nXSeAb6O88RLEEYFreYA+hK4H6muK1SRpBC7Ah2J3ZOa6D4azeX4rtW27gEfK+vSrUny2IiveufR+i3Q3z6m8flYVWMLS4+YRjcSTxywzXqPhqf7TG7FtgIAwR1+led2Wl2+qxJbPxuGHyMhgQcZXoe9dZprXsX9nWaxiS4KZcj5dzLwSD3HFccdJO513vsd7Opf7rZ43Z6Yx2qGWWN0/eR74wOvfNZcuo7G8pjhiOcn7relRy3V3qUDR6XEGuQpGWGEQ46k0N2YLVmZqEYg12wv2Mj2UZdJCq4VGZcfe7/AE6V1ASK4MUsWCowDu603S9Eku/DFvHPOrSPbRsSV+63Ukj0yeaoWckjWxjRAZUJU45AxwalaP1LnubUMsFvAQC/yn5zjII7YrGv72W/uFtI4kMYO45yBtzggkd8ZqB71bJZLcvulfBKscbf/r1Rg8T29hb6vIqNcXkSjyoUByz45O7oFGQCfXiqk7Mnrc1nntjBc21sgjFtK2MDhQCByfyFfDGu6vDHrmrBkckXk+SB1/etX1ydau2014Lrat405uAoXIw7dCe+DxXxNrrMutakpPIupgc/9dGrooPlehhiFzNGiNct+8cn5Uh1u2B+5J+Vc95lNL810Oqzm5EdZYajFearZCNWUx+a53D/AKZNWFrx/wBIjH+x/WrHhv5tUHtbzH/xwj+tUdYk3zRH1T+tZTfNK7NYqyKsfMTD1qKQgn8Kkj4RhUBOWb6VK3Kexv2v+pTJ7U2Ygnmi0/1KfQU2b71UQMX5TleD6jimTaxfQsY0vrlUJ3ECU4JxjP5U4VnXn+uP0qXFS3Vyoya2ZqN4q1aSRne8MjNjO9FOcDHp7VMni29Gd9vp8oww+e1XuAM8dx29K56kyahUYWskUqku5up4jlXG6w09+O8J/wAauWepnUEKta20JjOd0KkFs9jz2xx9TXMZNa+g5/0jP+z/AFqowSd0JzbVmbNFFFbEBRRRQAUUUUAFFFFABRRRQAUUUUAen+AfEMOl+GhYX0Mh07Ub+SB50IHk5hXJ65zwuOw557V6RY+NNQ0fRrK7MX2Y6jbEwxyFZJLwr9xQB1bHOPRj7V5R8OYr/Uz/AGfHpxubBZjK0hjG1XIA5c8DgDj3z6V7Bd+Bxd3tis+rb7uzbzVs0fy4YUIJwMKzKScc8ZGelc0/iN43seeW/irXvHiC4l0aFI4JSDJwkSSdFBU8k7iBgYJ/Oujh+HerWF5DrEerXNxNdmOWVJ4RvldBnrnj07gHHWs/QrXVF1b/AIR+88IQR/KZcW7GIPIrbvOaWTOVA6Y5yfU16JpGmx6ZLHcvCkk9wrQxSwuWEsRww5zgLx1A5xxSl5DSvucbq3iLXbLT5b820LPcNthMYbzGyrEABv7p2duRmvMfHuLOzexMzPLDbvCzFsgsFzJ9SW7/AFr1/wAWXKwDSriYhn3SpAxXYDgAEkE+x5zzgdBXjfjudbxbpkdGjZHZcc/eJH5cH9aEEtjyXJwa+h/BqCawt1TBl2KvuOAfy4/WvBWsnCnivc/BjpJbRgSLDNEqqN3HYYP0IpYnWIYV2kzu7W9uLByXhe4hHGQM5B6gqf8AOak09tCS/lkgtp4DLzIqsYwSOvByM/UVftEJGWRXi4UleuD6j/Iq1caZZurfbIwJlLEyIdxH4jn2/CvMselFhDqltFBEoN4HA3RtPjYg9NwJX8KtWninQiY7prq2gkKFCZ02tHz0H168deKxDpUNvAxh1FYYwMyC4fACHoelEFpCjbUs9PuHkGRdTF1G0dxvXj2IoimF0dBf+IbdtOc2morFbHk+WFTce5B5Iz6DNcnFJrEjFI45zEshKyXsgymR0x1P4gGtOx0PVp33tJp9sFBVStysjsM5HReD7jnmrk2hPb4ea/jQHlxsb5j3HI5/nQosSkjgtVtlRQJJUdQxUIGypP49ce2a4zXdLbZJI6rHD0Axy/H6V7DqNhaW9uyxecZQQBITufn+EccD2A5ry7xN9y6XJwOOm0M3p+FbU1qZVHc8T1451F8f3F/lWnoYZrBY8kBg2D/wI8Vn6rH5l67DkFR0rU0QbbaJSBldxz3xnpXpr4Uea9ZEkOgyi8kuXx5SkKNvJbOOPatOKUCQKCCQpBPYc9QeufUUpYvDvU4csAjqu7AP04OPWsvU5Dp1j5VrI8hjbIlbBxk5P6/zo3DYv3EUGoQNblgkZBZsNuZT1yadbWNnbBZbO1llaJARIHZsA9WA4H1qnpF4lzbh0X7NLuIlkEhyx68Z6VbS585mto5hsjX7rZOAOpY9Cf8AIoAkmMdy2JY4Vt5T5f2hm/eIxXrgckfWs608KfYJFnl1CKQQkOrW7ZXIOQCx5BOPSrVpFfAjzZoliLEjMR+Zcfdx3PtVmG9mvbK4xFNbyo/ySSDAxjBYr19Onr9aOgCr4p3XclmscjKAWeSLO1O7cf3fc1BcXiCB2RzNDsLM4HCLuAx+JNM0vRV0+4MsV5HOph2uB3c9sd1Bx160s2oR3KTbV3oPkJc56df89KOg1scvqoIZRn+InGMY6cVvfDY48UQk9o3/AKVh6gPNMZAGCSRj04xW54B3W/iBZdpOIm/mKa+Fkx3Pq7QJShaUqQoXrjJXFS+H9a0931CW6A8iGT7LNM5JwynP/Ac5B4xmqWmzq9qCrEK8YV/cEVyg0OSQXV3FcRol1cYSIg/vTnA+uBzntXMrbs6ad+h6PqOman9i+2Wup2U6zP5lvC4YyNEfu7mHQ98mt7Tr7UBodrZ+fpsN8ikPJlmCHn5sYHJz0/Wq+maHJALWJw00caKOv3sDGcVqy6WDIjbR14G3qPQ1motu5SlqSaVqV9Bo0Fvc3MdxLGgjMiNsRwOnB5FUtD0rWJr2+Be1gAYSgPuAAbnapHUD1qU2eJBhQu0YGe1Xm11LOxjMozLHnI25GB1/T+VElZ3uU3dnCfEe3Om38FqLm4WOaMzSeXhWGDyC3UA9sc1Z0rTltNJhjjULK486QuxI55CqD2H86zvFXiaw8Q3mnw2swEbTfZrqZE3K4JyEz+HX8BW1exeRagQyoRv2/KMbeOlXo3cmpokjF1GIXMTSyAh43WQYOACGBAr4x8QPv1vVWAxuupjg/wDXRq+y74N/Z86DbiaRF68ltwFfG+tR+ZrGpMOd1zKc+vztXTEwq7IyA3HFBJqx5GOCKQwH0NWYmr4WGdRmb+7bSn+Q/rWbqn/Hwg9Fx+prY8MRlLq8J/59H/mtY2pn/Shj+7UvctbEKj5SfWq3XcfarOcI30qvGPlb6UogzftR+5T/AHaZMeaktv8AUp/uioputUiRi1nXn+u/CtEd6zbsgzfhQBABR3ozR0NIaHGtfQf+Xj/gP9axicn3rZ0D/l4/4D/WmgNmiiirEFFFFABRRRQAUUUUAFFFFABRRRQB7L8J5mj8J6krywxwtd4C7nE0zbV+RMDB6Zr06x8U20NvHLaWTQahLGrySSQk5QHAZm7A4OC317CvHfhhqMk2nzaIPtMcUs7XLSfdhOFUbd+Mg9CfbFdxdeKtN0TwxewwCK5uZZfszL5jASBySrY4JPGOmO3fnlmveZ0Qeh1y3Oo+I9evLuO2kZNPVVtZ1UB0MkY3nd0Ktk4XB+5Xnzaxr+hJqumz/aYprHy49NkBH2YxtneWIAJY9QOMdO1eq2jaxe6W9o9u8MzxrE8xbBKngbtvOR37/nXl2jWl1bGbUNdlefS23S29nGc7WSQqvU5OQrNycDAY9KS2HIxvH8/9o6Zb/boZUngMYihwwMZYAbCPQ/3v/rVxfiXSG0m3WJ5BI0kWd/YYzhR+Ln8veuvZL/xbBq2pXbDBuftDLt4UDAQBgOmM4H1bHSsTxtHvu5xGyGMBFjRBjJIG78iMfhVLsS9Vc84IcKR+Wa9D0N5Io4JQNyBck45HHI9x/wDrrjmgZW2sh+gGa7bw1KDDHG2cNghh1U9MijEO0bhh1ds9O0nxPA9xbRXiLGSpKy+YpXntkY6+9bN1NZXKCQXcUcSAs2x9yqB/Fxkj+lcDHp0jMDuhmiDnf8nzZ9sDr9BzT7NtMjRoJUa3mC5AXkk98jqO3oK4uSMlodalKO52UWntHcxxmzSaKLDuPNWRXXqMDAK+vX862jqljHPFHLaXUXmr8ixROQyg4ztGcc9zivOo9QXTmkOnzEMRggSECTnoVfgc+9aX/CY6mLeRJdKt9zYIDOxUkf7pOR/+qhUmloNVE9zt1ezu0EkTXF1EW2bPKaY5HoMYXHuRTJLpIUm+zWpLqTkLLsY/7IyR09xxXHtr9/ebzNrsMMZwygWjdPQBn/8AQqrzjR9zvJrN7dAYDYmIDk9eQMEjp8uAPU0lBhzItavdqwLT3Rgj27QgbLbj/u4HtmvLfGN8JIWii3LDnqVwTj0HYGuu1PVbcBvsNrI7Mdoac7mGOvLEn8QOK4bV4Zp457i5QpEPuKzZ5+vpWtNKL1MpNyWhwssG8qxxnaOKsWsYTaq5DMDk1at7Z54xIQQCSM/Soz+6uwgPGMfUcV3dDi6kmmGCS2R4xhQzlu21s8j2FXrn7NJCPPyIHwcADH1B7fjVXcllazSbAywliw+6c8cD1PvT4J45oEkR0cH5grZCgH17Uhj5TaxxhYYfJSNsnI5cn+IHkVQtdViebZCZg6sS0bEZb6+tGy4u4LaRbaVUlJKMwGCAfvccD68U+S1vcSz2BgZpj5kgcRoUI7igC6sUskcS4DXLgiBcEZPXnPA29alMV3c3bIt1FYxAKzbQztPg8gLzwD9BVGO31ZWRJbdGs3YM055Q8dc9c8/U1Pa2gSNhfTQbRuIUMcMAODgnjrQMt3l2qyXBlI80gSNg5CAdwvbgdMnpXPGSO50/EWIw4xEW6hc/4ZrSSWPUYEW2KpATiQhBlhnBXjn3/KobjyLaN40IaBBgYTDDHHehbCMVl3uRkELjFdR4GtvtGsSRAlTJbyID3B4x+oFc/bRNK8xKkgbcn0612XgCLZ4hUkEqqMQSMccVX2WKO5614fvbmaW1tJTNaRyAb5QhIzt3AA4IGcHGa7a30l7O6t1lk8yCCHMLA5yp4yw9a4nRL631LVVaAIIYmaXKvllwNoDr25yR7V6P4eviZJTIUdjuiTPVgOQT+Bx74rjjpudcNnY6nQr2Mx+QxAdBsDBuuO1X1nfcQ6jZ1/CsTR4knvHyyB0HJ6ZxXUxQQxKsjAOB8xz0qluStyHZGybkBAduMjgVzmrRwpI4jdWI5cscD6D1ro7+8eQeXGg54z0x7VzEWlOWme6aN3Jyec7M9BSluV1PPbzXbaytJtDGnFLeNvNTHO5mOUbd2wRj8MVsQajHdWsLkhxszg/dDGo9UltNI8RWISOGVWfyXkeMkAcnd9B71lDR9VsI3ZZ7QW8kryLHKx81UYk5A6cDJwaTfLoOauTRF7+XErDyLeQSOuRz2z+H9a+U76JTfXR9ZpOf+Bmvp7TDFG+ri0mne2a53BrgAt5ZwFzjjJ9vpXzTdoRdXAJP+tf/ANCNdFPY562yM9ok7ClMK44xVrYcDj8DQM4PAx9K2toY9CzoUY8y+I7Wp5/4GtctqR/0s/Suy0hPk1M4xi2/9nWuM1H/AI+RnrtGagpbERP7tqhX7p+lSt/q2qJeVaiIzftv9Sn0qOXrTrfPkr9KZLTRIwdOKzbr/Wke1aK1nXQ/fH6UARAUlFJQMK2tA/5eP+A/1rF61s6B/wAvP/Af601uI2qKKKoAooooAKKKKACiiigAooooAKKKKAPb/g3Zpe+HLiMyCNzfOFmVsSW5MafvFHQnqMH39K6zxB4M1D7ZaS2Rh1DZHITJMgacueEcORtQdyw9OleT/D7WZ9F0fV7iN/lj/eeSWWPzSMZUMeScfwgc4PrXa6t8VPEmn+EyLHREEFtthfVopi+zJBC4wORkDpxxXNNPmNotcupj+M/EHi3wWJbCKG8tHvrvesqXPnNNKcErvHIxx8g9Rmuospby6Sztm0SWWJT5c6l1XyFwOC38WGLHngDPPNZ4e08S6fpE16Gj1DT7qORvOYSRtuIZywzlS2MYYZGB2zXa2K2y6eIBcKbGZSHaVvmmZsg5btk5BHU+w4pPRFo5KZU0vRJktpbeCzmJmhhjk3iQrkqGb+IHAPGBx7V5ZJcTz28CzhjKshikbb0cOcgHvnP616DqV9btPHpYkgaPyMbouR5oP3E+gGfwFcVq8k1tqVqZI1hka58xER85O5TkjoKcSZbFdrdFVQQMdzTNBm8iQ7wTBubG0/MDkgj+taUsyXEvmSLh25bqo/wrG0m4Nld3KSQiSCRiSjdMZyPoe2aqqrxsTRdpHpOn3JucC1lic8ZVuvTng8j8KtQTrcAQz25AUYDxoGcexUnP5Gs2x0u3vITc6fNvjO1vLcYdD+HBPpxUt7HeRSkGV12gqpkTj8hkZ9+9cHs1fQ7lN21NhdO0qRNhljtZZUJAZJApx6q24flWfLoyyYW2njO9cttUHH+7txj3NUoPE1zZGIXf+qB4cYLRt2I68fr7VpWviTSLlP3iQsVYkCRyAxPVgP6UWnEE4MhTw4ZVzJMrqflQxwEn/wAeO0fXFLLov2c+W7zKSOV+yISAPRxwK2o9ZtpolgstRto4Xy+3eir19QMn6ZpJbhSkhSdYowCwcnhT3bkcc89annmUoQsYMtpFBGVhhSJx8pctuc55yT09K4bX8pauZpMjb8oY/d55JrtL3UYEiKxtd3ExAO5VIC57k8ZP4/XFcB4ounZJPOVYwrZ2Ftx9vxrSlFt3ZlOSS0KekW8k2mRNglCX2DGR949qy9SjEOoy7xjy1DMDwOn/ANatvw15p0m3lXKZL/Mp5xuPFYmtKTq9whYsjKoww5I29P1r0LaHB1EljjubXcTJv25+7jCnPWsPSEmt7ie2eJniK7jxnHT+fT8q24JSwHkF9qblZQMBscdasXV2kNmoJ3LKu0KTs3MMkLkdQM+1IZE+o3d1mG5iCpG4EaucDGMZJHoOKa3kzFF/dttc7syY2sO/PJqlqr3NppXlyR7GZVXKqFzk5yR+ma5aJZUdZRwUO4GmkJs7K9Wea2ZrCMGRQrbUJzuz1Uf1pbmx1C5hh33VrEyQlSZByT1Y8D/OPen2kwMUbSJCquv3nUAqTz8uOT+IqwgQyEsIkLJ3XaMdCd3UfXFIZUsbFdJg8tbmKXflkeMk+YAOSMjj0ptxKksKBk8olQG6FQf7oPtVl5JDNHA8K+bbEEFMHAPICsc8d6z7m8jmYMgATJ4A4OOvFCAl0GEyyXfOQCucn6112ivHY3TuVIDRlAVPPJA4rC8IbZRf7idu9OnQHBrqobD7XJDH5uWLjoB06/nxVfZYo7nd+DLAfaINQZv3jQBJE2449Pwxn8K9NsoktnvIw+wb0nUL94YUHI9sgiuL0CxuNNicogeNjwvX6j68109pG2oMwhRXuEJTep4QEHH15BA9xXJLRaHVS31NzSWt0ZpWuNiS/c3dTnn+tdRbt5sO5JQ5+6VU9fWuRlt4ItPzE0gY24dsjc7EdTjrnPpWrYX6rp8U6W8m4xgrt/iOPWohLWzLcbO5pXN1FExZ2YqOAoxgVjahqG9XWEbzu2jYe/vWelxc6pcSGSBkjU5UHjJHUn2zUpjjsIJZ7pooogeAeN319qq92S1qczf3UdvqcYlijcbSzF29GHT8uazb+9HiTV42jiAgiUr5r8Dd0JHtwR781X1tFvra31G0kgdJG8tZCDkANzs/HjPQYrR0W2+zwysNpGAvH8NPd3Cb6GdNZraTPIhbdM8cfyngEHIbH4Y/GvBrq1UySP3LsTz15PavoeeMLaNLuYlplbn/AGWFeGTWC7iQRyxOcc9TXRT3ZjW2Rliw3AfMuOvWnPpoXA8xACOTnIrRFq6YJUhD3A61IsOcZbBHU7ulbNGDMy3txb2uokEEtAoH/fYrzzUPmuvwr0+8j8qyuMEfOqj6fOK8wv8A/j6eoluX0IH/ANW1RD7p+lSN/q2qIdDSQG9Bnyl+lRyHmpYDiID2qGU80yRE61m3f+uNaSc1nXf+vagCAGik70ooGJWzoH/Lx/wH+tY9bGgf8vH/AAH+tCEbVFFFWAUUUUAFFFFABRRRQAUUUUAFFFFAH0J+z/8ADq18TaS2sSyQRSxX8tqsstuX2/uo24bcNpO7jj155r1TU/hrquk2UMEFtaahbQAyFIIxvmkyTvbceT09QOT6VnfsoLOfhprXkTiNzqkwTzV3xqfJg+bZxk/U4/Wve4zFehZJfmjHyjaGRDjvgdfXP9K8+rNqbR2QgnFHxLoOg3h8Q32o6xdXtg0szrLYGDyQGzkKWb5jjHBxk+tYnjTV7mDWXs9Ga9nhm8u5TLM7NIV3ZVT93Bxn6GvufWtL07XgbS/0mG9tidqGSNpCCO4IHH1U8V5prvwPsrqa7XR/NtLm8ZJJFuZCwMagAIDjcq8dMHnPNV7ZX1CVJpaHzx4hBtNRtNWm05IvKtJZ7oytzG+dqKuOC20dRn73tXF6hcrrF3ptwrKjPOGKHPJduefQba908e+BNatJriTVNGn+yJD5CXMB8+NVJy7EJ0zx1A6e9eG6pg69bGF1MJlj8uMLgRICQq57nHJ9ya0pu5nNWRrT2sds/wBnE6Shf+WsbHy/1Gar6fp8d3GdxIlBO11GeMng+1Wk3I6sEc7v4uopfDUqzeZGyjzY5nDKRnK7jzjrx7U69+W6FQtzNFuGO40mOIupCSjhwc5Yd1I5Hv8Ayrch8ZQyMkN6zOCwJ85Q7j3BwD+FWbdwY2RQDyQwPzK47j/6/aon8O2V/EY99tDsbYXjOcHsHUnj68Vxqa+0jqUGvhZa+0aHqe5I7hftIHBWIq64PUHqQPSs680DQ5XaP+0MXDcgyp+6f1zgHP5VGvg2eckx6vauuSCwYoFI7cqRVCPR7yyDBrKC/lQlZDG+8J6cKR+RFUpR6MTUuqLi+F4YYC9vd2Wx+PmU26qB3xgnP4ZqC60OCG22pei9mlYbY4opNyjODycY/LJq3BptxA0cg0McHO/CoH/Ek4/M1bSKSUgtqFtCJV+aPTl3yL7eYxwDxyQCafOl1EoN6WMDUoLy1idJi6xx/KVkly+e2cn9K4TVbOW5jaWQ4hVsdMbjXpN7bWEJkdY98u/KNOxkZRjjJPf8q4nxNcgq/wAxfC9BwKKdS70FKnbcm8Oor6HbnYoYvJ8/GMbj1rmPEJEWvXSBlAZFwev8IGf1rqvCSxyaBbSMwBDSAjOTjeecVzPitI4/EdwqMJETy23bSAy7Rng13rY4upngiKJcsflwpbZnJ6Z61btZnniKkbGjY71duh/Lp71WknSO8Fv5jM7KXABxj2B7jHb2qzOyERnMQmkyG7MoxgbfXNSMfHbw3ME1u8yjzMKZCu4DnIOevb3p1z4SuIEbzBHDEGALFht+u7ofwqmkq2kSZDhQADlC5Zfbp0qwzYtjGY0FvKcKDkD9TgH6etAC3LRWKs4uHjihT5Yxg+Zgfwntn07VTTU1uLEXFtC0tznbsCjKk9ie4+tTWyzCTfLZvCYjggR/NjtjtU6+bHP5kMcLTqjFYm2jOcY4GMYoAjSO5W1DzpH5iqZAUPB9lGOtZAVI1jVYWA253HrWkr3J/cTMv2mHAlAfCKpycD6VnSzG6iWYKRnO3I4wKYHTeA43aPUnGGIdDtzgng/nXbWzrb3dpK0bKwlBIbHAwfx71xfgR4wNQJ3JtdADnttPWu0toftFxBGJAUlkKqV4+Yq2P1p9GC3PVLeRvsUTRPvkcfdX+LHQ/XH8q6TwijRynMjKzkgE8ZXPArjtCgaW4tA7pGmxjtPJVuMt9MHH516Rp9strMgwWZTjJ4DCuY6VoaF75VuySfK0oPA4y3tWDdCe4uGkg3RK6lGSLgsxPDemR0PqPeuyvLGC4h859v3QozjOfp61lxRfYd/lqWl3cb+ce4rPk1KUijNKlqheOeKP5R5RZTkjpwO/Ncde6dNcGVtQuVIfc8Y5Ck9ic5z/ACrcvb43DTRXKCTGdkjnGBnBAPp6VyEviW1E01u8pjNphWlZwocHo2e/H6g+tO13qF7aozdO0hIry5ie7dhFO7bHbp0OwewJ6CuqFuLdNqn/AFg6tjrXG2Mdtby3Ihz5TSu0IkUruUnOQDzjJPvitt/3EEUhkxIwJC+o7VokQ9y1qu60sAJHyCV2jsQf/r1421vFIwbIXJPDKcD8utes65dShrGByA2wMuevK8DH05/KvLlkQyE4B7YBI/pWlPdmdXoV9kcYAZd2eMlf84pdishWNQrHt1q15Ac7lIyo+6Op+vapDb+WhfIBI4BAyR7f41u9zHqc/wCIIZILNgylSyrjIxn5hXk2of8AH1+Fet+Jhssi4G1SoPv96vI7/IuQD6A1nL4iuhC/+rNRDpUj/cNRjpQgZvQf6tfpUUvFS2/+rGfSopjzTJGrzWbdnExrRSs67P740dQK+aXNJmigAzW14f8A+Xj/AID/AFrFra0D/l4/4D/WmgNqiiiqAKKKKACiiigAooooAKKKKACiiigD7F/ZOmaP4d6kiIryS6xIoBBOP3MPOO/8uTmvddKtrVNPmtLOOWySBmg89IuAQMs6bxiU88EAgnrnGK+S/gdrdw3gm48L2WnR3lxrOpyRyyXPmi2toDHEHeRkIyT91VBBYnrjg/U+li002W6e30x7a6mEC7Npyw2KApYEg7cYwuAMdOprzqvxs7qfwI6bTLKUWU7WzSQzXL+Z57FZGIwBlt2dxwMEkAZzgDFJreqWukWjXNzLblEVpJncmNI4kGXYttIGB2JGScA1l29xHeXUzSOkRhl8yCJboYmRcgSNGuOMlsA7vU88VZt9bWCCRJ0M9xJC92sUUTbpIgfk3KRhCeAAxycZ+ib6FNEEOtR+JLK3v9DiSa0RyoldI3E6jghGVztwe4PUYxXOeLfhH4Z8WTefqHhu3a44ZbqCTy7hT670Az+Oa7O01iKSysbuXTpdNE4HmwXIVSpbopCZy2fQc81YvbyO0M0C3otbm8ZvI3J87kLliiLzkDoDg4prTW4t1ax8x+Kv2br62k/4kWqiZfvx2eosEkPqFkX5Sfqo+teE6r4T8ReDrt/7Z0y80xxK+2aRP3bfMSCrj5W6+tfoM+kWssYvdR1S9lEypJH5yIDasBj90FTcjHJzktnpUsCwX9ndraPNfW6nyZbfU7c7GYdeGUZznngjiq55PRkqEVqj4O07xL52FnVlnP38D5ZAO+OrfhWncNp2qqbiMqHBxmMurAdlz1AHvX0z4q/Z28Na/Izw6VDpEzjcG06Tau7/AK4tlT/wErXjfir9mPxXogebT0/tezAyPschjmA94mOT/wABLVnyJvTQpSa31OLXTLm4Yg304Qtwpk3DdjgA4GT9RnirFv4Nk1CI+dKfMUbspDvA98k8fpWLc2V3pk/2SW9ubS5Rf+PW9JVwR3wQCKdJdaiCZI76JSvGIWXLA9cgYz+dT7N9GWqiOgXwVZqpbz50lIzudtjlh+Ax+J6VHqPh2aKAs042LhtruDgd/n9T/wDqrFsvFmtWu+JLqNw+cmRGLHAOOAT+tOk1OG6tVMt1dKyj/UHaodj1wwycUlSfUFVRX1OG2sk2S3BLg7jHnaPoB1rznxVepKjpBhUySSveus1S+t9rxwwldq8YBDMfctz/AJNcdqlpLPuaePygoBK4Oc9hW1KCjqzGc3LRGz4OIPh+3UsykF84wc/OawPEbhdaugeyKPmH+wO1dL4UlCaBCnmAtukHl4/2z1JrmfEwk/tm6dRudURlHDHG0fnXajk6lKS2WRkmuEA2Kyr5eRgHHU+o5p1wPs7iaSFrgx4EW1Tvi/2s9GB/mafCZJGG1S6kdB+Y4qVR5jARs+5QZBt5GAMHjv2yPep6jKlmFiuZ1EdyjjcSWBwAP4R7VPcX37yCOGzleZxsUOmACeep4/xpPMj3mJZCrLz5akho8+x6dakRIVRYY55ROoHyMd4YY4yT0OKOoFifzmI3286KSqqEQ5Lehb1/Sud04yapqonY+VFG2Me2envxW9G89sp8q93LsBcNuZnx0XnjHapHuVkjLbVtmONpjYke/Hc98/4UwI5X+0DyzIDNGDlQAAx9T34HrWVdHEybsY27UXpgnrTtNiWMXsVvdP5chIaWSIF5O5A7jpz3NOmdm3McLtVuCPuE9c0AdF8P3aWLVFV8B5Y1wR8rHBxk9q65leC8sSYtk0U27aM87QTj9K4vwI4jg1P5QGLoFOP9k8V19qBJdWZBAZJRk45Awff3pvYS3PXLLUorhba6tjC4eXbINmGTcMqAfSvR9OuTMiqoBaPDc9lryux0uC1tS2I44wwKE5A/3ifXOMV3nh3UQLaI3AKysCGwMg++R0zXLfWx1dDrLyWCGAmWYBSPur1X3PtWXcX0c8Zj3nGDufOT9OO1UPElxE0KsC3mFNrKeB7YrlI/FiQvNZWcImuHQRuijofXceAR+NK+o0upDrV/FbWRMi7FWM7pQT6+g+vUetcFbNqb6ibhizI4V41lUYV8bQceoHf3rq5kl1qNTJG/2e3JMsIIO/B+VRjnORz69K2tAs9PNvbz7t8kpYp5jBh9Bn7o7UR11B9jhtetPt+owzQmYMGwkcZyWYgDH1zWjcaZe29kFku1lv2bymg25KtjjkHn/wCsa6i/0+GaTels+9uHkzjHptA/n+VczdwJp2pm7WR4mW3bKE8E4I/Pp+tJ3TuFkzFEMshkmEv3Zdzse2G25HpwP0rmtuGARcH13DBrs7rdaWK7drK4ReB9zkZOe9cTJHtkDHa3fDDg10UupjUHlWEm1Vl5546VLAk27mV1djgMScAVWLngqoVQM5HQflUisx3FWYgdNqHgfnxWy3MUY/iwKmnOAwZiBnByM7hXkWoNm5z1+UV614swtg4BGCnQdvmFeRXRzOPoKj7RQ1/9XUSgjBqVx+7HFd/4g8NeHLZdQ0qzkuLfWdGiieWaecGO9JKCRUTjayl8gAnIU0IHuc1Dwn4VFNXbeIvh9PoBvPsmq2Oqx2VwLa4FuSktu5bavmRt0BPGQSM1yup6Tfadf31jc2siXdgzLcxgbvKKnDZK5GASOenNMTM+PvWdd/601orw20nDdcHrVC6TMpNAiriil20FSKAEra0D/l4/4D/WsbFbOgf8vH/Af601uBtUUUVQBRRRQAUUUUAFFFFABRRRQAUUUUAfVX7MlzL/AMILqkFtLBFdpqvmRl1Lbsxx/eHYDaMEc5Y+1d548uPEniqdtC0tQmnKpl1K50+8COqhios1c8ieQjH+yuSeleEfCDUHtPBetqtveyXMbzXFklmSHuZwIB5XGSR8wJHcV7r4Bnm12fVb668qK/Ev2O4itUVVsnEYJDY+83OC+SeAM8HPnVm+dnbBe4jV8FeA9H8EWxvbpbSXV7uOO0nuZ33lEA+S3jwBkDHYZfG416DPqlrdabcNcWkMttqkSxOiH5ZFf5PmOQSMHBPXsK424v7K3sxeExXE0G5VaXAKylSm5j1HTBIGcHgc1594e+I0/iXxZe+D4fDbypp7wC+nnlCwwkcvMhYAqdwBQYy2M1PS5ctj1XWPGVl4U1SLSLSO7uL4NDFFaWsalgGGFVGbO07QWJ4AUZJya07WdrRrmW8kWNoCY7OaabzpCD/GcADezHGACcYyazXN/DYXOqWkFpqGrElEdl8t2hZ8lC/97b36ZArFWK+0G2/4nWvE2ERd7TVbhBJdQsW+QbcbSyoW+cjtmjpcfQ7nRNRhW61COaPUbdYMQyx3bFlZioYtERlyOfoT+VV9D13WbHQ3v57W7vVW5KJawRyBzbM+1ZFWZVZ2XrjjIzisxNRikuhEmq3FzG8aQrFLs+fjJfzx8zEjk4wBxxyK27TWo5Zfs93ctNPHJ5UXmQNEF/uoM8t0zvPPeiIjtNHhlEEdxLA0RMajEuPNJ/2guVX/AHRmo7pkS11GVDNMwbc0Vsdz4/ujccBj6AisLVZbjU7GSwh1yTTHwGaaJFDqp4Ayeg/WovC3hG28I2Fpp8Wu393cE+YJdQl8wPg/Mqx8Koxnpz3q0+iJS6st6t4M0TxJpyQa9o1td2+zeI7zEjxnuAx5Uj1BryDxt+y54c1KQz+Hb2XSJXXKQzL59s/0cfOv5t9K+gBPaTtLbSNErlciNiG+UnHT0PSqjyyWNzb2cenRmyjOE2Oi+UoHBCemeMDpTVkLdnxf4i+C/iTwnbvLfWExs4l+W6sFFxGfcnI2fitcc+k28zxMLppXGMSStjHqOn6Y/OvvHxX4203wZBK+pTtHMsP2lIFUb5FzjAI968k8Z614B167W4vfD0kLz26u1/YssVzHI2cBgPlYbcHJB61k5WdkzSEb7o+XLqyggklLABhuk81uuOnU8jp0rifFN0scD8jeSM855xXrPjzwrcWekf2vo9/FqWmFWkmDqFvLUKcZkTJBQZA3pwMjIWvDNUjd4xNLknkknqaqiru7ZFR291It+H7sx6ZAcA/M+dxyOWPas7V97ancXEQyAAdqHJxtGcVHpc22zReQMtn86J5Abp33YToe3YV39Di6jEuDDMgViGPYd8HP4dcVP9oS3lZoXDPGcfIcbcjn0NIqB5QoiQgLncO3rn0qGG02TSXBDsWwpQrgjHY89akZXV0e7hLWrpNLvCu2RuXHBz3pZ77y5JXZlWJDtWUfeZvUA9frViK4EiYaQmIt8xV+fw+lK9r5aIlxsn3nMjSEL9CM/wAqbAqaVem7laERsMd2ORt9fb+Va0anG750ZycneMr7cU2VlWFtzhI1AwS3Ciqces289zsDyMzNhAQcE/0oAsTQpN5eNzOhyCWPHv6/WsSK6N7HK7LhQcAA9MdK3wEQlixcjoW5I7YH41jSRR27NGq7WHLKG5AoEbng12C3xMYcb0Dc9BtNdnppE97EkYCZJ2+3FcD4adUju9zAZkX1z0rs/DbhtViYsAFBJx2H4U38ILc9inuM+EyzMvzbcxueH5BYevY11fhvULQadC5iEMqLhXiPDHt8p/I4rgDq1s0s9nK4aBiQZFXI9/zOAPc1uaBG+nxrBPayqZCHzgnDbQTj+fsc1zNnVFaHT3Sy6qk73AVYFYFx2Q9V2965/TJIBfXUe5I1tGIE4OckryPbAYDPfPtWt4h1LTitvbWkzzXRG/8AcktnPZm6c+lYGkaUiapNBLczQ3G4SzJMCybTyCh4A5wNvsT2rN76FJaalB/Dn9raneGxW6it0nO2TeyKFwORzyTz9M11WnaCLG3hjjgQbQQdq4rRsbWRLll8ws0bYLDv+FdPJGsaZZSCRjOOD7Y9apJITdzF2iK1UY2NxjcM4rkfEmm+fE2CoZuWJGcg/wCc1191DPKZSYztT3wK5bUbhp2aNQPnbaSf1P060pMEjkr9lmt1j2tw+cYxldw5P5frXAfankDk5cEc5A//AF13mrp9inZUXiXLcevr/KvMxLkg7mJPf1roomFUu7y52sFLE5xjnmpFY5A3Y9gMg/jVADepPOenPenBvlIxz6f4VujJFbxQwaxkx/c6EdPmrya4/wBcOO1ena+4+yMvP3B/6FXmV0P9IqPtDQjnCD1r0PxFolrr9xfeL4tUtFtLhIZY4BIpmNySitC0edwwdx3YIwB615zJwinvmmo4DL6560kD3PoDxXd6eP8AhNZNN03ydUGsW9pqU0k7PuhMu5ZEU8KS6YI7cYrC1V2bxj8VH6Zs73OPeWOuJtNYvkt9Si+0u66mipdGT52l2sHU7jyGDDOetbWtePZ9R03UIf7K0+HU9SiWC81OIMJbhAQcFc7QSVXJHXFN7iZ2+p6o+t+N4fCOox29xpV5ZQRxFoV822lNsGWRJAN33hyCcYNc42mQWnhnw9cJ4FTW1mtGkurmLzVdXEjDlkOPugHkUreN/D6asviKGx1M69FbJDFFK8f2dXWIRh8jngc4qq1zFq+h+HoLHxla6ReWVobeeCeWaLcxdjksq46GmM4fw1oZ8Ua/a6bG4t452Zmc8+XGAWY++AK2rzw/oGsaTql34cm1AT6Ugmlhvdp86HdtMiFemCQSD2NVvh/qFto3i62a7mRLaQS2zzZ+VA6lA2fTJFb+neHL3wPonim91nyoVurJrC0AlVvtLOw+ZQDyoAzmgRmXvgK3tpdRRb2Ui00aPVATGPmZtuU68D5utc/oIx9o/wCA/wBa9Yu7C5vr/X4La3lnuJPClsqRxoWZifL6Ada81tNH1HR5JY9RsLmzeQBlW4iKFhkjIz1oAt0UUVQBRRRQAUUUUAFFFFABRRRQAUUUUAe6fA8G20ae7inWCY3jqSDgyKsaHa2OWUBmOMjBGR3r1bSok0G2SytLlLeMjdGeEWeTcHdjGvBUDjn1zXg3w71lbHw89m0Sn7VqAjDnPG8Imcg9gT+ddFqPiC68PaFF5wS/1EsIl+xlivzE4VSRnaBurz6qvJndTdoI9j8Ly6Na6rcavYRtc/2/LLfGb7SJckEKh3EYC4yAoHHOc1sLe2L6VfatDIIZS7ztKkBhkdoVZAnIy2SQoPPcivPvC4ntrF4tJtIVSVYwiSLiG0AGCFA+9647tk1du54Y9QvriOS8u9cghaz2iUrCgIG1iudqk5HPsaxvdGqWh1msahJp2jS3Rv7oG4SO3nhinLtGcAbYVAzvJyOmSMnirlg+pazcS6ZqqRS2MNrHPDfudsDEjIj2HlipXLE9uO9cJ4f1m18TztdCCW3Glyyv9pDf6zcDGzADsBkg5yPxFddba/OLbULmzjcW9uxEHzAC6AAyQ3OF3cZ6kA96pbErVG9ocGswpHrGtfZoLie1CzRWMe8rKWGXXPCqAO2ffpWvZ3d1f6rcbr63uZbV99vLajPkoRld2c5bqT/wHpmvIz4s1zxwZtG0ny1Fq5FxrayssUmPvgKVzzuI49M8c10l3fw6GdG07SLKaKG7nwk0EKrBDGBnMjBiWOATz97v0FK+lggjpmjudX11NSls7mC80mQXC2882Le5YDET5HqOo7HmvQ5ddcvvist0vmoZUQKQeBk7yeAO5A7dK5O3u7Q3n2a3hcxMPOlndty7933XJ6nAyfTirZvrOU291awOJLeNljlwc7ZGAYbfoo60QVhvU7R5VN35LYlRiJQqtu+YnIYHsBjpXkHj34py+FPFk1jZ2Be8niKS6oxLIuMYUAfcClgTngmpvGXjoaPpoFhMIr+UYjWMbfNjH3gD0zkivDW1nVLi8t9uowLGJJEvMjeZgqgui+uCTknpmi92CVjpfEtxe3NuYN0ty0yyRtcM+VVyAQp6nGcnj2Fc5f3Euq6ZdWdoZLa7Y/ZZZo0BCSsOXznJUY6dicUzTbidtV1jVbi8K6NJHDOixfLt2phl9h8nP4VaOuWMUAu7URzR3jrcs0HCoGcK0h9cd6lKzHfUisnSx1O2OmXIGpWsMlozzkb3VkBOVxypAyT0IYivIvih4cbQtQ/dRrBa3cZmjiDbzG2cNET/ALJ/HaVr2OdSlxqV3DFGJdkasyE7yVBHXoFxjp1Oc9BXB/E3EvgiaITpNeabIt4qlVVgjt5TEgc45Q888VUNJompszxyxUi2TPq386c6K80quOP4snjGBS6JG72UZkY7lJBP40y4YfbjErZzjKnsSP8A61ek9jzluSpsmIkLAmNipHTJ9KnWcmYPNP5SfdO75t3GBtbr+BqvAUhO0E7ywOV6E9MH6gVVtL/dPPA675oyTlR1GeuevFSUaM0kDW8bRGO2yS7IsePMQcH5uq854qvFBFY7pHuGNvMwKBlZTux3z1659KhuGj1dJEEssYEnzybPvj06+tTRDYiQ7IsOVQpgkD0yMn8/f2pgWopJpGLQoZImGXYtncMfMAO39KrwaXp+nXRJLh4wJA0gJKqehz0H86khtxFG6wpGiq4LpKxBAPVgenQcYqaGYR2q7HDQg/MQMgY9D60gK9xfKJ44lZWaVTIBnPQd/wDPrWXdOZlEhVUZhxnA464q/LhQQXzyXCsw3BT2z3/+vWbOGijUSjcxbdkcAZ7UxGh4ejDQ3ZOc715HQcV13horFqJbG75COB15rl/DS5trghwcyD5e/T/69dHZypFcpv6yZQYP4/yBqn8IluemaPal47RVWQO8WyQSLlGA+YEfjng9MV7Alqr2Mn2cNNG4UFslWUgdR6H3ri/DVrDFYR2KKNtsvy/Ng7d3r+I/Cuu0mc2NvKkjhnhJUKOduenHcd657aHShdF0aNHurKeJ5JIcsr5GNj9AFHcHOT9KxtOt4LnULm6RHJuGGN/Xao2qP0z+NVL/AMTy6dqUty5QNHGyN5h2od4ACj64J46YqHwtdw6ddvDGkkdpIPMgSY/NGrMQABknaeorKKSNG7o7+y0xo3VjiMgZPfH1rYlJiXzXfcqfM3B2j0qtb3yrCVBUkjBI7is++vHMQjJYxA5yTjOOgzVEop6jMZICsZJRRjjjPOa4+G4x50ROQG28HvjP8sVL4m8SpYJBCJYkklOAGbGfWuRuVu3eGS3uZkGd5TAGC2Mlvx/QColuWTapG6zSTSSH90QEQe+c5/z2rzNItqDacjHYda7zX7o2ap50oAVmLjs2Bgfqa5AQ8hVYZHpyRXTR2ZzVt0UhGC2VVRUpjx8pBGOoxjFWTGzDAXOOuBn9aBF8wVTyORt5z+VbmJy/iRwiqh+88JI98MP8a84uubgj2r0fxnBJ9hhvEwxtm2uAf4W4/mK82ncNMXH3T2rO+rLtZEcp+6PSmr94fWkJySfWlT7woQup0NrynvUc/DEGn2v3fwptyOaYiBRVC6fEhFaKnisy6P700MCDdzmlMhYAHJA4GT0ptAoAtwaneW8vmw3dxFJtCb0lYHaOgyD0ra03Ur3UjK17eXFy0YVVM8rOVHPAyeK5r+VbWgD/AI+P+A/1prcDaoooqgCiiigAooooAKKKKACiiigAooooA2dObVRpkwsHaOECWaRhyGaMIyrj6/nXpXh2/kvbWxe/jniuXUS+Uj7Sh6A7uw56ehxiuJ8J3otbK5VdplZzweOMDGT6Z/nXT/2ksMazRRNI8LoWHPMR5Yg/3hnj6VxVdW0dVJ2VzdvtZvrC0eeC4mhubeVPLmXBTzHbYN3ptBLEYxk1rW17LHcR2t/JLeQ2fz5YeZ5jMQqKW/iZeTznAOawhPb6hA0Db5UkKyeXtxwpGAPXJGfqa0YbiDSrNZS8cShHzMykDaTnBB6HnmsFtY2Wp1AurR9Cht2trT+zrWQJ5CEqmCcDeQQcDqc8YHNJo3id5723sdMiU6bHEkwiZGVEDblwiD5iA44GR1zXGX6S3lk1g9ti31G4+fbJhhBtBLHHfcMgd/xrqroxxWsUluiNKVWKOOJtgkx79VHG4n2pR2GmT6bGNNt7rVPFetGO4tvPZLR32Wi+Y2FzGvJPbGT1Ndx4VeDUJop4ZI7i1tIRbmGJCI48gGQ88nOQBnooNeYW0sUgMhePVVuZzMJVjLH92cRpk8Y3Z+b2rafXbuw0UTx2kkuqQGQSx2UgMdwxJyCfQ9ce1CHHY9GXUb3TvEM8cM/mW1wkqIkSBo8xsF3MP4nbJA56LXQf8JBb6VdyXF+JbCKKLdsdfmn67hgZ4wc469K8p8PXnmeHbDTLsr9v+driSJt377O44YdgWx+GKtw+NbjWNEv7W702+gug5t0uQu4NgZKZPfAycdRQtAjqV77VbK+sbu7skRYX3PbsYjtXDDagHUEg/wA6oRq0lvLJBDHazMVSJkALNlsvkehxz61Sia6kupYpYoyt1IsbmOTZFHGqdIx3Ykke2KXRNJu0VZFuGks7dPKeRBuZpi3HPYbcc9zUxVh3uyPVbK61wyaZNp7RRGFJLiGAE+apcgJkdMkZJ9OK0C9p4a0+a5gS3i02BBCjWwDsQPvIqjpz171oWGqR3dnIDMXW2lVGk5RvMBOFOcdPXoa52x1VIpI7e+4nntWnMUePLgBlwy4HUncMt3OaYuompiTxHGqmQWlgzRkbnCSzL8rBVUHhWyBn646VleKrfT28Ka8IwRDd2MzReTECGYAFdzdhkZOPQVrS3UMTxWYhjOqrCskjQYj3orHyo1U/MV5GemAOar+LpXj8M64Lpbdo/scyW/IOR5Y+bHZgxxR1QPZnz5po225UEn5icYrF1SN/7QaWP5XGK6C1jCREc5yaz72LNwW6+hr03seaYl1fTrDtKEORguPr29KmsBEyrPIytPGOuc4FXHtldAWPHsKr/wBnBsAKD7kUugzSW4dxJuaNQx64+8T79qxb/VZVuFS3AAjOOB8rfhU39msgwJXwR2Yiq/8AZuCR5rAeuRQBvpN59vHKZ1Qsq8YOVxyNuOp471Hqd08Vk8ibiXGcPjPPGeOOP6istNOMYGJpMHsGx/SlmsNykuZHI6BmPSjoBX0+8EKOJSmBgjI+bPseuKLieW6YCMNt9WHQ+1T21mq5PlgelTvCOwx7UwNHwzB5EMxYnfvHfrxWpq8SzwwbHdZN+dwPIIHGDWfo2VhkUlsEg8Gr10dyIBz8w6U+gup3PhL4kNpMoi16FwmzAu4ELA47so5B9xx9K7m2+IQ1i1S5sntZbiZCCxlHylcYVsdOpwTjpXkEKb1CdSVxzVe98LwzW4lCKJAOcDBx9RWNtDZS0PbvB9uuuG61KSWe61C5B3W0mGSLZkfKMY6cY64rpYtMsbKO2LMyBVj8yO1VQwUHJ29g2D0r5p0AappY32Or3tqQ+/akmV3euDnmukm8V+LGSRm1S2lLckyWq5P/AHyRS5Vaw4z6nvFj4iha1BljLQ5PzKMDAOMnHK+/vWJr3jkrNDp9lA00zpkSMwCIM9+5/D868R0zxX4msUk2X1uTI+9g0BILDODjOMjNY82ta414WN8kchYkvHAoLE+uc1EYPuVzo9suVsWnhR2a41NkSWeR2BTgZAUdByc46Vh+JPFtlpVq8ck6xykghEOXfkZwvWvJ2+23V273eo3cocANiUqDjpwuBT1sreDf5ceHPVj1P41fKiHMt6trl94huYoyHisRMrLGeXc7s5P484ruhY7d4Mw8wdsN/PHFefxoXliUEggjBB969DeWSIEbm28HrjPvzWsdDOWpUeFUIyWUA8kL/nNVH+U4X5sdSVwf51PMxAyHOGPPPFZVw/HA6c9a0JJhJFOkttMyrBcoYmdhkRk4Kt+DAE+2a8t17SDZ3s0LxG3mjYq8Y5CkHkV2dzccsOD9apXs1v4kVbUuF1aFNqM3/LyoGAuf76gY/wBoAdxzhOPLLnXzNYS5lyM8+aIqT3HqKao+cfWtG4tJLdzkEEHBHoaqsQDkjkelUncho2bUfJzTbnJOaitL5SMNx71Ym2yjKn8KbEyqKzLr/WGtXbgVmXQ/eUwK1FHNFMQVteH/APl4/wCA/wBaxa2tA/5eP+A/1pIDaoooqwCiiigAooooAKKKKACiiigAooooAt2N2IJApYg8kYOOvFby6oFUO4JwoBVfvNg9vw5/CvO9WupLa8TYfl2DIP1NT2/iDPEoIJ/iJz+tYTg27msZ2R6bp+sG0kVixkYRO0QLcNjBAHsRW9Y39vrehqt3ATC6vFNAWJdW/qQeR69a80s9XR/LaMozLwAe4PUV0FlqZikKjG4Y24/iHpjvxWDiaxkd1peoWs1u+qf6QrzQCN4pG2+TtGC4HYYAyO2frVbTbgza9p99FbyCM2ojlbfuhVScKPcjL/UEVgrqbx3KpIsYhmMkb9xKjDoP9oHII7g1qWF5by20thbq8aPCNuzgFPuNj0YVCVi4yudNfIpTTdMsLmK2hjvYmWWM7fMjQMxjx69vetvTgtteSTpONgVlVSSUGTlun8Xv7Vw9vFFa2dpbvGBNbwkx3AGWV8YLD35zWss7wWqK06nEgG/ocFBlmA6HIqbFRZoafp15Z6bLBp969tcTTu7zuA3kCRzghe+OPxNP8KweI9GL2+uXS6htkmASZs7oyNoeMj7pPP4VTsJysckUFwWNuBjzeWIblcnuDjH4Vs6dLf6hZ6dDc3Uh2K13JdJGFaQBsNAG7D9am9kVFdhLPWY49ZvLSHR7qRbJEBjiKiPdgZ2Mx5bGMjvW7BcTFriC3EccaBZGUy8IMcFsdSR/hWRrupPpmnXF9baVdXEqKuyxYhnkZmC4AXPy4zk98VlfEDxVN4Y8PRz2dr+8uLqK1jj25IQ8kfkCKIq70Gna9zp7zUrOW2k0mGKS7vljVTG7/MFkY7d7DgdGPrjFU9P0B0k1Frq4jkjaQKuI9vlKuD5e7qRuAJ9au6ZIjqYcRrfXDxkoHAdScBA2OhwOOc1XW6vLzUZIYbuITPDG+1GZ/KCyMsiOTxkt/d5xyelSmO2upXvLmMakGt4YpNQuU2OygsQEIVl3dfb0B5Nc18Q3ki8JyiRo1S5aKGMBss+W3scdlCqBz3zXTxaTBp11bPaukdzFD5IdpGxJGXLEcep3Anr9a86+JWqW9xfR21vbLEu97mXB+ZncBQW99q5/GrprmmkRUdos4S2iPljA4yck1n3sDCZuMgds1sQqNrMvBxyMYxWfeBjIxJwT1x1r0Tg6mesa4yRn8afsyxy3GMVYRAFBCAjOOvWnfNgjIxjPAx+dIZWdeOmfTNVwoLYKnOegrQCHcDjI6nHapFjAwAysTzkk/lQBSEYCjjP86R48qAMHPOavMqg4GMDglR19+elQvEckgqQRxijoBTMXXK4prxHG0gY96ueW3KkMxxjpmmyW7tgnkDHfmgRNp8YRWAHfrVm4TOzA70WdswydpwemD1q20S/LuOM9u4p9BF2yQbF3Abjzmt8Qho+MA47Cse2i2qrCVSPY81rw4dRkH3rPoarYxmTyps/KM9qY5JYqCPy61du7dg5YLu7fSoraAliTz9e1ABb2S7M7Rz6VXvNPRjuCDd9K2Iofb8u1JLGCeQB2pXCxyclu0cy4BwKeiHznLDn0rYmt/myAOKpPGBIQM4+lMRBaqv2pATgbhziu03ELnGO+OlclBHmYEAHB6etdfjeg3KuePlAxVxJkUbjBB45zyayLoAg46njnt+Vbcse7JU547Cs27jIJOB7YrQhnIapJ5MTNn5jxXFzuS5JJznOa7LxGvCDB5ya5R495xgcfrUyY0SR6xJdER3uJOwmPDj6nv+NNvLLZg4Khxldwxn3HqPpmqUkBBPGPrVix1S809TFG6yWxOTbzoHjP/ATxn3HNZ8tti3K+5Uit3eQICFYnHzHAroI/CetrbmdrXyouzzSLGG/3SxGfwqza3nhPVoxHqNtf6NdAY+0WOLmAn3ichh/wFz9K7Cx0PWNR0IaPomuaL4j0xn8xLOK8FvdRt6rHNsfPsu4H0rLEe20dK3nf9DfDqg7qtfyt+uh5pLHd2zbZIyPoQw/MGqkh3/eUg1r654d1HQZCuo6XqFg2fu3duyfk2MGsbKnjd+RrWN2tTGaSegwxjHHWmFMY4qXMY/iNJ8vY1SIIsY7VsaCP+Pj/AID/AFrLJ54rW0P/AJb/APAf601uI16KKKsAooooAKKKKACiiigAooooAKKKKAMfVolkuFJ/uf1NZTwEdBW5foXlGOyj+ZqoItoHvWbAy1EkTZUlSO4rRt9dniASQb1HGRww/Gh4RjP6VA1txnGM0aPcabOx0zxRBJ5W8jehBCt6+tbdrq4b7QmSUZg6un3wR7fh+NeWNbMOasWup3dkymOQ4U5w3NZ+zXQuNS257Hc6m1xYh7aYySKVmULxgqc7fxwePetWDVWnmSQRoHmUDEn8QHK/zNeS6f4rWIhZlKj68D3zXTWuoxXHzrKpt2+Zgoz83c/1rJwaNYzuegJqEJVJDH5cucNhskAdFP6mu98N38V5oloSJnkR5I1trUbjGcFt59sD8SRXkEE1vKrjcr+YFLA9GwMAmu28C6lLbG60nToZGkl/0gcgCPAw/wA3UgDmsZR0NoSOiS3tLe9m1YXN3cX18V8xAmyS1Gz5YdueCec/XNY2qyTXmtadpb2QaJY2uboh8iBAw2ZboGLKfw6V0lxCrWhvkuFuVgxLbw2b+UWbGN8kjd+uPas9pUmn3E3ttb6dJHO93F0uJADuQKeXxkAH1pR7lW0LF/dWtwloLO6t/tbqLuGNG2NKqk/d7k7x9cCi5l1K20eeX7PZi+d1lnTOyBUAzIyj+HIBOOvJ9qZo8JuUi1PULJLPUm3LGowZY4SxZFJ7MADnHqKn1W/MUbW9raG9keNyiO2Y2JQ5HPJz8wAPXB6VK7DXcLzyWsb6S7gkNoySb7hX2A5XcrjHYnb065FeNXQ+0SSStu3k7iqqOPYH9PwrsvFvi9dQtrPTIsRrBFGbhVbgSBcbAOgC/wA/pXGyPGO+d3QjBNdVCFldnNWnd2RTVY0GMH1yPWqN0NzHauBjtwa1cDJOQUGTjOKzbjAJYhdvT5Tz+VdBgVRAFQPuBHQj3qRYWcEhcjrgDNG5duCMgc8r+lSBS20gqvcKQBQA0R5A4JcAfKopwiY7+GLKOOAcf4VMqEnh854IPzflUh5IJLNtPIyAD+AoAqG0aQqoX5j6YprRIijaP3hONxOMYq8kZJG0bt3y8jIz6UyTbEzI7R7k6kc8enFAFMQTuSF8w9m9qhNttbcCQ/THQMK0ppEkUiL5wTxuT5gOwpj2xBUSBPlHzAnH6etADbWJgNz5JOOD6VbwHdQTgD25pbZURgECYBzuKj8qsmLIyDwPoafQQ+GMKF2hQOnNbtqmYwoHzexxWRHC3yYBJP61sW8RVRngj2rN7GiIruJlBJx7YNVoAhXORu9hV+4iAUnGT9OlUl2x5wMnP50lsMsgYwOTkdqVkGPUCpoiNo3KfrkfypZI+uAAfpQBmzIMjJwtZs8YLfpzW1MpC9SR1xWdKm75vmwTjOO/1oQmV4LVDKuN278K6iOErGgJOOg4rGtIwJVbqepwK6uOHEQYlolI4IyK0RLMqa3yvTj0ZcfpWXcW7LyAPT5eK3ZFZxuDsT06nJqlPFISWXg56buaq5LR57r8QaTDcgDntXMSwqMlDx9Oa7rxDbYkYtgnHXPSuTe2JcqATmpYzJMTOMHHHIphsTKwAOM1olMcA4A5/wAinLH8xxwMd6AMeTT54hkJuHtzURt4yP3isje3I/I10KKw+YZAHB96lCxspSSENnnPelcaMuz8Ra1pUPk2Ot3kcGNvlCZtmPTaTj9KUeJ7qaTdfWGm35PUzWyqx/FNpqzJptu4ZlUrx0qu+lcBQrA+4ppoQ1tQ0aUfvfD7xHuba8dR+TBqWH/hF5Axmi1qE9vLeKQfqBTG0qVOxXPTNRvpM4YgjJHoaEkF2WhaeFJMY1PV4f8Afso2/lJU9vbaZbl/7O1Ca8DY3+bbeSU9P4jnPP5VlnRpT/d59DVzTbNrTzQ2Mtjv6ZojvuJl+iiitBBRRRQAUUUUAFFFFABRRRQAUUUUAO+zCVN53cHHAqo9kAxJBA7c10+jQLNZP8m5jIe/bAp8+niV8BSvbsMfjWbepVjj2tCOQelRNCRn0966mTSQGJbgZ/h5qlLp20kjDAnA9RSCxzrQjd8o4qB7bIOBxW61huJwCPUk1BJaFMrjJHB9KBGG9nj1zUcTT2zh4pGQjupxWo8ZJqF4uMd6aYFyy8W3VqVWZBKo7jg/4V2vh/xtFDe21zaXJguYjyjNtLr0K/iOK83NuF521C1uzduBUOEWWpyR9SyXcHivSpmF0TY3E0R2bhug2EMFYdx8u33zXRvJeSvGZ3S2CgSKoTcz84KDP3fTIr5M0rWdX0iVHsbiRWXoDyK9E0vxv411WaONri1D7QvmNDkqASfXHcmsHQa2ZvGsnuetWeoXw8Q39tdQQRwbXuVmL9I1CD5uwPNcD4v+IqXE7W2iFnmDsZL0NkHK7fl9T156DPGarS6fPqMg/tTUJrtj1Vztjz/ujj881KNJsUIXyVXPBz6UQppasHNtWRydpbTSYDbVX3NbdtZ/uy0rAhcbVbofwqa50uNDI1vhQvAU8n/61VYhISuFcpnDc8V0J3MLWLe2GMFXVsnvgBQfYYrMm5kcs+RnrgD+VaaKcEKVAPHBzVK8txkZdBkHIBzVElcSQqpACtu4zn7v4d6FaJe+49uKid1jAARScZ45Ap0agKCx2bh6c/8A1hQA8S7gGwo2nIIxuz9aQzNlhjGME88Zo+zgx8IBk8sT1HtVhGigDeU3BGPmXOB7UAVlmY7h5LlT02HAz7560/8As66mt1mKMtqP4iQB+Azk1K10F2qIlODww6gfyqMxm4fmMk+p5OPr2oAYbeRQdyoQcbS6Z/L0pziVy2dikgBigH6D1qwxFukQIKMuQcHmmD5MjYWXIIJHIpgTWtqScj5WY/xfzq+EkUBdu0dCRwaitpc/LvbG3uMgVeUbvlboR/Cef16UPYEJDblcfM+P6VrW8S4XIBPaqNrHlhjdnPI/+vW/bEGIjbyOuec1m9i0UZoztGFxt9utUpUXexbv0APWteaJsZ+72+Y4qo0JR/m2njuM4pIZSRlUM3mfLn05FTocjls46Drmho0yWKEdsAcfWljjJ5DKPT1oAinX5Dkgq2DgcVQeNAwzJhuhwM1rSqrJtbHTr/8AWqmF5YqFX1A5/nQgYW0YLxgrjn72P1rokVQgJQsCMHt/OsWBMzLnPI6qOa2wXCDj6k4BI7VaJZSlQqXZYlB9wDVRzIM5IAz61qszhR8wIb+6cHH0qlcRqzZdyR6gc/iKpks47XVYscnJbjAOCa5ieA5I24A611msRFWIRgAeCW6VgtabHkw6MB0YZ/rwaljSMloRu4wCPbqKFh3NtAyc5yR0/GtPaoViXYuMfMOBiiNN2dwVt/AYdR78UXCxTW13kZJVfULkCkNsq8gEleACM1vx2xVcbAWI6evvUD2rElhwDzk0AYJj5HB9cdKkKEKW2yGQYKn/AOvV2a3bALL74yOKaY5UOB94j+A8flQBUEYf5pYpEJG5WDkDP41GwKICwO3nbgA1amJkfhWVfTuKjFuCvyBix98A/h60xFUOZG3BQF7bR0NOm5CHnJzkGnsrZ6fd4+7zUUpXPyrjv7U1uJjKKKKsQUUUUAFFFFABRRRQAUUUUAFFFFAHW+FoVexd2wMSkZ9OBWtJYphmZjknvgCqXg2ze50+UoGJEx4H+6tbc1uQxVV2gfezyc1lLc0Wxk/Z4l5KKe53HAJqlNAZfmSMLvOeBiukSBXQqYgQvUk8/hUb2pCMFQkeuQAKkLHKy2uyP5YgWPBOckVmSWLtzt+U8V1s1pExVMhcdcnrUT2qtkLt2ngE9PoKYrHFSaeQSgFQf2aWbB4H0rtprNd2Y9oCjooz+tU5LRThQv7w9TmgLHKLpJZgDnj1qxHpCbuMkgcgiug+zhXKrjA6tilgQsQVzye/GaAsVLDSVmdQI/lrqIIFsnTaNhyOCO1LYKoXLABQegXpVsuUbO0EemM1LLSsNmIS7jk7+n9asvkA8YbAPNQyATOhVQAOcipvLfcBkEbc7hUjG48wszKCMc89KyJreBZAQGPqQf6Vui2QopZ8Z67ap3UcQHyxsyofv+tVFikUoNqjBEhAHykYqOdQ+EjjCAZJ3YyavhYz9xDkd88flVW5t5GkHyhR1+Yd60MzLeEJjYGx/ETwKmkh3MoXy09Npxx9amktnKnbKNq9FBxj86j8lTs8xiVbjC80AQm0QBsSESY4yODUscMflsfMyw4KgdvrT2iSPJ8zp03DPHvTkltpnA2qgPHyDvQBFHCruoZI2jYjgnBpxmeOVkgTykJIKgbsj0zT5CiFdgbdnBLDrUgkJ4iXBzyCaAIfKExUGbDHqSOhqSHEpDfflOQWZzzSshcKRgEHB46U+MOhwyq38XHQ0AXrTzEi2iLqORj73uanVcgFkIYfxL1/Gm20MzxeYVdB1G09quNuCrEQU4ycDLH8aGNDbeNnGOMDn5hjFbNom2E5BPrisy1haT/loMg87u1btpaOsYZivHXmoZaK00SnHC/WqcxG4EL/AMCFa80S7sAHn0rOnSQHjAK9RUoZVaMDoSB19aXy2fI2ZXPYfdqcZOMo2MdzQoBJwG+U9OmaYilKCCykZPb3quhYkqVBHXHTFaG+TzG+QBe241FIvmLkhSMccdKYMZbKyyAKShHPB6VsfZmdVbzi4PUis+KDhT8xB6ZxWtANoYHBJ7KeD9apEsq7DEwBjbI65PFV5vQxYxz1xV+eGTaCwYx9M9ce1VpYggXccpjIK4/UGmxHH6ssR3nHOeAef0rCEksRkdE4PXjIFdJr0cMibkUq4zy4xuHtiuZlLMm4smOhBGCPxpMBY5FaNgYz8uSwC9BUyGDAVECgY6c59+eRVLPlxZydpXgjvU8ThUy3KEA8ADHuKQzVtS4yYwozwSDyadcQhTk4MmeRmizYMBtbax4HofrUt2ir1YMzf3f4aAMx0ZScB1OMHp+lZzRndlnjAB5GOvvWpIu8ch9x7dRWbIp3H5RtHtgUxEDlpIwwL+hw2AfzpVt4mABdx3Kk9D9ad5gZj8oz1IxSqVMZKZ3A8g8cUAV5Dtkwo46dciq16ABF03c5I/wrSaSMALs+U9NzZ59sVnX4YFNy4644prcTKdFFFaEhRRRQAUUUUAFFFFABRRRQAUUUUAei+ALdpNInYAkeew4/3VrpDZvsMhChR/D6n2rzvw74uOgWb24tDNukMm7zduMgDGMH0rY/4WSNwJ0snnn/AEjk/wDjtZOLuaKSsdStm5jyiEKecEVVltZY0zKBtcnA71gN8SQwH/Er5HQ/aP8A7GoT8QlY5Omn1P8ApHX/AMdpcrDmR0UdnEyAsgDH1qG6t0VOoGOML1Nc9/wnceedM3L6Gf8A+xqOXxsrj5NOCfSbP/stPlYXRtG381vkRsc8A44qvLaCXgZD9TzxWQvjBFUg2GeMDM3T9KibxWGOfsWD/wBdf/rUcrFdGm0CIGLg44AwafaxKz7ym4g5LH+lYzeJlZdv2PjOf9Z/9anw+K1hLH7FnPbzf/rUcrC6OtTYUJ2fLjOemTSwKZVHKpn+8e1cufGQKKn2DAHcS8n/AMdoXxkFOfsAyep83/61TyMrmR2qwMkSuHGSeBjgCnLF8ihF3svzZ7Vx6eO1jBA04Y/67f8A2NOj8fGMMBYdf+m3/wBjRySHzI65oVJIZtpzzgcVVubQ+WSnbqcYzXNnx6O2nYP/AF2/+xqCTxvI4IW1Zc9f32f/AGWmoMTkjodskO45wRyAoqrK0rOrM5I5JZugrGHjWRSSLXqMHMmc/pUcni9pUCG0AQcgCT/61XZmdzZW13Ddu+UjJJ6mmrbKj7wQUzg881hyeKBIwP2THriTr+lL/wAJNFuz/Z4x6eb1/SizC5snajn5EKAkLinRKr5dVBwenasQ+KBkstntf1EnA/DFB8VbgoNmu0dg+M/pRYLm+wEjY2sWzk4PAp4jQscM4APBIzz6Vzy+K8MSbTPPA8zgfpT/APhLjt2/YwOckiT/AOtRZhc6QRGcjLBAM5GcUscaQsrtkL0yetc2vi/bwbIFe48z/wCtTk8YhetiG9MyZx+lFh3O0TUIGIVSxCjbkLx9allljYj5Wz/fJriU8bFOBYgDvtlxn/x2p/8AhPFyM6apGMczdf8Ax2hoEzvrGTLDCoB03MOtbkK5QsFAPYgd68pi+IQjznTAT2/f4A/8drQi+KojUD+xwT6i5x/7LUuLKUkehvEAxbZknsDVKVFR2Cgnd3PUVxb/ABYDgg6Ocnv9q/8AsKhl+KPmuGOkgEf9PH/2NLkY+ZHcbBs3KjM3T5gMVDslDAYCc4I9a4pviezKFOmcDoPP/wDsaYfiSCP+QXk+9x/9jT5WHMjsGiVGOMktkEkdPpTlgV1Ow43DBU8VxS/EYKT/AMSwkZzgz/8A2NSD4l46aXj0xPyP/HaOVi5kdvb2YUZYqQRywPSrgiZULoYwFwCN2M154vxLVVZf7K4bn/j47/8AfNTL8VGXH/EqBI7+fz/6DTUWJtHeiZlcnG1epCnIqtdMCCPKBbr8tcdJ8VI5AQ2iDPYi5wR/45VSb4jrKB/xK2Ujv9p/+xp2YrmjqrMEK5cEcjI+X6VzzJGwWQqC5ONnYj1qO78YtdKVNphT/wBNc/0rLl1nzTnye2B83T9KLMLmjNC6APHIuD0C9hUQidujYIPGaz49UMZyIyfbd/8AWqRNY2EHyePTf/8AWpcrC6OjtlkBVWANTTOSfnycDA5xWBF4kMWf9HJ9/M/+tTpPE++MoLQDPcvn+lHKwujWKGNSS53joM9ay7mSUzqW57barHXskH7PyPR//rVFPrLTsrGMhl6Hd/8AWoswuW2EaNhR7nccfhT1UGNRxyPvcH9KzzqqscvBubOc7v6YpDqitIHa3GR6Nj+lHKwuaXktIihVG3/npjFZ2rbswkjGc/0pW1cseIsDORhun6VWvL1rzy9wwVzyTknP/wCqmk7g2VaKKKskKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/2Q==";
const APP_FAVICON_32 = "data:image/png;base64,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";

/* ---------- SKAL BENCH logo mark ----------
 * A pressure gauge, simplified to the few elements that still read at 22 px in the header: the
 * bezel, six bold ticks over the usual 270-degree sweep, the needle sitting up-and-right in the
 * working range, and a rust redline arc for brand colour. Drawn as vector rather than embedded as
 * an image so it stays crisp at any size and on any display, costs about a kilobyte, and can be
 * recoloured from the palette — a detailed gauge photograph turns to mush at favicon size. */
function SkalMark({ size = 24, title = "SKAL Bench" }) {
  const pol = (deg, r) => {
    const a = (deg * Math.PI) / 180;
    return [50 + r * Math.sin(a), 50 - r * Math.cos(a)];
  };
  const INK = "#1C2733";
  const [ax0, ay0] = pol(55, 40);   // redline arc start
  const [ax1, ay1] = pol(95, 40);   // redline arc end
  const [nx, ny] = pol(40.5, 33);   // needle tip
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={title}
      style={{ display: "block", flexShrink: 0 }}>
      <title>{title}</title>
      <circle cx="50" cy="50" r="47" fill="#F4F2ED" />
      <circle cx="50" cy="50" r="47" fill="none" stroke={INK} strokeWidth="6" />
      <path d={`M ${ax0.toFixed(2)} ${ay0.toFixed(2)} A 40 40 0 0 1 ${ax1.toFixed(2)} ${ay1.toFixed(2)}`}
        fill="none" stroke={C.rust} strokeWidth="6" strokeLinecap="round" />
      {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t, i) => {
        const d = -135 + t * 270;
        const [x1, y1] = pol(d, 35);
        const [x2, y2] = pol(d, 26);
        return <line key={i} x1={x1.toFixed(2)} y1={y1.toFixed(2)} x2={x2.toFixed(2)} y2={y2.toFixed(2)}
          stroke={INK} strokeWidth="5" strokeLinecap="round" />;
      })}
      <line x1="50" y1="50" x2={nx.toFixed(2)} y2={ny.toFixed(2)} stroke={INK} strokeWidth="6.5" strokeLinecap="round" />
      <circle cx="50" cy="50" r="7" fill={INK} />
    </svg>
  );
}

/* ============================== DOCUMENTATION ==============================
 * The per-module pages are generated from the MODULES table itself, so the equations, references
 * and input lists shown here are the same strings the calculators carry — they cannot drift out of
 * sync with the code. DOC_EXTRA supplies what the table does not hold: citations for the older
 * modules that predate the `reference` field, and full write-ups for the custom screens (MICP, NMR,
 * contact angle, correlation, penetrometer) which are not table-driven. */
const DOC_EXTRA = {
  gasSteady: {
    reference: `Darcy, H. (1856). "Les Fontaines Publiques de la Ville de Dijon." Dalmont, Paris. Gas slippage: Klinkenberg, L.J. (1941), "The Permeability of Porous Media to Liquids and Gases," API Drilling and Production Practice, 200–213. Procedure: API RP 40 (1998), §6.`,
    notes: `Gas is compressible, so the Darcy form uses the squared-pressure difference. Because gas molecules slip at the pore wall, apparent permeability rises as mean pressure falls; measuring at several mean pressures and extrapolating kₐ against 1/Pm to infinite pressure removes the effect. The intercept, k∞, is the Klinkenberg-corrected (equivalent liquid) permeability, and the slope carries the gas-slip factor b.`,
  },
  gasSingle: {
    reference: `Darcy, H. (1856), as above; API RP 40 (1998), §6.`,
    notes: `A single-point measurement returns the apparent gas permeability at one mean pressure. It carries an uncorrected slip contribution and therefore reads high — always higher than the Klinkenberg value. Use it for screening; use the multi-point steady-state module when the corrected permeability matters.`,
  },
  pulseDecay: {
    reference: `Brace, W.F., Walsh, J.B. & Frangos, W.T. (1968). "Permeability of Granite under High Pressure." Journal of Geophysical Research 73(6), 2225–2236. Practical implementations: Dicker, A.I. & Smits, R.M. (1988), SPE 17578; Jones, S.C. (1997), "A Technique for Faster Pulse-Decay Permeability Measurements in Tight Rocks," SPE Formation Evaluation 12(1), 19–26.`,
    notes: `For tight rock, steady flow is impractically slow. Instead a small pressure pulse is applied across the plug and its decay between two reservoirs is tracked. The decay is exponential, so permeability follows from the slope of ln ΔP against time together with the reservoir volumes and fluid compressibility.`,
  },
  liquidCoreflood: {
    reference: `Darcy, H. (1856), as above; API RP 40 (1998), §6. Forced-origin regression is used because zero differential pressure must give zero flow.`,
    notes: `Liquid permeability needs no slip correction, so it is the natural reference for the Klinkenberg-corrected gas value. Fitting several flow rates and forcing the line through the origin is more robust than any single point, and a curved Q–ΔP trend is a warning of turbulence, fines migration or clay swelling rather than a valid Darcy measurement.`,
  },
  relPermSteady: {
    reference: `Hassler, G.L. (1944), US Patent 2,345,935. Method and interpretation: Osoba, J.S., Richardson, J.G., Kerver, J.K., Hafford, J.A. & Blair, P.M. (1951), "Laboratory Measurements of Relative Permeability," Trans. AIME 192, 47–56; Richardson, J.G. et al. (1952), Trans. AIME 195, 187–196.`,
    notes: `Both phases are injected together at fixed ratios until pressure and production stabilise, and Darcy's law is applied to each phase in turn. Steady state is slower than an unsteady-state flood but far less sensitive to numerical differentiation, so it is the reference method where accuracy matters.`,
  },
  relPermHub: {
    kind: "nav",
    notes: `A navigation page grouping the three relative-permeability routes: steady-state, unsteady-state (JBN) and the Brooks–Corey fit/prediction screen. No calculation of its own.`,
  },
  capillaryHub: {
    kind: "nav",
    notes: `A navigation page grouping the mercury-injection workflow: the high-pressure intrusion analysis and the penetrometer selection tool. No calculation of its own.`,
  },
  contactAngle: {
    formula: `θ_water = θ_drop (water/brine drop)   θ_water = 180° − θ_drop (oil drop or gas bubble)`,
    reference: `Young, T. (1805). "An Essay on the Cohesion of Fluids." Philosophical Transactions of the Royal Society of London 95, 65–87. Measurement convention: Craig, F.F. (1971), "The Reservoir Engineering Aspects of Waterflooding," SPE Monograph 3. Interpretation: Anderson, W.G. (1986), "Wettability Literature Survey — Part 2: Wettability Measurement," JPT 38(11), 1246–1262. Classification bands: Chilingar, G.V. & Yen, T.F. (1983), Energy Sources 7(1), 67–75, with Morrow, N.R. (1990), JPT 42(12), 1476–1484.`,
    notes: `Upload a drop or bubble photograph, mark the solid baseline and two points on each side of the drop edge, and the console fits a tangent through each pair and measures its angle to the baseline — the classical goniometric construction, not automated drop-shape fitting, so accuracy depends on careful point placement. Because the tangent is measured through the drop phase, the fluid setup matters: for an oil drop or a captive gas bubble the reported water contact angle is the supplementary angle. The result is given both on the seven-band petroleum wettability scale and as the surface-science hydrophilic/hydrophobic call at 90°.`,
  },
  nmrPetrophysics: {
    formula: `φ = A·K/Vb    CBW/BVI/FFI from T2 cutoffs    k_SDR = a·φ^m·T2LM^n    k_Coates = (φ/C)^p·(FFI/BVI)^q`,
    reference: `SDR model: Kenyon, W.E., Day, P.I., Straley, C. & Willemsen, J.F. (1988), "A Three-Part Study of NMR Longitudinal Relaxation Properties of Water-Saturated Sandstones," SPE Formation Evaluation 3(3), 622–636. Timur–Coates model: Timur, A. (1968), JPT 20(6), 775–786; Coates, G.R., Xiao, L. & Prammer, M.G. (1999), "NMR Logging: Principles and Applications," Halliburton. T2 cutoffs: Straley, C., Rossini, D., Vinegar, H., Tutunjian, P. & Morriss, C. (1997), The Log Analyst 38(2), 84–94. Clay-bound water: Prammer, M.G. et al. (1996), The Log Analyst 37(6).`,
    notes: `A CPMG echo train is inverted two ways — a three-component exponential fit and a regularised inverse Laplace transform — and the amplitude is converted to porosity through the instrument calibration constant and the plug bulk volume. The distribution is split at the clay-bound and BVI cutoffs to give CBW, BVI and FFI, from which the SDR and Timur–Coates permeabilities follow. Two calibration controls are provided because the generic literature coefficients routinely miss measured permeability by a factor of several: the SDR coefficient can be back-solved from a measured core permeability, and the BVI cutoff can be derived from a measured irreducible saturation instead of the 33 ms default. Coates is reported as not applicable when almost no signal falls below the BVI cutoff, since the FFI/BVI ratio is then unstable. The echo train is sampled logarithmically before inversion so that the early echoes carrying the clay-bound signal are preserved.`,
  },
  micpIntrusion: {
    formula: `d = −4σcosθ/P (Washburn)    k_Purcell = (φ/8)·Σ(ΔS·r²)    Sb = Sb∞·exp(−G/log₁₀(Pc/Pd)) (Thomeer)`,
    reference: `Washburn, E.W. (1921). "Note on a Method of Determining the Distribution of Pore Sizes in a Porous Material." PNAS 7(4), 115–116. Purcell, W.R. (1949), Trans. AIME 186, 39–48. Burdine, N.T. (1953), Trans. AIME 198, 71–78. Leverett, M.C. (1941), Trans. AIME 142, 152–169. Swanson, B.F. (1981), JPT 33(12), 2498–2504. Thomeer, H.J. (1960), JPT 12(3), 73–77, and Thomeer, H.J. (1983), JPT 35(4), 809–814. Brooks, R.H. & Corey, A.T. (1964), Colorado State University Hydrology Paper 3. Winland r35 as published in Kolodzie, S. (1980), SPE 9382. Flow-zone indicator: Amaefule, J.O. et al. (1993), SPE 26436.`,
    notes: `The full mercury-injection workflow, presented across tabbed sections: instrument summary, intrusion curves, petrophysics, the data table, relative permeability, a custom plot, and the equations behind them. The custom plot tab allows any two of the processed quantities — saturation, pressure, throat radius, pore-size distribution, height above free water, the J-function — to be plotted against one another in a choice of units and on linear or logarithmic axes, with quick presets for the standard views and the same Modify and export controls as the other figures. Washburn's equation converts each injection pressure to a pore-throat diameter, giving the pore-throat size distribution, and the saturation curve yields threshold pressure, r35, sorting, the Leverett J-function, mercury entrapment and a family of permeability estimates (Purcell, Swanson, Winland, Thomeer). The Brooks–Corey fit is taken across the main drainage interval only, excluding the low-pressure conformance region and the high-pressure microporosity tail, neither of which obeys the power law. The Thomeer hyperbola is fitted by searching the displacement pressure with a closed-form linear solve inside, returning the pore geometrical factor G, entry pressure Pd and the extrapolated Sb∞.`,
  },
  penetrometerSelector: {
    formula: `stem utilisation = intruded volume / stem volume (target ≈ 25–90%)`,
    reference: `Micromeritics AutoPore penetrometer specifications (published catalogue data, Table 5-1). Selection guidance follows API RP 40 (1998) and standard mercury-porosimetry practice: too little stem utilisation gives poor resolution, too much risks exceeding stem capacity mid-run.`,
    notes: `Matches a plug to a penetrometer by estimating the mercury volume it will take up and checking the resulting stem utilisation. The part numbers and bulb/stem volumes are published manufacturer specifications, not measured data.`,
  },
  phiKCorrelation: {
    formula: `k = a·φ^b (power law)    k = a·e^(bφ) (exponential)`,
    reference: `Standard log-linear regression of core porosity–permeability pairs. Interpretation follows Tiab, D. & Donaldson, E.C., "Petrophysics: Theory and Practice of Measuring Reservoir Rock and Fluid Transport Properties," Gulf Professional Publishing. For pore-geometry-based rock typing, see the Rock Typing module.`,
    notes: `Fits both a power-law and an exponential trend to a porosity–permeability dataset and recommends the better model by R². The purpose is to extend a handful of core measurements across uncored intervals; the fit is only as good as the rock-type consistency of the dataset, so a poor R² usually means several flow units have been mixed rather than that the regression failed.`,
  },
};

const DOC_METHODS = [
  {
    t: "Calibration philosophy",
    b: `Every empirical permeability transform in this software — SDR, Timur–Coates, Swanson, Winland, Thomeer — carries coefficients that were fitted to a particular set of rocks. Applied unchanged to a different formation they are commonly wrong by a factor of several, and that is a property of the correlations, not a defect of the measurement. Wherever it is possible the console therefore exposes the coefficient and provides a way to anchor it to your own core data, and reports the generic literature value alongside so the size of the correction is visible.`,
  },
  {
    t: "Curve smoothing",
    b: `Every chart offers Savitzky–Golay smoothing at 5, 7 or 9 points. The quadratic Savitzky–Golay kernel is used in preference to a moving average because it preserves peak height and position, which matters where the peak is itself the measurement — T2 distributions and pore-throat spectra. Endpoints are left unsmoothed rather than extrapolated. Smoothing is applied only to what is drawn: every reported value, fitted parameter and R² is computed from the raw data, and a note appears beneath any chart that is being displayed smoothed.`,
    r: `Savitzky, A. & Golay, M.J.E. (1964). "Smoothing and Differentiation of Data by Simplified Least Squares Procedures." Analytical Chemistry 36(8), 1627–1639.`,
  },
  {
    t: "Numerical differentiation",
    b: `The JBN relative-permeability calculation differentiates the production and pressure data twice, which strongly amplifies scatter — particularly just after breakthrough. A five-point Savitzky–Golay smoother is therefore applied to the monotone series before differentiation, and can be switched off from the input fields. Points that come out negative or otherwise unphysical are filtered rather than plotted.`,
  },
  {
    t: "Brine resistivity and temperature",
    b: `Brine resistivity is strongly temperature-dependent, so it must be stated at the same temperature as the resistivity measurements before a formation factor is formed. The electrical modules apply the Arps correction, Rw₂ = Rw₁·(T₁+21.5)/(T₂+21.5) with temperatures in °C, and report when a correction has been made. The resistivity index needs no such correction because it is a ratio taken on the same plug, so temperature cancels.`,
    r: `Arps, J.J. (1953). "The Effect of Temperature on the Density and Electrical Resistivity of Sodium Chloride Solutions." Journal of Petroleum Technology 5(10), 17–20.`,
  },
  {
    t: "Constrained regression",
    b: `Two of the Archie fits have a physically fixed point and are fitted accordingly. The resistivity index must equal one at full water saturation, so the saturation exponent is estimated with the line forced through the origin in log–log space; the unconstrained fit is reported alongside, because a large intercept is a useful warning that the data are noisy or non-Archie. The formation factor is reported both with a free tortuosity factor and with Archie's original a = 1 constraint.`,
  },
  {
    t: "Centrifuge inversion",
    b: `Converting an average saturation measured in a centrifuge into the saturation at the inlet face is an inverse problem. The Hassler–Brunner first approximation is exact only in the limit where the plug is short relative to its distance from the axis. This console also solves the underlying integral equation directly, as a regularised least-squares problem with a monotonicity constraint, and selects between the two on the basis of the r1/r2 ratio — round-trip tests on synthetic curves show the direct inversion to be substantially more accurate for long plugs and the Hassler–Brunner approximation better as r1/r2 approaches one. Both values are always reported.`,
    r: `Hassler, G.L. & Brunner, E. (1945), Trans. AIME 160, 114–123; Forbes, P. (1994), The Log Analyst 35(4), 31–53.`,
  },
  {
    t: "Measurement uncertainty",
    b: `Darcy's law is a product of measured quantities, so relative variances add and the plug diameter counts twice because area goes as the square of diameter. The uncertainty module propagates instrument tolerances on this basis and reports the expanded uncertainty at a coverage factor of two, together with a ranking of which instrument dominates the error budget.`,
    r: `JCGM 100:2008. "Evaluation of Measurement Data — Guide to the Expression of Uncertainty in Measurement" (GUM), §5.`,
  },
  {
    t: "Data export",
    b: `Two exports are offered, and they differ in scope. Plotted points (CSV), beneath each figure, contains only the points drawn on that chart. Full results (CSV), on the result card, contains the complete computed table for every row, including the intermediate columns the chart never shows — for the centrifuge module, for instance, it carries both the Hassler-Brunner and the direct-inversion saturations side by side. When a chart is displayed smoothed the exported filename records the smoothing window, so a smoothed export cannot be mistaken for raw data. Figures export separately at publication resolution.`,
  },
  {
    t: "Modifying a figure",
    b: `Every chart carries a Modify control that opens a panel for presentation changes: a title or sample name, axis labels, axis minima and maxima, and gridlines on or off. A live preview shows the effect before anything is exported, and the title is drawn inside the exported image rather than only on screen. Axis limits clip the view alone — the fit and every reported value continue to use the whole dataset, so a figure can be zoomed to a region of interest without altering the result behind it.`,
  },
  {
    t: "User-applied trend lines",
    b: `On charts of discrete measurements the same panel offers a trend line: the module's own fit, no line at all, or a linear, power or exponential fit applied by the user, with the equation and R² shown beneath the plot and carried into the export. R² is computed against the untransformed measurements rather than in the space each model linearises to, so the three models can be compared on equal terms. A trend chosen here is an annotation on the figure and never feeds the reported result, which is always computed by the module's own method from the raw data. The control is withheld on charts of continuous curves and distributions — relative permeability, T2 spectra — where a trend line would not be meaningful.`,
  },
  {
    t: "When a calculation fails",
    b: `If a screen fails it is replaced by an error panel rather than a blank page, and the rest of the application stays usable. The panel shows a reference code derived from the fault itself, so the same problem always produces the same code, together with a report — version, module, error and timestamp — that can be sent in one action. Nothing entered is transmitted anywhere: all calculation happens in the browser, and a report contains only what the user chooses to send.`,
  },
  {
    t: "Units",
    b: `Each input field states its expected unit and the console converts internally; permeability is reported in millidarcy, pressure in psi or atm as labelled, lengths in centimetres and viscosity in centipoise. Saturations and porosity are fractions, not percentages, except where a field is explicitly labelled as a percentage. A separate unit converter is provided under the Converter tab, and the conversion factors it uses are exact definitions rather than rounded values.`,
  },
];

/* ============================== CITATION ==============================
 * One component, rendered both on its own page (footer link) and inside the documentation, so the
 * wording and the citation string can never diverge between the two. */
function CitationBlock() {
  const [copied, setCopied] = useState(null); // which format was copied, so only that button confirms
  const copy = (key, text) => {
    try {
      navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch (e) { /* clipboard unavailable — the text is selectable regardless */ }
  };
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 11, padding: 18 }}>
      <p style={{ fontSize: 13, lineHeight: 1.72, color: C.textDim, margin: "0 0 14px", ...fBody }}>
        If this software contributed to work you are publishing, please cite the version you used. The version
        number matters: a calculation corrected in a later release may not reproduce an earlier result, so
        quoting the version keeps your figures traceable.
      </p>

      {[
        { key: "apa", label: "APA 7TH EDITION", text: citationText(), note: "Adapt the punctuation if your journal uses its own house style — the required elements are all here." },
        { key: "bib", label: "BIBTEX", text: citationBibtex(), note: "For LaTeX users: paste into your .bib file." },
      ].map((fmtItem) => (
        <div key={fmtItem.key} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, letterSpacing: 1.2, color: C.textFaint, ...fMono }}>{fmtItem.label}</span>
            <button onClick={() => copy(fmtItem.key, fmtItem.text)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 10px", color: copied === fmtItem.key ? C.good : C.textDim, fontSize: 11, cursor: "pointer", ...fBody }}>
              <Copy size={11} /> {copied === fmtItem.key ? "Copied" : "Copy"}
            </button>
          </div>
          <div style={{ background: C.bgSoft, border: `1px solid ${C.borderSoft}`, borderRadius: 7, padding: "12px 14px" }}>
            <pre style={{ fontSize: 12.5, lineHeight: 1.7, color: C.text, ...fMono, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{fmtItem.text}</pre>
          </div>
          <div style={{ fontSize: 11, color: C.textFaint, marginTop: 6, ...fBody }}>{fmtItem.note}</div>
        </div>
      ))}

      <div style={{ fontSize: 10, letterSpacing: 1.2, color: C.textFaint, ...fMono, marginBottom: 6 }}>VERSIONS</div>
      <p style={{ fontSize: 13, lineHeight: 1.72, color: C.textDim, margin: "0 0 16px", ...fBody }}>
        The current release is version {APP_VERSION} ({APP_RELEASED}). Versions follow the MAJOR.MINOR.PATCH
        convention: the patch number changes for fixes that alter no results, the minor number when a module or
        capability is added, and the major number when a calculation&rsquo;s output changes such that an earlier
        result would no longer reproduce.
      </p>

      <div style={{ fontSize: 10, letterSpacing: 1.2, color: C.textFaint, ...fMono, marginBottom: 6 }}>LICENCE</div>
      <p style={{ fontSize: 13, lineHeight: 1.72, color: C.textDim, margin: 0, ...fBody }}>
        SKAL Bench is released under the MIT licence: you may use, copy, modify and redistribute it, including
        within commercial work, provided the copyright notice and licence text are retained. It is provided
        without warranty — confirm important values against your own core measurements before relying on them.
      </p>
    </div>
  );
}

function CiteScreen({ onBack }) {
  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "26px 24px 10px" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", color: C.textFaint, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 24, ...fBody }}>
        <ArrowLeft size={15} /> Back
      </button>
      <div style={{ fontSize: 11, letterSpacing: 2, color: C.rust, ...fMono, marginBottom: 12 }}>CITATION</div>
      <h1 style={{ fontSize: 28, lineHeight: 1.15, margin: "0 0 20px", color: C.text, ...fDisplay, fontWeight: 700 }}>
        How to cite SKAL Bench
      </h1>
      <CitationBlock />
    </div>
  );
}

function DocSection({ title, children }) {
  return (
    <div style={{ marginBottom: 34 }}>
      <div style={{ fontSize: 11, letterSpacing: 1.5, color: C.rust, ...fMono, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function DocModule({ mod, extra }) {
  const formula = (extra && extra.formula) || mod.formula;
  const reference = mod.reference || (extra && extra.reference);
  const notes = extra && extra.notes;
  const Icon = mod.icon;
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 11, padding: 18, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
        {Icon && <Icon size={15} color={mod.color} />}
        <span style={{ fontSize: 14.5, fontWeight: 700, color: C.text, ...fDisplay }}>{mod.name}</span>
        {extra && extra.kind === "nav" && (
          <span style={{ fontSize: 10, letterSpacing: 0.6, color: C.textFaint, border: `1px solid ${C.border}`, borderRadius: 4, padding: "1px 6px", ...fMono }}>NAVIGATION</span>
        )}
      </div>
      {mod.short && <div style={{ fontSize: 12.5, color: C.textDim, marginBottom: 10, ...fBody }}>{mod.short}</div>}
      {formula && (
        <div style={{ background: C.bgSoft, border: `1px solid ${C.borderSoft}`, borderRadius: 7, padding: "9px 11px", marginBottom: 10, overflowX: "auto" }}>
          <div style={{ fontSize: 12, color: C.text, whiteSpace: "pre-wrap", ...fMono }}>{formula}</div>
        </div>
      )}
      {(mod.blurb || notes) && (
        <p style={{ fontSize: 12.5, lineHeight: 1.68, color: C.textDim, margin: "0 0 10px", ...fBody }}>{notes || mod.blurb}</p>
      )}
      {notes && mod.blurb && (
        <p style={{ fontSize: 12.5, lineHeight: 1.68, color: C.textDim, margin: "0 0 10px", ...fBody }}>{mod.blurb}</p>
      )}
      {Array.isArray(mod.needs) && mod.needs.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10.5, letterSpacing: 1, color: C.textFaint, ...fMono, marginBottom: 5 }}>REQUIRED MEASUREMENTS</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {mod.needs.map((n, i) => (
              <li key={i} style={{ fontSize: 12, lineHeight: 1.6, color: C.textDim, ...fBody }}>{n}</li>
            ))}
          </ul>
        </div>
      )}
      {Array.isArray(mod.rowFields) && mod.rowFields.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10.5, letterSpacing: 1, color: C.textFaint, ...fMono, marginBottom: 5 }}>INPUT COLUMNS</div>
          <div style={{ fontSize: 12, color: C.textDim, ...fBody }}>
            {mod.rowFields.map((f) => `${f.label} (${f.unit})`).join(" · ")}
          </div>
        </div>
      )}
      {reference && (
        <div style={{ borderTop: `1px solid ${C.borderSoft}`, paddingTop: 9, marginTop: 4 }}>
          <div style={{ fontSize: 10.5, letterSpacing: 1, color: C.textFaint, ...fMono, marginBottom: 4 }}>REFERENCES</div>
          <div style={{ fontSize: 11.5, lineHeight: 1.6, color: C.textFaint, ...fBody }}>{reference}</div>
        </div>
      )}
    </div>
  );
}

function DocsScreen({ onBack }) {
  const byCat = CATEGORIES.map((cat) => ({
    cat,
    mods: MODULES.filter((m) => m.category === cat.name),
  })).filter((g) => g.mods.length);
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "26px 24px 10px" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", color: C.textFaint, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 22, ...fBody }}>
        <ArrowLeft size={15} /> Back
      </button>

      <div style={{ fontSize: 11, letterSpacing: 2, color: C.rust, ...fMono, marginBottom: 12 }}>DOCUMENTATION</div>
      <h1 style={{ fontSize: 30, lineHeight: 1.15, margin: 0, color: C.text, ...fDisplay, fontWeight: 700 }}>
        Methods, equations and references
      </h1>
      <p style={{ marginTop: 14, fontSize: 14, lineHeight: 1.7, color: C.textDim, maxWidth: 720, ...fBody }}>
        Every calculation in SKAL Bench is listed here with the equation it evaluates, the measurements it
        needs and the published source it follows. Nothing is a black box: where a correlation carries fitted
        coefficients, the defaults are stated and the means of calibrating them to your own core data is
        described. The module entries below are generated from the same definitions the calculators use, so
        the equations and citations on this page are the ones actually being evaluated.
      </p>

      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 11, padding: 18, margin: "24px 0 34px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, ...fDisplay, marginBottom: 8 }}>How a test runs</div>
        <p style={{ fontSize: 12.5, lineHeight: 1.68, color: C.textDim, margin: 0, ...fBody }}>
          Pick a test from the home page. Each one lists the measurements it needs and offers a pre-formatted
          spreadsheet template. Enter one plug by hand or upload a batch, and the console returns the headline
          result, the supporting figure and the full computed table. Figures can be exported at publication
          resolution, and both the plotted points and the complete table can be exported as CSV. Sample-level
          fields such as plug length and fluid viscosity are entered once per plug; row fields are the
          measurements that vary within a run.
        </p>
      </div>

      {byCat.map(({ cat, mods }) => {
        const Icon = cat.icon;
        return (
          <DocSection key={cat.name} title={cat.name.toUpperCase()}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              {Icon && <Icon size={14} color={C.textFaint} />}
              <span style={{ fontSize: 12.5, color: C.textFaint, ...fBody }}>{cat.note}</span>
            </div>
            {mods.map((m) => <DocModule key={m.id} mod={m} extra={DOC_EXTRA[m.id]} />)}
          </DocSection>
        );
      })}

      <DocSection title="METHODS & CONVENTIONS">
        {DOC_METHODS.map((m, i) => (
          <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 11, padding: 18, marginBottom: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, ...fDisplay, marginBottom: 7 }}>{m.t}</div>
            <p style={{ fontSize: 12.5, lineHeight: 1.68, color: C.textDim, margin: 0, ...fBody }}>{m.b}</p>
            {m.r && (
              <div style={{ borderTop: `1px solid ${C.borderSoft}`, paddingTop: 9, marginTop: 10, fontSize: 11.5, lineHeight: 1.6, color: C.textFaint, ...fBody }}>{m.r}</div>
            )}
          </div>
        ))}
      </DocSection>

      <DocSection title="LIMITATIONS">
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 11, padding: 18 }}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {[
              `Empirical permeability transforms are only as good as their calibration. Treat any uncalibrated permeability from NMR or mercury injection as an order-of-magnitude estimate until it is anchored to measured core.`,
              `Fixed T2 and saturation cutoffs are regional conventions. The 33 ms sandstone and 92–100 ms carbonate values are Gulf of Mexico defaults and should be confirmed against core wherever possible.`,
              `The Timur–Coates model becomes unstable as bound water approaches zero, and is reported as not applicable in clean, near-irreducible rock rather than returning a spurious number.`,
              `The contact-angle tool is a manual tangent construction, so its accuracy depends on point placement; it is not automated drop-shape analysis.`,
              `Fits are ordinary least squares in the stated transform space unless a physical constraint is noted, and do not carry confidence intervals except in the dedicated uncertainty module.`,
              `Ambient plug measurements overstate reservoir permeability. Use the stress-dependence module where net confining stress matters.`,
            ].map((t, i) => (
              <li key={i} style={{ fontSize: 12.5, lineHeight: 1.68, color: C.textDim, marginBottom: 7, ...fBody }}>{t}</li>
            ))}
          </ul>
        </div>
      </DocSection>

      <DocSection title="CITATION & LICENCE">
        <CitationBlock />
      </DocSection>

      <DocSection title="STANDARDS">
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 11, padding: 18 }}>
          <p style={{ fontSize: 12.5, lineHeight: 1.68, color: C.textDim, margin: 0, ...fBody }}>
            Laboratory procedures follow the American Petroleum Institute&rsquo;s <i>Recommended Practices for
            Core Analysis</i> (API RP 40, 2nd edition, 1998), which remains the reference standard for routine
            and special core analysis. Uncertainty is expressed following JCGM 100:2008 (GUM). Individual
            module citations are listed with each entry above.
          </p>
        </div>
      </DocSection>

      <div style={{ fontSize: 11.5, color: C.textFaint, lineHeight: 1.65, marginTop: 26, marginBottom: 10, maxWidth: 760, ...fBody }}>
        Results are engineering estimates that depend on your input data and local calibration. Confirm
        important values against your core measurements before relying on them.
      </div>
    </div>
  );
}

/* ============================== ABOUT / ACKNOWLEDGEMENTS / CONTACT ==============================
 * One page, four anchored sections. The footer links set the target section and the page scrolls to
 * it on mount, so each link feels like its own destination while the text reads as one continuous
 * piece. Section ids are stable so the links keep working if the order ever changes. */
const ABOUT_SECTIONS = [
  { id: "about-me", label: "About" },
  { id: "acknowledgements", label: "Acknowledgements" },
  { id: "why", label: "Why this tool exists" },
  { id: "contact", label: "Contact" },
];

/* ============================== NAVIGATION DRAWER ==============================
 * The hamburger opens a left drawer holding the three top-level destinations (Tests, Calculator,
 * Converter), a full tree of every module grouped by category, and the theme switch. Hub modules
 * are marked so it is clear they open a sub-menu rather than a calculator. */
function NavDrawer({ open, onClose, view, onNavigate, theme, onToggleTheme }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";      // stop the page scrolling behind the drawer
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  const go = (v) => { onNavigate(v); onClose(); };
  const TOP = [
    { v: "home", label: "Tests", icon: FlaskConical, color: C.rust },
    { v: "calculator", label: "Calculator", icon: CalcIcon, color: C.amber },
    { v: "converter", label: "Converter", icon: Scale, color: C.teal },
  ];
  const groups = CATEGORIES
    .map((cat) => ({ cat, mods: MODULES.filter((m) => m.category === cat.name) }))
    .filter((g) => g.mods.length);

  return (
    <>
      <div onClick={onClose} aria-hidden="true"
        style={{ position: "fixed", inset: 0, background: C.overlay, zIndex: 40 }} />
      <aside role="dialog" aria-label="Navigation"
        style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 320, maxWidth: "86vw", zIndex: 41,
          background: C.panel, borderRight: `1px solid ${C.border}`, overflowY: "auto", boxShadow: "0 0 40px rgba(0,0,0,0.35)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: `1px solid ${C.borderSoft}`, position: "sticky", top: 0, background: C.panel, zIndex: 1 }}>
          <SkalMark size={22} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text, letterSpacing: 0.3, ...fDisplay }}>SKAL BENCH</span>
          <button onClick={onClose} aria-label="Close menu"
            style={{ marginLeft: "auto", background: "none", border: "none", color: C.textFaint, cursor: "pointer", padding: 4, display: "flex" }}>
            <CloseIcon size={17} />
          </button>
        </div>

        <div style={{ padding: "14px 12px 8px" }}>
          {TOP.map((t) => {
            const Ico = t.icon;
            const active = view === t.v;
            return (
              <button key={t.v} onClick={() => go(t.v)}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                  border: "none", borderRadius: 8, padding: "10px 12px", marginBottom: 3, cursor: "pointer",
                  background: active ? C.panel2 : "transparent", color: active ? C.text : C.textDim,
                  fontSize: 13.5, fontWeight: 600, ...fBody }}>
                <Ico size={15} color={t.color} /> {t.label}
              </button>
            );
          })}
        </div>

        <div style={{ padding: "8px 12px 4px", borderTop: `1px solid ${C.borderSoft}`, marginTop: 6 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.4, color: C.textFaint, ...fMono, padding: "10px 12px 6px" }}>ALL MODULES</div>
          {groups.map(({ cat, mods }) => (
            <div key={cat.name} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: C.textDim, padding: "6px 12px 4px", ...fBody }}>{cat.name}</div>
              {mods.map((m) => {
                const active = view === m.id;
                const isHub = typeof m.special === "string" && m.special.includes("hub");
                return (
                  <button key={m.id} onClick={() => go(m.id)} title={m.short || m.name}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
                      border: "none", borderLeft: `2px solid ${active ? m.color : "transparent"}`,
                      borderRadius: "0 6px 6px 0", padding: "7px 12px", cursor: "pointer",
                      background: active ? C.bgSoft : "transparent", color: active ? C.text : C.textDim,
                      fontSize: 12.5, lineHeight: 1.35, ...fBody }}>
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: m.color, flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{m.name}</span>
                    {isHub && <ChevronRight size={12} color={C.textFaint} />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{ padding: "12px 18px 26px", borderTop: `1px solid ${C.borderSoft}` }}>
          <button onClick={onToggleTheme}
            style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", border: `1px solid ${C.border}`,
              borderRadius: 8, padding: "10px 12px", cursor: "pointer", background: C.bgSoft, color: C.textDim,
              fontSize: 12.5, fontWeight: 600, ...fBody }}>
            {theme === "dark" ? <Sun size={15} color={C.amber} /> : <Moon size={15} color={C.blue} />}
            {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          </button>
        </div>
      </aside>
    </>
  );
}

/* ---------- Brand marks for profile links ----------
 * Drawn as inline SVG because the app's icon set (lucide) carries no brand logos, and because an
 * external icon CDN would be one more third-party dependency that can vanish. Each is reproduced
 * at its official colour and undistorted, used solely to link to the author's own profile on that
 * platform — the ordinary, permitted use under those companies' brand guidelines. */
function LinkedInMark({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#0A66C2" role="img" aria-label="LinkedIn" style={{ flexShrink: 0 }}>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}
function ResearchGateMark({ size = 15 }) {
  /* The RG monogram on its teal ground: a full-height R with the G set small and raised, as the
   * mark appears as a favicon/app icon. Set as text rather than traced letterform paths — at 15 px
   * a hand-traced glyph is where inaccuracy hides, and a bold sans-serif stack renders predictably. */
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="ResearchGate" style={{ flexShrink: 0 }}>
      <rect width="24" height="24" rx="4" fill="#00CCBB" />
      <text x="7.6" y="16.8" fontFamily="Helvetica, Arial, sans-serif" fontSize="14" fontWeight="700" fill="#FFFFFF" textAnchor="middle">R</text>
      <text x="16.2" y="11.2" fontFamily="Helvetica, Arial, sans-serif" fontSize="9" fontWeight="700" fill="#FFFFFF" textAnchor="middle">G</text>
    </svg>
  );
}

function ScholarMark({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Google Scholar" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M12 24a7 7 0 1 1 0-14 7 7 0 0 1 0 14z" />
      <path fill="#A0C3FF" d="M12 10a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z" opacity=".85" />
      <path fill="#356AC3" d="M12 0L0 9.5l4.8 3.8L12 7.6l7.2 5.7L24 9.5z" />
    </svg>
  );
}
function MailMark({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.rust} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Email" style={{ flexShrink: 0 }}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 6 10-6" />
    </svg>
  );
}

/* Profile links. Defined once and rendered in the About section; the contact section keeps only
 * the email, so "where to read my work" and "how to reach me" stay separate. */
const PROFILE_LINKS = [
  { href: "https://www.linkedin.com/in/sohaib-kholosy", label: "LinkedIn", Mark: LinkedInMark },
  { href: "https://www.researchgate.net/profile/Sohaib-Kholosy-2", label: "ResearchGate", Mark: ResearchGateMark },
  { href: "https://scholar.google.com/citations?user=zW-8hgsAAAAJ&hl=en", label: "Google Scholar", Mark: ScholarMark },
];
const aboutCardStyle = () => ({
  display: "inline-flex", alignItems: "center", gap: 9, background: C.bgSoft,
  border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px",
  color: C.text, fontSize: 13, textDecoration: "none", ...fBody,
});

function AboutH({ id, children }) {
  return (
    <h2 id={id} style={{ fontSize: 20, fontWeight: 700, color: C.text, ...fDisplay, margin: "0 0 14px", scrollMarginTop: 90 }}>
      {children}
    </h2>
  );
}
function AboutP({ children, dim }) {
  return (
    <p style={{ fontSize: 14, lineHeight: 1.78, color: dim ? C.textFaint : C.textDim, margin: "0 0 14px", ...fBody }}>
      {children}
    </p>
  );
}
function AboutBlock({ children }) {
  return (
    <section style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px 26px", marginBottom: 20 }}>
      {children}
    </section>
  );
}

function AboutScreen({ onBack, section }) {
  useEffect(() => {
    if (!section) return;
    const el = document.getElementById(section);
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [section]);

  const expertise = [
    ["Core analysis", "SCAL and routine core analysis, coreflood experiments and interpretation, relative permeability"],
    ["Recovery and damage", "EOR/IOR studies, formation damage"],
    ["Fluids and surfaces", "wettability and contact angle, surface and interfacial tension, petroleum-fluid characterisation, SARA"],
    ["Instrumentation", "low-field NMR, SEM, AFM and profilometry, GC/MS"],
    ["Laboratory practice", "experimental design, QA/QC, calibration, SOP development, equipment maintenance and troubleshooting"],
  ];

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "26px 24px 10px" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", color: C.textFaint, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 26, ...fBody }}>
        <ArrowLeft size={15} /> Back
      </button>

      <div style={{ textAlign: "center", padding: "6px 0 30px", borderBottom: `1px solid ${C.borderSoft}`, marginBottom: 30 }}>
        <div style={{ fontSize: 13.5, color: C.rust, letterSpacing: 0.3, fontStyle: "italic", ...fBody }}>
          In the name of Allah, the Most Gracious, the Most Merciful
        </div>
      </div>

      {/* ---------- ABOUT ---------- */}
      <AboutBlock>
        <AboutH id="about-me">About the developer</AboutH>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.text, ...fDisplay }}>Sohaib Kholosy</div>
          <div style={{ fontSize: 12.5, color: C.rust, marginTop: 3, ...fMono }}>
            Principal Research Technician — Special Core Analysis
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            {PROFILE_LINKS.map(({ href, label, Mark }) => (
              <a key={href} href={href} target="_blank" rel="noopener noreferrer" style={aboutCardStyle()}>
                <Mark /> {label}
              </a>
            ))}
          </div>
        </div>
        <AboutP>
          I&rsquo;ve spent more than 15 years in petroleum research laboratories, most of it on Special Core
          Analysis at the Kuwait Institute for Scientific Research (KISR), Petroleum Research Center. I started
          out as a laboratory technician and worked up to Principal Research Technician, which means most of
          what I know came from the bench rather than from a manual — running the experiments, fixing the rig
          when it stopped behaving, and working out why a number didn&rsquo;t look right.
        </AboutP>
        <AboutP>That work has spanned:</AboutP>
        <ul style={{ margin: "0 0 14px", paddingLeft: 18 }}>
          {expertise.map(([k, v]) => (
            <li key={k} style={{ fontSize: 13.5, lineHeight: 1.7, color: C.textDim, marginBottom: 6, ...fBody }}>
              <span style={{ color: C.text, fontWeight: 600 }}>{k}</span> — {v}
            </li>
          ))}
        </ul>
        <AboutP>
          Alongside the analysis itself, a lot of my time goes to the work that makes results trustworthy in
          the first place: calibrating properly, documenting procedures, and helping researchers get numbers
          they can defend.
        </AboutP>
      </AboutBlock>

      {/* ---------- ACKNOWLEDGEMENTS ---------- */}
      <AboutBlock>
        <AboutH id="acknowledgements">Acknowledgements</AboutH>
        <AboutP>All praise is due to Allah, by whose favour this work was made possible.</AboutP>
        <AboutP>No career is built alone.</AboutP>
        <AboutP>
          Whatever I know has been shaped by people who shared their knowledge, gave me opportunities, and
          trusted me with responsibility. Some taught me technical skills, some taught me how to troubleshoot,
          some taught me how to think about experimental results — and some showed me things no textbook could.
        </AboutP>
        <AboutP>
          My deepest thanks go to <span style={{ color: C.text, fontWeight: 600 }}>Dr. Mohammad A. Jumaa</span>,
          whose guidance and mentorship shaped the foundation of my work in this field.
        </AboutP>
        <AboutP>I am also grateful to:</AboutP>
        <ul style={{ margin: "0 0 14px", paddingLeft: 18 }}>
          {["Dr. Waleed Al-Bazzaz", "Dr. Salim Ok", "Mr.Abdullah AL-Bloushi", "Dr. Adel Al-Otaibi", "Dr. Abdulaziz Al-Makimi"].map((n) => (
            <li key={n} style={{ fontSize: 13.5, lineHeight: 1.8, color: C.text, ...fBody }}>{n}</li>
          ))}
        </ul>
        <AboutP>
          And to the researchers at the Petroleum Research Center, whose questions and standards shaped how I
          approach laboratory work.
        </AboutP>
        <AboutP>
          <span style={{ color: C.text, fontWeight: 600 }}>To my colleagues.</span> Laboratory work is a team
          effort. Every successful experiment involves people who prepare samples, operate equipment, monitor
          conditions, troubleshoot problems, analyse results, document procedures, and support one another when
          things don&rsquo;t go to plan. To everyone who has worked beside me — including the many I
          haven&rsquo;t named here — thank you for the knowledge you shared, the problems we solved together,
          and the experience that became part of my professional education.
        </AboutP>
      </AboutBlock>

      {/* ---------- WHY ---------- */}
      <AboutBlock>
        <AboutH id="why">Why this tool exists</AboutH>
        <AboutP>That practical perspective has shaped the way I approach SCAL.</AboutP>
        <AboutP>
          A great deal of laboratory knowledge is never written down. It lives in notebooks, in spreadsheets
          built by one person for one purpose, in procedures passed on by demonstration, and in the memory of
          experienced technicians and researchers. When those people move on, much of it goes with them.
        </AboutP>
        <AboutP>SKAL Bench started as an attempt to put some of that in one place.</AboutP>
        <AboutP>
          Alongside it there is the everyday work: the calculations, the unit conversions, the checking and
          re-checking, the same problems solved again in one laboratory after another. Each task is simple on
          its own. Together they consume real time and create room for error.
        </AboutP>
        <AboutP>
          So the tool does two things at once. It handles the routine calculation and plotting so you can get
          on with the experiment. And it shows its working — every equation, every coefficient, and the
          published source behind it — so that using it teaches you something rather than just returning a
          number.
        </AboutP>
        <AboutP>
          It is built for the people who do this work: laboratory technicians and operators, researchers,
          engineers, and students meeting these methods for the first time.
        </AboutP>
        <AboutP>
          If it helps a student understand where a calculation comes from, helps a technician troubleshoot a
          measurement that looks wrong, helps a researcher check a result, or simply saves someone an hour,
          then the experience behind it has served its purpose.
        </AboutP>
        <AboutP>
          The intention is not to claim ownership of knowledge. It is to preserve it, organise it, improve it,
          and pass it forward — what I know today was once knowledge someone else decided to share with me.
        </AboutP>
      </AboutBlock>

      {/* ---------- CONTACT ---------- */}
      <AboutBlock>
        <AboutH id="contact">Contact &amp; feedback</AboutH>
        <AboutP>
          If you have a question, a suggestion, or something to report, I&rsquo;d be glad to hear from you.
          That includes bugs and unexpected results, corrections to an equation or a reference, ideas for
          modules that would be useful in your own laboratory, or simply a question about how something works.
          Email is the best way to reach me and I&rsquo;ll reply as soon as I can.
        </AboutP>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "18px 0" }}>
          <a href="mailto:skalbench@gmail.com" style={aboutCardStyle()}>
            <MailMark /> skalbench@gmail.com
          </a>
        </div>
        <div style={{ background: C.bgSoft, border: `1px solid ${C.borderSoft}`, borderRadius: 9, padding: "14px 16px", marginTop: 6 }}>
          <div style={{ fontSize: 10.5, letterSpacing: 1.2, color: C.textFaint, ...fMono, marginBottom: 8 }}>REPORTING A PROBLEM</div>
          <p style={{ fontSize: 12.5, lineHeight: 1.7, color: C.textDim, margin: "0 0 10px", ...fBody }}>
            <span style={{ color: C.text, fontWeight: 600 }}>If the app shows an error screen</span>, it will
            display a reference code such as <span style={{ color: C.rust, ...fMono }}>SKB-4F2A9C</span>, along
            with an <i>Email this report</i> button that fills in everything needed. Sending that is the fastest
            route to a fix — the same fault always produces the same code, so it can be traced directly.
          </p>
          <p style={{ fontSize: 12.5, lineHeight: 1.7, color: C.textDim, margin: "0 0 8px", ...fBody }}>
            <span style={{ color: C.text, fontWeight: 600 }}>If a result simply looks wrong</span> rather than
            the app failing, there is no code to quote, so please include:
          </p>
          <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
            {[
              "Which test you were running, and the version number shown at the foot of the page",
              "The values you entered — or the spreadsheet you uploaded, if you are able to share it",
              "The result you received, and the result you expected",
            ].map((t, i) => (
              <li key={i} style={{ fontSize: 12.5, lineHeight: 1.65, color: C.textDim, marginBottom: 4, ...fBody }}>{t}</li>
            ))}
          </ul>
          <p style={{ fontSize: 11.5, lineHeight: 1.65, color: C.textFaint, margin: 0, ...fBody }}>
            Nothing you enter is transmitted anywhere — the calculations run entirely in your browser — so a
            report only contains what you choose to include.
          </p>
        </div>
      </AboutBlock>
    </div>
  );
}

/* ============================== HOW TO USE ==============================
 * A capabilities overview and first-run guide. Deliberately separate from the documentation: this
 * answers "what can it do and how do I drive it", while the documentation answers "what equation
 * is it evaluating and on whose authority". Counts are derived from the module table so they
 * cannot fall out of step. */
function HowToScreen({ onBack, onOpenDocs }) {
  const steps = [
    ["Choose a test", "Open the menu at the top left, or pick from the categories on the home page. Each test states what it measures and what it needs before you enter anything."],
    ["Enter your measurements", "Type a single plug directly, or download the ready-made spreadsheet, fill it in and upload it to process a batch at once. Every field states its expected unit."],
    ["Read the result", "The headline value appears with its supporting figure and the full computed table, including the intermediate quantities, not only the final number."],
    ["Take it away", "Export the figure at publication resolution, the plotted points as CSV, or the complete results table as CSV."],
  ];
  const groups = CATEGORIES
    .map((cat) => ({ cat, mods: MODULES.filter((m) => m.category === cat.name && !(typeof m.special === "string" && m.special.includes("hub"))) }))
    .filter((g) => g.mods.length);
  const features = [
    ["Batch processing", "Upload a spreadsheet of plugs and every one is processed in a single pass, with a template provided for each test so the column layout is never in doubt."],
    ["Figures you can shape", "Every chart has a Modify panel: title or sample name, axis labels, axis limits, gridlines, and a choice of trend line — none, the module's own, or a linear, power or exponential fit with its equation and R². Changes preview live and carry into the exported image."],
    ["Two kinds of export", "Plotted points (CSV) gives the points on the chart. Full results (CSV) gives every computed column, including those the figure does not show. Figures export separately at publication resolution."],
    ["Curve smoothing", "Savitzky–Golay smoothing at three strengths, applied to the drawing only — reported values and fits always come from the raw data, and the exported filename records that smoothing was applied."],
    ["Calibration to your own core", "Where a correlation carries fitted coefficients — the SDR permeability constant, the NMR T2 cutoff — you can anchor it to a measured permeability or irreducible saturation instead of accepting a regional default."],
    ["Every equation shown", "Each module states the equation it evaluates and the published source it follows, at the point of use as well as in the documentation."],
    ["Unit conversion throughout", "Axis units and input units convert through one engine, so pressures can be read in psi, atm, bar, kPa or MPa and throat sizes in µm, nm or inches without re-entering anything."],
    ["Works offline, keeps your data", "Every calculation runs in your browser. Nothing you enter is uploaded, and no account is required."],
  ];
  const card = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 11, padding: 18, marginBottom: 14 };
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "26px 24px 10px" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", color: C.textFaint, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 24, ...fBody }}>
        <ArrowLeft size={15} /> Back
      </button>
      <div style={{ fontSize: 11, letterSpacing: 2, color: C.rust, ...fMono, marginBottom: 12 }}>HOW TO USE</div>
      <h1 style={{ fontSize: 29, lineHeight: 1.15, margin: "0 0 16px", color: C.text, ...fDisplay, fontWeight: 700 }}>
        What SKAL Bench does, and how to drive it
      </h1>
      <p style={{ fontSize: 14, lineHeight: 1.72, color: C.textDim, maxWidth: 720, margin: "0 0 30px", ...fBody }}>
        {TEST_COUNT} tests spanning routine and special core analysis, from gas and liquid permeability
        through capillary pressure, relative permeability, wettability, electrical properties and NMR.
        Enter measurements, get the result with its figure — and the equation and source behind it.
      </p>

      <div style={{ fontSize: 11, letterSpacing: 1.5, color: C.rust, ...fMono, marginBottom: 12 }}>GETTING STARTED</div>
      {steps.map(([t, d], i) => (
        <div key={t} style={{ ...card, display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{ width: 26, height: 26, borderRadius: 13, background: C.rustSoft, color: C.rust, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 700, flexShrink: 0, ...fMono }}>{i + 1}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, ...fDisplay, marginBottom: 4 }}>{t}</div>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: C.textDim, ...fBody }}>{d}</div>
          </div>
        </div>
      ))}

      <div style={{ fontSize: 11, letterSpacing: 1.5, color: C.rust, ...fMono, margin: "30px 0 12px" }}>WHAT IS INCLUDED</div>
      {groups.map(({ cat, mods }) => {
        const Icon = cat.icon;
        return (
          <div key={cat.name} style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
              {Icon && <Icon size={15} color={C.textFaint} />}
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text, ...fDisplay }}>{cat.name}</span>
              <span style={{ fontSize: 11, color: C.textFaint, ...fMono }}>{mods.length} test{mods.length === 1 ? "" : "s"}</span>
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.7, color: C.textDim, ...fBody }}>
              {mods.map((m) => m.name).join(" · ")}
            </div>
          </div>
        );
      })}

      <div style={{ fontSize: 11, letterSpacing: 1.5, color: C.rust, ...fMono, margin: "30px 0 12px" }}>CAPABILITIES</div>
      {features.map(([t, d]) => (
        <div key={t} style={card}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, ...fDisplay, marginBottom: 5 }}>{t}</div>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: C.textDim, ...fBody }}>{d}</div>
        </div>
      ))}

      <div style={{ fontSize: 11, letterSpacing: 1.5, color: C.rust, ...fMono, margin: "30px 0 12px" }}>GETTING MORE DETAIL</div>
      <div style={{ ...card, marginBottom: 30 }}>
        <p style={{ fontSize: 13, lineHeight: 1.72, color: C.textDim, margin: "0 0 12px", ...fBody }}>
          This page covers what the software does. For the equation each test evaluates, the measurements it
          requires and the published source it follows, see the documentation — it is generated from the same
          definitions the calculators use, so it cannot drift out of step with the code.
        </p>
        <Button variant="outline" icon={FileText} onClick={onOpenDocs}>Open the documentation</Button>
      </div>
    </div>
  );
}

function AppFooter({ onOpenDocs, onOpenAbout, onOpenCite, onOpenHowTo }) {
  const linkStyle = { background: "none", border: "none", padding: 0, color: C.textDim, fontSize: 12.5, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3, ...fBody };
  return (
    <footer style={{ borderTop: `1px solid ${C.borderSoft}`, padding: "26px 24px 46px", maxWidth: 1100, margin: "40px auto 0" }}>
      {(onOpenDocs || onOpenAbout || onOpenCite || onOpenHowTo) && (
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 16 }}>
          {onOpenHowTo && <button onClick={onOpenHowTo} style={linkStyle}>How to use</button>}
          {onOpenDocs && <button onClick={onOpenDocs} style={linkStyle}>Documentation</button>}
          {onOpenCite && <button onClick={onOpenCite} style={linkStyle}>How to cite</button>}
          {onOpenAbout && ABOUT_SECTIONS.map((sec) => (
            <button key={sec.id} onClick={() => onOpenAbout(sec.id)} style={linkStyle}>{sec.label}</button>
          ))}
        </div>
      )}
      <div style={{ fontSize: 12, color: C.textDim, letterSpacing: 0.2, ...fBody }}>
        © {new Date().getFullYear()} SKAL Bench · Routine &amp; Special Core Analysis. All rights reserved.
      </div>
      <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 6, ...fMono }}>
        Version {APP_VERSION} · {APP_RELEASED} · MIT licence
      </div>
      <p style={{ fontSize: 11, color: C.textFaint, lineHeight: 1.65, marginTop: 10, maxWidth: 840, ...fBody }}>
        Built on established, peer-reviewed petrophysical methods, with every equation and reference shown so you can
        check the work. Results are engineering estimates that depend on your input data and local calibration —
        please confirm important values against your core measurements before relying on them. Provided as is,
        without warranty.
      </p>
    </footer>
  );
}

/* ============================== ERROR BOUNDARY ==============================
 * Without this, a render error unmounts the whole tree and the user is left with a blank page and
 * nothing to report. This catches the failure, keeps the app usable, and — most importantly —
 * produces a short reference code plus a filled-in report the user can send in one action.
 *
 * The code is a deterministic hash of the error message and the first stack frame, so the same
 * fault always yields the same code. That makes duplicate reports recognisable at a glance and
 * lets a fix be tied to a specific code. It carries no personal data: only the module in use, the
 * app version, and the error text itself. */
function errorCode(message, frame) {
  const basis = `${message || ""}|${frame || ""}`;
  let h = 5381;
  for (let i = 0; i < basis.length; i++) h = ((h << 5) + h + basis.charCodeAt(i)) >>> 0;
  return `SKB-${h.toString(36).toUpperCase().padStart(6, "0").slice(-6)}`;
}
const firstFrame = (stack) => {
  if (!stack) return "";
  const lines = String(stack).split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.find((l) => l.startsWith("at ")) || lines[1] || "";
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null, copied: false };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    this.setState({ info });
    // Also log it, so anyone who opens the browser console sees the full stack.
    console.error("SKAL Bench error", errorCode(error && error.message, firstFrame(error && error.stack)), error, info);
  }
  report() {
    const { error, info } = this.state;
    const frame = firstFrame(error && error.stack);
    const code = errorCode(error && error.message, frame);
    const compLine = (info && info.componentStack ? String(info.componentStack).trim().split("\n")[0] || "" : "").trim();
    return [
      `Reference code: ${code}`,
      `Version: ${APP_VERSION} (${APP_RELEASED})`,
      `Where: ${this.props.where || "unknown"}`,
      `When: ${new Date().toISOString()}`,
      `Error: ${(error && error.message) || "unknown"}`,
      `At: ${frame || "n/a"}`,
      `Component: ${compLine || "n/a"}`,
      "",
      "What I was doing when this happened:",
      "(please describe briefly — which module, what values you entered)",
    ].join("\n");
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const code = errorCode(error.message, firstFrame(error.stack));
    const body = this.report();
    const mailto = `mailto:skalbench@gmail.com?subject=${encodeURIComponent(`SKAL Bench issue ${code}`)}&body=${encodeURIComponent(body + "\n")}`;
    const btn = { display: "inline-flex", alignItems: "center", gap: 7, border: `1px solid ${C.border}`, borderRadius: 7, padding: "9px 14px", fontSize: 13, cursor: "pointer", background: C.bgSoft, color: C.text, textDecoration: "none", ...fBody };
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ background: C.panel, border: `1px solid ${C.danger}55`, borderRadius: 12, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
            <AlertCircle size={18} color={C.danger} />
            <span style={{ fontSize: 17, fontWeight: 700, color: C.text, ...fDisplay }}>Something went wrong here</span>
          </div>
          <p style={{ fontSize: 13.5, lineHeight: 1.7, color: C.textDim, margin: "0 0 16px", ...fBody }}>
            This part of the app stopped rather than showing a result that might be wrong. Nothing you entered
            has been sent anywhere. You can go back and carry on using the rest of the app — and if you send the
            report below, the fault can be found and fixed.
          </p>

          <div style={{ background: C.bgSoft, border: `1px solid ${C.borderSoft}`, borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.2, color: C.textFaint, ...fMono, marginBottom: 4 }}>REFERENCE CODE</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: C.rust, letterSpacing: 1, ...fMono }}>{code}</div>
            <div style={{ fontSize: 11, color: C.textFaint, marginTop: 6, ...fBody }}>
              Quote this code when reporting. The same fault always produces the same code.
            </div>
          </div>

          <details style={{ marginBottom: 16 }}>
            <summary style={{ fontSize: 12, color: C.textDim, cursor: "pointer", ...fBody }}>Show the technical details</summary>
            <pre style={{ fontSize: 11, lineHeight: 1.6, color: C.textFaint, background: C.bgSoft, border: `1px solid ${C.borderSoft}`, borderRadius: 7, padding: "10px 12px", marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-word", ...fMono }}>{body}</pre>
          </details>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href={mailto} style={{ ...btn, borderColor: C.rust, color: C.rust }}>
              <FileText size={14} /> Email this report
            </a>
            <button onClick={() => {
              try { navigator.clipboard.writeText(body); this.setState({ copied: true }); setTimeout(() => this.setState({ copied: false }), 2000); } catch (e) { /* clipboard unavailable */ }
            }} style={btn}>
              <Copy size={14} /> {this.state.copied ? "Copied" : "Copy report"}
            </button>
            <button onClick={() => { this.setState({ error: null, info: null }); if (this.props.onReset) this.props.onReset(); }} style={btn}>
              <RotateCcw size={14} /> Back to tests
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default function App() {
  const [view, setView] = useState("home");
  const [aboutSection, setAboutSection] = useState(null);
  const [theme, setTheme] = useState("dark");
  const [navOpen, setNavOpen] = useState(false);
  /* applyTheme rewrites the shared C palette in place, then the state bump re-renders the whole
     tree so every inline style recomputes. There are no memo boundaries below App, so this reaches
     every component. Theme is not persisted between sessions. */
  const toggleTheme = () => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  };
  useEffect(() => {
    document.body.style.background = C.bg;
    const m = document.head.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", C.bg);
  }, [theme]);

  useEffect(() => {
    const put = (sel, tag, attrs) => {
      let el = document.head.querySelector(sel);
      const isNew = !el;
      if (isNew) el = document.createElement(tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      if (isNew) document.head.appendChild(el);
      return el;
    };
    put('link[rel="apple-touch-icon"]', "link", { rel: "apple-touch-icon", sizes: "180x180", href: APP_ICON_180 });
    put('link[rel="icon"][sizes="32x32"]', "link", { rel: "icon", type: "image/png", sizes: "32x32", href: APP_FAVICON_32 });
    put('meta[name="theme-color"]', "meta", { name: "theme-color", content: "#1b1b1e" });
    put('meta[name="apple-mobile-web-app-capable"]', "meta", { name: "apple-mobile-web-app-capable", content: "yes" });
    put('meta[name="mobile-web-app-capable"]', "meta", { name: "mobile-web-app-capable", content: "yes" });
    put('meta[name="apple-mobile-web-app-title"]', "meta", { name: "apple-mobile-web-app-title", content: "SKAL Bench" });
    put('meta[name="apple-mobile-web-app-status-bar-style"]', "meta", { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" });
    if (!document.title) document.title = "SKAL Bench — Routine & Special Core Analysis";
    const manifest = {
      name: "SKAL Bench — Routine & Special Core Analysis", short_name: "SKAL Bench",
      start_url: ".", scope: ".", display: "standalone",
      background_color: "#1b1b1e", theme_color: "#1b1b1e",
      icons: [
        { src: APP_ICON_192, sizes: "192x192", type: "image/jpeg", purpose: "any" },
        { src: APP_ICON_512, sizes: "512x512", type: "image/jpeg", purpose: "maskable" },
      ],
    };
    const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
    put('link[rel="manifest"]', "link", { rel: "manifest", href: URL.createObjectURL(blob) });
  }, []);

  const mod = MODULES.find((m) => m.id === view);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, ...fBody }}>
      <style>{FONTS}{`
        * { box-sizing: border-box; }
        input:focus { border-color: ${C.rust} !important; }
        input::placeholder { color: ${C.textFaint}; opacity: 1; font-style: italic; }
        select, input, textarea { color-scheme: ${theme}; }
        ::-webkit-scrollbar { height: 8px; width: 8px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
        @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
      `}</style>

      <div style={{ borderBottom: `1px solid ${C.borderSoft}`, position: "sticky", top: 0, background: C.headerBg, backdropFilter: "blur(6px)", zIndex: 10 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setNavOpen(true)} aria-label="Open menu" aria-expanded={navOpen}
            style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", padding: 4, display: "flex", alignItems: "center", marginRight: 2 }}>
            <Menu size={19} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setView("home")}>
            <SkalMark size={24} />
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.4, color: C.text, ...fDisplay }}>SKAL BENCH</span>
            <span style={{ fontSize: 11, color: C.textFaint, ...fMono }}>RCAL + SCAL</span>
          </div>
          <button onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            style={{ marginLeft: "auto", background: "none", border: `1px solid ${C.border}`, borderRadius: 7,
              color: C.textDim, cursor: "pointer", padding: "6px 9px", display: "flex", alignItems: "center" }}>
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>

      <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} view={view}
        onNavigate={setView} theme={theme} onToggleTheme={toggleTheme} />

      <ErrorBoundary where={view} onReset={() => setView("home")} key={view}>
      {view === "home" ? (
        <Home onOpen={setView} onOpenCalculator={() => setView("calculator")} onOpenConverter={() => setView("converter")} />
      ) : view === "about" ? (
        <AboutScreen onBack={() => setView("home")} section={aboutSection} />
      ) : view === "howto" ? (
        <HowToScreen onBack={() => setView("home")} onOpenDocs={() => setView("docs")} />
      ) : view === "cite" ? (
        <CiteScreen onBack={() => setView("home")} />
      ) : view === "docs" ? (
        <DocsScreen onBack={() => setView("home")} />
      ) : view === "calculator" ? (
        <CalculatorScreen onBack={() => setView("home")} />
      ) : view === "converter" ? (
        <ConverterScreen onBack={() => setView("home")} />
      ) : mod?.special === "correlation" ? (
        <CorrelationBuilder mod={mod} onBack={() => setView("home")} />
      ) : mod?.special === "relperm-hub" ? (
        <RelPermHub onOpen={setView} onBack={() => setView("home")} />
      ) : mod?.special === "corey" ? (
        <CoreyScreen mod={mod} onBack={() => setView("relPermHub")} />
      ) : mod?.special === "contactAngle" ? (
        <ContactAngleScreen mod={mod} onBack={() => setView("home")} />
      ) : mod?.special === "capillary-hub" ? (
        <CapillaryHub onOpen={setView} onBack={() => setView("home")} />
      ) : mod?.special === "micpIntrusion" ? (
        <MICPIntrusion mod={mod} onBack={() => setView("capillaryHub")} />
      ) : mod?.special === "penetrometerSelector" ? (
        <PenetrometerSelector mod={mod} onBack={() => setView("capillaryHub")} />
      ) : mod?.special === "nmr" ? (
        <NmrScreen mod={mod} onBack={() => setView("home")} />
      ) : (
        <ModuleScreen
          mod={mod}
          onBack={() => setView(["relPermSteady", "relPermJBN"].includes(view) ? "relPermHub" : "home")}
        />
      )}
      </ErrorBoundary>
      <AppFooter onOpenDocs={() => setView("docs")} onOpenAbout={(sec) => { setAboutSection(sec); setView("about"); }} onOpenCite={() => setView("cite")} onOpenHowTo={() => setView("howto")} />
    </div>
  );
}
