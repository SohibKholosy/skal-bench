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
