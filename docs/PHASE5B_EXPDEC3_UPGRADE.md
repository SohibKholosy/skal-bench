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
