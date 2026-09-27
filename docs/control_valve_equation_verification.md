# Control-valve equation-verification record

Review date: 2026-09-27. Record version: 1. Status: evidence review completed; standards-dependent implementation and production release remain blocked.

Governing requirement: [approved Phase 1 specification](control_valve_sizing_spec.md), including its Approved Phase 1 Design Basis and decisions 1–27. This record does not revise that basis, authorize implementation, or certify compliance. All function/test names below are proposals, not existing control-valve implementations.

Repository inspected at commit `5b4f5b3d9df620ef1564f0493d9b0e1485b7974a`. Approved specification SHA-256: `FC0709DCBC4CD07E60BA8C43C11F2D1A2869519B27789CEA129A49016318E923`.

## 1. Verification status and gates

Evidence status and permission to implement are separate fields. Manufacturer agreement does not satisfy the specification's authorized-standard gate.

| Code | Status | Meaning |
|---|---|---|
| AS | Verified against authorized standard | Exact edition, corrigendum, clause, equation, constants, unit tuple and applicability reviewed from an authorized complete text; named reviewer/date required. No equation currently has AS. |
| MP | Corroborated by multiple primary manufacturer sources | Independent manufacturers support the stated family; does not prove edition equivalence or every branch/constant. |
| P1 | Provisionally supported by one primary source | Direct primary evidence located; remaining limitations stated. |
| SV | Requires authorized-standard verification | Mandatory overlay on every standards-dependent family, including MP/P1 items. |
| MV | Manufacturer-specific | Actual design/trim/size/travel data and applicability required; no generic factor approval. |
| ID | Identity or metrological conversion checked | Algebra/dimensions or authoritative unit definition checked; not an IEC sizing certification. Rounded references are identified. |
| EA | Approved engineering/application policy | Comes from the approved specification; any additional proposed numerical policy remains explicitly pending. |
| RI | Repository interface inspected | Confirms existing field/function behavior, not physical accuracy. |
| NI | Not approved for implementation | Missing evidence, unresolved conflict, unsupported branch or deferred scope. |

Before implementing E2–E10 standards-dependent sizing branches: require AS for the entire branch, dimensional/unit checks, reconciled primary-source conflicts, qualified MV inputs, and independently reviewed expected values. Specification §§1, 10 and 28 require verification before implementing each affected branch, not merely before release. MP is insufficient to bypass this rule.

ID and already approved EA transformations can be implemented separately after a future implementation request. An idealized E11 model can be isolated as approved EA algebra; using it for a real valve still needs MV qualification. Production requires all relevant AS/MV gates, independent benchmark acceptance, deterministic tests and specification §24 workflow checks. Neither this review nor an algebraic self-check is independent engineering sign-off.

Required future sign-off fields: source ID/version/hash, clause/page/equation, unit tuple, constants with precision, domain, source differences, derivation/check attachment, benchmark IDs, reviewer identity/date and disposition. Current authorized-standard reviewer: **not assigned**; sign-off: **outstanding**.

## 2. Standards, editions and source register

All URLs below were accessed or attempted on **2026-09-27**. Evidence is from opened source content, not search snippets. Only short factual records, equation families and limited example data are retained; no standards tables, charts or extended handbook text are reproduced.

### Standards

| ID | Organization, number and title | Edition/amendment | Location and availability | Compatibility disposition |
|---|---|---|---|---|
| S1 | IEC 60534-2-1, *Industrial-process control valves — Part 2-1: Flow capacity — Sizing equations for fluid flow under installed conditions* | 2011, edition 2.0; official page says April 2015 corrigendum incorporated | [IEC official record](https://webstore.iec.ch/en/publication/2461), description/product details; public record only, complete authorized text unavailable | Public description identifies changed non-turbulent treatment relative to 1998. Obtain full corrected edition before adopting equations. |
| S2 | ANSI/ISA-75.01.01-2012 (60534-2-1 MOD), *Industrial-Process Control Valves — Part 2-1: Flow capacity — Sizing equations for fluid flow under installed conditions* | 2012; amendments/corrigenda not established from accessible page | [ISA official record](https://www.isa.org/products/ansi-isa-75-01-01-2012-60534-2-1-mod-industrial-pr), title; complete authorized text unavailable | MOD designation is not proof of equivalence. Compare national modifications and whether the later IEC corrigendum is covered. |

No authorized standard was supplied in the attachment. Repository document/file-name searches found the approved specification and generated reports, but no identifiable authorized IEC/ISA text. This is a scoped search finding, not proof about materials outside the workspace. No third-party standard mirror is accepted. A licensed human review may supply a permitted verification record; the license/permission must allow the intended use of equations and fixtures.

### Primary engineering and metrology evidence

| ID | Organization and document | Edition/revision and locator | Official URL; evidence use |
|---|---|---|---|
| M1 | Fisher/Emerson, *Catalog 12: ANSI/ISA/IEC Valve Sizing*, section 2 | PDF has mixed February 2018/June 2017 page footers; pp. 2-2–2-10, Table 2, liquid/geometry/Reynolds sections | [Catalog 12 section 2](https://www.emerson.com/is/content/emerson/en/final-control/flow-controls/documents/cat12_s2.pdf). Read selected pages; not treated as the authorized 2011/2012 standard. |
| M2 | SAMSON, *Cavitation in Control Valves*, Technical Information Part 3, L351 EN | Footer 03/11; pp. 16–17, 43–46; equations 6, 23–26 | [L351 EN](https://www.samson.de/document/l351en.pdf). Pressure-ratio and recovery evidence. |
| M3 | Neles Finland Oy/Valmet, *Flow Control Manual*, ISBN 952-9773-12-9 | 6th edition, 4/2022; Appendix A, printed pp. 109–112 | [Manual](https://www.valmet.com/globalassets/sharepoint/imported/flowcontrol_manual.pdf). Candidate viscous/choked examples; discrepancies retained below. |
| M4 | SAMSON, *Application Notes: Kv coefficient · Valve sizing*, AB 05 EN | Edition March 2012, last-page code 2012-05; p. 1 liquid formulas | [AB 05 EN](https://www.samson.de/document/t00050en.pdf). Simplified density/volume/mass Kv forms; excludes fitting/choking effects. |
| M5 | Spirax Sarco, *Control Valve Capacity*, Learn About Steam module 6.2 | Undated web revision, Table 6.2.1 and conversion paragraph | [Capacity](https://www.spiraxsarco.com/learn-about-steam/control-hardware-electric-pneumatic-actuation/control-valve-capacity). Cv/Kv definitions and rounded conversion reference. |
| M6 | Spirax Sarco, *Control Valve Characteristics*, module 6.5 | Undated web revision; linear/equal-percentage sections, Examples 6.5.1–6.5.2 | [Characteristics](https://www.spiraxsarco.com/learn-about-steam/control-hardware-electric-pneumatic-actuation/control-valve-characteristics). Text/example evidence; equation images failed retrieval, so inverses below are explicitly algebraic derivations. |
| M7 | Spirax Sarco, *Control Valve Sizing for Water Systems*, module 6.3 | Undated web revision; Example 6.3.1; cavitation/flashing section | [Water systems](https://www.spiraxsarco.com/learn-about-steam/control-hardware-electric-pneumatic-actuation/control-valve-sizing-for-water-systems). Simplified water benchmark and screening context. |
| M8 | Valmet, *Flow control manual — Liquid flow* | Undated web revision; §§3.2–3.3, equations 24–32 referenced by page | [Liquid flow](https://www.valmet.com/flowcontrol/valves/flow-control-manual/liquid-flow/). Boundary operator, factor roles and correction sequence; image equations not independently transcribed. |
| M9 | Emerson, Jim Cahill/Reid Youngdahl, *Sizing a Control Valve for Liquid Flow: A Step-by-Step Walkthrough* | 2026-06-10; setup, fittings and iteration sections | [Walkthrough](https://www.emersonautomationexperts.com/2026/valves-actuators-regulators/sizing-a-control-valve-for-liquid-flow-a-step-by-step-walkthrough/). Partial independent publication check, not an independent manufacturer or complete fixture. |
| U1 | NIST, *Guide for the Use of the International System of Units*, SP 811 | 2008 guide, online Appendix B/B.8; alphabetical quantity entries | [B](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors), [B.8](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b8). Distinguishes exact definitions from printed rounded factors. |
| U2 | NIST OWM, *SI Units — Length* | Web updated 2025-09-19; inch redefinition subsection | [Length](https://www.nist.gov/pml/owm/si-units-length). Exact inch/metre definition. |
| U3 | NIST OWM, *SI Units — Volume* | Undated revision in inspected content; common units subsection | [Volume](https://www.nist.gov/pml/owm/si-units-volume). Litre/cubic-metre identity. |
| R1 | Workbench source files listed in §§12–14 below | Repository commit above; function/field locators | Local implementation evidence only, linked below. |
| P0 | Owner-approved Phase 1 specification | Approval 2026-09-27, hash above | [Specification](control_valve_sizing_spec.md); authoritative project policy, not an equation standard. |

Access limitations: Emerson's current *Control Valve Handbook* landing page identifies edition 6, but its linked [D101881X012 PDF](https://www.emerson.com/is/content/emerson/en/final-control/flow-controls/documents/d101881x012.pdf) exceeded the browser tool's size limit. Older handbook URLs and SAMSON `l800en.pdf` were inaccessible. No content from those unavailable documents is claimed verified. Catalog 12 is a separately identified source, not a substitute edition of that handbook. PDF text extraction can lose radicals/subscripts; final AS review must inspect the original equation layouts. No numerical chart has been digitized here.

## 3. Variable dictionary

Ranges below combine P0 input policy with mathematical prerequisites; they do not establish a standard's full applicability domain. All numeric inputs must be finite. A dash in the pressure-basis column means not a pressure quantity. Sources/statuses apply to each row; physical fluid values still require traceable case-specific evidence.

| Symbol | Meaning | Internal SI / permitted display | Pressure basis | Range and qualification | Source/status |
|---|---|---|---|---|---|
| Q, q | Actual inlet volume rate; q denotes the numeric value in an equation's declared units | m³/s / m³/s, m³/h, L/s, L/min, US gpm | — | Q>0 for enabled case; no normal gas volume | P0 §§4,9; M4; ID/SV unit tuple |
| ṁ, w | Mass flow rate | kg/s / kg/s, kg/h | — | >0; Q=ṁ/ρ at real inlet | P0 E1; ID |
| Cv | US conventional capacity coefficient | Tagged Cv number, not an unqualified SI scalar / Cv | Defined using differential pressure | >0; required and rated distinct | M5; P1/SV |
| Kv | Metric conventional capacity coefficient | Tagged Kv number / Kv | Defined using differential pressure | >0; declared bar convention | M4/M5; MP/SV |
| P1 | Upstream static pressure at assembly tap | Pa / Pa, kPa, bar, psi | Absolute internally; explicit gauge input allowed | >0 and >Pv; real anchor mandatory | P0 §§5,7; SV taps |
| P2 | Downstream static pressure at assembly tap | Pa / Pa, kPa, bar, psi | Absolute internally | >0; P2<P1 for supported active case | P0 §§5,16; EA/SV |
| ΔP | Available static drop P1−P2 | Pa / Pa, kPa, bar, psi | Differential only | >0; stability floor §11 below | P0 E1; ID |
| ΔPt, ΔPs | Terminal and effective sizing drops | Pa / same pressure units | Differential | Positive, branch-qualified; ΔPs≤ΔP | P0 E5/E6; MP/SV |
| Pv | Saturation/vapor pressure at case temperature | Pa / Pa, kPa, bar, psi | Absolute | Positive supported value; missing is not zero; subcritical applicability verified | P0 §§6,13; RI/SV |
| Pc | Substance thermodynamic critical pressure | Pa / Pa, kPa, bar, psi | Absolute | >0; not a surrogate for P1 or vena-contracta pressure | P0 §6; RI/SV |
| G, SG | Density relative to explicitly stated reference water density | 1 / SG with reference conditions | — | >0; reference conversion required if bases differ | P0 §9; M4/M5; MP/SV |
| ρ, ρref | Operating and reference density | kg/m³ / kg/m³, g/cm³ | — | >0; no invented water/property values | P0 §§5,6; ID/RI |
| μ | Dynamic viscosity | Pa·s / Pa·s, mPa·s, cP | — | >0; Newtonian liquid | P0 §5; U1; ID/RI |
| ν | Kinematic viscosity μ/ρ | m²/s / m²/s, mm²/s, cSt | — | >0; equation adapter may require cSt | P0 E1; ID |
| T | Operating temperature | K / K, °C, °F | — | >0 K and inside provider/method liquid domain | P0 §6; U1; ID/RI |
| d | Method-defined valve sizing diameter | m / m, mm, in; separate DN/NPS label | — | >0; definition must be reconciled for each equation | P0 §5; SV/MV |
| D1, D2 | Actual upstream/downstream pipe internal diameters | m / m, mm, in | — | >0; catalogue ID, never DN substituted | P0 §7; RI |
| FL | Bare-valve liquid pressure recovery factor | 1 / decimal | — | P0: 0<FL≤1; design/size/travel source required | P0 refinement; MV/SV |
| Fd | Valve geometry/style modifier in applicable Reynolds branch | 1 / decimal | — | >0 when required; no style-derived default | P0 refinement; MV/SV |
| FP, Fp | Piping geometry factor | 1 / decimal | — | >0; evaluate only verified geometry domain, no clamp | P0 E7; P1/SV |
| FLP | Combined valve/attached-fitting recovery factor | 1 / decimal | — | >0; not interchangeable with FL or FLP/FP | P0 E5/E7; P1/SV |
| FF | Liquid critical-pressure ratio factor | 1 / decimal | — | Validated ratio/domain; no clamp | P0 E4; MP/SV |
| FR | Reynolds correction factor | 1 / decimal | — | Positive within verified branch; unity only with evidence | P0 §12; SV |
| Rev | Valve Reynolds number | 1 / number | — | >0 where evaluated; not pipe Reynolds number | P0 E8; SV |
| h, H | Normalized travel and physical stroke/angle | h dimensionless; physical stroke m or angle rad / %, mm, degrees | — | h in qualified controllable interval within [0,1] | P0 E11; EA/MV |
| Rv | Rangeability, maximum/minimum controllable coefficient | 1 / ratio | — | >1 where used; sourced, not seat leakage ratio | P0 §14; EA/MV |
| Cr, Creq, Ctarget | Rated, required and preliminary target Cv or Kv | Same tagged coefficient basis / Cv or Kv | — | Positive; never mix coefficient bases in ratios | P0 §§14,15; EA |
| xF | Cavitation screening pressure ratio | 1 / decimal | Absolute pressures form differential ratios | ΔP/(P1−Pv), P1>Pv | P0 E10; M2; P1/SV |
| K1,K2,KB1,KB2,Σζ,Ki | Attached resistance and signed velocity-reference terms | 1 / decimal | — | Algebraic terms, domain/sign convention verified | P0 E7; M1; P1/SV |
| Kext,f,fT | External fitting loss, Darcy friction and Crane fully turbulent factor | 1 / decimal | — | Existing function-specific domains; not valve factors | R1; RI |
| N1,N2,N4 | Empirical/conventional unit constants | Unit-tuple-specific, not portable SI scalars | — | Only approved tuple/precision; no guessed values | P0 §10; SV |
| Patm,z,v,g | Site atmosphere, elevation, mean velocity, gravity | Pa,m,m/s,m/s² / declared engineering units | Patm absolute | Site atmosphere explicit; elevations use common datum | P0 §§7,9; ID/RI |

## 4. Base turbulent equations and density basis

Identifiers retain P0 E1–E11; suffixes distinguish the checks. These are equation records, not executable instructions for an unverified branch.

| ID / P0 link | Symbolic form and units | Dimensional check (review derivation) | Applicability and evidence/status |
|---|---|---|---|
| E1a / §§9–10 | ΔP=P1−P2, all Pa; Pabs=Pgauge+Patm | Pa−Pa=Pa; absolute offset cancels only for consistently referenced pressures | ID; P0. Do not offset differential pressure. |
| E1b / §§4,6,10 | Q=ṁ/ρ; ṁ=ρQ | (kg/s)/(kg/m³)=m³/s | ID; frozen upstream state. |
| E1c / §§5,10 | ν=μ/ρ | (kg/(m·s))/(kg/m³)=m²/s | ID; no empirical viscosity approximation. |
| E1d / §9 | G=ρ/ρref; Gmethod=Ginput·ρref,input/ρref,method | Density ratios dimensionless | ID arithmetic; SV reference convention. |
| E2v / E2 | Cv=qUS/sqrt(ΔPpsi/G), N1=1 for US gpm/psi | Cv carries the conventional flow/square-root-pressure normalization | M1/M5; MP/SV; turbulent, non-choked, no attached correction. |
| E2k / E2 | Kv=qH/sqrt(ΔPbar/G); equivalently qH·sqrt(ρ/(1000·ΔPbar)) for the explicitly stated 1000 kg/m³ reference | qH in m³/h, density ratio dimensionless, pressure normalized to bar | M4/M5; MP/SV. The 1000 is a reference convention, never a supplied liquid density. |
| E2m / E1+E2 | qH=3600ṁ/ρ before E2k; same conversion before E2v using US gallon units | Mass route reduces to volume route with identical operating ρ | ID conversion; sizing inherits E2 SV. Avoid an extra mass-form empirical constant. |
| E3 / §§10–11 | q=N1·FP·C·sqrt(ΔPs/G) | N1 must carry the selected flow/coefficient/pressure normalization; FP dimensionless | P0 family, M1 corroboration; P1/SV. Not a universal viscous formula. |

Numerical constant register: M1 Table 2 supplies the Cv tuple `(q=m³/h, pressure=bar): N1=0.865` and `(q=US gpm, pressure=psi): N1=1`. For Cv with d in inches, N2=890; with q in US gpm and ν in cSt, N4=17300. These are **printed source values**, not approved exact constants. N2/N4 applicability remains unresolved for E7/E8. No Kv N2/N4 set is approved. Do not combine a Kv coefficient with Cv geometry constants, or SI Q/ν/d with these customary constants. [M1](https://www.emerson.com/is/content/emerson/en/final-control/flow-controls/documents/cat12_s2.pdf), Table 2, p. 2-3.

Cv/Kv conversion E2c: M5 gives `CvUS=1.156099 Kv`, rounded. For equal reference-density conventions, derive `Kv/Cv = (US_gallon_m³ × 60) × sqrt(Pa_per_bar/Pa_per_psi)`. Unequal references additionally require `sqrt(ρref,Cv/ρref,Kv)`. This is dimensional/algebraic inference, not verification of the standards' reference-water conventions. Therefore the production full-precision conversion factor remains **SV/NI**. Never implement both 0.865 and 1.156 as independently rounded inverse conversions. See §12 for the precision gate.

Eligibility precedes arithmetic: pure Newtonian liquid, actual inlet flow, positive valid pressure drop, frozen properties, appropriate taps, demonstrated turbulence and non-choking. Missing recovery data may permit an explicitly diagnostic E2 base value after branch verification; it cannot establish completed sizing. No numerical density, viscosity, Pv, Pc, FL or Fd may be invented to complete eligibility.

## 5. Liquid critical-pressure ratio factor

E4, P0 §§10,13: `FF=0.96−0.28 sqrt(Pv/Pc)`. Evidence: M2 equation 24, p. 44 and M1 p. 2-4; **MP/SV**, not AS. Pv/Pc is dimensionless only when both pressures use identical absolute units; compute internally in Pa. The coefficients are dimensionless empirical values, not unit conversions.

M2 relates FF to the critical vena-contracta pressure divided by vapor pressure; that local pressure is distinct from thermodynamic Pc. [SAMSON L351 EN](https://www.samson.de/document/l351en.pdf), equations 23–24. This supports interpretation, not general applicability to every liquid.

P0 eligibility supplies positive Pc and applicable Pv at operating T. Exact empirical limits, permitted fluid classes and near-critical exclusions remain SV; do not infer a complete validity interval merely because the square root is real. Missing Pc or Pv, invalid ratio, unsupported state or nonpositive derived driving pressure produces null FF/dependent assessment and a specific reason. No zero, water Pc, guessed mixture critical point or numerical clamping.

## 6. Choked-flow determination and numerical boundary

P0 E5/E6, §§11,13: `ΔPt,bare=FL²(P1−FF Pv)`; `ΔPt,attached=(FLP/FP)²(P1−FF Pv)`; `ΔPs=min(ΔP,ΔPt)`. M1 p. 2-6 and M3 Appendix A support the terminal family (**MP/SV**). Use E3 with ΔPs, preserving actual P2. Algebraically its choked attached limit is `q=N1 C FLP sqrt((P1−FF Pv)/G)`; the FP cancels. This cancellation is a dimensional/continuity check, not a separate approved equation. A formula leaving an extra FP or dividing by FP again must be reconciled, not patched by calibration.

Both terminal expressions have pressure dimensions. FL is necessary for completed bare recovery; attached assessment requires qualified FP/FLP and their underlying data. FL alone is not an incipient-cavitation threshold.

M8 explicitly uses `ΔP≥ΔPt` at choking. [Valmet liquid flow](https://www.valmet.com/flowcontrol/valves/flow-control-manual/liquid-flow/), §3.2, equation 25 discussion. Pending AS confirmation, retain raw mathematical comparison separately from a proposed numerical boundary flag:

`δ=ΔP−ΔPt`; `ε=max(1 Pa, 1e-6·max(|ΔP|,|ΔPt|))`.

This ε is a **proposed EA software comparison policy requiring engineering validation**, not a standard allowance or physical uncertainty model. It borrows the scale of P0 §16's pressure-consistency policy but does not claim that approval automatically extends to choking. Measurement uncertainty must be handled separately and may be much larger. Never perturb ΔPs to force a category.

| Decision branch | Exact proposed comparison | Result |
|---|---|---|
| Non-choked | δ<−ε | `non_choked`; raw limiting flag false; use exact min formula. |
| Boundary | −ε≤δ≤ε | `near_choking_boundary`; raw `at_or_above_limit=(δ≥0)` retained; at δ=0 both equations coincide. |
| Choked | δ>ε | `choked`; extra available drop does not lower required turbulent capacity. |
| Indeterminate | Missing/invalid factor or property, unsupported branch, nonpositive ΔPt | No limit comparison; null dependent results with missing-field/method reason. |

The table is not implementation-ready until AS and ε validation are complete. Boundary tests must cover equality, both ε endpoints and just outside them. P0 still treats the mathematical limit as reached at equality; the numerical flag must not misrepresent equality as definitively non-choked.

## 7. Attached fittings and correction ownership

E7, P0 §§7–8,10,12. Record the candidate geometry relationships, not a released geometry library:

`FP=[1+(Σζ/N2)(C/d²)²]^(-1/2)`; `Σζ=K1+K2+KB1−KB2`.

`FLP=[1/FL²+(Ki/N2)(C/d²)²]^(-1/2)`; `Ki=K1+KB1`.

M1 pp. 2-3–2-4 supports these forms (**P1/SV**); source typography and exact d/Ki domains require AS review. `(C/d²)²/N2` must be dimensionless for the chosen conventional coefficient and diameter unit. FLP then is dimensionless. The diameter symbol cannot be switched between nominal valve size, actual pipe ID and trim bore.

| Geometry branch | Required sequence / review condition | Readiness |
|---|---|---|
| Same-size, no attached fittings | Establish actual no-attachment case; Σζ=Ki=0 gives FP=1 and FLP=FL algebraically | Limit identity checked; physical applicability SV. |
| Upstream reducer only | Determine inlet resistance and inlet velocity-reference term from verified geometry; outlet term only if its reference geometry calls for it | Full contraction coefficients, angle/length limits and taps SV. |
| Downstream expander only | Determine outlet resistance and signed outlet velocity-reference term; do not add downstream loss to inlet Ki indiscriminately | Full expansion domain SV. |
| Smaller valve between larger equal pipes | Both attachments; inlet/outlet Bernoulli terms cancel in Σζ if truly equal, but inlet Ki need not vanish | Geometry/source verification required. |
| Unequal pipes / combined fittings | Preserve signed inlet/outlet reference terms; no assumption of cancellation; ensure applicable assembly model | SV/MV, otherwise NI. |
| Unsupported fitting geometry | No borrowed Crane coefficients or guessed reducer equations | NI; manufacturer/standard evidence needed. |

Short concentric-reducer formulas are located in M1 p. 2-4, but are not promoted into an approved universal coefficient set. The reviewer must record their exact coefficients, permitted geometry and edition reconciliation before implementation. Dimensional consistency alone cannot validate empirical contraction losses.

Correction sequence required by P0: freeze properties and physical dimensions; choose a verified coefficient basis/unit tuple; evaluate attached factors for trial C; evaluate terminal drop; use the verified turbulent/viscous branch; solve the C residual within the verified domain. C-dependent factors require local iteration, not a network operating-point solver. Travel-dependent factors require qualified data at each trial travel. Never universally multiply FP and FR without an explicitly verified combined branch.

Each imported element receives one role: `external_line_loss`, `attached_inlet`, `attached_outlet`, `replaced_control_valve`, or `excluded_with_reason`. Attached reducers/expanders are removed from both external Crane K and precomputed known-ΔP contributions; their dimensions stay in the assembly snapshot. Reject duplicate IDs and inseparable lumped losses. Preserve kinetic/elevation reference terms; removing a resistance does not remove a physical area change. Do not mutate the source scenario. This ownership rule is approved EA; attached coefficients remain SV.

## 8. Reynolds correction: unresolved method reconciliation

E8 from P0 §10 is the candidate family:

`Rev=[N4 Fd q/(ν sqrt(C FL))]·[1+FL²C²/(N2 d⁴)]^(1/4)`.

Dimensional obligation: the bracket is dimensionless with N2's declared coefficient/length normalization; N4 converts `q/(ν sqrt(C))` to a dimensionless number. It is **not** dimensionally valid to declare N4 unitless and insert arbitrary SI values. Algebraic structure checked; full numeric dimensional closure is **incomplete** until diameter, unit tuple and constants are verified.

Important direct-source difference: M1 p. 2-6 uses **pipe internal diameter D** and a pseudo coefficient; pp. 2-7–2-8 distinguish sizing, flow-prediction and pressure-prediction procedures. Its size-selection branch labels Rev<56 laminar and Rev>40000 turbulent. These are **source-specific observations, not approved project thresholds**. P0's E8 uses d and envisages a verified method pack. Do not transplant those thresholds, generic style factors or a chart into the IEC 2011 branch. [M1](https://www.emerson.com/is/content/emerson/en/final-control/flow-controls/documents/cat12_s2.pdf).

E9 remains `FR=verified_method(Rev,coefficient/diameter basis,trim branch,qualified factors)`, **SV/NI**. No complete reviewed piecewise FR algorithm, transition equality rules or reduced/full-trim criteria has been established. M8 points to a manufacturer graph; a graph is not a verified analytical interpolation rule. S1's revision note reinforces the need to reconcile editions. Numeric low-Re and transitional thresholds for the adopted standard: **unassigned, blocking**.

Approved Fd policy is unchanged: require sourced Fd only when the applicable verified Reynolds procedure needs it. Missing Fd cannot itself establish turbulence. Independently demonstrated turbulence may permit a base branch without Fd if the AS methodology permits; record evidence and `not_required`, not a fabricated Fd. Missing a required factor/evidence produces `REYNOLDS_INDETERMINATE`. FL is independently required for completed recovery/choking. Globe, segmented-ball and butterfly remain descriptive categories; neither FL nor Fd follows from their label.

P0 §8 numerical solver policy: at most 20 bracket expansions and 80 bisections; recompute C-dependent factors, freeze fluid/geometry; require relative flow residual and relative coefficient bracket width both ≤1e-6 with validated positive normalization floors. These are project numerical proposals, not standard constants. A no-bracket/domain/nonfinite/nonconvergent result returns null corrected coefficient/travel and recorded diagnostics, never the final failed iterate as success. A future reviewer must prove that the selected branch admits the proposed bracket/monotonicity assumptions. The generic solver scaffold does not authorize an unverified FR function.

## 9. Cavitation and flashing screening

P0 §§10,13 and decision 15 govern outputs. E10 `xF=ΔP/(P1−Pv)` is dimensionless; it requires real absolute P1/Pv and P1>Pv. M2 equation 6 supports the ratio; its threshold discussion is fluid/test dependent. **P1/SV** for the method, **MV** for actual thresholds. The source's water-test caveats prevent treating a valve's laboratory onset number as universally transferable.

| Branch | Defensible output and required evidence |
|---|---|
| P1≤Pv or non-liquid inlet | Unsupported inlet condition; no completed liquid sizing. |
| P1>Pv and P2≤Pv | Flashing screening per P0, including equality as an approved conservative boundary convention. Separate from choking and downstream two-phase calculation. |
| Qualified E5 limit reached | Choked-liquid flag; no automatic incipient/significant/damage label. |
| P2>Pv with valid xF, no applicable threshold | **Cavitation assessment indeterminate — manufacturer data required.** |
| Applicable inception/significant threshold supplied | Compare only using its verified pressure scaling, fluid, size, travel and uncertainty rules. Preserve source and threshold type; do not rename one manufacturer's index as another's. |
| Data incomplete | Name the missing assessment/property/factor, retain only unaffected diagnostics. |

M7's cavitation/flashing discussion corroborates the physical distinction; it is not a universal damage model. FL-only recovery does not establish inception, severity, acceptable noise, erosion life or suitability. A damaging-cavitation classifier is outside Phase 1; verified incipient/significant screening still makes no damage-prevention claim. Without thresholds neither “no predicted issue” nor a reassuring suitability statement is allowed. Vendor confirmation remains mandatory.

## 10. Rated coefficient and inherent-opening algebra

P0 E11/§14 approves idealized characteristic models. M6's proportional linear and equal-percentage descriptions support the model family (**P1**); the following normalization and inverse are **ID derivations of approved EA models**, not a manufacturer's curve or installed process response.

Let `r=Creq/Cr`, `h=H/Hrated`, `Rv=Cmax/Cmin>1`. All ratios are dimensionless and coefficient bases must match.

| ID | Forward / inverse | Dimensional and endpoint check |
|---|---|---|
| E11L | Cavailable=Cr·h; h=r | Same coefficient units; r=h=1 at rated travel. |
| E11E | Cavailable=Cr·Rv^(h−1); h=1+ln(r)/ln(Rv) | Log/exponent arguments dimensionless; h=1 gives Cr; modeled h=0 gives Cr/Rv. |
| E11R | Rv=Cmax/Cmin over the qualified controllable interval | Definition requires a nonzero minimum controllable capacity, not a leakage specification. |

The modeled equal-percentage endpoint at h=0 is not physical shutoff leakage. Do not return nonzero shutoff flow as a prediction; enabled zero-flow sizing is invalid. A real minimum controllable travel may exceed that mathematical endpoint. Below qualified range: null operational travel plus `below_controllable_range`; r>1: null plus `above_rated`, never clamp to 100%. Missing/nonfinite/≤1 rangeability blocks equal-percentage inversion. Linear inversion may be displayed without Rv but controllability remains unassessed without its limits.

Qualified manufacturer curves take precedence and prohibit extrapolation. If recovery/geometry/Reynolds factors depend on travel, a ratio inversion alone is insufficient: solve the verified capacity relation using qualified travel data. No generic quick-opening model. Keep unrounded internal values; P0's display proposal is three significant figures and 0.1 percentage-point travel, not an accuracy guarantee. Manufacturer curve qualification and independent opening benchmarks remain release obligations.

## 11. Margin, opening bands and stability policy

E12 / P0 §15: `Cmax=max(valid enabled Creq)` and `Ctarget=Cmax(1+m)`, with approved configurable default m=0.10. Margin amount is `m Cmax`, in the same tagged Cv/Kv basis. These are **EA/ID**, not IEC allowances. Required coefficient, Q, ΔP, FF, choking and cavitation remain unchanged. Display required, margin amount/percentage, target and selected rating separately. Incomplete enabled cases cannot contribute to a completed recommendation. Maximum flow is not necessarily governing required C.

P0 §14 preliminary opening guidance: minimum 10–40%, normal 40–70%, maximum 70–90%; configurable, vendor-qualified limits take precedence. No IEC/ISA or vendor guarantee. For a monotone idealized normalized curve f(h), the per-case rating interval is `[Creq/f(hhigh), Creq/f(hlow)]` where f(hlow)>0; intersect across valid cases and compare separately with Ctarget. This is **ID inference from P0 §§14–15**, not product selection. Empty intersection reports no single rating meeting targets. No preferred-number or commercial valve selection.

P0 §16 positive near-zero floors: `0<Q≤1e-9 m³/s` and `0<ΔP≤1 Pa` block by default for numerical stability. They are not engineering applicability limits. Nonpositive values remain invalid, irrespective of overrides. A documented project-specific floor requires explicit validation of units, numeric stability and method domain, plus reviewer/rationale/policy version. It cannot waive SV/MV limits. The separate proposed choking comparison ε in §6 is not automatically approved by this floor policy.

## 12. Unit conversion and repository utilities

U1/U2/U3 plus P0 §9 support the following registry. Each multiplicative conversion preserves the named physical dimension; temperature requires an affine transformation. Reverse conversion uses the **same** factor's reciprocal. These are review checks/planned test oracles, not tests run against a new implementation.

| ID | To internal SI | Independent anchor / reverse check | Status |
|---|---|---|---|
| U-P | Pa unchanged; kPa×1000; bar×100000; psi×6894.757 | 1 bar→100000 Pa→1 bar. NIST printed psi factor is rounded; do not label exact. | ID for exact units; P1 rounded psi pending precision choice. |
| U-Q | m³/h÷3600; L/s÷1000; L/min÷60000; US gpm×0.003785411784÷60 | 60 L/min→0.001 m³/s→60; 1 US gpm≈6.309020e-5 m³/s in U1 | ID/P0 exact gallon value; U1 corroborates at published precision. |
| U-M | kg/h÷3600; kg/s unchanged | 3600 kg/h→1 kg/s→3600 | ID, time units. |
| U-T | K=°C+273.15; K=(°F−32)·5/9+273.15 | 32 °F↔0 °C↔273.15 K; differences have no offset | ID, U1. |
| U-RHO | g/cm³×1000; SG×declared ρref | 1 g/cm³↔1000 kg/m³; SG route requires nonzero reference | ID, U1; reference convention SV. |
| U-MU | mPa·s and cP×0.001 | 1 cP↔0.001 Pa·s | ID, U1. |
| U-NU | mm²/s and cSt×1e-6 | 1 cSt↔1e-6 m²/s; also E1c | ID, U1. |
| U-D | mm×0.001; in×0.0254 | 1 in↔25.4 mm↔0.0254 m | ID, U2. |
| U-C | Cv/Kv E2c, using one reviewed multiplier and reciprocal | M5 rounded anchor: Kv=1→CvUS=1.156099 | P1/SV, not approved full-precision registry. |

Precision disposition: NIST B.8 prints rounded psi and US-flow factors. P0's exact gallon definition is retained; its higher precision must not be inferred from NIST's rounded row alone. Before production, verify an exact psi derivation from authoritative force/mass/length definitions and pin it with its reference. Do not silently elevate 6894.757 to an exact definition. A unit-only rounded-reference check is permissible; a release coefficient adapter is blocked until psi precision and water-reference conventions are reconciled. The rounded M5 coefficient conversion is a comparison anchor, not an approved exact multiplier.

Proposed computational round-trip tolerance: relative 1e-12 for nonzero exact multiplicative conversions, absolute 1e-10 K for ordinary temperature anchors; source-rounding comparisons use the printed last-place interval instead. These are new test-policy proposals, not property accuracy claims. Round-trip agreement alone cannot detect two mutually consistent wrong constants; every conversion needs its external anchor and dimensional assertion. Reject unknown units, NaN/Infinity, ambiguous gallons, liquid Nm³/h, pressure-basis mismatches and DN-as-ID.

Repository findings (RI):

- [backend/main.py](../backend/main.py), `normalize_flow_unit`, and `frontend/app/page.tsx`, `normalizeFlowUnit`, normalize aliases; they are not general numerical conversion functions.
- [engineering/hydraulics.py](../engineering/hydraulics.py), `calculate_mass_flow`, handles kg/h, kg/s, m³/h and m³/s through `get_fluid_state`; use only validated frozen liquid data for reuse. Its normal-volume branch is not eligible for this module.
- [engineering/fluids.py](../engineering/fluids.py) already converts °C↔K and bar↔Pa internally. Preserve interface units; do not reapply factors to already-SI values.
- [engineering/piping.py](../engineering/piping.py) returns ID in mm; hydraulic element handling converts mm to m.
- No reusable complete tagged unit registry, psi/US-gpm/Cv-Kv converter, SG-reference reconciler, gauge/differential validator or cP/cSt/°F valve-input adapter was found in the inspected engineering/backend/library paths. These need small independently tested adapters later, not edits now.

## 13. Fluid-property mapping and freeze contract

Source: R1 [engineering/fluids.py](../engineering/fluids.py), `get_fluid_properties`, `_get_properties_coolprop`, `_get_properties_thermo`, `_properties_are_usable`; [backend/main.py](../backend/main.py), `FluidConfig` and `FluidPropertyRequest`. Status **RI**, mapping verified by source inspection; numerical property validity **not independently benchmarked**.

| Valve quantity | Existing output / conversion | Availability and adaptation |
|---|---|---|
| ρ | `density_kg_m3`, already SI | Provider usability check covers positive density; strict finiteness/liquid applicability still needed. |
| μ | `dynamic_viscosity_pa_s`, already SI | Positive viscosity covered by usability check; strict state/applicability checks needed. |
| ν | No dedicated output; derive μ/ρ | E1c, retain derivation provenance. |
| Pv | `vapor_pressure_bar_a`×100000 | Conditional, may be null; CoolProp saturation lookup at case T and thermo Psat are provider routes. No zero fallback. |
| Pc | `critical_pressure_bar_a`×100000 | Engine exposes it conditionally; existing backend `FluidConfig` has no field. Strict valve adapter must preserve it. |
| T, P1 | `temperature_c`+273.15; `pressure_bar_a`×100000 | Existing call accepts real T/P; validate returned conditions match case. |
| Phase | `phase_label`, `phase_type` | Validate supported liquid and pure-substance eligibility, not density alone. |
| Provider identity | `_property_provider`, `_provider_fluid_id`, `fluid`, `display_name` | Preserve backend metadata; public fluid-property response strips underscore metadata. |
| Extended provenance | Provider version, timestamp, property references, override actor/reason and snapshot hash | Not all supplied by current engine; adapter must add accurate metadata rather than fabricate it. |

The current usability predicate only checks density/viscosity. It cannot certify Pv/Pc completeness or the mixture gate. `FluidConfig` has water-like defaults; `get_fluid_state` includes permissive manual defaults. Neither may supply absent valve properties. Pump `freeze_pump_fluid_properties` demonstrates real-source-pressure freezing, but its pump-specific snapshot is not the complete valve contract. Do not reuse a pump datum as physical valve P1 or discard Pc/provenance during replay.

Per P0 §§6–8: evaluate at real inlet P1/T, once per distinct case state, freeze ρ/μ/ν/Pv/Pc and provenance through iteration/save/report. Provider fallback is allowed only with actual provider recorded and complete validated properties; no untraceable cross-provider patchwork. Manual overrides need units/source/reason and original automatic value. The deterministic replay flag must not relabel automatically resolved properties as user measurements.

Initial scope is supported pure liquids. Mixtures require all properties from the existing provider with verified applicability, as a gated extension; manual completeness cannot bypass that gate. If linked pressure cannot be established without coupling, require a validated frozen hydraulic state or explicit real P1 rather than silently implementing coupled property/pressure iteration.

## 14. Crane and hydraulic mapping

Source inspection is **RI**, not a new verification of Crane equations. No existing calculation is changed. Workbook `crane_resistance_coefficient_K_database.xlsx` SHA-256: `F8802C83B5A8CE417BA4738A00DAC6614ACD1BAA9DE67BA0C099FDFBE1EFA057`; underlying Crane publication edition and independent fixture rights remain to be established.

| Needed quantity | Existing reusable function/model and fields | Reuse boundary |
|---|---|---|
| External straight-pipe loss | `hydraulics.calculate_velocity`, `friction_factor`, `calculate_pressure_drop`; `solve_line` element `pipe_friction_dp_bar` | Darcy/pipe regime is not valve Rev/FR. Freeze validated liquid properties; respect existing domains. |
| External fitting loss | `fittings.get_fitting_catalog`, `calculate_database_k`, `get_crane_ft`, `calculate_fitting_k` | Preserve `k_each`, `k_total`, quantity, method, fT/multiplier and override provenance; use documented local velocity basis. |
| External total/partition | `solve_line`: `resistance_dp_pa`, `static_dp_pa`, `total_dp_pa`; per-element local/equipment/elevation fields | Distinguish irreversible loss from static/reference changes; do not treat total as friction alone. |
| Static pressure anchors | `solve_line`: `pressure_in_bar_a`, `pressure_out_bar_a`, pressure profile, actual inlet parameter | Only valid at declared physical boundaries; synthetic datum/system-curve profiles are not actual valve pressure. |
| Available valve drop | New one-way adapter around existing external-loss outputs | No current general valve tap-budget function. Requires source/sink static pressures, elevation/velocity terms, known pump head and excluded assembly. |
| Attached ownership | Backend `LineElement`: `id_mm`, `k_total`, `known_dp_bar`, `database_selection`, fitting metadata | Existing model does not provide the complete valve ownership ledger; add immutable snapshot IDs/roles later. |
| Actual pipe ID | `piping.get_piping_catalog`, `get_internal_diameter_mm(nps,schedule)`, `get_roughness_mm` | ID is OD−2 wall; no DN-as-ID or independent replacement tables. |

Local sources: [hydraulics.py](../engineering/hydraulics.py), [fittings.py](../engineering/fittings.py), [piping.py](../engineering/piping.py), [backend models](../backend/main.py).

E13 / P0 §7: a one-way energy balance supplies external losses and real valve tap pressures at prescribed flow. Existing external relations include `v=Q/A`, `ΔPpipe=f(L/D)ρv²/2`, `ΔPfitting=Kextρv²/2` and elevation `ρgΔz`. Dimensional check: `(kg/m³)(m²/s²)=Pa`; each resistance multiplier is dimensionless. These are repository-observed relations, **RI/ID dimensions**, not newly AS-certified equations. The full boundary budget must retain kinetic-energy reference terms (and applicable velocity-profile assumptions), not simply subtract irreversible losses from two static pressures with unequal diameters. Independent source/sink worksheet and tap audit remain mandatory.

## 15. Independent benchmark register

All entries require an independent engineer's review before release. Values below are either minimal published data explicitly attributed, or transparently derived identity checks; none was generated by a prospective valve engine. `Missing` means no approved numerical oracle is available, not zero. Source edition/version is inherited from §2 where referenced. A candidate with incomplete inputs, unresolved typography or wrong applicability is a **release blocker**, not a passing benchmark.

Copyright disposition: `Factual candidate` means only isolated factual input/output values and original test wording are proposed; no chart/table/explanatory text reproduction. Fixture-use review is still pending, so this record does not assert a license for redistribution. `Own identity` requires no copied example; it still needs independent arithmetic review. No complete source table is approved for encoding.

| ID / coverage | Source and inputs | Expected output / units | Rounding and proposed tolerance | Status / fixture disposition |
|---|---|---|---|---|
| B01 Base Cv | M5 definition, P0 E2v: independently construct reference-water case, 1 US gpm and 1 psi, G=1 | Cv=1 by definition | Exact definition anchor; proposed relative 1e-12 arithmetic | Own identity; reference convention and complete turbulent/non-choked state qualification missing, SV blocker. |
| B02 Base Kv | M7 Example 6.3.1: water, q=10 m³/h, Kv=16, G=1 | Published graphical ΔP≈0.4 bar; independent simplified algebra gives 0.390625 bar | Chart is coarse; proposed ±0.05 bar only for chart comparison. Derived arithmetic oracle needs separate sign-off | Factual candidate + own derivation; not a complete operating-state fixture. |
| B03 Cv/Kv | M5 conversion: Kv=1 | CvUS=1.156099 | Six decimal places; proposed ±0.0000005 on printed comparison, reciprocal check separately | P1/SV; factual candidate; exact adopted convention unresolved. |
| B04 Choked flow | M3 pp.111–112: q=40 m³/h, T=20 °C, P1=10/P2=1.5 bar(a), G=1, Pc=221.2 bar(a), d=D1=D2=50 mm, FL=0.9; Pv conflict below | Printed FF=0.957, ΔPt=8.08 bar, Cv=16.3 | Printed 3 decimals, 2 decimals, 1 decimal; tolerance unapproved until input conflict resolved | P1/NI; factual candidate; special Q-Trim example outside initial scope, cannot validate ordinary trim release. |
| B05 Choking boundary | Future authorized worked example plus signed below/equal/above-limit derivative cases | Missing complete numeric fixture; expected operator logic in §6 only | Exact branch outside validated ε; continuity tolerance must be reviewed | Missing, release blocker; no fixture approved. |
| B06a Attached reducer FP subcase | M1 pp.2-8–2-9: d=3 in, D1=D2=8 in as used by source, trial Cv121, N2=890, identical concentric attachments | Printed Σζ1.11, FP0.90 | Two decimals; proposed ±0.005 for printed-factor comparison only | P1/SV; factual candidate. Source's nominal/actual diameter treatment needs reconciliation; not a converged sizing oracle. |
| B06b Attached FLP/full sizing | M9 partial propane example: 3-inch valve, rated Cv121, FL0.89, N1=1,N2=890; complete state/geometry tuple not provided there | Printed FLP0.81, ΔPt171 psi, required Cv125.7 | Rounded outputs; tolerance withheld pending complete tuple/edition reconciliation | P1/NI; factual candidate only. Need upstream-only, downstream-only and unequal-pipe cases too. |
| B07 Low-Re/viscous | M3 pp.109–110: D-series ball, q100 m³/h, T85 °C, P1/P2=42/41.2 bar(a), G0.9, ν10000 cSt, d=D1=D2=100 mm, FL0.76, trial Cv320, example Fd1 | Printed Rev51.8, FR0.35, Cv323 | Source decimals/whole Cv; proposed ≤1% only after chart/domain reconciliation | P1/NI; factual candidate; example Fd is not a generic default. Pv/Pc and complete branch evidence still missing. |
| B08 Linear opening | M6 linear example: h=40%, constant ΔP | 40% full flow/pass area | Published percentages; compare normalized algebra at relative 1e-12 | P1/EA model check; factual candidate, not physical valve validation. |
| B09 Equal-percentage | M6 Example 6.5.1: full flow10 m³/h, Rv50, h50%, fixed ΔP | q=1.414 m³/h | Three decimals; proposed ±0.0005 m³/h; inverse test uses unrounded independently derived reference | P1/EA; factual candidate, manufacturer qualification still required. |
| B10 Fluid engine | Independent pure-liquid property reference at specified real P1/T, pinned provider version | ρ/μ/Pv/Pc expected values missing | Property-specific uncertainties; no blanket percentage | Missing, release blocker; engine output cannot create its own reference. |
| B11 Crane external loss | Workbook hash §14 plus authorized independent Crane example, exact geometry/quantity/velocity basis | K and ΔP expected values missing | Source precision plus independently reviewed hydraulic residual | Missing, release blocker; workbook alone is not independent evidence. |
| B12 No double counting / pressure budget | Signed worksheet with separate attached/remote element IDs, source/sink elevation/velocity/pressure and pump input | Missing numeric ΔP/P1/P2; each ID exactly one owner is an independent structural invariant | Exact ledger membership; pressure tolerance requires worksheet review | Ownership rule EA-ready; numeric integration benchmark missing, release blocker. |
| B13 Unit identities | §12 anchors, U1/U2/U3 and P0 | Explicit SI/reverse values in §12 | Exact vs rounded checks separated | ID; own identity, review pending; psi/full-precision Cv-Kv not cleared. |
| B14 Margin/disabled cases | P0: synthetic required coefficients 10 and20 in one basis; m0.10 | Cmax20, margin2, target22; required values unchanged | Exact elementary arithmetic; independent review before encoding | EA/ID, own identity; not valve sizing validation. |

Matrix references to B06 include B06a and B06b. The FP-only subcase has sufficient inputs for a source comparison; it does not cure the missing full-state/recovery fixture.

Conflicts that must not be silently repaired:

- **M3 choked example:** its input lists Pv=0.03 bar(a), while substitution uses 0.023. Record both; neither is silently chosen. Its Q-Trim opening is not a generic characteristic benchmark. Obtain a corrected source and an in-scope ordinary-trim case.
- **M1 versus M9 reducer iteration:** M1 p.2-10 prints final Cv116.2; M9 prints116.6. Independent arithmetic from the rounded `800/(0.97 sqrt(25/0.5))` is approximately116.63617. This demonstrates a discrepancy; it does not establish the unrounded, converged oracle or authorize averaging/loosening tolerance.
- **M3 viscous example:** the fluid description is oil but a flow-input label says water; Fd and chart-derived FR are example-specific. Resolve intended fluid and chart/standard branch before fixture approval. Do not adopt an Fd=1 rule for ball valves.

Missing independent release-ready benchmarks therefore include base Cv/Kv full-state cases, adopted conversion convention, ordinary-trim choking and boundary cases, all attachment orientations, the adopted low-Re algorithm, physical curve qualification, fluid-state integration, Crane loss and the complete no-double-counting energy budget. Located opening examples and definition checks support early algebra tests but do not clear the module's release gate.

## 16. Equation and decision traceability matrix

`Ready` below means evidence supports isolated implementation after a separate request, not code exists or tests passed. `Blocked` requires the cited verification. All production-release cells remain conditional; no module release is approved. Planned unit-test names denote tests in a future `tests/test_control_valves.py` unless adapters warrant separate files.

| Equation / decision | P0 section | Source/status | Planned Python function | Planned test | Benchmark | Implementation / release |
|---|---|---|---|---|---|---|
| E1a pressure basis | 5,9,10,16 | P0/U1 ID | `normalize_pressures` | `test_absolute_gauge_drop` | B13 | Exact SI ready; psi precision blocked / pending tests |
| E1b mass-volume | 4,6,10 | P0 ID | `actual_volume_flow` | `test_frozen_density_mass_basis` | B01,B13 | Ready / independent review |
| E1c viscosity | 5,9,10 | P0/U1 ID | `kinematic_viscosity` | `test_viscosity_dimensions` | B13 | Ready / independent review |
| E1d density reference | 5,9 | P0 ID+SV | `normalize_specific_gravity` | `test_reference_density_required` | B01–B03 | Explicit-reference arithmetic ready; standard reference blocked / blocked |
| E2v/E2k/E2m base sizing | 10–11 | M1/M4/M5 MP+SV | `required_turbulent_coefficient` | `test_base_cv_kv_mass_equivalence` | B01,B02 | Blocked / blocked |
| E2c / U-C conversion | 9 | M5 P1+SV | `convert_capacity_coefficient` | `test_cv_kv_reference_reciprocity` | B03 | Blocked / blocked |
| E3 installed turbulent | 10–12 | P0/M1 P1+SV | `predict_installed_liquid_flow` | `test_installed_capacity` | B06 | Blocked / blocked |
| E4 FF | 10,13 | M1/M2 MP+SV | `critical_pressure_ratio` | `test_ff_missing_pc_domain` | B04 | Blocked / blocked |
| E5 bare limit | 10,13 | M1/M3 MP+SV | `terminal_drop_bare` | `test_bare_choking` | B04,B05 | Blocked / blocked |
| E5 attached limit | 10,12,13 | M1/M3 MP+SV | `terminal_drop_attached` | `test_flp_fp_limit` | B05,B06 | Blocked / blocked |
| E6 min/boundary | 10,13,16 | P0/M8 SV; ε proposed EA | `classify_choking` | `test_choking_equality_band` | B05 | Physical branch/ε blocked / blocked |
| E7 FP/FLP | 7,10,12 | M1 P1+SV | `attached_geometry_factors` | `test_factor_unit_tuple` | B06 | Blocked / blocked |
| Same-size/none limit | 7,12 | P0/E7 ID limit, SV domain | `validate_attachment_geometry` | `test_no_attachment_limit` | B06 | Structural input check ready; physical factors blocked / blocked |
| Inlet/outlet/combined/unequal attachments | 7,12 | M1/M8 SV | `attached_loss_terms` | `test_attachment_orientations` | B06 | Blocked / blocked |
| E8 valve Reynolds | 10,12 | P0/M1 conflicting definitions, SV/NI | `valve_reynolds` | `test_diameter_branch_and_units` | B07 | Blocked / blocked |
| E9 laminar/transitional FR | 10,12 | SV/NI | `reynolds_correction` | `test_verified_transition_edges` | B07 | Blocked / blocked |
| Turbulence evidence / absent Fd | 5,12 | P0 EA, method SV | `validate_regime_evidence` | `test_missing_fd_conditional` | B01,B07 | Completeness scaffolding ready; branch proof blocked / blocked |
| Factor provenance / styles | 5,12,27 | P0 EA/MV | `validate_factor_applicability` | `test_no_style_defaults` | B06,B07 | Structural validation ready; actual factors MV / blocked |
| E10 xF and cavitation thresholds | 10,13 | M2 P1/SV/MV | `screen_cavitation` | `test_indeterminate_without_thresholds` | B05 + missing onset fixture | Required-message guard ready; classifier blocked / blocked |
| Flashing/inlet-phase screening | 3,13,16 | P0 EA; M7 P1; state validation | `screen_flashing` | `test_p2_pv_equality` | B04 + missing boundary fixture | Guard/comparison algebra ready; physical qualification pending / blocked |
| E11L/E11E/E11R | 14 | P0 EA/ID, M6 P1, MV | `inherent_capacity`, `invert_inherent_travel` | `test_inherent_forward_inverse` | B08,B09 | Idealized algebra ready; actual curve MV / pending independent checks |
| Zero/below-range/above-rated/quick-opening | 14,16 | P0 EA | `validate_travel_model` | `test_travel_exclusions` | B08,B09 | Ready / pending tests, physical qualification |
| E12 margin/rating intervals/bands | 15 | P0 EA/ID | `preliminary_rating_target` | `test_margin_is_rating_only` | B14 | Ready on supplied coefficients / pending tests |
| Enabled cases/incomplete/governing case | 4,15 | P0 EA | `aggregate_case_status` | `test_disabled_and_incomplete_cases` | B14 | Ready / pending tests |
| Near-zero policy / validated override | 8,16 | P0 EA | `validate_numerical_policy` | `test_floors_and_override_evidence` | B13 | Guard ready; new override requires validation / pending tests |
| Bounded coefficient/travel iteration | 8,12,14 | P0 proposed numerics; branch SV | `solve_coefficient_bracketed` | `test_bounds_failure_no_result` | B05–B07 | Scaffold only; physical branch/normalization validation blocked / blocked |
| U-P/Q/M/T/RHO/MU/NU/D | 9 | U1/U2/U3 ID/P1 | `convert_to_si`, `convert_from_si` | `test_unit_anchors_and_round_trip` | B13 | Exact identity subset ready; precision exceptions §12 / pending checks |
| Property resolution/freeze/overrides | 6,17 | R1 RI, P0 EA | `resolve_control_valve_properties` | `test_real_state_frozen_provenance` | B10 | Contract/validation ready; provider accuracy pending / blocked |
| Pure-liquid/mixture gate | 3,6,25 | P0 EA, S1 scope | `validate_service_eligibility` | `test_pure_liquid_gate` | B10 | Eligibility guard ready; mixture extension NI / blocked |
| E13 external loss/pressure budget | 7–8 | R1 RI/ID, P0 EA | `build_valve_pressure_budget` | `test_real_taps_energy_balance` | B11,B12 | Reuse mapped; new budget benchmark blocked / blocked |
| Crane ownership/ID import/stale snapshot | 7,20 | R1 RI, P0 EA | `build_loss_ownership_ledger` | `test_duplicate_and_lumped_losses` | B12 | Structural ledger ready / numeric integration blocked |
| Coupled network / gas / quick-opening extension | 3,8,25 | P0 NI | No Phase 1 function | `test_unsupported_scope` | Not applicable | Deferred / not eligible |

Release-critical conflicts are explicit: method edition/diameter/FR reconciliation, empirical geometry domains, coefficient reference precision, benchmark discrepancies and incomplete property/pressure fixtures. None changes the approved style, margin, Fd, cavitation, mixture, opening-band or floor refinements.

## 17. Implementation gate and smallest defensible scope

### A. Evidence-ready for initial isolated implementation after a separate request

- E1 SI pressure difference and explicit gauge offset, mass/volume identity, μ/ρ, and density-reference arithmetic with an explicitly supplied reference.
- Exact SI/metric conversions and U2's inch conversion; source-precision comparison tests with explicit tolerances. Keep unresolved psi and full-precision Cv/Kv conventions out of the released coefficient adapter.
- Strict finite/unit/pressure-basis/eligibility validation, missing-factor/provenance status, frozen-input schemas, three-case completeness, ownership ledger validation and explicit unsupported-method results.
- E11 idealized linear/equal-percentage forward/inverse algebra and range guards on externally supplied, same-basis coefficients, clearly separated from real-valve suitability and qualified factor-dependent travel.
- E12 target-rating margin and preliminary guidance evaluation on supplied valid coefficients. No calculation of required coefficients is implied.

### B. Still blocked

- **All IEC/ISA sizing branches E2–E10:** no AS equation pack or authorized edition comparison. Manufacturer corroboration has not removed this blocker.
- Standard water-reference conventions, full-precision Cv/Kv conversion and complete unit-constant tuples; empirical FF domain and coefficient precision.
- Attached reducer/expander coefficients, taps, FLP/FP domain, signed reference terms and installed-viscous combination.
- Adopted valve-Re diameter/coefficient basis, thresholds/equality handling, piecewise FR, and justified turbulence evidence without Fd.
- Case-specific FL/Fd and part-travel factors until sourced and applicable; incipient/significant cavitation thresholds until verified. Damage/suitability prediction remains excluded.
- Physical-state qualification, independent fluid/Crane/energy-budget oracles, corrected ordinary-trim choking and attachment examples, approved fixture permissions and source-specific tolerances.
- Proposed choking ε and solver numerical-normalization validation; no unreviewed numerical policy may silently become an engineering acceptance threshold.
- Mixtures except through the approved provider/applicability gate; generic quick-opening, coupled hydraulics, special/multistage trims and all other deferred scope.

**Smallest safe next engine scope:** a pure, deterministic **validation, exact-unit/identity and approved-policy core**, consuming supplied frozen properties and supplied same-basis coefficients. It may expose separately labeled idealized characteristic algebra. It must return `method_not_verified` for required Cv/Kv sizing, choking limits, attached corrections and Reynolds correction, with no completed sizing recommendation. No API, UI, persistence, report or hydraulic-calculation changes belong to that scope. A useful standards-based turbulent sizing engine is the next step only after its authorized equation pack and independent benchmarks are cleared; this record does not claim that step is ready today.
