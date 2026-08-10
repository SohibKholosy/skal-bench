# SKAL Bench — Validation Protocol

How to confirm that every module produces correct, reproducible values, and how to get an AI
assistant to verify them independently rather than simply agreeing with you.

Applies to version 1.0.9. Record the version with every result — a later release may change a
calculation, and a validation record without a version number cannot be interpreted.

---

## 1. The three tests every module must pass

A single comparison is not validation. Each module should pass all three of the following, because
each catches a different class of error.

### Test A — Analytic round-trip (catches algebra and coding errors)

Construct input data from known parameters, feed it to the module, and check that the module
recovers those parameters exactly.

*Example — Formation Factor.* Choose `a = 1`, `m = 2`, `Rw = 0.1 Ω·m`. For porosities
0.10, 0.15, 0.20, 0.25, 0.30 compute `F = φ⁻²` and then `Ro = F × Rw`. Enter those porosity and Ro
pairs. The module must return `m = 2.000`, `a = 1.000`, `R² = 1.0000`.

Any deviation is a coding error, not a modelling difference. This test has no tolerance: exact
recovery is required, to within floating-point rounding.

**Strength:** unambiguous, and isolates the code from any argument about which model is right.
**Limitation:** proves the equation was implemented as written, not that the right equation was chosen.

### Test B — Published worked example (catches wrong-equation and wrong-constant errors)

Take a numerical example from a paper, textbook, or standard, enter its inputs, and compare against
its published answer.

This is the only test that catches using the correct *form* of an equation with the wrong constant
— for instance a Swanson coefficient of 355 instead of 431, or a Washburn surface tension of
480 rather than 485 dyn/cm. Test A would pass such an error silently.

**Tolerance:** published examples are usually rounded, so agreement to the number of significant
figures printed is the standard. Disagreement beyond that is a finding to investigate, not
necessarily a defect — check first whether the source used a different unit convention.

### Test C — Physical and limiting-case behaviour (catches nonsense that is arithmetically correct)

Confirm the result behaves correctly at boundaries and stays inside physical bounds.

Examples:
- Porosity must lie between 0 and 1; grain density near 2.65 g/cm³ for sandstone, 2.71 for
  limestone, 2.87 for dolomite.
- Amott–Harvey index must lie between −1 and +1.
- Klinkenberg-corrected permeability must be **lower** than any apparent gas permeability used to
  derive it, and liquid permeability should be close to it.
- Relative permeability must lie between 0 and 1 and reach its endpoint values at the endpoint
  saturations.
- Saturation exponent `n` should be near 2 for clean water-wet rock; a value of 6 signals either
  oil-wet rock or a data problem.
- Doubling the flow rate at fixed pressure drop must double permeability — linearity in Darcy's law.

### Cross-check (a fourth test, where the app offers more than one route)

Where the software computes the same quantity by independent methods, compare them:

| Quantity | Independent routes available |
|---|---|
| Permeability from MICP | Purcell, Swanson, Winland r35, Thomeer |
| Permeability from NMR | SDR, Timur–Coates |
| Porosity | Gravimetric (Archimedes), helium (Boyle's law) |
| Inlet-face saturation (centrifuge) | Hassler–Brunner, direct Forbes inversion |
| Wettability | Amott–Harvey, USBM, contact angle |

These need not agree exactly — they are different models — but they should agree in order of
magnitude and in trend. A permeability of 50 mD from Swanson and 3000 mD from Winland on the same
sample means one of them is being misapplied, or the rock violates an assumption.

---

## 2. Worked example of a Test B check

*Washburn equation, MICP module.*

Equation: `d = −4σ·cosθ / P`

With the standard mercury constants σ = 485 dyn/cm (0.485 N/m) and θ = 140°:

```
cos(140°)  = −0.76604
P          = 1 psia = 6894.76 Pa
d          = −4 × 0.485 × (−0.76604) / 6894.76
           = 1.48612 / 6894.76
           = 2.1554 × 10⁻⁴ m
           = 215.5 µm  (diameter)
r          = 107.8 µm  (radius)
```

So at 1 psia mercury enters throats of about 108 µm radius. This is a widely quoted benchmark and a
fast way to confirm both the constants and the unit handling. If the module reports 54 µm, the code
is returning a radius where a diameter was intended, or vice versa.

---

## 3. Recording results

Keep a simple table. The record matters as much as the test — it is what lets you demonstrate the
tool was validated, and what you re-run after any change.

| Module | Test | Source | Expected | Obtained | Deviation | Verdict | Version | Date |
|---|---|---|---|---|---|---|---|---|
| Formation Factor | A | analytic | m = 2.000 | 2.000 | 0.00% | Pass | 1.0.9 | |
| MICP Washburn | B | Washburn (1921) | r = 107.8 µm @ 1 psia | | | | 1.0.0 | |

Re-run the full table whenever the major or minor version changes. Patch releases by definition
change no results, but re-running is cheap insurance.

---

## 4. The AI verification prompt

The main risk when asking an AI to check a number is **anchoring**: shown a result, models tend to
work backwards and confirm it. The prompt below is built to prevent that — it requires the model to
compute independently first, to state its source, and to declare uncertainty rather than guess.

Use one module per conversation. Paste the template, filling the bracketed fields.

---

```
You are verifying a petrophysics calculation. Accuracy matters more than agreement:
if my numbers are wrong, say so plainly.

Work in this order and do not depart from it:

STEP 1 — Before I give you any result, state from your own knowledge:
  (a) the standard equation for [QUANTITY, e.g. Klinkenberg-corrected permeability]
  (b) the original published source for that equation, with author, year and where it
      appeared
  (c) every constant it uses, with the value and unit you would expect
  (d) the assumptions under which it is valid

STEP 2 — Compute the answer independently from these inputs, showing each step and
carrying units throughout:
  [LIST THE INPUTS, WITH UNITS]

STEP 3 — Only now, compare against the value my software produced:
  [SOFTWARE RESULT, WITH UNITS]
  State the absolute and percentage difference.

STEP 4 — Judge the outcome:
  - If the values agree within rounding, say so and state the tolerance you applied.
  - If they differ, list the possible causes in order of likelihood: unit conversion,
    a different constant, a different form of the equation, a different convention
    (radius versus diameter, fraction versus percentage), or an actual error.
  - Say which you think it is and how I could distinguish between them.

STEP 5 — Sanity checks: is the result physically plausible for this rock type, and
does it sit within the expected range for the quantity?

Rules:
- If you are not confident of a constant or a source, say so explicitly rather than
  estimating. An honest "I am unsure of this value" is more useful to me than a
  confident wrong number.
- Do not adjust your working to match my result.
- Quote sources precisely enough that I can look them up. If you cannot recall a
  citation exactly, say which paper you believe it is and flag that the reference
  needs checking.
```

---

## 5. A second prompt, for building test cases

Use this when you want an analytic Test A case rather than checking an existing number.

```
I need a test case to validate a [MODULE NAME] implementation.

Construct a synthetic dataset with known parameters, working forwards:
  1. Choose realistic values for the underlying parameters and state them.
  2. Using the standard equation — state it and its source — compute the input
     measurements that such a sample would produce. Show the arithmetic.
  3. Give me those inputs as a table I can type into the software.
  4. State exactly what the software must return if it is correct, and to how many
     significant figures.
  5. Include at least one edge case: an endpoint value, a limiting condition, or a
     case where the model is known to break down, and say what correct behaviour
     looks like there.

Use realistic magnitudes for [ROCK TYPE / FLUID SYSTEM] so the test also exercises
the expected numeric range.
```

---

## 6. Where the AI's answer must not be trusted

Independent verification by a language model has real limits. Treat its output as a
*second opinion that itself needs checking*, not as an authority.

- **Citations are the weakest part.** Models routinely produce plausible-looking references with
  the wrong year, wrong journal, or wrong author order, and occasionally invent them entirely. Any
  citation the AI gives must be confirmed against the actual paper before it goes into a report.
- **Empirical coefficients are frequently misremembered.** Swanson's 431 and 2.109, Winland's
  0.732 / 0.588 / 0.864, Arps' 21.5 — check these against the source, not against a model's recall.
- **Regional conventions are not universal.** A model will often present a Gulf of Mexico T₂ cutoff
  of 33 ms as though it applied everywhere.
- **Agreement between the software and the AI proves only that both used the same equation.** If
  the equation itself is the wrong choice for your rock, both will be wrong together. Test B against
  a real published example is the only guard against this.

The strongest validation remains a physical one: run a sample whose properties you already know by
an independent laboratory method, and see whether the software reproduces them.
