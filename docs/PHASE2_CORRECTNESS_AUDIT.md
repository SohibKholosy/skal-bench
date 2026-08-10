# Phase 2 Scientific Correctness Audit

**Branch:** `phase2/correctness-audit`  
**Baseline:** `main` at `a692b644d1f9150cdf6f1a423f958a5c16167713` (Phase 1)  
**Application version inspected:** 1.0.9  
**Audit mode:** implementation and traceability audit; no scientific formula, constant, conversion, or calculated result was changed.

## Scope and decision rules

This report follows `docs/VALIDATION_PROTOCOL.md`: analytic round-trip testing, published worked examples, and physical/limiting-case checks. A method is not labelled a calculation bug merely because another valid convention exists. Any issue without an authoritative primary or standards source is marked **REVIEW REQUIRED**, not silently corrected.

**Status classes:** PASS, MINOR, REVIEW REQUIRED, BUG, CRITICAL.

## Repository-wide source review

- A repository code search for `Wikipedia` found no indexed textual occurrences. No Wikipedia citation was removed.
- The source audit found no blog, forum, marketing-page, or AI-generated citation added by this branch.
- Several module references are already primary papers, SPE publications, API RP 40, or JCGM GUM. Their bibliographic details and any DOI/landing URL still require source-record verification before a future citation-normalization change. This report does not invent missing identifiers.
- The implementation has inline citations for many modules, but the four Phase 1 permeability modules and steady-state relative permeability lack module-level authoritative citations. This is traceability debt, not evidence of a wrong output.

## DOI investigation

The Zenodo record [21763629](https://zenodo.org/records/21763629) was directly verified. It identifies **SKAL Bench: Routine and Special Core Analysis**, software version **v1.0.9**, published August 2, 2026, and links its release to `https://github.com/SohibKholosy/skal-bench/tree/v1.0.9`.

The verified canonical version DOI is **10.5281/zenodo.21763629**. The prior conflicting values `10.5281/zenodo.21757512` (application metadata) and `10.5281/zenodo.21757513` (`CITATION.cff`) were replaced with this DOI. The README already used the verified DOI. This is citation-metadata correction only; no scientific calculation output changed.

## Module audit

| Module | Method/equation checked | Current status | Scientific source(s) recorded in code | Validation and test coverage | Discrepancy / severity | Code changed |
|---|---|---|---|---|---|---|
| Steady-state gas / Klinkenberg | Compressible-gas Darcy expression; linear (k_a) vs (1/P_m) extrapolation | MINOR | No inline module citation | Phase 1 analytic intercept/slope regression | Formula implementation is internally consistent; add authoritative source traceability. MINOR | No |
| Single-point gas | Compressible-gas Darcy expression | MINOR | No inline module citation | Phase 1 analytic mean/dispersion regression | Formula implementation is internally consistent; add authoritative source traceability. MINOR | No |
| Pulse decay | Log-linear pressure-decay regression and permeability back-calculation | REVIEW REQUIRED | No inline module citation | Phase 1 analytic exponential-decay regression | System-compressibility form and reservoir-volume convention need a published worked-example check. | No |
| Liquid coreflood | Darcy law; origin-constrained (Q) versus (Delta P) fit | MINOR | No inline module citation | Phase 1 analytic proportional-flow regression | Algebra and units are internally consistent; add authoritative source traceability. | No |
| Relative permeability, steady state | Phase Darcy effective permeability normalized by (k_{abs}) | MINOR | No inline module citation | No automated regression yet | Formula is conventional; endpoint/crossover behaviour requires synthetic coverage. | No |
| Relative permeability, JBN | Johnson–Bossler–Naumann derivative form with optional Savitzky–Golay smoothing | REVIEW REQUIRED | Johnson, Bossler & Naumann (1959); Savitzky & Golay (1964) | No automated regression yet | Numerical differentiation, smoothing, and rejection of nonphysical points require a published worked-example comparison. | No |
| Brooks–Corey / Corey fit | Normalized saturation and power-law relative-permeability fit | REVIEW REQUIRED | Corey (1954); Brooks & Corey (1964) | No automated regression yet | Fit implementation and endpoint conventions need a synthetic round-trip. | No |
| Contact angle | Wettability interpretation of measured contact angle | REVIEW REQUIRED | Source is displayed in the feature, not catalogued in `MODULES` | No automated regression yet | Conventions (through water versus oil phase, advancing/receding angle) require explicit source review. | No |
| NMR petrophysics | T2 components; SDR and Timur–Coates correlations | REVIEW REQUIRED | Source is displayed in the feature, not catalogued in `MODULES` | No automated regression yet | Empirical coefficients/cutoffs are calibration-dependent and must be checked against the cited primary source. | No |
| MICP intrusion analysis | Washburn conversion; capillary-pressure interpretation | REVIEW REQUIRED | Source is displayed in the feature, not catalogued in `MODULES` | No automated regression yet | Mercury constants, pressure conversion, and radius/diameter convention need the protocol’s worked-example test. | No |
| Penetrometer selection | Penetrometer volume/pressure-range selection | REVIEW REQUIRED | Feature-level source not catalogued in `MODULES` | No automated regression yet | Decision thresholds require standards/manual verification. | No |
| Porosity–permeability correlation | Correlation/regression method | REVIEW REQUIRED | Feature-level source not catalogued in `MODULES` | No automated regression yet | Empirical fit is descriptive; data handling and extrapolation limits need a documented validation case. | No |
| Gravimetric porosity / grain density | Archimedes bulk volume and saturation pore volume | PASS | API RP 40 (1998) | Formula reviewed; no automated regression yet | Equations are internally consistent with the declared mass-volume convention. | No |
| Centrifuge capillary pressure | Hassler–Brunner approximation and Forbes-style inversion | REVIEW REQUIRED | Hassler & Brunner (1945); Forbes (1994); API RP 40 | No automated regression yet | Regularized inversion and monotonicity projection materially affect output; validate against a published/digitized example before any change. | No |
| Amott / USBM wettability | Amott–Harvey index and (log_{10}(A_1/A_2)) USBM index | PASS | Amott (1959); Donaldson, Thomas & Lorenz (1969); Anderson (1986) | Formula reviewed; no automated regression yet | Implementation follows stated definitions; classification bands should be source-checked. | No |
| Formation factor / cementation exponent | Archie log-linear fit; optional Arps temperature correction | REVIEW REQUIRED | Archie (1942); Winsauer et al. (1952) | No automated regression yet | Arps temperature constant and temperature units require primary-source worked-example verification. | No |
| Resistivity index / saturation exponent | Archie (IR=S_w^{-n}), constrained through (IR=1) at (S_w=1) | PASS | Archie (1942); Keller (1953); Sweeney & Jennings (1960) | No automated regression yet | Origin-constrained regression is explicitly stated and physically motivated; add synthetic test. | No |
| Helium porosimetry | Boyle-law double-cell expansion | PASS | API RP 40 (1998) | Formula reviewed; no automated regression yet | Rearranged volume expression is algebraically consistent with the stated equation. | No |
| Waxman–Smits | Clay-corrected formation factor and log-linear fit | REVIEW REQUIRED | Waxman & Smits (1968); Juhász (1981); Archie (1942) | No automated regression yet | (B), (Q_v), and conductivity-unit compatibility require a source-backed dimensional test. | No |
| Stress-dependent permeability | Exponential (k(sigma)=k_0e^{-csigma}) regression | REVIEW REQUIRED | API RP 40; Fatt & Davis (1952); Jones & Owens (1980) | No automated regression yet | Exponential model is an accepted empirical convention, not universally required; its extrapolation must be labelled model-dependent. | No |
| Rock typing | Winland r35 and Amaefule RQI/FZI | REVIEW REQUIRED | Kolodzie (1980); Pittman (1992); Amaefule et al. (1993) | No automated regression yet | Code correctly converts porosity fraction to percent before Winland terms; coefficients and port-class limits need source-record verification. | No |
| Darcy uncertainty budget | First-order independent-input propagation; (k=2) expanded uncertainty | MINOR | JCGM 100:2008 (GUM) | No automated regression yet | Correct only under stated independence/linearization/coverage assumptions; covariance is not modelled. | No |

## Findings requiring follow-up

1. **No calculation bug is confirmed.** Consequently, no scientific output changed and no scientific formula was edited.
2. **Regression gap:** Phase 1 protects only gas single-point, Klinkenberg steady gas, pulse decay, and liquid coreflood. The remaining scientifically significant modules require analytic and/or published-example tests before any implementation correction.
3. **Citation gap:** The modules marked MINOR or REVIEW REQUIRED need bibliographic verification and, where currently absent, module-level authoritative source traceability.
4. **DOI consistency:** The verified Zenodo record DOI was applied to application and CFF metadata.
5. **Version mismatch:** The protocol and CFF version fields were corrected to 1.0.9 to match the application and package metadata. DOI values were intentionally left untouched.

## Change log

- Updated `docs/VALIDATION_PROTOCOL.md` from version 1.0.0 to 1.0.9, including its sample validation-record version.
- Updated `CITATION.cff` version from 1.0.0 to 1.0.9.
- Added this report.
- Corrected application and CFF DOI metadata to 10.5281/zenodo.21763629 after direct Zenodo-record verification.
- **Scientific outputs changed:** none.

## Reproducibility and validation

The full Phase 1 suite must be run after every future scientific change. At the time of this audit, the four Phase 1 tests pass in the available Node runtime. Production build validation is blocked in this environment until npm dependencies can be installed; npm registry access returned sandbox `EACCES` errors. The branch CI workflow will run `npm ci`, `npm test`, and `npm run build` on a pull request.
