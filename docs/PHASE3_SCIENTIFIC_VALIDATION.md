# Phase 3 — Scientific Validation Expansion

**Branch:** `phase3/scientific-validation`  
**Baseline:** `main` at `b9f83a74fce14394aa257f6e5fb03029d0fee07c`  
**Status:** in progress  
**Change-control rule:** no production scientific calculation is changed without authoritative evidence, an independent reproducible validation case, and a regression test.

## Validation register

| Module | Phase 2 | Phase 3 | Current convention / evidence | Reference verification | Regression test | Production code changed | Remaining uncertainty |
|---|---|---|---|---|---|---|---|
| Centrifuge capillary pressure | REVIEW REQUIRED | REVIEW REQUIRED | The implemented inlet pressure is `Pc1 = ½ Δρ ω² (r2² − r1²)`; units are dimensionally consistent after converting g/cm³ to kg/m³ and cm² to m², then Pa to psi. The implemented Hassler–Brunner approximation is `S1 = Sbar + Pc1 dSbar/dPc1`. | Partial: AIME confirms Hassler & Brunner title/authors; Wiley confirms HB is an approximate interpretation; exact source-backed benchmark for the direct inversion is still required. | No | No | The regularized direct inversion, its fixed `LAMBDA = 0.05`, monotonicity projection, and the 0.85 selection threshold need independent numerical validation. |
| JBN relative permeability | REVIEW REQUIRED | Pending | Production implementation uses fractional-flow derivatives, optional Savitzky–Golay smoothing, and a saturation transformation. | Pending | No | No | Needs published or independently derived numerical benchmark. |
| Waxman–Smits | REVIEW REQUIRED | Pending | Production implementation computes `F* = Ro (1/Rw + B Qv)`. | Pending | No | No | Need explicit dimensional validation of `B`, `Qv`, and conductivities. |
| MICP intrusion | REVIEW REQUIRED | Pending | Washburn pressure-to-throat conversion and reported radius/diameter convention. | Pending | No | No | Need authoritative constants and worked example. |
| NMR petrophysics | REVIEW REQUIRED | Pending | SDR/Timur–Coates correlations and configurable T2 cutoffs. | Pending | No | No | Need coefficient, porosity-unit, and cutoff validation. |
| Pulse decay | REVIEW REQUIRED | Pending | Log-linear differential-pressure decay and reservoir/system-compressibility expression. | Pending | Phase 1 analytic test | No | Need method-source convention check. |
| Brooks–Corey / Corey | REVIEW REQUIRED | Pending | Normalized saturation power-law fit. | Pending | No | No | Need synthetic round-trip and endpoint verification. |
| Formation-factor temperature correction | REVIEW REQUIRED | Pending | Archie fit with Arps temperature correction. | Pending | No | No | Need original-source constant and temperature-unit verification. |
| Stress-dependent permeability | REVIEW REQUIRED | Pending | Exponential stress sensitivity fit. | Pending | No | No | Need worked example; model remains empirical. |
| Winland r35 / FZI | REVIEW REQUIRED | Pending | Winland and Amaefule correlations. | Pending | No | No | Need coefficient/threshold verification. |
| Contact angle | REVIEW REQUIRED | Pending | Feature-level contact-angle convention. | Pending | No | No | Need source traceability and phase convention. |
| Penetrometer selection | REVIEW REQUIRED | Pending | Feature-level geometry/range selection. | Pending | No | No | Need authoritative selection thresholds. |
| Porosity–permeability correlation | REVIEW REQUIRED | Pending | Empirical correlation/regression. | Pending | No | No | Need extrapolation-limit validation. |

## Centrifuge capillary-pressure review

### Production method

The current code:

1. converts RPM to angular velocity with `ω = 2πN/60`;
2. evaluates inlet-face pressure as `Pc1 = ½ Δρ ω² (r2² − r1²)`;
3. reports psi after SI conversion;
4. calculates the Hassler–Brunner first approximation with a finite-difference derivative;
5. selects Hassler–Brunner at `r1/r2 ≥ 0.85`, otherwise a regularized direct inversion;
6. clamps recovered saturation to `[0,1]` and projects it non-increasing for drainage.

### Independent checks completed

- **Dimensional check — PASS.** `Δρ` is converted from g/cm³ to kg/m³, `r²` from cm² to m², and `ω²` has s⁻². The resulting unit is kg·m⁻¹·s⁻² (Pa); division by 6894.757293168 converts Pa to psi.
- **Pressure relationship — PASS.** The published centrifuge relationship is the same inlet-face expression implemented by SKAL Bench.
- **Hassler–Brunner convention — PASS, limited domain.** The implemented relation matches the short-core/far-from-axis approximation reported in the literature. It must not be interpreted as exact for long cores or low `r1/r2`.
- **Direct inversion — REVIEW REQUIRED.** The code’s piecewise-linear integral inversion is an implementation choice. Its regularization parameter, monotonicity projection, and branch-selection threshold have not yet been validated with a source-backed numerical dataset. No production behavior was changed.

### Sources checked

- Hassler, G. L. and Brunner, E., *Measurement of Capillary Pressures in Small Core Samples*, **Transactions of the AIME**, 160 (1945), 114–123. Title and authors verified against the AIME 1945 petroleum-technology library listing.
- Ayappa, K. G., Davis, H. T., and Gordon, J., *Capillary pressure: Centrifuge method revisited*, **AIChE Journal** (1989), DOI: [10.1002/aic.690350304](https://doi.org/10.1002/aic.690350304). Publisher record confirms that Hassler–Brunner is an approximate data-reduction method.
- Forbes, P. L., *Simple and accurate methods for converting centrifuge data into drainage and imbibition capillary pressure curves*, **The Log Analyst**, 35 (1994), 31–53. Bibliographic details are present in later peer-reviewed centrifuge-method literature; direct primary-record verification remains pending.

## Phase 3 changes to date

- Added this validation register and the centrifuge evidence record.
- **No scientific calculation outputs changed during Phase 3.**
