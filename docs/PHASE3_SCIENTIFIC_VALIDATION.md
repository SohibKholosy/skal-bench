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

## Incremental validation record — centrifuge, JBN, and Waxman–Smits

### Centrifuge capillary pressure

- **Status:** REVIEW REQUIRED (direct inversion); PASS for the implemented pressure conversion and Hassler–Brunner short-core relation.
- **Equation/method checked:** Pc = 0.5 Δρ ω² (r₂²−r₁²), with the Hassler–Brunner first approximation S₁ = S̄ + Pc dS̄/dPc.
- **Authoritative sources checked:** Hassler and Brunner, *Transactions of AIME* **160** (1945), 114–123; Ayappa, Davis and Scriven, “Capillary pressure: Centrifuge method revisited,” *AIChE Journal* **35** (1989), 453–464, DOI: 10.1002/aic.690350304.
- **Automated coverage:** the centrifugePc Hassler–Brunner regression uses a synthetic linear S̄(Pc) relation, for which the finite-difference derivative is exact.
- **Remaining gap:** no publisher-backed numerical benchmark was found for the present discrete direct-inversion implementation, its λ=0.05 regularization, monotonicity projection, or the r₁/r₂=0.85 selection threshold. Those items remain unverified and no scientific output was changed.

### JBN unsteady-state relative permeability

- **Status:** MINOR — core derivative and saturation transform are regression-tested; smoothing and endpoint practice remain REVIEW REQUIRED.
- **Equation/method checked:** the implementation computes fractional flow from dNpD/dQiD, the JBN mobility derivative from d(1/QiD)/d[1/(QiD IR)], and Sw,2 = Swi + NpD − QiD fo; nonphysical values are filtered.
- **Authoritative source verified:** Johnson, Bossler and Naumann, “Calculation of Relative Permeability from Displacement Experiments,” *Transactions of AIME* **216** (1959), 370–372, DOI: 10.2118/1023-G (SPE publication record).
- **Automated coverage:** the relPermJBN analytic regression uses a differentiable displacement dataset with smoothing disabled and includes a nonpositive-injection input for filtering.
- **Remaining gap:** the five-point Savitzky–Golay setting is a numerical choice, not a JBN result; it has not yet been compared with a primary-source worked JBN dataset. Endpoint interpretation depends on displacement assumptions and remains for review.

### Waxman–Smits shaly-sand formation factor

- **Status:** MINOR — implemented conductivity relation and dimensional consistency tested; coefficient convention requires user-controlled units/calibration.
- **Equation/method checked:** F* = Ro(Cw + BQv), with Cw = 1/Rw. In the regression case, Ro is Ω·m, Cw is S/m, Qv is eq/m³, and B is S·m²/eq, making BQv S/m and F* dimensionless.
- **Authoritative source verified:** Waxman and Smits, “Electrical Conductivities in Oil-Bearing Shaly Sands,” *SPE Journal* **8**(2) (1968), 107–122, DOI: 10.2118/1863-A.
- **Automated coverage:** the waxmanSmits regression recovers a known a*=1, m*=2 synthetic formation-factor trend.
- **Remaining gap:** this does not validate any empirical B–salinity/temperature correlation (including Juhász conventions). The application accepts a user value for B and per-plug Qv; their units and laboratory calibration must be explicitly confirmed before interpreting results.

### Mercury-injection capillary pressure (MICP)

- **Status:** MINOR — Washburn conversion, diameter/radius convention, and the 1 psia numerical case are regression-tested.
- **Equation/method checked:** Washburn’s non-wetting capillary relation in diameter form, d = −4σcosθ/P. The implementation takes σ in dyne/cm, θ in degrees, and P in psia; it converts to SI internally, returns d in µm, and subsequently reports r = d/2 where a radius is needed.
- **Authoritative source verified:** Washburn, “The Dynamics of Capillary Flow,” *Physical Review* **17**(3) (1921), 273–283, DOI: 10.1103/PhysRev.17.273.
- **Automated coverage:** the micpWashburnDiameter regression evaluates P = 1 psia, σ = 485 dyne/cm, θ = 130°, producing d = 180.863 µm and r = 90.432 µm.
- **Remaining gap:** 485 dyne/cm and 130° are conventional mercury-intrusion settings, not universal physical constants; each instrument’s stated surface tension, advancing contact angle, and pressure calibration require confirmation. The pressure conversion and pore-throat **diameter** convention are covered, but a complete instrument-output benchmark remains REVIEW REQUIRED.

### NMR permeability and fluid partitioning

- **Status:** REVIEW REQUIRED — no production change and no regression assertion added in this increment.
- **Equation/method inspected:** SDR is implemented as k = a φ^m T2LM^n; Timur–Coates is implemented as k = (φ/C)^p (FFI/BVI)^q. Porosity is explicitly calibrated from the total 100%-saturated T2 signal divided by bulk volume; BVI and FFI use user-editable T2 cutoffs.
- **Sources requiring primary-record confirmation:** the code cites Kenyon et al. (1988) for SDR and Straley et al. (1997) / Chang et al. (1994) for cutoff conventions. These are empirical calibration sources rather than universal constants, and their exact bibliographic records and coefficient/unit conventions still require source-level verification.
- **Finding:** the code correctly presents the coefficients and cutoffs as editable lithology defaults, but a fixed tri-exponential fit plus a 5% BVI applicability guard is a software choice, not a universally validated NMR interpretation rule.
- **Remaining gap:** validate the stated default coefficients, T2 units (ms versus the unit assumed by each coefficient), 33/92/100 ms cutoffs, and the Timur–Coates parameter convention against the original publications or an authoritative vendor/manual. A regression should be added only after that evidence is verified.

## Incremental validation record — NMR and pulse-decay

### NMR petrophysics

- **Status:** MINOR for the mathematical forms; REVIEW REQUIRED for deployed coefficient/cutoff defaults.
- **Authoritative source verified:** Kenyon, Day, Straley and Willemsen, “A Three-Part Study of NMR Longitudinal Relaxation Properties of Water-Saturated Sandstones,” *SPE Formation Evaluation* **3**(3) (1988), 622–636, DOI: 10.2118/15643-PA. It supports the SDR power-law form k = a φ^m T2LM^n.
- **Equation/method checked:** the implemented SDR and Timur–Coates functions retain the general empirical power-law forms k = a φ^m T2LM^n and k = (φ/C)^p (FFI/BVI)^q. A regression evaluates each with an analytic synthetic input.
- **Empirical limitations:** coefficients, exponent conventions, T2 units, and T2 cutoffs are calibration-dependent. The implementation’s 33/92/100 ms cutoffs and lithology presets must not be read as universal. Timur–Coates depends on that cutoff through the FFI/BVI partition.
- **Remaining gap:** source-level verification of the exact coefficient/unit packages used in every preset, particularly Timur–Coates defaults. No result was changed.

### Pulse-decay permeability

- **Status:** PASS for the stated simplified two-reservoir model; MINOR for scope limitations.
- **Authoritative support:** Brace-type pulse-decay formulation as reproduced in an authoritative DOE/LBNL technical record: k = α μ β L / [A(1/Vup + 1/Vdown)], with α from ln(ΔP) versus time. The application’s factor of 1000 is the existing cm–cp–atm-to-mD unit convention.
- **Validation:** the existing analytic exponential-decay regression recovers both α and k. The source confirms the reservoir-volume reciprocal sum and compressibility convention.
- **Limitations:** the simplification assumes negligible sample storage, approximately uniform pressure gradient, Darcy flow, and small pulses/constant fluid properties. It is not a general transient or adsorbing-gas interpretation.
\n

## Incremental validation record — Brooks–Corey / Corey

### Corey endpoint prediction

- **Status:** MINOR — effective-saturation and endpoint prediction are regression-tested; wettability screening remains empirical.
- **Authoritative sources verified:** Corey, “The Interrelation Between Gas and Oil Relative Permeabilities,” *Producers Monthly* **19**(1) (1954), 38–41; Brooks and Corey, *Hydraulic Properties of Porous Media*, Colorado State University Hydrology Paper No. 3 (1964).
- **Equation/method checked:** Se = (Sw − Swi)/(1 − Swi − Sor), kro = (1 − Se)^No, and krw = [krw(Sor)/kro(Swi)] Se^Nw. The application deliberately normalizes kro to the oil endpoint at Swi and caps the normalized water endpoint at 1.
- **Automated coverage:** a synthetic round-trip verifies Se endpoints, kro(Se=0)=1, krw(Se=0)=0, kro(Se=1)=0, krw(Se=1)=the supplied endpoint ratio, and the selected exponents.
- **Remaining gap:** fitting measured curves, Welge-tangent discretization, and Craig-rule wettability classification need separate method-specific validation. They are not asserted as universal physical laws.
- **Citation hygiene:** obsolete Wikipedia references in this screen were removed; the existing engineering-text reference is retained.

## Incremental validation record — formation factor and Arps correction

### Formation factor / Archie–Winsauer

- **Status:** PASS for the implemented clean-brine formation-factor fit; MINOR for applicability limits.
- **Authoritative sources verified:** Archie, “The Electrical Resistivity Log as an Aid in Determining Some Reservoir Characteristics,” *Transactions of AIME* **146** (1942), 54–62; Winsauer, Shearin, Masson and Williams, “Resistivity of Brine-Saturated Sands in Relation to Pore Geometry,” *AAPG Bulletin* **36**(2) (1952), 253–277.
- **Equation/method checked:** F = Ro/Rw = a φ^(−m); log10 F is regressed against log10 φ to recover free a and m. The separate Archie-constrained estimate fixes a=1.
- **Automated coverage:** a synthetic four-plug dataset recovers a=0.8 and m=2 exactly.
- **Applicability:** this is a clean, brine-saturated-rock relation. Conductive clay or surface conduction requires a non-Archie interpretation such as the separately reviewed Waxman–Smits module.

### Arps brine-resistivity temperature correction

- **Status:** PASS for the code’s declared Celsius convention.
- **Authoritative convention verified:** Arps’ empirical temperature relation uses Rw(T2) = Rw(T1)(T1+21.5)/(T2+21.5) when temperatures are in °C; the Fahrenheit offset is 6.77. The implementation explicitly uses the Celsius form and treats the user-entered Rw temperature as the reference temperature.
- **Automated coverage:** the same synthetic dataset corrects Rw from 20°C to 70°C before recovering the known a and m.
- **Limitations:** Arps is empirical and assumes the same brine composition between temperatures; it does not replace a direct brine-resistivity measurement at test conditions.

