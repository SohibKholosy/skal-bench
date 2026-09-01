# Phase 5B — ExpDec3 engine upgrade

Phase 5B replaces the previous fixed-start, unconstrained ExpDec3 implementation. It consumes only the Phase 5A prepared signal and does not use raw magnitudes, machine results, or ILT output.

## Model and constraints

The fitted model is `M(t) = A1 exp(-t/T21) + A2 exp(-t/T22) + A3 exp(-t/T23) + C`.

T2 values are ordered by transformed variables: `T21 = exp(q1)`, `T22 = T21 + exp(q2)`, and `T23 = T22 + exp(q3)`. Component amplitudes are constrained non-negative by deterministic coordinate-descent NNLS; baseline `C` is independently fitted and unconstrained.

## Search and objective

Eight deterministic starts are derived from the acquisition time extent rather than geological cutoffs or machine metadata. Each start receives Nelder–Mead exploration followed by damped deterministic local pattern least-squares refinement. The selected valid fit has the smallest ordinary unweighted SSE.

The engine reports RSS/SSE, RMSE `sqrt(SSE/n)`, R², adjusted R² with seven fitted parameters, residual lag-1 correlation, start counts, and near-optimal solution spreads. Near-optimal means SSE within 0.5% of the best result. A fit is flagged potentially unstable when any T2 relative spread exceeds 25% or the baseline relative spread exceeds 50%; this is a heuristic sensitivity diagnostic, not a uniqueness proof.

## Limits

A high R² does not establish unique components. Close T2 components, weak amplitudes, long-T2/baseline coupling, finite duration, and noise can make the decomposition sensitive. Phase 5C ILT work remains out of scope.


## Deterministic fitting-data reducer audit

The UI selects the fitting dataset only after Phase 5A preparation. It uses the established log-index rule: retain index 0, generate 500 rounded base-10 log-spaced candidate indices over the acquisition, then retain each unique finite candidate in increasing order. The reducer is now instrumented through `nmrSelectExpDec3FittingIndices`; the fit trace records source count, configured target, candidate and rounded-candidate counts, rounded duplicates, invalid-index and non-finite rejection counts, final count, and first/last selected index and time.

For `MG-512D-178_T2.txt`, the deterministic trace is:

| Field | Result |
| --- | ---: |
| Source/prepared points | 23,148 |
| Configured target | 500 |
| Rounded candidates | 500 |
| Duplicate rounded candidates | 145 |
| Invalid/non-finite rejections | 0 / 0 |
| Final fitting points | 356 |
| First / last index | 0 / 23,147 |

Thus 356 is the reproducible consequence of the existing rounded log-index selection, not a hidden quality filter. The current reducer is **bounded-data, deterministic, and early-time preserving**, but its nominal target is not an exact cardinality guarantee because rounding creates duplicates. It remains a **REVIEW REQUIRED** sampling policy rather than a scientifically validated adaptive design. No optimizer or fit objective was changed by this instrumentation.

## Real-file reproducibility audit

These files were read only from the user-provided local path and were not committed. Results below are from the automatic Phase 5A preparation path and the deterministic 500-candidate reducer.

| Acquisition | Prepared / fitted points | Runtime | Status | T2 values (ms) | Baseline | R² | RMSE | Residual lag-1 |
| --- | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: |
| BG-1594D-63 | 55,556 / 371 | 8.426 s | Converged | 65.484, 673.939, 2396.087 | -2220.101 | 0.999927 | 679.543 | 0.853 |
| MG-512D-37A | 6,944 / 329 | 7.557 s | Converged | 7.421, 30.482, 98.986 | 330.658 | 0.999982 | 214.500 | 0.097 |
| MG-512D-178 | 23,148 / 356 | 7.956 s | Converged | 3.740, 47.615, 246.537 | 817.012 | 0.999942 | 524.593 | 0.703 |

All three runs used eight deterministic starts and reported a stable result under the implemented near-optimal-start heuristic. This does not establish component uniqueness. In particular, BG-1594D-63 has high residual lag-1 correlation and all eight starts fall within the current near-optimal threshold; its individual components and baseline therefore require expert review before being interpreted as uniquely resolved populations. The MG-512D-178 result retains the previously reported 356-point fit and values.

## Full-versus-reduced synthetic audit status

A noise-free, well-separated three-component synthetic case (700 source points; 246 reduced points) was fitted with the same production fitter. The full fit took 13.114 s, the reduced fit 4.871 s, both converged, and both recovered T2 = 3, 25, 130 ms with R² effectively 1.0. This supports deterministic round-trip behavior for that tractable case only.

The requested 7,000 / 23,000 / 55,000 full-resolution fits have not been represented as completed: the observed runtime scales too high for the local validation environment, and a 55,000-point full fit would be unsuitable for the normal regression suite. They remain **REVIEW REQUIRED**. The production bounded reducer has direct deterministic invariant coverage; further full-versus-reduced numerical benchmarking should run in a dedicated performance-validation environment with a recorded timeout budget and the same production fitter.

## Guardrail correction

The audit identified one incorrect status outcome: an exactly flat finite input had previously been represented as a converged three-component solution with all amplitudes zero. A regression test was added before the correction. Such an input now returns `Insufficient signal` with the reason “Prepared signal has no usable decay.” This affects only the no-decay input-status path; it does not alter the objective, parameterization, optimizer, reducer, or output of a usable decay.

## Current Phase 5B audit status

- **PASS (implementation):** ordered-positive T2 parameterization, non-negative amplitudes, free baseline, deterministic multi-start execution, and explicit residual/stability diagnostics.
- **PASS (reproducibility):** bounded reducer trace and the MG-512D-178 23,148-to-356 point result.
- **REVIEW REQUIRED:** sampling adequacy for close components, long-T2/baseline separation, noisy data, and full-resolution equivalence at large source counts.
- **REVIEW REQUIRED:** interpretation of individual components for BG-1594D-63 because of serial residual structure.
- **OUT OF SCOPE:** Phase 5C ILT regularization, resolution analysis, and quantitative T2-distribution interpretation.


# Final validation addendum — reducer correction

This addendum supersedes the earlier observation-only log-index reducer assessment.

## Demonstrated defect and correction

A fixed-duration, noiseless, well-conditioned synthetic decay was sampled at 7,000, 23,000, and 55,000 points. Under the former rounded log-index selector, changing only source density materially changed fitted T2 values; at 55,000 points the errors were -0.714, -7.158, and -10.193 ms for true T2 = 3, 28, and 160 ms. This is a reducer defect because it changes the implicit unweighted least-squares weighting as source density changes.

A regression test was committed before the correction. The production ExpDec3 selector now selects exactly 500 uniformly spaced acquisition indices, including both endpoints. This does not alter Phase 5A parsing or preparation, or the ExpDec3 optimizer/objective. It does change the fitting dataset and, therefore, fitted ExpDec3 outputs for valid decay acquisitions. The former 500-candidate/145-duplicate/356-point MG-512D-178 trace is retained as the pre-correction audit baseline; the corrected selector uses 500 points.

## Controlled full-versus-reduced known-truth validation

All eight cases used 1,500 equally spaced source points over 0.2–749.7 ms. **FULL** used all 1,500 values; **REDUCED** used the production 500-point selector; both used the same `fitExpDec3` implementation, starts, bounds, and objective. All cases converged and were stable under the implemented diagnostic. FULL recovery was effectively exact without noise; expected deterministic-noise deviations were present in both FULL and REDUCED fits.

| Case | Truth A / T2 / C | FULL RMSE | REDUCED RMSE | Reduced T2 error (ms) | Reduced C error |
| --- | --- | ---: | ---: | --- | ---: |
| Well-separated | 8,16,40 / 3,28,160 / 1 | 3.56e-10 | 4.09e-10 | -3.5e-11, -2.7e-10, -1.2e-10 | 2.4e-10 |
| Moderate separation | 10,18,35 / 7,28,95 / 1 | 1.14e-4 | 1.21e-4 | -0.000128, -0.000360, -0.000134 | 0.000044 |
| Weak component | 3,22,38 / 4,35,145 / 1 | 1.26e-7 | 1.36e-7 | -1.2e-10, -4.6e-9, -3.7e-9 | 7.9e-8 |
| Non-zero baseline | 10,20,40 / 5,35,150 / 12 | 4.39e-7 | 4.71e-7 | -1.7e-9, -5.7e-9, -1.8e-9 | 2.8e-7 |
| Long T2(3) | 11,18,40 / 4,35,320 / 2 | 1.68e-6 | 1.69e-6 | 1.7e-9, 6.3e-9, -7.8e-9 | 2.7e-6 |
| Low deterministic noise | 9,19,38 / 4,30,150 / 2 | 0.03746 | 0.03744 | -0.0114, -0.0207, -0.0212 | 0.000545 |
| Moderate deterministic noise | 9,19,38 / 4,30,150 / 2 | 0.37458 | 0.37442 | -0.1276, -0.2311, -0.2283 | 0.005685 |
| Baseline/T2(3) coupling | 10,17,25 / 5,42,290 / 18 | 0.07492 | 0.07489 | 0.000661, 0.021917, 0.091139 | -0.000842 |

The complete executed parameter records, including A errors, are summarized here: reduced A errors respectively were: well-separated (-7.6e-9, 5.4e-9, -1.9e-9); moderate separation (-0.00314, 0.00284, -0.00082); weak (-0.0000023, 0.0000019, -0.0000008); non-zero baseline (-0.0000084, 0.0000069, -0.0000027); long T2(3) (-0.0000200, 0.0000168, -0.0000087); low noise (-0.0204, 0.0076, 0.0042); moderate noise (-0.2097, 0.0814, 0.0477); coupling (-0.0263, 0.0094, -0.0069). The full-versus-reduced values agreed at the displayed accuracy for the noiseless cases; full fits took 29.7–35.6 s and reduced fits 5.9–12.1 s in the local audit environment.

## Fixed-duration source-density sensitivity

The same well-conditioned physical model, same 0.2–749.7 ms extent, and only source density changed. Only normal production **reduced** fitting was run; a 55k full multistart fit was intentionally not run.

| Source points | Candidates / duplicates / final | T2 error (ms) | A error | C error | Runtime |
| ---: | --- | --- | --- | ---: | ---: |
| 7,000 | 500 / 0 / 500 | 6.3e-11, 2.5e-10, 2.2e-10 | -7.3e-9, 5.3e-9, -2.0e-9 | 2.3e-10 | 9.281 s |
| 23,000 | 500 / 0 / 500 | -8.7e-12, 1.1e-10, 1.5e-10 | -7.4e-9, 5.4e-9, -2.0e-9 | 2.4e-10 | 9.587 s |
| 55,000 | 500 / 0 / 500 | -4.9e-12, 1.9e-11, 1.7e-10 | -7.4e-9, 5.4e-9, -1.9e-9 | 2.3e-10 | 9.745 s |

The first and last retained times were 0.2 and 749.7 ms for every density. This validates density invariance for the controlled model; it does not establish universal identifiability in noisy or poorly separated physical data.

### Reducer acceptance

**ACCEPTED WITH LIMITATIONS.** The corrected selector passes cardinality/end-point invariants, agrees closely with tractable full-data fits across the eight cases, and has no material fixed-duration source-density drift in the controlled model. Limitations remain: fixed 500-point uniform sampling is not an adaptive information-optimal design; close components, long-T2/baseline coupling, noise, and finite acquisition duration can still limit identifiability. Full 55k eight-start fitting was not executed because it is computationally impractical in this environment and was not required to isolate the reducer.

## Final real-file comparison

“Old” means the pre-Phase-5B UI values recorded during this audit; “new” is the corrected 500-point production path. Values are empirical fit results, not independently established physical populations.

| File | Old A / T2(ms) / C / R² | New A / T2(ms) / C / R² | New diagnostics |
| --- | --- | --- | --- |
| BG-1594D-63 | 9060.9,41641.8,170781.1 / 25.99,244.74,860.99 / 400.2 / 0.99999 | 13274.30,51647.52,157062.19 / 40.306,328.108,900.179 / 157.94 / 0.9999900 | adj R² 0.9999899; RMSE 139.43; SSE 9,720,200.07; lag-1 0.315; starts 8/8/1; Stable; Converged; 55,556/500 points; 10.802 s |
| MG-512D-37A | 22145.9,97826.2,30354.4 / 8.75,31.67,100.25 / 312.0 / 0.99998 | 25720.50,98989.17,26001.04 / 9.304,33.536,108.828 / 240.84 / 0.9999641 | adj R² 0.9999636; RMSE 128.12; SSE 8,207,692.05; lag-1 0.311; starts 8/8/8; Stable; Converged; 6,944/500 points; 11.806 s |
| MG-512D-178 | 32677.9,52659.0,120202.9 / 5.14,61.56,258.77 / 526.9 / 0.99995 | 39439.21,63675.52,105615.16 / 5.788,82.228,281.234 / 200.50 / 0.9999356 | adj R² 0.9999346; RMSE 241.78; SSE 29,228,541.23; lag-1 0.617; starts 8/8/7; Stable; Converged; 23,148/500 points; 10.667 s |

Absolute / percentage T2 change (new minus old): BG = +14.316 ms (55.1%), +83.368 ms (34.1%), +39.189 ms (4.6%); MG-512D-37A = +0.554 ms (6.3%), +1.866 ms (5.9%), +8.578 ms (8.6%); MG-512D-178 = +0.648 ms (12.6%), +20.668 ms (33.6%), +22.464 ms (8.7%).

For BG-1594D-63, the corrected fit’s lag-1 residual correlation is lower than the former 0.853 but remains non-zero. **Fit convergence** is distinct from **model adequacy/component interpretability**: individual BG ExpDec3 components remain **REVIEW REQUIRED**. MG-512D-178 also retains substantial sequential residual structure (lag-1 0.617).

## Scientific change audit

Changed production behavior is restricted to ExpDec3:

- New constrained, ordered, non-negative-amplitude ExpDec3 engine with a free baseline and deterministic multi-start diagnostics.
- Corrected fitting-data selection: former rounded log-index sampling replaced by exact-cardinality uniform-in-time selection after a reproducible density-bias finding.
- Residual series/diagnostic UI and fit trace.
- Flat/no-decay guardrail: exact flat input now reports `Insufficient signal`; this is an invalid-input correction, not a valid-decay calculation change.

Unchanged: acquisition parser; raw Time/Real/Imaginary arrays; calibration; Phase 5A signal preparation; PCA phase correction; Real/Imaginary mode behavior; global orientation; ILT kernel/grid/regularization/solver; T2LM; rock-core cutoffs; and unrelated calculation modules.
