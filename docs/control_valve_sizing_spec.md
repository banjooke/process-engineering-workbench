# Control-valve sizing: Phase 1 engineering specification

Status: approved Phase 1 design basis, subject to verification gates; not authorization to implement. Approval recorded: 2026-09-27.
Task: `control_valve_sizing`. Proposed schema: `control-valve-liquid/1`.

**Preliminary engineering sizing requiring vendor confirmation.** Results do not approve a commercial valve, pressure class, trim, materials, actuator, noise level or cavitation life.

## Approved Phase 1 Design Basis

The owner has approved decisions **1–27** from the consolidated Phase 1 approval package, subject to the mandatory refinements recorded throughout this document and mapped in section 27. Approval concerns the design basis only; it does not authorize implementation, commits or pushes.

- Globe, segmented-ball and butterfly remain selectable descriptive categories. No generic FL or Fd may be assigned from style alone; applicable sourced factors are required for dependent assessments.
- The configurable 10% margin affects only the preliminary target rated Cv/Kv, never required capacity, flow or pressure drop. Required capacity, margin and target rating are displayed separately.
- FL is required for completed pressure-recovery/choking assessment. Fd is required only where the applicable verified Reynolds correction needs it; its absence does not block a demonstrably turbulent base calculation that does not require Fd.
- Generic cavitation output is screening. Incipient/significant labels require verified standard or manufacturer thresholds; otherwise display “Cavitation assessment indeterminate — manufacturer data required.” No damage-prevention or valve-suitability claim is permitted.
- Initial implementation starts with supported pure liquids. Mixtures are deferred unless the existing provider supplies every required property with verified applicability; they remain a gated Phase 1 extension or later phase.
- Opening bands are configurable preliminary guidance, not IEC/ISA requirements or vendor guarantees. Near-zero floors are software-stability defaults, not engineering applicability limits; documented project-specific overrides require explicit validation.
- Standards-dependent equations and constants remain blocked from release until verified. Verification is also required before implementing each affected branch, as specified below.
- Manufacturer-dependent factors remain user-supplied, traceable and applicable to the valve design, size and travel. Design approval does not approve any unsourced factor or blanket part-travel approximation.
- Independent benchmarks are mandatory before release. Source-specific benchmark tolerances and remaining verification work must be resolved within this approved basis.

## 1. Scope, sources and verification gates

Support Newtonian, incompressible, single-phase-at-inlet liquid sizing: standalone and optional project-linked studies; minimum/normal/maximum cases; required Cv/Kv; selected valve style; installed effects; attached reducers/expanders; applicable Reynolds correction; choking, cavitation and flashing assessments; selected/rated capacity; estimated opening; assumptions, warnings and report-ready results.

Inlet two-phase service is unsupported. An initially liquid stream may develop vapor through the valve: assess this with the applicable liquid method but do not claim to solve a two-phase discharge network.

Proposed governing references, checked through their public primary-source descriptions:

- [IEC 60534-2-1:2011](https://webstore.iec.ch/en/publication/2461), edition 2 including the 2015 corrigendum. Its public scope describes Newtonian incompressible fluids and cautions about mixtures. Start with supported pure liquids. Mixtures are deferred to a gated Phase 1 extension or later phase unless the existing property provider supplies all required properties with verified applicability.
- [ANSI/ISA-75.01.01-2012 (60534-2-1 MOD)](https://www.isa.org/products/ansi-isa-75-01-01-2012-60534-2-1-mod-industrial-pr). Confirm edition, modifications and amendments from an authorized copy before implementation.
- [Emerson control-valve sizing guidance](https://www.emerson.com/en/final-control/catalog/products-and-software/valves/control-valves/control-valves-sizing) identifies the IEC/ISA methods as harmonized and identifies required process/fluid/valve inputs.
- [Emerson Control Valve Handbook resource](https://www.emerson.com/en/final-control/catalog/products-and-software/valves/control-valves/control-valve-handbook) is a candidate manufacturer source for qualified factors and examples. Verify the actual edition/pages; the complete handbook was not verified in this review.

An authorized full standard and reviewed numerical manufacturer fixtures were not supplied. Labels used throughout:

| Label | Meaning |
|---|---|
| SV | Verify equation, every constant, unit tuple, branch, limit and applicability against the authorized standard before implementing that branch. |
| MV | Verify factor, characteristic, rating and travel/geometry validity against applicable manufacturer literature. |
| EA | Engineering/application policy, not a standards requirement. Decisions 1–27 are approved as refined here; separately identified overrides, approximations and benchmark tolerances still require explicit validation/approval. |
| ID | Mathematical identity or defined unit conversion; independently test. |

All equations in sections 9–15 are labeled. All SV/MV items and benchmark expected values are release gates. Do not copy standards tables/text/diagrams, invent remembered constants, or describe this specification as standards-compliant software. Store copyright-safe references and permitted numerical fixtures, not reproduced standards.

## 2. Inspected repository and calculation architecture

Paths are relative to the repository root. Existing interfaces below were inspected; proposed names are explicitly distinguished.

| Existing interface | Finding and reuse |
|---|---|
| `engineering/fluids.py`: `get_fluid_properties(fluid, temperature_c, pressure_bar_a)` | CoolProp/thermo provider selection; density, dynamic viscosity, vapor pressure, critical pressure, phase and conditions returned. `_property_provider` and `_provider_fluid_id` are available for provenance. Reuse directly through a thin adapter. |
| `get_fluid_catalogue`, `search_fluids`, `property_engines_available` | Reuse substance catalogue/selection and provider availability; no new fluid database. |
| `backend/main.py`: `FluidPropertyRequest`, `FluidConfig`, `/fluids/properties` | Existing vocabulary uses °C and bar absolute. `FluidConfig` has water-like defaults and omits critical pressure. The HTTP properties route strips underscore metadata. Reuse vocabulary, not permissive defaults; backend adapter must retain provenance from the engine. |
| `engineering/hydraulics.py`: `get_fluid_state`, `calculate_mass_flow`, `solve_line`, `friction_factor`, `calculate_pressure_drop` | Reuse external line-loss calculations with validated frozen liquid properties. Manual paths contain defaults; `coolprop_property` clamps pressure. Do not use either behavior for valve property resolution. |
| `freeze_pump_fluid_properties`, `size_pump_duty`, `build_pump_system_curve` | Stage 3 resolves at real source pressure and returns `resolved_fluid_config`. Reuse this design, not the pump-specific implementation; preserve critical pressure and provenance as well. |
| `engineering/piping.py`: `get_piping_catalog`, `get_internal_diameter_mm`, `get_roughness_mm` | Actual ID derives from NPS/schedule, OD/wall. Older schedule helpers also exist in hydraulics. Use the catalogue-facing piping interface as import authority; flag discrepancies, do not add tables. |
| `engineering/fittings.py`: `get_fitting_catalog`, `calculate_fitting_k`, `calculate_database_k`, `get_crane_ft` | Existing `crane_resistance_coefficient_K_database.xlsx` supports fixed K, multiplier × fT, quantity and explicit overrides. Reuse it and its method metadata; never duplicate the workbook. |
| Backend `normalize_flow_unit`; frontend `normalizeFlowUnit`, `resolveStandardPipe`, `buildApiElementsForScenario`, `buildSolveFluidConfigForScenario` | Unit aliases and UI mappings are distributed, not a general unit library. Reuse compatible aliases; introduce a thin tested SI adapter. Normal gas-volume inputs are inappropriate for liquid sizing. |
| `backend/auth.py`, `backend/projects.py`, `backend/scenarios.py` | `get_current_user_id` verifies Supabase access; project reads filter `Project.user_id`; scenarios must belong to authorized projects. Reuse these patterns for calculations and reports. |
| `database/models.py`: `Project`, `HydraulicModel`, `Scenario` | Scenario has `fluid_config_json`, `elements_json`, required flow fields and no dedicated result column. A versioned task envelope fits existing JSON storage; API dispatch must be adapted. |
| `frontend/app/page.tsx`, `frontend/lib/api.ts`, `EngineeringServiceStatus.tsx` | Large wizard with authenticated, bounded GET retries; mutations never automatically replay. New module must reuse this behavior. |
| `frontend/lib/pump-report.ts`, `frontend/lib/api-error.ts` | Reviewed frozen-data guard and readable FastAPI errors provide patterns to reuse. Never allow undefined configuration to disappear from JSON. |
| `reports/engineering_report.py`, `reports/project_engineering_report.py` | ReportLab PDF, python-docx and single/project writers. Reuse presentation utilities; valve preparation must consume validated frozen results instead of resolving fresh properties. |
| `tests/test_stage1_hardening.py`, `test_stage2_authentication.py`, `test_stage3_pump_curves.py`, `test_cors.py`, `frontend/tests/*.test.mjs` | Python unittest/TestClient and Node tests executing actual TS functions with mocked boundaries. Retain conventions and add independent engineering fixtures. |

Proposed architecture: pure `engineering/control_valves.py`; thin `control_valve_properties.py`; one-way `control_valve_hydraulics.py`; dedicated strict models/router; separate frontend workspace; later shared report preparation and PDF/DOCX writers. No calculation/UI/database/report files are created in this specification change.

## 3. Explicit exclusions and unsupported entries

Exclude gas, steam, inlet two-phase flow, slurry/solids transport, non-Newtonian liquids, detailed noise prediction, actuator sizing, detailed cavitation-damage prediction, trim/material selection, vendor-specific selection, dynamic process-control simulation and safety-relief sizing. Initially exclude multistage/special trim and geometries outside the verified method pack. Start with supported pure liquids; mixture support is gated on complete properties from the existing provider and verified applicability, not merely manual completeness or a mixture label.

Require phase, rheology, solids and composition declarations. Unknown is not supported. Unsupported entries may remain editable drafts but block calculation and normal engineering reports. A slurry warning must explicitly state unsupported; do not produce a valid liquid recommendation. Optional diagnostic exports, if approved, must say NOT SIZED. Flashing assessment from a supported liquid inlet is distinct from accepting inlet two-phase flow.

## 4. Minimum, normal and maximum case model

Use exactly three stable keys (`minimum`, `normal`, `maximum`) with editable names and explicit enabled state. Normal is required/enabled for completed selection; min/max may be disabled deliberately. Disabled cases make no provider calls, contribute no maxima and retain no apparently current numeric result.

Each case carries: case name/state; flow value/unit/basis; temperature/unit; upstream absolute pressure; downstream absolute pressure or specified differential; density or SG; dynamic or kinematic viscosity; vapor pressure; critical pressure; inlet/outlet pipe references; valve geometry reference; raw fluid configuration; resolved/frozen configuration; per-property provenance; results; assumptions; warnings and validation errors.

Use tagged alternatives: `flow_basis=actual_volume|mass`, `pressure_mode=downstream|drop`, `density_basis=density|specific_gravity`, `viscosity_basis=dynamic|kinematic`. Imported redundant values must agree or require reconciliation. No silent precedence or property copying between cases.

All cases reference one immutable selected physical valve/assembly, though conditions and travel-dependent factors differ. Enabled incomplete cases return invalid/null dependent results. Other cases may calculate diagnostically, but any invalid enabled case blocks an overall completed recommendation/report. Save incomplete inputs only as drafts. Check min ≤ normal ≤ max on resolved upstream actual-volume flow; flag differing mass-flow ordering. Never silently sort/rename cases.

## 5. Input field dictionary

R = required for complete sizing, O = optional, D = derived, I = importable. Automatic resolution can supply required properties; manual mode must enter them explicitly.

| Field | Status | Definition/validation |
|---|---|---|
| Fluid name/ID, phase, rheology | R/I | Existing catalogue ID or descriptive manual name; liquid/Newtonian confirmed. |
| Temperature | R/I | Per case; unit tagged. |
| P1 upstream pressure | R/I | Real absolute assembly inlet pressure at the declared tap. |
| P2 or specified ΔP | R/I/D | One active basis, other derived; redundant imports checked. |
| Flow and basis | R/I | Positive actual upstream volume or mass flow; no normal-volume liquid basis. |
| Density or SG | R/I/D | Explicit SG reference density/temperature; no default water density. |
| μ or ν | R/I/D | Explicit units; ν=μ/ρ. |
| Pv, Pc | R/I | Absolute vapor pressure at T and substance critical pressure; source required; no substitution. |
| Upstream/downstream pipe ID | R/I | Actual ID, with schedule/custom provenance. |
| Nominal valve size; equation diameter d | R | DN/NPS label plus standard-defined sizing diameter. Pipe ID, nominal size and trim throat are not interchangeable. SV/MV. |
| Valve style | R | Globe, segmented-ball and butterfly are selectable descriptive categories only. No style-derived generic FL/Fd; dependent results require user-supplied sourced factors applicable to design, size and travel. EA/MV. |
| FL | R for completed recovery/choking assessment | User-supplied sourced recovery factor applicable to design, size and travel; 0<FL≤1 and verified SV/MV domain. Never default. |
| Fd | Conditional R | Required only when the applicable verified Reynolds correction needs it. Positive finite sourced modifier applicable to design/size/travel; never default. An independently demonstrated turbulent base calculation may proceed without it if the verified method permits. |
| Rated Cv or Kv | O for required sizing; R for opening/selection | Positive, sourced, reference travel and basis; reconcile if both entered. |
| Characteristic | R for opening | Linear/equal-percentage idealized; quick-opening policy in section 14. |
| Rangeability | R for equal-percentage/controllability | >1; source and minimum controllable travel. |
| Coefficient basis | R | User preference Cv/Kv; always return both. |
| Reducer/expander information | R | Explicit none or attachments with identities/dimensions/orientation. |
| Imported hydraulic scenario | O/I | Authorized IDs, revision/hash, valve location, sections, fittings and real boundaries. |
| `future_gas.xT` | Reserved only | Non-null active usage rejected in Phase 1; never read by a liquid formula. |

Null is missing, not zero. Defaults for policy values require recorded acceptance; physical properties and valve factors have no numerical defaults.

## 6. Existing fluid-engine integration

Proposed `resolve_control_valve_properties(case)` calls existing `get_fluid_properties(fluid, temperature_c, pressure_bar_a)` at each case's real upstream pressure and temperature, converting SI at the boundary. Resolve once per distinct state, freeze before numerical coefficient iteration. Do not evaluate at a numerical hydraulic datum, pressure clamp, downstream limit or imaginary pump source.

Read density, dynamic viscosity, vapor pressure, critical pressure and phase. Derive kinematic viscosity. Extend existing configuration vocabulary through a strict adapter model, not a duplicated engine. Do not instantiate existing water-default `FluidConfig` to fill missing values; do not rely on `get_fluid_state`'s permissive manual defaults. `_properties_are_usable` currently validates density/viscosity, which is insufficient for this module.

Return required `resolved_fluid_config`: explicit properties; real T/P; fluid identity; `phase_type=Liquid`; `use_manual_properties=true` for deterministic replay; critical pressure and provenance. The replay flag must not relabel automatic properties as user-entered.

For every property preserve value/unit, origin (`automatic|manual|imported`), original origin if imported, provider/version/fluid ID, reference/edition if manual, applicable evaluation T/P, retrieval timestamp, override reason/actor and source hash. Critical pressure is a substance constant, not pressure-dependent: distinguish retrieval conditions from physical dependency. Pv is a function of operating temperature.

Existing CoolProp-to-thermo fallback may be reused with actual provider recorded and stricter phase/property validation. Missing Pv/Pc must not be accepted just because density/viscosity resolved. No untraceable mixing of providers, silent manual fallback or substitution of zero. Explicit field overrides require units, source and reason; preserve original automatic values. Imported snapshots are reusable only at applicable composition/T/P or through deliberate manual confirmation; otherwise recalculate. Initial implementation supports pure liquids. A mixture may enter a gated extension only when the existing provider supplies all required properties with verified applicability; manual overrides do not bypass that gate. Unsupported mixtures and out-of-range states block completed sizing.

Require liquid inlet and P1>Pv. Frozen configuration and hashes must survive API responses, persistence and reports unchanged. Reports never call property providers. No critical/vapor-pressure guess is permitted.

## 7. Standalone and project-linked Crane/hydraulic integration

Standalone users specify P1 and P2 or ΔP across declared assembly taps. Show inlet pipe, attached reducer, valve, expander and outlet pipe. With attachments use the verified standard tap convention; do not mix bare-valve flange and assembly pressures.

Project-linked users select an owned project/scenario, proposed valve location, pipe sections, adjacent fittings and real boundary conditions. At each prescribed flow the adapter computes external losses with existing pipe/friction/Crane functions and excludes the valve assembly. Use a full mechanical-energy budget: source total head minus sink total head plus known pump head minus external irreversible losses. Reconstruct static assembly P1/P2 consistently with elevation and velocity heads; do not simply subtract friction from static boundary difference when diameters/elevations differ.

Pressure-drop-only scenarios lacking absolute anchors cannot supply choking/property conditions. Require real boundary data. Saved aggregate line loss alone is insufficient. Pump results with deliberately unavailable absolute profiles cannot be treated as real valve-inlet pressures. If a hydraulic import cannot establish real inlet pressure without a coupled property/pressure solve, require a user-confirmed P1 or validated frozen hydraulic state; do not hide coupling in the adapter.

Import NPS/schedule, actual catalogue ID, OD/wall, roughness/material and version/hash through `engineering/piping.py`. Unknown schedules or catalogue discrepancies require review, never DN-as-ID fallback. Audit existing area-change/velocity-head handling for the selected taps. Unsupported networks block linked calculation while leaving standalone available.

### Mandatory loss-ownership ledger

Assign every source element one stable snapshot ID (scenario revision plus index/hash when no persisted element ID exists) and exactly one role: `external_line_loss`, `attached_inlet`, `attached_outlet`, `replaced_control_valve`, or `excluded_with_reason`.

- Remote fittings remain external and use existing Crane K on its documented velocity basis.
- Attached supported reducers/expanders belong to IEC/ISA assembly geometry. Exclude their ordinary K AND any precomputed known-ΔP contribution from external losses; retain dimensions and identity.
- Replace an existing valve loss at the proposed location rather than add a second valve.
- Reject duplicate IDs, ambiguous adjacency or inseparable lumped K/known-ΔP that contains attached losses. Require source decomposition.
- Build an immutable working snapshot; never edit the original hydraulic scenario merely to exclude fittings.
- Preserve actual kinetic/elevation boundary terms when excluding irreversible losses. Verify reference-plane accounting independently.

Crane K, Cv/Kv, FP, FL, FLP and Fd have different meanings. K must not replace a control-valve coefficient or an IEC/ISA recovery/geometry factor. Reuse the Crane workbook/functions and their fT/multiplier/quantity/override metadata without duplication.

## 8. One-way versus coupled calculations

Recommend one-way transfer with prescribed case flow for the smallest reliable Phase 1. Opening affects coefficient, coefficient affects valve ΔP, which affects flow and external losses; boundary conditions/pump curve determine the real operating point. Phase 1 does not solve that circular system. Full coupled network/valve equilibrium is future work.

Local coefficient/geometry/Reynolds iteration is still required. EA numerical policy: solve `Qpred(C)-Qtarget=0` over an SV-valid bracket, at most 20 deterministic bracket expansions and 80 bisection steps. Recalculate coefficient-dependent factors at each evaluation; properties and physical geometry remain frozen. Require both relative flow residual and relative coefficient bracket width ≤1e-6, normalized by target magnitude and an approved positive numerical floor. No rounding inside iteration.

Do not expand beyond method applicability. No bracket, nonfinite factors, inadmissible regime, nonmonotone travel table or exhausted iterations => explicit failure, null corrected coefficient/opening and no completed recommendation. Record method, bracket, residual and iterations. Tolerances are EA proposals, not standards constants. Travel-dependent solving follows the same deterministic bounded policy.

## 9. Units and dimensions

Core arithmetic uses m³/s, kg/s, Pa, K, kg/m³, Pa·s, m²/s and m. Cv/Kv remain tagged conventional capacity numbers, not dimensionless SI conductances. One standards adapter converts SI to the verified equation unit set and back; numerical constants never float between unit systems.

| Quantity | Input/display units | Conversion and constraints |
|---|---|---|
| Actual volume | m³/s, m³/h, L/s, L/min, US gpm | 3600 s/h, 1000 L/m³, 60 s/min; US gallon=0.003785411784 m³, ID. Imperial gallons unsupported. |
| Mass | kg/s, kg/h | Q=mass flow/ρ at upstream state, ID. |
| Pressure | Pa, kPa, bar, psi with absolute/gauge/differential tag | bar=100000 Pa; pin independently verified psi factor in registry. |
| Temperature | K, °C, °F | K=°C+273.15; °C=(°F−32)×5/9, ID. |
| Density | kg/m³, g/cm³, SG | 1 g/cm³=1000 kg/m³; SG=ρ/ρreference with explicit reference temperature/density. |
| Dynamic viscosity | Pa·s, mPa·s, cP | mPa·s=cP=0.001 Pa·s, ID. |
| Kinematic viscosity | m²/s, mm²/s, cSt | mm²/s=cSt=1e-6 m²/s; ν=μ/ρ, ID. |
| Diameter | m, mm, in; DN/NPS labels | inch=0.0254 m; mm=0.001 m. DN/NPS is not actual ID. |
| Capacity | Cv, Kv | Nominal Kv≈0.865 Cv and Cv≈1.156 Kv, SV. Use one approved full-precision factor and its reciprocal, not two rounded constants. |

P1/P2/Pv/Pc must be absolute. ΔP is differential. Optional gauge UI converts Pabs=Pgauge+Patm using entered site atmosphere or deliberate acceptance of 101325 Pa reference atmosphere. Persist assumption/original input. Never add atmospheric pressure to ΔP.

Verify water reference densities/test-temperature conventions for Cv/Kv (SV). Convert user SG reference to the method's reference before use. Test alternate-unit equivalent cases and absolute/gauge errors. Reject unknown units and NaN/Infinity. Keep unrounded values in calculations/snapshots; proposed EA display is three significant figures and travel to 0.1 percentage point, with uncertainty near limits. Do not imply that display precision equals engineering accuracy.

## 10. Equation registry: verification required before implementation

These equation families define the intended calculation, not an authorized transcription. No branch is accepted until its full method pack is independently reviewed.

| ID | Relationship | Verification |
|---|---|---|
| E1 | ΔP=P1−P2; Q=mass flow/ρ; ν=μ/ρ | ID; consistent static tap boundaries. |
| E2 | Turbulent base `Cbase=q/[N1 sqrt(ΔP/G)]`, G=ρ/ρreference | SV: N1, q/pressure units, Cv/Kv reference convention. |
| E3 | Installed turbulent family `q=N1 FP C sqrt(ΔPsizing/G)` | SV: permitted assembly/regime. |
| E4 | Candidate liquid critical-pressure ratio `FF=0.96−0.28 sqrt(Pv/Pc)` | SV: coefficients, fluid scope, ratio range. Invalid FF must not be clamped. |
| E5 | Bare terminal drop `FL²(P1−FF Pv)`; installed family `(FLP/FP)²(P1−FF Pv)` | SV: exact factor definitions, taps and applicability. |
| E6 | `ΔPsizing=min(ΔPavailable,ΔPchoke)` for the supported turbulent branch | SV; not a blanket viscous/two-phase equation. |
| E7 | Geometry family `FP=[1+(Σζ/N2)(C/d²)²]^(-1/2)`; FLP uses the verified inlet-loss/recovery relation involving FL and C/d² | SV: N2, d definition, signed Bernoulli terms, separate inlet/outlet sums and all contraction/expansion coefficients. |
| E8 | Valve Reynolds family `Rev=[N4 Fd q/(ν sqrt(C FL))] [1+FL²C²/(N2 d⁴)]^(1/4)` | SV: edition, exact parentheses, unit constants and fitting applicability. Not pipe Reynolds ρvD/μ. |
| E9 | `FR=method_pack(Rev,C/d²,geometry_branch,FL,Fd)`; use the corresponding verified non-turbulent capacity relation | SV: exact piecewise equations, full/reduced trim criteria, transition limits and coefficients remain unverified. Do not invent them. |
| E10 | Generic screening ratio `xF=(P1−P2)/(P1−Pv)` for P1>Pv | MV/SV: inception/significant thresholds, pressure scaling, travel/size applicability. FL is not an incipient cavitation threshold. |
| E11 | Linear `C(h)/Crated=h`; equal-percentage `C(h)/Crated=Rv^(h−1)` | EA/MV idealized model convention, qualified controllable travel only. |

Do not universally multiply FP and FR: the adopted standard branch must explicitly permit the installed/viscous combination. Unsupported combinations yield indeterminate corrected sizing and vendor review. Phase 1 release nevertheless requires demonstrated supported viscous and attached-geometry branches.

The versioned method pack records authorized edition/clause/page, equation ID, complete unit tuple, every constant (including N1/N2/N4 and additional FR/FLP constants), domain, reviewer/date, checksum and independent fixtures. E7 FLP and E9 branch details are deliberate unresolved verification gates. No engineer should implement them from this document alone. No unverified threshold, coefficient or manufacturer factor is a default.

## 11. Deterministic 19-step sequence

All physical outputs below are SI; factors are dimensionless and capacities explicitly Cv/Kv. Errors null dependent outputs. Warnings carry code/severity/case/field.

| Step | Inputs → outputs | Validation, equation family and warning |
|---|---|---|
| 1 Service/case | Declaration, enabled → eligibility | Liquid/Newtonian; disabled skipped; unsupported blocks. |
| 2 Units | Unit-tagged raw fields → SI inputs | Section 9 ID; unknown basis or missing atmosphere blocks. |
| 3 Properties | Fluid,T[K],real P1[Pa] → ρ,μ,ν,Pv,Pc,frozen state | Strict adapter; valid phase/finite properties; unavailable blocks, overrides warn. |
| 4 Pressures | P1 and P2/ΔP or hydraulic anchors → absolute taps[Pa] | E1/one-way adapter; no artificial datum. |
| 5 Available drop | Taps/external ledger → ΔPavailable[Pa] | E1 and mechanical-energy balance; duplicate loss blocks. |
| 6 Ordering | P1,P2,Pv → eligibility | P1>P2>0; P1>Pv; P2≤Pv flags flashing. |
| 7 Geometry | Pipe catalogue/valve/attachments → D1,D2,d[m], branch | Actual positive dimensions; SV/MV limits; unknown ID blocks. |
| 8 Base capacity | Q,ρ,ΔP → base Cv/Kv | E2; positive flow/drop; uncorrected turbulent estimate only. |
| 9 Installation | Trial C,dimensions → FP,FLP | E7, SV; unsupported assembly blocks correction. |
| 10 Reynolds | Q,ν,C,d and method-required factors → Rev/FR or verified regime evidence | E8/E9, SV; Fd only for a branch needing it. Missing Fd is not proof of turbulence; demonstrably turbulent base sizing may proceed if verified methodology permits. |
| 11 Recovery | P1,Pv,Pc,FL,FLP,FP → FF/terminal drop | E4/E5, SV; missing FL or required properties leaves recovery/choking assessment incomplete; never infer factors. |
| 12 Choking | Available/limiting drop → flag/ΔPsizing | E6 within applicable branch; severe-service warning. |
| 13 Cavitation | Pressure ratio/threshold data → concern classification | E10 screening; incipient/significant labels require verified standard or manufacturer thresholds, otherwise use the mandatory indeterminate message. |
| 14 Flashing | P2,Pv,T → flashing classification | Persistent-vapor screening; no vapor fraction or downstream two-phase solve. |
| 15 Corrected capacity | Factors/limits → required Cv/Kv | Bounded E3/E9 solve; revisit steps 9–14 as C changes; failure blocks. |
| 16 Rating | Unchanged required C,rated C,margin → target rating/ratios | Default target=Cmax×1.10; never alter required C,Q or ΔP. Display required, margin and target separately. |
| 17 Opening | C,Crated,characteristic,Rv → travel[%]/validity | E11 or qualified travel-dependent solve; no deceptive clamping. |
| 18 Cases | Three case statuses → comparison | Any invalid enabled case blocks completed overall result. |
| 19 Recommendation | Case extrema,bands,flags → overall recommendation | Section 15; always preliminary/vendor confirmation. |

Steps 3–5 require real upstream conditions before property freezing. A project import without known valve P1 must establish it from a validated anchored hydraulic snapshot or request user confirmation. Materially variable properties requiring network/property iteration are outside one-way Phase 1.

## 12. Reynolds correction and geometry applicability

Use the applicable verified Reynolds methodology; compute valve Rev using E8 only within its verified branch. Existing pipe-flow thresholds must not select the valve regime. Require Fd only where that methodology's Reynolds correction needs it. Never silently default FL or Fd. Missing Fd does not automatically block a demonstrably turbulent base calculation when the verified methodology does not require Fd; retain the method reference and independent evidence establishing turbulence. If required evidence or a required factor is absent, mark the dependent Reynolds correction `REYNOLDS_INDETERMINATE` and leave its outputs incomplete. Do not infer turbulence from missing data or arbitrarily set FR=1. Unaffected calculations may remain available with explicit assessment-level completeness; no incomplete dependent assessment may be presented as completed.

FL remains required for completed liquid pressure-recovery/choking assessment. Factor provenance must establish applicability to valve design, size and travel. A valve-style label alone supplies neither FL nor Fd.

Same-size pipe/valve without attachments uses FP=1 and FLP=FL in the applicable branch. Smaller valves between larger pipes require both IDs, actual assembly dimensions and separate inlet reducer/outlet expander contributions. Recovery and outlet loss are not interchangeable. Remote fittings remain Crane external losses; attached elbows/tees require applicable manufacturer factors or are outside Phase 1, not silently treated as concentric reducers.

Manufacturer-dependent factors remain user-supplied and traceable. Factor data must include valve design/style/trim/size, travel validity, geometry basis and source. Rated-travel-only FL/Fd may be used at other travel only under an explicit approved constant-factor approximation, flagged conditional. Otherwise part-travel results are indeterminate. No extrapolation outside qualified tables. Nominal valve dimension in the standard is not automatically pipe ID or trim port diameter.

## 13. Choking, cavitation and flashing

Report real P1/P2, Pv/Pc, FF, FL, FP, FLP, Fd, available/terminal/effective drop, classifications and sources. Above the applicable terminal limit, extra available ΔP must not falsely lower turbulent required capacity. Choked liquid service requires vendor confirmation. Missing FL or required Pv/Pc leaves recovery/choking and dependent final sizing/opening incomplete; retain unaffected base results only with explicit limitations. Fd is conditional on the verified Reynolds branch, not universally required. No silent factor, zero or water-property default.

Generic cavitation output is screening only. Without applicable verified standard or manufacturer thresholds, return exactly: **“Cavitation assessment indeterminate — manufacturer data required.”** A choked-flow result alone must not be upgraded into an incipient/significant cavitation classification.

Keep `choked`, `cavitation` and `flashing` as separate fields; these conditions can overlap. Display severity precedence: invalid/indeterminate, flashing, choked, significant concern, incipient concern, no predicted issue.

| Classification | Decision |
|---|---|
| No predicted issue | Complete supported assessment and applicable verified standard or manufacturer onset criterion not exceeded; never a damage guarantee. Without onset data, this label is unavailable. |
| Incipient cavitation concern | P2>Pv and applicable verified standard or manufacturer inception criterion exceeded, significant threshold not exceeded. |
| Significant cavitation concern | Applicable verified standard or manufacturer significant-cavitation threshold exceeded with liquid pressure recovery. Choking alone is insufficient for this classification; no damage prevention or valve suitability is implied. |
| Choked liquid service | Applicable terminal criterion reached/exceeded; retain other flags. |
| Flashing service | P1>Pv and P2≤Pv at stated T; vapor can persist downstream. No two-phase piping solution claimed. |
| Invalid/indeterminate | Missing/inapplicable properties, factor/threshold data, inconsistent boundaries or unsupported regime; identify the unavailable assessment. |

Generic pressure ratios/choking/flashing screening cannot establish manufacturer-specific inception or acceptable damage. Cavitation is vapor formation followed by collapse during recovery; flashing persists downstream. Use approved uncertainty bands near thresholds. Do not promise acceptable noise, erosion life or material suitability.

## 14. Inherent characteristics and predicted travel

Let r=Crequired/Crated and h be fractional travel. With qualified constant-factor approximations: linear h=r; equal-percentage h=1+ln(r)/ln(Rv), Rv>1. These apply only to the controllable interval. The equal-percentage endpoint r=1/Rv is a low-capacity modeling endpoint, not seat leakage at shutoff.

If r>1, return opening null/`above_rated` and insufficient capacity, not 100% clamped travel. Below minimum controllable coefficient, return `below_controllable_range`, not negative travel interpreted as operation. Linear opening can be estimated without supplied rangeability, but controllability remains indeterminate until a valid minimum travel/rangeability is provided. Zero flow is not an active sizing point.

Store separately required C, selected/rated C, and available C at travel. If FL/Fd/geometry factors vary with travel, solve the verified capacity relation in h over a qualified monotone table rather than simply use r. Use section 8 bounds and failure rules.

Quick-opening has no adopted defensible universal curve: required sizing may remain available, but generic opening is blocked. A qualified manufacturer table requires separate approval; no arbitrary square-root model.

Approved EA configurable preliminary guidance bands: minimum 10–40%, normal 40–70%, maximum 70–90%. Vendor travel limits and rangeability take precedence. These are preliminary review guidelines, not IEC/ISA requirements, engineering applicability limits or vendor guarantees. Record policy/approval and overrides; never infer leakage class or minimum controllable flow from coefficient alone.

## 15. Overall recommendation

For valid enabled cases, Cmax=max(required C). The governing case may not have maximum flow because density/pressure differ. The approved configurable default margin is m=10%, applied only to the preliminary target rated coefficient: **target rated Cv = maximum required Cv × 1.10; target rated Kv = maximum required Kv × 1.10**. For an explicitly configured margin use (1+m) instead of 1.10. Do not alter required Cv/Kv, flow or pressure drop. Display maximum required capacity, margin percentage/amount and target rated capacity separately from the user-selected rating.

Intersect per-case rated-capacity intervals implied by approved travel bands and characteristic, then use the separately calculated preliminary target rating as a candidate lower bound. This comparison never changes the required coefficients or the target-rating formula. A nonempty interval is a preliminary target Cv/Kv range, not an available product. Empty intersection means `no_single_rating_meets_targets`; identify governing cases. A size change changes geometry factors and requires recalculation; do not scale Cv alone to recommend size.

Selected rating assessment explicitly covers insufficient capacity, margin not met, normal/minimum/maximum travel outside band, excessive oversizing, inadequate rangeability and low-flow controllability. Choking/cavitation/flashing, conditional factors or incomplete cases force vendor review/incomplete status regardless of nominal capacity. Style-category suggestions may explain tradeoffs but cannot invent factors or select a commercial valve.

## 16. Validation and exact boundary behavior

Errors/warnings carry stable code, severity (`blocking|warning|info`), case ID, field path, readable message, source and remediation. Null dependent results require a reason; no NaN/Infinity in JSON.

| Condition | Behavior |
|---|---|
| Flow≤0 | Block enabled case; disable inactive cases instead of assigning Cv=0. |
| 0<Q≤1e-9 m³/s | Approved software-stability default: block; request unit review or an explicitly validated, documented project-specific floor. No division/log workaround; not an engineering applicability limit. |
| ΔP≤0 or P2>P1 | Block; reverse-flow sizing excluded. |
| 0<ΔP≤1 Pa | Approved software-stability default: block unstable sizing; documented project-specific overrides require explicit validation. No artificial epsilon; not an engineering applicability limit. |
| P1/P2≤0 absolute or T≤0 K | Block physical input. Positive P2≤Pv is a flashing condition, not automatically impossible pressure. |
| P1≤Pv or non-liquid inlet | Block supported liquid sizing. |
| Redundant pressure inconsistency | Block beyond max(1 Pa,1e-6×largest relevant pressure magnitude), proposed EA. |
| Inconsistent ρ/SG or μ/ν | Block beyond proposed relative 1e-6 conversion consistency; not a property-accuracy tolerance. |
| Missing Pv/Pc or invalid ratio | Block full assessment; never assume zero/critical pressure of water. |
| Bad diameter/unknown schedule | Block; no DN-as-ID fallback. |
| Supplied FL≤0 or >1; supplied Fd≤0/nonfinite | Reject invalid factors and check SV/MV domains. Missing FL leaves recovery/choking incomplete; missing Fd blocks only dependent branches requiring it. |
| Rating below requirement / invalid travel | Selection fails; retain valid required capacity with explanation. |
| Duplicate/lumped attached losses | Block before external-loss calculation. |
| Unsupported service/standard range | Block dependent calculation; diagnostic base output never masquerades as final. |
| Nonconvergence | Null corrected sizing; no last-iterate-as-success. |

Near-zero floors are versioned software-stability defaults, not engineering applicability limits or standard constants. Project-specific overrides require explicit validation of units, numerical stability and the verified method domain, with rationale, reviewer, limits and policy version recorded. An override cannot waive an SV/MV applicability limit. Other numerical tolerances remain separately documented EA policies. Drafts may preserve invalid inputs but cannot produce completed engineering reports.

## 17. Versioned result schema

Proposed `ControlValveLiquidResultV1`:

- Envelope: `schema_version`, `calculation_version`, `method_pack_id`, standards/corrigendum IDs, units/policy versions, UTC timestamp, canonical input/frozen-property hashes, task/mode, source project/scenario revision/hash, geometry snapshot, loss-ownership ledger.
- `cases.minimum|normal|maximum`, each with name, enabled, `status=disabled|invalid|valid|conditional|not_converged` and:
  - normalized SI inputs plus original units; required resolved fluid configuration and per-property provenance for computed cases; explicit null/reason for disabled/invalid cases;
  - `available_pressure_drop_pa`, `limiting_pressure_drop_pa`, `effective_sizing_pressure_drop_pa`;
  - base and corrected required Cv and Kv;
  - FP, valve Rev, FR, regime; recovery object with FL/FLP/FF/Fd, sources and applicability; per-factor `required|not_required|missing` status and method evidence, so an unused Fd can be null without implying failed base sizing;
  - separate choking/cavitation/flashing classifications and criterion/uncertainty details;
  - rated Cv/Kv, opening fraction/percent/status, available coefficient at opening, controllability and band/margin assessment; separate maximum-required coefficient, margin percentage/amount and preliminary target rated Cv/Kv;
  - assumptions, warnings, validation details and iteration diagnostics.
- `overall`: governing cases, maximum required Cv/Kv, target rating interval or reason for none, selected-rating assessment, completeness and vendor-review reasons.

Strict response schemas must prevent omitted required configurations. Reports take a trusted saved result or a complete frozen snapshot verified deterministically server-side. Client-submitted results are not authoritative merely because their shape is valid. Verification uses frozen inputs, not a fresh provider lookup.

## 18. Proposed FastAPI contracts and security

These are future routes/models, not implemented endpoints:

| Route/model | Purpose |
|---|---|
| `POST /v1/control-valves/liquid/calculate`, `ControlValveLiquidRequestV1` → `ControlValveLiquidResultV1` | Standalone three-case sizing; tagged units, task/schema/method/policy. |
| `POST /v1/projects/{project_id}/control-valves/liquid/calculate`, `LinkedControlValveRequestV1` | Owned source scenario/revision, valve location, geometry and ledger; server reconstructs authorized source. |
| `POST /v1/projects/{project_id}/control-valve-scenarios`; `GET/PUT .../{scenario_id}` | Versioned draft/validated envelope mapped to existing Scenario storage. POST creates, PUT explicitly updates. |
| `GET /v1/projects/{project_id}/control-valve-scenarios` | Task-filtered list with ownership enforcement. |
| `POST /v1/reports/control-valves/liquid/pdf` and `/docx`, `ControlValveReportRequestV1` | Complete validated standalone snapshot or owned saved scenario; shared preparation. |

Every engineering calculation/report/save route requires `Depends(get_current_user_id)`. Verify project ownership and scenario membership before reading linked inputs or rendering reports. Do not accept body owner IDs. Reuse 404 for inaccessible project/scenario to avoid enumeration. No unauthenticated engineering shortcut.

Strict nested/discriminated models reject unsupported active gas fields, unknown versions and ambiguous units. Report models require all enabled cases, frozen properties and provenance. Proposed HTTP behavior: malformed/incomplete required request or unsupported service 422 with `detail[{loc,msg,type/code}]`; missing/invalid auth 401; inaccessible resource 404; stale source revision 409; provider unavailable 503 with readable context; unexpected defect 500 without internals. Structurally valid calculations may return 200 with per-case engineering failures for comparison, but `overall.complete=false` and no successful recommendation/export.

Reuse `readApiError` to show FastAPI array details. Preserve existing `apiFetch` authorization on every attempt and bounded GET-only wake-up handling. POST calculation/report/save and PUT update are never automatically replayed. A deliberate retry must warn about uncertain save outcomes.

## 19. Frontend design

Add a task tile and separate proposed `ControlValveWorkspace`, not substantial logic in `app/page.tsx`. Child modules: `ModeAndSource`, `FluidProperties`, `OperatingCases`, `ValveGeometry`, `ValveFactors`, `ValveSelection`, `CaseResults`, `EngineeringWarnings`, `ScenarioActions`, `ReportActions`.

Workflow: standalone/project source → service/fluid → three-case editor → real pressure boundaries → pipe/valve geometry and attachment schematic → sourced factors → selected/rated coefficient and characteristic → calculate → comparison/warnings → save/export. Import preview requires confirmation of boundaries, catalogue IDs and ownership ledger.

Display property evaluation conditions and sources, with overrides distinguished. Case comparison shows enabled state, flow/T/P, required Cv/Kv, margin, preliminary target rating, selected rating, opening, choking/cavitation/flashing, controllability and validation. Missing rating permits required sizing but not completed selection. Unsupported service remains visible with explanation. Block report requests before sending when required frozen data is absent. Reuse service waking banner, retain inputs on failure and require deliberate mutation retry.

Open saved scenarios by task ID. Existing line/pump UI must not reinterpret valve JSON. Any change to physical inputs, factors, geometry or policy invalidates old results/report readiness. No hidden rescaling or engineering recalculation on every keystroke.

## 20. Versioned persistence and compatibility

No database migration is presently necessary: use `Scenario.fluid_config_json` for a task envelope and `elements_json` for source elements. Proposed structure (draft illustration, not valid calculation input):

```json
{
  "engineering_task": "control_valve_sizing",
  "schema_version": "control-valve-liquid/1",
  "control_valve": {
    "status": "draft",
    "inputs": {},
    "frozen_properties_by_case": {},
    "result": null,
    "source_link": null,
    "geometry_snapshot": {},
    "loss_ownership": [],
    "calculation_version": null,
    "method_pack_id": null,
    "input_hash": null
  }
}
```

Store input values/units and all three cases; frozen properties/provenance; result; method/software versions; source hash/revision; owner through Project; and original snapshots for reproducibility. Existing relational required flow columns mirror the normal case input value/unit. Existing optional inlet pressure mirrors normal P1. Set a namespaced `calculation_intent=control_valve_sizing` through the dedicated mapping: the database field is a string, but existing `ScenarioPayload` literals exclude this task. Extend API dispatch/task filtering deliberately, not by sending valve inputs to hydraulic endpoints.

To avoid fabricated flow sentinels, server draft creation requires a positive normal-case flow/unit and name; other fields can remain incomplete. Empty drafts stay client-side. Relaxing this constraint would require a separately approved persistence change. Standalone calculation needs no project; saving requires choosing/creating an owned project.

Validate envelope/schema/hash on read. Do not silently convert corrupt valve JSON into `{}` as a usable scenario. Old hydraulic scenarios retain existing interpretation. New task records must be routed/filtered safely before persistence is enabled. No bulk migration of legacy data.

Software/provider/method updates mark saved results stale, never silently overwrite/recalculate them. Permit historical rendering with version label where supported; explicit recalculation creates a new revision. Source scenario changes require re-import/confirmation. Future schema migrations preserve originals and have tested reversible transforms. Ownership checks apply to every read/write/report reference.

## 21. PDF and DOCX reports

One preparation function supplies both writers. Reuse existing ReportLab/python-docx utilities, file naming and authenticated responses where appropriate; avoid line/pump-specific assumptions. Required content:

- Project/scenario identity; standalone/linked mode; source revision and valve location.
- Calculation basis, governing editions/corrigenda, method verification status and software version/timestamp.
- Fluid identity, all properties, provenance and real evaluation conditions, including manual overrides.
- Minimum/normal/maximum inputs, disabled markers, original/display/SI units and pressure taps.
- Pipe/valve geometry, attached element ownership, external loss budget and sourced valve factors.
- Base/corrected required Cv/Kv, separate margin percentage/amount and preliminary target rated Cv/Kv, user-selected/rated Cv/Kv, characteristic, rangeability and predicted openings. Margin never modifies required capacity, flow or pressure drop.
- FP/FR/Rev/FL/FLP/FF/Fd, limiting pressure drop, choking/cavitation/flashing assessments.
- Governing cases, recommended rating interval, controllability, assumptions, warnings and limitations.
- Prominent preliminary engineering sizing and vendor-confirmation statement.

Validate the complete frozen snapshot before rendering. No property lookups or default values at export. Server verifies client results against frozen inputs or uses a trusted saved snapshot. Normal reports require complete supported enabled cases; conditional/severe-service results carry conspicuous vendor-review status. A diagnostic NOT SIZED report requires separate approval. Later report tests must check preparation parity and actual PDF/DOCX content/rendering in temporary output directories.

## 22. Deterministic test plan

Keep existing unittest/TestClient and Node actual-TS-module conventions. Pure engine tests inject immutable properties and factors; adapter tests assert exact real P1/T and provider call count. No network-dependent expected values. Pin provider versions in fixtures.

Required test categories:

1. Unit conversions, absolute/gauge/differential tags, Cv/Kv reciprocity, equivalent full cases in different units.
2. Automatic versus manual frozen state; actual inlet pressure; no artificial datum; missing/out-of-range Pv/Pc; override/import provenance and immutable replay.
3. Turbulent and viscous/transitional valve branches; required-factor absence and demonstrably turbulent base sizing without Fd when the verified method permits; no style-derived defaults; iteration convergence/failure; supported/unsupported installed combinations.
4. Same-size, upstream reducer, downstream expander and combined geometry; actual ID/schedule import; remote Crane K/quantity/velocity basis.
5. Duplicate ownership and pre-lumped losses; reference-plane kinetic/elevation terms; source scenario not mutated.
6. Below/at/above verified choking limit; verified standard/manufacturer cavitation thresholds, exact indeterminate message without thresholds and no choking-to-cavitation severity shortcut; distinct flashing logic.
7. Linear/equal-percentage travel, shutoff exclusion, minimum controllability/rangeability, quick-opening rejection, overcapacity and excessive oversizing.
8. Three-case disable/incomplete/order behavior; maximum-flow not necessarily governing; rating-interval intersection failure.
9. Standalone/linked equivalence, missing anchors, stale source and unsupported topology.
10. Authentication missing/invalid/valid/unavailable; cross-user ownership isolation for calculate/save/read/update/report; body owner spoofing rejected.
11. Persistence round trip of all cases, values/units/provenance/results/hashes; legacy task routing; corrupt/unknown schema handling.
12. PDF and DOCX payload preparation and real artifact content; missing configuration blocked in frontend; readable 422 arrays.
13. Cold-start GET recovery and no automatic POST/PUT/PATCH/DELETE replay preserved.
14. Zero/near-zero, negative, nonfinite, unknown units, bad diameter/factor and tolerance-edge cases; explicitly validated project-specific floor overrides; repeatability and bounded runtime. Verify margin affects only target rating and opening bands never become standard limits. Test initial pure-liquid eligibility and the complete-provider/verified-applicability mixture gate.

Metamorphic tests and implementation self-consistency supplement independent fixtures; they do not replace them. Seed fuzzing; exclude timestamps from numerical equality while verifying presence. Test the actual engine/model/builder functions, not copied formulas.

## 23. Independent benchmark register

No numerical standard/manufacturer expected output is asserted here. All such fixtures are pending acquisition and independent approval. Synthetic hand-check inputs may be defined but must be labeled synthetic; independently derive/review outputs rather than calling the implementation to create expectations.

| Group | Independent evidence required | Outputs and proposed tolerance policy |
|---|---|---|
| Simplified same-size turbulent | Signed hand calculation using coefficient definition with explicit reference density | Cv/Kv and pressure balance; proposed 1e-6 relative for exact analytic fixtures. |
| Cv/Kv/unit conversion | Authorized definition/table plus independent dimensional derivation | Reciprocal and round-trip; proposed 1e-10 relative for algebraic conversion, separate published rounding tolerance. |
| IEC/ISA worked examples | Authorized edition/clause/example, permission for minimal fixtures | C,FP,FLP,FR,Rev,terminal drop; proposed 0.5% or published rounding bound, whichever larger, subject to review. |
| Manufacturer installed examples | Identified handbook/software version and full qualified geometry/factor inputs | Upstream/downstream attached effects and capacity; tolerance based on source precision. |
| Choked threshold | Independently checked standard/manufacturer example | FF, limiting drop, saturated capacity, both sides of threshold; exact classification outside approved uncertainty band. |
| Viscous/low-Re | Authorized example plus manufacturer comparison where available | Rev/FR/corrected C/branch; proposed ≤1% only after reconciling branch/rounding. |
| Fluid-engine comparison | Independent trusted property tables/provider reference data at exact state | ρ,μ,Pv,Pc; property-specific source uncertainty, no universal percentage. |
| Crane resistance | Workbook identity/version plus independently checked Crane/reference example | K/quantity/velocity basis/external ΔP; regression and independent check. |
| One-way pressure budget | Independent energy-balance worksheet with attached/remote fittings separated | P1/P2, available drop, no duplication, kinetic/elevation terms; approved absolute/relative residual. |

Every benchmark requires source/document/page/URL, edition/version, reviewer/date, complete inputs/units, expected outputs/units, tolerance/justification, method applicability and copyright-safe fixture permission. Proposed tolerances are EA policies, not approved accuracy guarantees. Conflicts require reconciliation, not averaged expected values. No branch releases without an independent approved benchmark.

## 24. Objective acceptance criteria

- Engineering: complete verified method pack and independent benchmark pass for every supported branch, including viscous and installed geometry.
- Units: equivalent cases agree; absolute/gauge handling and coefficient reference convention are explicit and tested.
- Determinism: repeated frozen inputs yield matching numerical results/diagnostic ordering; iteration cap and failure states tested.
- Traceability: every property/factor has source and applicability; no silent default; frozen snapshots survive API/persistence/report round trip.
- Cases: all three operate consistently; disabled excluded; incomplete enabled cases block complete recommendation; governing case identified.
- Workflows: standalone and anchored linked cases agree; missing real pressures block; source records remain unchanged.
- Double-counting: each element exactly once; ambiguous aggregate losses block; pressure-reference accounting independently checked.
- Warnings: generic cavitation is screening; incipient/significant categories require verified thresholds; the mandatory indeterminate message appears otherwise; choking/cavitation/flashing distinguished; unsupported services never appear sized; no damage/vendor approval claims.
- Persistence: task/version dispatch, owner isolation, stale/corrupt handling and legacy compatibility tested without migration under the approved draft rule.
- Security: authenticated calculations/reports, no cross-user access, existing authorization and no-mutation-retry behavior preserved.
- Reports: PDF/DOCX contain equivalent complete inputs/frozen states/warnings; absent configuration cannot be omitted into a report POST.
- Tests/build: existing and new suites pass; TypeScript/build pass; no new ESLint errors; no unrelated diff.
- Performance (EA): frozen three-case core target p95<100 ms on a documented reference machine, excluding provider/network/report I/O; bounded iterations; normally at most three distinct property resolutions. Measure provider timing separately; never sacrifice validity for latency.
- Documentation: reviewed method/units/benchmark registers, factor requirements, limitations and examples. Unresolved required SV/MV gates block release.

## 25. Future phases

Separate future specifications for gas/xT, steam, two-phase, non-Newtonian/slurry, coupled system/valve operating point, noise, actuator sizing, detailed cavitation damage, trim/material selection, vendor valve database/commercial selection, special/multistage trims and dynamic control-loop simulation. Mixtures remain a gated Phase 1 extension or later phase; initial implementation starts with supported pure liquids and cannot bypass the complete-provider/verified-applicability gate. Reserved data fields do not imply support.

## 26. Traceability table

Planned E=engine; P=property adapter; H=hydraulic/Crane adapter; A=API; U=dedicated UI; S=JSON envelope; R=report preparation. No listed planned module is implemented here.

| Requirement | Engineering engine | Property adapter | Crane/hydraulic adapter | API/model | Frontend component | Persistence field | Report section | Test category |
|---|---|---|---|---|---|---|---|---|
| Liquid scope/exclusions | E eligibility | P phase | H eligibility | A service discriminant | U FluidProperties | S inputs.service | Basis/limitations | Unsupported/boundaries |
| Three cases | E evaluator | P per-case freeze | H per-flow budget | A keyed cases | U OperatingCases | S inputs.cases/results | Comparison | Case completeness |
| Units/Cv/Kv | E registry | P interface units | H mm/bar conversion | A tagged values | U units | S raw/SI | Units/basis | Conversions |
| Real pressure/provenance | E frozen state | P real P1/T | H taps | A required configuration | U provenance | S frozen_properties | Property sources | Datum/round trip |
| Catalogue/Crane reuse | E external inputs | P validated fluid | H existing functions | A source snapshot | U ValveGeometry | S geometry/elements | Loss budget | ID/Crane fixtures |
| Attached effects/no duplication | E FP/FLP | P fixed properties | H ownership ledger | A attachment IDs | U schematic | S loss_ownership | Ledger/factors | Double counting |
| One-way linked mode | E prescribed flow | P validated state | H anchored budget | A owned refs | U ModeAndSource | S source_link/hash | Linked basis | Workflow parity |
| Reynolds correction | E Rev/FR | P μ/ν | H qualified geometry | A Fd/domain | U ValveFactors | S method/factors | Rev/FR | Viscous/iteration |
| Choking | E terminal drop | P Pv/Pc | H assembly taps | A limits | U CaseResults | S results | Limiting drop | Threshold fixtures |
| Cavitation/flashing | E classifiers | P phase/Pv | H downstream state | A separate flags | U warnings | S classifications | Severe service | Thresholds/missing data |
| Rating/travel | E characteristic | P frozen | H fixed assembly | A rating/curve | U ValveSelection | S selection/policy | Travel | Linear/equal-percent |
| Recommendation | E aggregate | P override flags | H assumptions | A overall | U comparison | S overall | Governing cases | Margin/oversizing |
| Validation/errors | E codes/nulls | P failures | H ambiguity | A 422/status | U readApiError | S draft status | Diagnostic limits | Invalid inputs |
| Auth/retry | E unchanged math | P server use | H owned reads | A existing auth | U apiFetch | S Project owner | Authorized download | Ownership/no replay |
| Persistence/version | E version/hash | P source hash | H revision | A task models | U ScenarioActions | S envelope | Version/time | Legacy/stale/round trip |
| PDF/DOCX | E frozen verification | P no export lookup | H saved ledger | A report snapshot | U ReportActions | S result | All sections | Both writers |
| Benchmarks/release | E method pack | P references | H independent budget | A version IDs | U preliminary label | S method metadata | References | Independent fixtures |

## 27. Approved decision register and remaining verification work

Decisions 1–27 below map to the consolidated approval table presented to the owner. All are approved subject to the mandatory refinements in the Approved Phase 1 Design Basis. This register supersedes the earlier unnumbered open-decision table; alternatives are not pending competing design choices. Remaining work concerns evidence, applicability and explicitly requested case-specific approvals, not reopening the approved basis.

| Decision | Approved Phase 1 choice | Remaining verification or explicit validation |
|---|---|---|
| 1. Hydraulic integration | One-way prescribed-flow transfer; coupled solving deferred. | Verify method boundaries and independent energy balance. |
| 2. Valve styles | Globe, segmented-ball and butterfly are descriptive categories only; no style-derived FL/Fd. | User-supplied sourced factors must apply to design, size and travel. |
| 3. Cv and Kv | Both supported with SI internal arithmetic and one reciprocal conversion convention. | Verify coefficient definitions and constants. |
| 4. Operating cases | Minimum/normal/maximum; normal required; optional cases explicitly disabled. | Test completeness and governing-case logic. |
| 5. Sizing margin | Configurable 10% only on target rated coefficient: target=Cmax_required × 1.10. Required, margin and target displayed separately; required capacity, flow and ΔP unchanged. | Test separation and policy persistence; not a standards allowance. |
| 6. Opening bands | Minimum 10–40%, normal 40–70%, maximum 70–90%; configurable preliminary guidance only. | Vendor travel limits prevail; no IEC/ISA requirement or vendor guarantee. |
| 7. Characteristics | Qualified idealized linear/equal-percentage estimates within controllable travel. | Verify rangeability, travel and factor dependence. |
| 8. Quick-opening | Generic travel prediction deferred. | Qualified curve support requires a separate extension approval. |
| 9. FL and Fd | FL required for completed recovery/choking; Fd only when applicable verified Reynolds correction needs it. Never default either. | Missing required factors leave dependent assessments incomplete. Demonstrably turbulent base sizing may proceed without Fd where verified methodology permits. |
| 10. Part-travel factors | Qualified data; no blanket extrapolation. | Conditional constant-factor approximation requires explicit case approval and sourced applicability evidence. |
| 11. Manual overrides | Field-level source/reason; original values retained. | Validate units/applicability; no bypass of mixture gate. |
| 12. Automatic properties | Existing traceable provider selection at real P1/T; freeze through API/save/report. | Verify completeness and applicability; no silent substitution. |
| 13. Missing Pv/Pc | Block completed dependent sizing; valid diagnostic base results must be labeled. | Obtain sourced properties; no invented zero/water defaults. |
| 14. Pressure inputs | Absolute default; optional explicit gauge conversion with recorded atmosphere. | Validate tags and conversion assumptions. |
| 15. Cavitation | Generic screening. Incipient/significant require applicable verified standard/manufacturer thresholds; otherwise “Cavitation assessment indeterminate — manufacturer data required.” | Verify thresholds; no damage-prevention or valve-suitability claim. |
| 16. Flashing | Separate flashing screening; no downstream two-phase/damage prediction. | Verify liquid-method applicability and state basis. |
| 17. Selected/rated coefficient | User-entered sourced Cv/Kv; required for opening/selection, not base required-capacity arithmetic. | Verify rating and reference travel. |
| 18. Automatic selection | Target coefficient interval only; no preferred-number/commercial selection. | Future selection databases require separate scope approval. |
| 19. Attached geometry | Exclusive assembly-versus-external element ownership. | Verify geometry factors and no duplicated losses/reference terms. |
| 20. Crane integration | Reuse external-loss catalogue/functions; never substitute K for IEC/ISA factors. | Independent loss and velocity-basis checks. |
| 21. Benchmarks | Independent authorized/manufacturer/hand-check fixtures mandatory before release; per-source tolerances. | Acquire evidence and approve individual tolerances; illustrative percentages are not accuracy guarantees. |
| 22. Vendor language | Mandatory preliminary engineering sizing requiring vendor confirmation. | No product, damage, material or suitability approval implied. |
| 23. Mixtures | Start with supported pure liquids. Defer mixtures unless the existing provider supplies all required properties with verified applicability. | Gated Phase 1 extension or later phase; eligibility evidence required before enabling. |
| 24. Near-zero policy | 0<Q≤1e-9 m³/s and 0<ΔP≤1 Pa are software-stability defaults, not engineering applicability limits. | Document project-specific overrides and explicitly validate units, stability and method domain; cannot waive standards limits. |
| 25. Draft persistence | Positive normal flow/unit and name before server save; no database migration. | Verify task routing, ownership and legacy compatibility. |
| 26. Incomplete reports | Normal exports blocked for invalid/incomplete enabled cases. | Separate NOT SIZED diagnostic mode requires further approval. |
| 27. Standards baseline | IEC 2011/corrigendum and ISA 2012 pairing as baseline to verify. | Authorized edition/equation/constant/applicability verification remains a release blocker. |

Unresolved items are limited to authorized equation/constant verification, applicable user-supplied factor evidence, independent benchmark fixtures/tolerances, and explicitly validated project/case exceptions within this basis. None authorizes generic factors, unverified cavitation severity, mixture support without the provider gate, a margin on process conditions, mandatory Fd for every turbulent calculation, or treating opening bands/numerical floors as standards limits.

## 28. Phased implementation plan and proposed commits

Design decisions are approved as recorded above; implementation still requires a separate request. Acquire/review the required equations and benchmark sources before coding each branch. Start with supported pure liquids; enable mixtures only through the approved gate. Final verification is not permission to defer correctness until the end.

1. **`feat: add deterministic liquid control-valve core and strict models`**: pure frozen-input engine, strict types, SI conversion boundary, initial verified liquid branch, bounded solver structure and independent unit fixtures. No UI, endpoints, persistence or report code. Unverified branches explicitly unsupported; this stage is not full Phase 1 release.
2. **`feat: add verified installed and viscous valve branches`**: qualified FP/FLP/Rev/FR pack, choking/flags, characteristics and case aggregation; independent branch tests. Keep reviewable rather than one large feature commit.
3. **`feat: expose authenticated control-valve calculations`**: thin existing-fluid adapter/provenance and versioned API; authorization, field completeness and readable errors.
4. **`feat: add standalone control-valve workspace`**: modular three-case editor/results, factors, ratings and existing cold-start/no-replay behavior.
5. **`feat: persist versioned control-valve scenarios`**: JSON mapping, task routing, ownership, legacy and stale-result tests; no migration under the approved draft rule.
6. **`feat: link valve sizing to hydraulic snapshots`**: one-way budget/taps, catalogue and Crane reuse, ownership ledger and independent energy-balance fixtures.
7. **`feat: add control-valve PDF and DOCX reports`**: common frozen preparation, both writers, content parity and rendered artifacts.
8. **`test: verify control-valve benchmarks and release criteria`**: complete independently approved register, source reconciliation, performance, documentation and release gates. No unsupported branch silently enabled.

**Single recommended next implementation step:** with the section 27 design decisions now approved, and after authorized equation verification and a separate implementation request, implement stage 1 only: the deterministic liquid-sizing core, strict models and independent unit tests, with no UI, persistence or reports.
