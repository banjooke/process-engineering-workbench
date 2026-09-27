# Control-valve MVP plan: mandatory hydraulic reuse

Status: documentation-only plan, inspected 2026-09-27. No implementation is authorized by this document. This file did not previously exist; this plan records the mandatory reuse scope and the smallest necessary adapter.

Related records: [Phase 1 specification](control_valve_sizing_spec.md) and [equation verification](control_valve_equation_verification.md). The owner's latest MVP instruction narrows the earlier attached-assembly approach: **MVP Phase 1 reducers and expanders remain ordinary external hydraulic resistance elements. IEC/ISA attached-valve reducer corrections are deferred.** This exception applies to this MVP plan; the two earlier documents are not edited. Their standards-verification, property-provenance and manufacturer-factor gates remain applicable to new valve calculations.

## 1. Existing implementation inventory

The actual workbook and Python interfaces were inspected, including loading the workbook through the existing loader. Counts below describe this snapshot, not a new database specification.

| Existing file / class / function | Verified interface and required reuse |
|---|---|
| `crane_resistance_coefficient_K_database.xlsx` | Sole existing Crane workbook. `K_Database`: 81 rows; `Friction_Factor_fT`: 14 rows. Retain the existing file, record its hash/version in snapshots and use its existing lookup path. No new fitting database, copied table or hard-coded replacement catalogue. |
| [engineering/fittings.py](../engineering/fittings.py): `find_database_path`, `load_fitting_database`, `get_database_info`, `fitting_database_available` | Existing workbook discovery/cache/status; `load_fitting_database()` returns K and fT dataframes. Reuse rather than a second reader/calculation system in the adapter. |
| Same file: `get_simple_fitting_database`, `get_fitting_catalog`, `fitting_label`, `find_fitting_record` | Existing selectable catalogue has 70 records: `Fixed` or `Multiplier × fT`. Formula/variable-correlation records are excluded. Keep selection labels and full catalogue metadata. |
| Same file: `get_crane_ft`, `calculate_database_k`, `calculate_fitting_k` | `calculate_fitting_k(selection_label, nominal_size_mm, quantity=1, override_k_each=None)` returns database and selected K, total K, quantity, size, method, fT, multiplier and expression. Reuse for supported catalogue fittings; never replicate multiplication/lookup logic in a valve calculator. |
| [backend/main.py](../backend/main.py): `FittingKRequest`, `fitting_k` | Existing request vocabulary and `/fittings/calculate-k` boundary. Catalogue/status routes are `fittings_catalog`, `fittings_info`. A backend adapter should call the engineering function directly, not make internal HTTP requests. |
| Same file: `LineElement`, `LineSolveInput`, `solve_hydraulic_line`, `normalize_flow_unit` | Existing element and flow vocabulary. `LineElement` carries pipe, fitting and equipment fields. HTTP route `/hydraulics/solve-line` wraps `solve_line`; reuse its validated intent/absolute-pressure distinctions, not its numerical-datum outputs as physical pressures. |
| [engineering/hydraulics.py](../engineering/hydraulics.py): `solve_line` | Authoritative external-loss engine: `solve_line(fluid_config, flow_value, flow_unit, inlet_pressure_bar_a, elements)`. Submit ordered upstream and downstream element lists at the prescribed flow. Do not recalculate their pressure losses in new valve code. |
| Same file: `friction_factor`, `churchill_friction_factor`, `colebrook_friction_factor`, `calculate_velocity`, `calculate_reynolds_number`, `calculate_friction_factor`, `calculate_pressure_drop` | Existing pipe hydraulic functions. Reuse through `solve_line` for element evaluation; standalone utilities remain available for existing workflows. No second Darcy/Crane/equivalent-length implementation. |
| Same file: `calculate_mass_flow`, `get_fluid_state`, `build_engineering_warnings` | Existing engine mass-flow/state handling and warnings. Supply explicitly validated frozen liquid properties; preserve engine results and warnings. No new property correlation or replacement warning thresholds. |
| [engineering/piping.py](../engineering/piping.py): `get_piping_catalog`, `get_internal_diameter_mm`, `get_roughness_mm` | Reuse NPS/schedule resolution and material roughness. `get_internal_diameter_mm(nps,schedule)` derives ID from existing OD/wall data and rejects unknown schedules. Do not use DN as actual bore. |
| [engineering/fluids.py](../engineering/fluids.py): `get_fluid_properties`, `get_fluid_catalogue`, `search_fluids`, `property_engines_available` | Existing provider selection and property resolution. `get_fluid_properties(fluid,temperature_c,pressure_bar_a)` returns density, viscosity, conditional vapor/critical pressure, phase, evaluation conditions and provider metadata. Preserve that information. |
| [backend/main.py](../backend/main.py): `FluidPropertyRequest`, `FluidConfig` | Reuse vocabulary, but not default physical values. `FluidConfig` supplies water-like defaults and omits critical pressure; a strict wrapper snapshot must carry explicit values and extended provenance. |
| [engineering/hydraulics.py](../engineering/hydraulics.py): `freeze_pump_fluid_properties` | Existing real-source-pressure freeze pattern. Reuse the principle; do not treat a pump-specific snapshot or artificial pump datum as the valve's physical inlet state. |

There is no existing `CraneFitting` calculation class to instantiate: fitting calculations are functions returning dictionaries/dataframes. The relevant existing request classes are the Pydantic classes above. The plan does not invent a parallel object model for calculating K.

Workbook fields inspected: `Category`, `Component`, `Configuration`, `Size Range (mm)`, `Angle / Geometry`, `K Basis`, `Multiplier on fT`, `Fixed K`, `Formula Reference`, `K Expression`, `Notes`, `Crane Page`. The fT sheet uses `Nominal Size / Range (mm)` and `fT (complete turbulence)`. Preserve source references and notes in metadata even where the public catalogue omits a field.

## 2. MVP ownership and reducer/expander policy

Every hydraulic element has one stable snapshot ID and one side: upstream or downstream. The valve itself is a cut point, not an additional line resistance. An existing resistance representing the valve being sized must be explicitly identified and excluded once, with its original record retained in the snapshot. Ambiguous lumped losses must be decomposed before sizing.

All reducers/expanders, including ones adjacent to the valve, stay in the appropriate external element list **exactly once**. Do not extract them into an IEC/ISA attached assembly, remove their ordinary K, add FP/FLP corrections, or apply a second equivalent length. A future attached-valve mode would require explicit ownership migration and renewed verification; it cannot silently stack on MVP losses.

Important current limitation: the workbook has sudden/gradual contraction and enlargement entries referencing Formula 1–4, but the automatic catalogue excludes them and `calculate_database_k` does not evaluate their expressions. `calculate_fitting_k` resolves the database entry before applying an override, so passing an unsupported reducer label with an override does not bypass that limitation.

Smallest supported representation: an existing `Resistance / Fitting` hydraulic element with an explicitly supplied, reviewed `k_total` and `id_mm` velocity basis. For a reducer/expander, preserve the original sourced K, source/formula reference, applicable geometry, small/large IDs, direction, quantity and the diameter to which K refers. This is ordinary external resistance evaluation by `solve_line`, **not automatic reducer-K calculation**. A synthetic K is permitted only in a clearly labeled software integration fixture. Production missing K or ambiguous diameter basis blocks the linked calculation; do not borrow an elbow label or invent a reducer formula.

No equivalent-length calculator was found in the inspected path. If an import supplies only L/D or equivalent length without an already supported loss representation, mark it unsupported and request a reviewed existing-engine input. Do not build a second K↔equivalent-length conversion in this MVP.

## 3. Thin adapter contract

Proposed future wrapper: `engineering/control_valve_hydraulics.py::evaluate_external_hydraulics`. This name is planned only. Its responsibilities are validation, immutable snapshot preparation, direct calls to existing functions, result partitioning and pressure-boundary bookkeeping. It must not contain fitting correlations or replacement hydraulic/property equations.

Inputs per operating case:

- Prescribed positive actual-liquid flow or mass flow in existing supported units; upstream/downstream ordered existing `LineElement` dictionaries and cut-point identity.
- Real source and sink absolute static pressures and declared locations/elevations/diameter basis, or an explicit real valve-outlet pressure for a forward-only downstream check. No pressure-drop-only synthetic datum qualifies as an absolute anchor.
- Explicit frozen liquid state resolved by the existing provider at the confirmed valve-inlet P1/T, or a validated imported/manual state with provenance. Preserve density, viscosity, vapor pressure, critical pressure, phase and provider metadata outside the permissive legacy model.
- Catalogue/pipe source version, fitting metadata and ownership ledger. No field defaults may silently supply missing engineering data.

Supported Phase 1 model is prescribed-flow, constant-property liquid. For automatic properties, a real user-confirmed/imported P1 is required when it cannot be established independently: resolve there, freeze, and check the upstream engine result against that P1. A mismatch blocks completed sizing pending boundary reconciliation; do not conceal a coupled pressure/property solve or resolve properties at a trial computational datum. Gas, two-phase external piping and pressure-dependent-property inverse solves are outside this wrapper.

### Evaluation sequence

1. Validate side assignment, source/sink/cut-point boundaries, liquid eligibility, explicit properties and all element types. Resolve standard IDs/roughness with `piping` functions. Retain justified custom IDs. Reject contradictory catalogue/import values rather than silently changing geometry.
2. Preserve already resolved fitting inputs. Where a supported catalogue fitting needs evaluation, call `calculate_fitting_k` with its original nominal-size basis, quantity and explicit override. Map its `k_total` into the existing element. Do not multiply quantity again. Carry full source metadata alongside the engine payload.
3. Call `solve_line` on upstream elements at the real source pressure, prescribed flow and frozen state. Its actual outlet is P1 under the supported pressure-reference convention. Sum its four per-element loss fields as specified below.
4. If real valve-outlet P2 is supplied, call downstream `solve_line` at P2 and check its outlet against the real sink boundary if supplied.
5. If only sink pressure is supplied, exploit only the existing constant-property path: make a downstream forward trial at computed P1 to obtain its signed total drop, set candidate `P2=Psink+downstream_total_dp`, then replay the **same** downstream list through `solve_line` at that candidate. Require the final outlet to match Psink. This is boundary inversion by engine reuse, not a duplicate resistance calculation. The trial uses a real pressure value, but is not the actual downstream profile; never expose its pressure-derived warnings as actual case warnings. Retain trial diagnostics separately. If the trial fails its positive-pressure/domain checks, return a clear adapter limitation rather than choosing an artificial high datum or suppressing errors.
6. Set available valve drop to P1−P2. Reject nonpositive available drop or inconsistent supplied valve-inlet property reference. Retain signed elevation contributions and final engine warnings. No automatic valve sizing calculation is implied by successful hydraulic evaluation.
7. For an empty side, return zero side contributions and the corresponding real boundary pressure without calling `solve_line` (which rejects empty element lists). This is an explicit boundary identity, not a fabricated hydraulic result.

For both sides, pressure bookkeeping must be compatible with the current engine. It marches friction/local/equipment/elevation contributions but does not implement a general kinetic-energy correction between differing boundary velocities. Thus physical valve-tap reconstruction is supported only when endpoint kinetic terms cancel or a separately validated imported boundary basis establishes compatibility. Unequal endpoint velocity heads, unanchored tank/pump boundaries and unverified area-change pressure-reference conventions block physical P1/P2 completion; retain diagnostic engine loss partitions. Do not repair these gaps by modifying Crane K values. A later general mechanical-energy wrapper requires separate engineering verification.

### Required returned quantities

Return SI pressure quantities in Pa; P1/P2 are absolute, losses/available drop are differential. Preserve display units separately. A positive elevation contribution is a pressure debit for upward travel; a negative contribution is a pressure gain, never an absolute-valued loss.

| Required output field | Authoritative mapping |
|---|---|
| `upstream_pipe_loss_pa` | Upstream sum of engine element `pipe_friction_dp_bar` ×100000. |
| `upstream_crane_fitting_loss_pa` | Upstream sum of `local_resistance_dp_bar` ×100000, preserving per-element catalogue/explicit-K provenance. |
| `upstream_equipment_loss_pa` | Upstream sum of `equipment_dp_bar` ×100000. |
| `upstream_elevation_contribution_pa` | Upstream sum of `elevation_dp_bar` ×100000, including Pipe `dz_m` and standalone elevation elements. |
| `downstream_pipe_loss_pa` | Downstream final-run sum of `pipe_friction_dp_bar` ×100000. |
| `downstream_crane_fitting_loss_pa` | Downstream final-run sum of `local_resistance_dp_bar` ×100000. |
| `downstream_equipment_loss_pa` | Downstream final-run sum of `equipment_dp_bar` ×100000. |
| `downstream_elevation_contribution_pa` | Downstream final-run sum of `elevation_dp_bar` ×100000, signed. |
| `pressure_before_valve_pa_abs` | Physical upstream outlet P1, or real source boundary for empty upstream side. |
| `pressure_after_valve_pa_abs` | Validated downstream inlet P2, or real sink boundary for empty downstream side. |
| `available_valve_pressure_drop_pa` | P1−P2 after physical-boundary checks. |

The legacy engine groups all explicit local K elements with catalogue fittings. The requested `crane_fitting_loss` output therefore includes ordinary external explicit-K reducers, with a per-element `catalogue_crane` versus `sourced_external_k` provenance tag; never label an arbitrary supplied K as a verified Crane lookup. Optionally expose those subtotals without changing the required total field.

Also return raw final upstream/downstream engine results, source snapshots, frozen state, per-element metadata, warnings with side/element context, boundary residual, `complete`/assessment status and limitations. On a blocking mismatch, required unavailable pressures/drop are null with reasons, not invented values; independently valid side loss totals may remain diagnostic.

## 4. Metadata, Reynolds behavior and interface mismatches

| Current behavior or mismatch | Smallest wrapper treatment |
|---|---|
| `solve_line` supports `Pipe`, `Resistance / Fitting`, `Known Equipment ΔP`, `Elevation Change`; no valve cut-point model or inverse outlet-boundary API | Split immutable existing lists and use forward calls plus the frozen-liquid replay in §3. Do not reverse element order or flow direction to fake a backward solve. |
| Result rows have index/type/description/pressure/loss/velocity/Re/friction fields, not all original fitting metadata | Join each row back to its input by side and stable snapshot ID/index; retain selection, quantity, K values, override/source, nominal size, actual ID, roughness, source page, formula reference and geometry. Do not use description text as identity. |
| `get_crane_ft` is complete-turbulence fT with exact/range selection then nearest-range fallback | Preserve current lookup semantics and chosen nominal-size basis. Record fallback applicability/limitations; do not substitute the pipe's current friction factor for fT. |
| `solve_line` computes local velocity, pipe Re and friction method for fitting rows, but applies supplied `k_total` without a new Re-dependent K correction | Preserve this behavior exactly. Pipe friction retains existing laminar/transition/turbulent dependence. Do not claim fitting K is dynamically Reynolds-corrected, add low-Re corrections, or substitute valve Rev/FR. Cases outside the supplied K's applicability remain flagged/incomplete. |
| Pipe `dz_m` and standalone elevation elements both contribute | Sum actual returned elevation contributions; detect duplicated imported elevation definitions rather than adding geometry elevations a second time. |
| Equipment input is prescribed `known_dp_bar`, not an equipment performance curve | Preserve the value at the specified case flow. Require case-specific data when flow changes; do not invent square-law scaling. |
| Formula/variable-correlation workbook rows are not implemented by the current lookup | Reuse reviewed imported explicit K as described in §2, or block. No new reducer formula/database in this plan. |
| Fitting input has one `id_mm`, no general two-diameter/angle calculation | Store both geometric diameters in provenance, but pass the sourced K velocity-reference ID to the current engine. Missing reference basis blocks. No silent K rescaling. |
| Engine has a 1000 Pa minimum-pressure guard and rejects empty lists | Preserve guard; surface failures. Use boundary identity only for genuinely empty sides. Do not clamp physical pressure to satisfy the solver. |
| Pressure-drop-only HTTP mode may use a 1000 bar numerical datum and suppress absolute outputs | Such outputs may describe losses only; never use them as valve P1/P2 or property-evaluation pressure. Call the engineering function with validated physical boundaries. |
| Existing property usability validation covers density/viscosity but not every valve property; public route drops underscore provider metadata | Reuse provider directly, validate completeness, retain `_property_provider`/`_provider_fluid_id` and extend frozen provenance minimally. No water defaults for missing properties. |
| Pressure-dependent automatic engine mode can re-resolve properties during marching | MVP uses explicit constant frozen liquid state; do not use that mode for the inverse downstream calculation or property-state consistency proof. |
| Existing warning function evaluates actual pressure/phase margins | Preserve `level`, `code`, `message` from final physical runs; side-tag without altering content. Append adapter limitations separately. Existing warnings do not certify new valve cavitation/choking assessments. |
| Catalogue NPS/schedule data and older hydraulic schedule helpers coexist | Use `engineering/piping.py` as catalogue-facing authority; flag imported discrepancies. Retain `id_mm` conversion once at the engine boundary. |
| General kinetic/elevation boundary accounting exceeds current scalar pressure-march interface | Limit completed physical tap results as described in §3. No new loss correlation or covert coupled network solver. |

## 5. Integration test plan (future work only)

Add future tests in `tests/test_control_valve_hydraulic_adapter.py` when implementation is separately requested. Direct calls to the **current** `solve_line`, `calculate_fitting_k` and `get_internal_diameter_mm` are the adapter-integration oracle. Do not copy their formulas into expected-value helpers. These parity tests prove reuse and mapping, not independent scientific validation of a new valve method.

Use a recorded workbook hash and supported catalogue selection resolved by exact component/configuration/geometry, not a fragile row ordinal. Keep input lists immutable. Suggested numeric parity tolerance: relative 1e-10 with absolute 1e-6 Pa for pressure sums, subject to review; compare metadata/methods/warnings exactly. Separately compare boundary replay residual using that documented software tolerance, not an engineering accuracy guarantee.

### Mandatory mixed-element fixture

Define a clearly synthetic software fixture with prescribed 5 m³/h and explicit frozen liquid properties (ρ=1000 kg/m³, μ=0.001 Pa·s, Pv=2000 Pa); these are fixture inputs, not automatically asserted water properties. Use real test boundary pressures of 10 bar(a) source and 2 bar(a) sink. Any downstream actual pressure supplied directly must be separately consistent with the direct engine run.

- Upstream: NPS 2 schedule 40 pipe, 10 m long and +1 m elevation; two standard 90-degree elbows evaluated using the real catalogue and quantity=2; sourced-input reducer represented as `Resistance / Fitting` on the NPS 1 schedule 40 ID basis; NPS 1 pipe 5 m; external expander back to NPS 2; equipment drop 0.1 bar; standalone elevation +1 m.
- Downstream: NPS 2 schedule 40 pipe 8 m; one catalogue elbow; equipment drop 0.05 bar; standalone elevation −1 m.
- Reducer and expander use explicitly declared synthetic `k_total` values 0.4 and 0.2 for **software parity only**, quantity=1, with small-ID velocity basis and both geometric IDs recorded. They are not claimed as workbook-computed K values. No formula is added. The upstream source/valve endpoint bores match to avoid claiming a net unhandled boundary velocity-head change; local profiles remain subject to the documented engine area-change limitation.

Expected results are obtained from direct engine calls, including their exact warning arrays, rather than invented numeric losses. The fixture must verify all eight partitions, P1, validated P2, available drop, signed elevations, quantity already included once, and absence of any FP/FLP contribution. A separate production-grade physical reducer benchmark remains necessary before claiming validated pressure recovery through area changes.

| Test | Required comparison/assertion |
|---|---|
| Mixed-element direct-call parity | Independently submit identical resolved side lists to `solve_line`; compare raw rows and all adapter partitions. Include the mandatory fixture above. |
| Downstream inverse and replay | Trial at physical P1, candidate P2 from engine total, final direct call at P2 reaches sink; compare final row/profile/warnings. No synthetic-datum pressure leaks into output. |
| Explicit P2 mode | Direct downstream call at supplied P2 matches adapter; inconsistent sink boundary blocks completion. |
| Quantity/override fidelity | Use actual catalogue `calculate_fitting_k` with quantity and override; retain database K versus selected K, fT and method; no double multiplication. |
| Reducer ownership | Each reducer/expander ID appears once in external lists, never an attached-correction list; unsupported formula lookup blocks instead of silently choosing a default. Explicit-K input follows direct `solve_line` behavior. |
| Diameter and schedule | Compare catalogue IDs and per-element velocity basis; unknown schedule, inconsistent imported ID and missing reducer K basis fail clearly. |
| Reynolds behavior | Run prescribed flows/frozen viscosities covering existing pipe friction branches; compare engine Re/friction/methods and loss outputs. Assert catalogue fT/K is not replaced by runtime pipe friction. |
| Elevation/equipment | Rising/falling sections preserve sign; pipe and standalone elevation are counted once; equipment values preserved without invented flow scaling. |
| Frozen properties/provenance | Existing provider called at confirmed real valve P1/T, then no provider calls inside replay; explicit state matches direct engine input. Mismatched reference P1 or missing properties blocks. |
| Warning preservation | Choose physical pressure/vapor-margin cases triggering existing warnings; compare final engine warning fields exactly, with separate adapter context. Trial warnings cannot masquerade as physical warnings. |
| Empty and invalid sides | Empty-side boundary identity; existing solver guard failures propagate; zero/negative available valve drop cannot produce completed sizing. |
| Boundary-model limitations | Unequal endpoint velocity heads, unanchored absolute pressures, gas and coupled-property requirements return explicit incomplete/unsupported status. |
| No source mutation | Original scenario/element dictionaries, source fitting metadata and catalogue contents unchanged after success and failure. |

Retain existing `tests/test_stage1_hardening.py`, `tests/test_stage2_authentication.py`, `tests/test_stage3_pump_curves.py` and `tests/test_cors.py`. Future implementation validation includes the complete Python suite and relevant frontend checks if those layers later change. This documentation change creates no test code and claims no test execution for an adapter that does not yet exist.

## 6. Delivery boundary and acceptance

Existing Crane lookup, pipe friction, pressure-loss, pipe catalogue and fluid-provider calculations are the established repository baseline to reuse unchanged. This inspection establishes their actual contracts; it does not newly certify every database correlation or all reducer pressure-reference cases. Preserve existing regression coverage and limitations.

New wrapper logic consists only of input/state validation, side/ownership mapping, engine invocation, frozen-liquid boundary replay, metadata preservation and output aggregation. Its correctness is provisional until integration parity and boundary tests pass. New control-valve required-coefficient, recovery/choking, Reynolds-correction and cavitation methods remain separately subject to the [equation-verification gates](control_valve_equation_verification.md); successful existing hydraulics do not clear those gates.

Acceptance requires all eleven required pressure outputs or explicit unavailable reasons, full metadata and final warning preservation, direct-engine integration parity, and zero duplicated external/attached losses. Reducer/expander formula automation, IEC/ISA attached corrections, replacement Crane tables, equivalent-length calculations and changes to validated existing loss formulas are excluded. Implementation, commits and pushes require a separate request.
