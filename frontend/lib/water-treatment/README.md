# Water treatment Phases 1 and 2

The native React calculator calls `adapter.ts`; it never imports the raw engine directly. The adapter is the replaceable calculation boundary for a future backend service.

- `ww-engine.cjs`: unchanged copy of `integration-source/water-treatment-release1/engine/ww-engine.js`, recorded as **ww-engine/0.2.0**. CommonJS packaging uses the reference's existing module export; no browser global or script injection is used.
- `ww-engine.d.cts` and `types.ts`: the typed subset exposed for Design Basis, water demand, statistics, checks and standards.
- `input.ts`: string form state, reference example defaults, strict numerical parsing and input mapping.
- `adapter.ts`: input guards, engine invocation and numerical-result guards. No formulas are duplicated. The stricter boundary rejects malformed/nonfinite/negative inputs and impossible operating hours instead of letting the prototype silently default them. Empty pasted datasets stay empty rather than becoming a zero observation.
- `format.ts`: display-only formatting; calculations retain full precision.
- `../../components/WaterDesignBasis.tsx`: accessible native inputs, results, collapsible design checks, detailed methods and standard comparisons.

The reference engine source is pinned by SHA-256 (normalizing Git line endings) in `tests/water-treatment.test.mjs`. The unchanged reference validation cases are retained in `tests/fixtures/ww-validation.cjs`, so their 18 cases / 80 values also run on clean checkouts without the gitignored handoff folder. When the handoff is present, parity tests compare the adapter directly against that original engine. Frozen source/fixture files are excluded from style lint, not from validation.

## Scope and engineering limits

Only Design Basis & Compliance is enabled. The remaining four Release 1 tools are disabled placeholders. Hydraulic projects remain in General Process Engineering. Authentication, industry preferences, project selection and scenario JSON storage use the existing Workbench implementation. Water scenarios have a dedicated task discriminator and cannot overwrite other task types.

Design / proposal / existing-plant labels use the same basis equations, as in the prototype. No distinct equipment-rating method exists for this tool. The initial form is explicitly an example, not measured project data. Authenticated reports render saved calculated results; report downloads are blocked until the calculation is saved.

Domestic peaking excludes infiltration. Industrial peaking is independent. A positive average-flow override treats the entire flow as domestic and replaces both other flow components, preserving the reference's behavior. Flow rates, including peak-hour results, are expressed as m³/d equivalents.

Treated-quality values are entered independently for reference comparisons. No effluent predictions are borrowed from the deferred Activated Sludge or Disinfection tools. Missing quality inputs produce info rows. A standard's `verified` status describes the prototype reference's metadata, not a new regulatory review. `to verify` entries stay visibly provisional; neither those nor numerical pass rows establish legal compliance. Several entries have no source URL, and library notes can flag individual values even under a verified entry. Confirm current source text, permit conditions and site applicability. All results require competent engineering review.

## Verification

From `frontend`:

```text
node --test tests/*.test.mjs
node --test tests/water-treatment.test.mjs
npx tsc --noEmit
npm run build
```

From the repository root (when the local handoff exists):

```text
node integration-source/water-treatment-release1/tests/run-validation.js
git diff --check
```

The production build needs network access for the existing Geist font setup. No font, environment or deployment configuration was changed.

## Phase 2 persistence and reports

`WaterProjectWorkflow.tsx` owns project/scenario selection, dirty state, duplication, read-only comparison and report downloads. `calculation.ts` orchestrates the unchanged engine and custom limits through its existing range-check helper. `presentation.ts` maps raw statuses to friendly labels and separates regulatory references, user criteria and comparative guidance. No standards were researched or updated.

`persistence.ts` stores `engineering_task: water_treatment` with a `water_treatment` document in existing `Scenario.fluid_config_json`. Protocol: `water-treatment-scenario/1`, `ww-engine/0.2.0`, tool `design_basis`. The document retains the full string-valued draft, selected criteria, result, checks, calculation note, input signature, timestamp and stale/calculated state. A draft can contain empty or invalid text and zero sentinel flow. Only current complete numerical results can be saved as calculated.

Frontend restoration checks the versions, note, exact input signature, timestamp and a deterministic replay through the same unchanged engine. This is an integrity check, not a report recalculation or independent engineering validation. Backend validation checks shape, finite required result fields, provenance, selected limits against the frozen unchanged catalogue, and checks/result consistency. It adds a SHA-256 digest to detect changed/corrupted stored documents. This digest is not a certification or a cryptographic attestation that a trusted server ran the engineering engine; the backend does not execute the JavaScript engine. Engine replay remains a frontend integrity check.

Inputs or criteria edits clear the current result and timestamp. Unknown engine/schema versions and incomplete/corrupted results reopen as inputs requiring recalculation. Duplication creates a new record with an editable Copy of name, copied inputs/criteria and no result. Comparison accepts 2-5 distinct current scenarios within the same owned project and never modifies them. Metrics are read directly from saved results. Plant utilisation is explicitly unavailable in this reference engine; water-supply capacity is shown where calculated.

Additional authenticated endpoints:

- `POST /projects/{project_id}/scenarios/{scenario_id}/water-treatment/duplicate`
- `POST /projects/{project_id}/water-treatment/compare` with `scenario_ids`
- `POST /projects/{project_id}/water-treatment/reports/pdf`
- `POST /projects/{project_id}/water-treatment/reports/docx`

Reports accept only a `scenario_id` and optional `comparison_ids` (2-5 including the primary scenario). They require project ownership, project/scenario association, compatible current result, valid provenance and the saved integrity digest. Missing/foreign resources follow the existing 404 convention. Saved results are rendered without engineering recalculation by one report-data builder. Both formats include project/scenario metadata, input units/origins, selected reference classification and verification metadata, results, checks, optional comparison, methods, source notes and review disclaimers. Filenames are ASCII-sanitized and bounded. Responses use in-memory bytes and no-store; no generated file cleanup service or new storage is needed. POST requests use the existing authenticated API helper and are never automatically retried.

`engineering/water_reference.json` is an exact frozen copy of the engine catalogue used to validate saved reference provenance on the Python side. A parity test prevents silent drift. `tests/fixtures/water-scenario.json` is generated by `node frontend/tests/create-water-fixture.mjs` from the actual integrated engine, not hand-authored formulas. The original engine and original validation fixture remain unchanged.

## Phase 2 verification record

Baseline before Phase 2 edits: 232 frontend tests and 194 Python tests passed. Final verification: 244 frontend tests; 26 focused water frontend tests; 211 Python tests including 17 focused water persistence/comparison/report tests; original prototype 18/18 cases and 80/80 values. Production build, standalone TypeScript, focused integration ESLint, Python compilation and diff whitespace checks passed. The existing page.tsx lint baseline remains 5 errors and 9 warnings with no new findings.

The six-page PDF comparison sample was rendered and all pages visually reviewed. DOCX generation and content/structure tests passed, but visual DOCX rendering could not run because LibreOffice is not installed. The attempted renderer's missing dependency was diagnosed; no application dependency or environment configuration was changed. Temporary QA tools and samples were removed. No migration was needed or run.

Phase 2 backend/report files: backend/main.py, backend/scenarios.py, backend/water_documents.py, backend/water_treatment.py, reports/water_treatment_report.py and engineering/water_reference.json. Frontend changes: app/page.tsx, components/WaterDesignBasis.tsx, components/WaterProjectWorkflow.tsx, lib/projects.ts, lib/download.ts, and the calculation, presentation, input, adapter, types, declarations, persistence and API modules in this directory. Tests and fixtures: frontend/tests/water-treatment.test.mjs, frontend/tests/water-persistence.test.mjs, frontend/tests/water-test-support.mjs, frontend/tests/create-water-fixture.mjs, tests/test_water_treatment.py and tests/fixtures/water-scenario.json. Existing uncommitted Phase 1 changes are retained.

## Design Basis layout update

The workflow now uses a single sticky project/action header with Save, Duplicate, Compare and a shared Download menu. Inputs, Results, Design checks and Comparison use persistent panels; tab changes never unmount the editor. Native desktop tabs support arrow keys and Home/End; narrow screens use a View selector. The report menu supports arrow keys, Home/End, Escape, Tab and outside-click dismissal. It restores trigger focus when appropriate and exposes disabled-action reasons. Existing report helpers and endpoints are reused, including explicit comparison downloads after a valid comparison.

The existing scenario selector is retained and shown compactly with current/calculated/draft indicators. A separate sidebar was avoided to keep one scenario selection state and the existing guarded open action. Incompatible or incomplete saved scenarios are disabled in Comparison with an explanation. All ownership and compatibility enforcement is unchanged.

Essential project/flow inputs remain expanded. Concentration/load inputs, pasted data and reference/custom criteria use optional native disclosures. Calculate is available above inputs and in a bottom bar only while Inputs is active. The bottom bar remains in normal document flow with bottom clearance; no second report bar is added. Successful calculations select Results and focus its heading; failures select Inputs and focus the existing error. Navigation is instant, without animated scrolling. A ResizeObserver measures the combined sticky header for focus-scroll clearance rather than assuming a fixed toolbar height.

Result cards use only existing output values and the existing formatter. Full outputs remain under Results, with detailed notes collapsed. The Design checks panel retains friendly labels, screening/provisional notices and expandable sources, with counts derived from unchanged raw statuses near navigation. Calculation input mapping, engine code, persistence schemas, backend APIs, authentication and report generation are unchanged by this layout-only update.

Files changed in this layout pass: components/WaterDesignBasis.tsx, components/WaterProjectWorkflow.tsx, new components/WaterWorkflowControls.tsx, tests/water-treatment.test.mjs, tests/water-persistence.test.mjs, new tests/water-layout.test.mjs and this README. Validation: 249 frontend tests, 31 focused water tests, production build, TypeScript and focused ESLint pass. Existing page.tsx lint findings match HEAD (5 errors, 9 warnings). Original validation remains 18/18 cases and 80/80 values. Browser visual checks at desktop/tablet/mobile widths could not be performed because the available browser automation inventory contained no connected browser. The temporary local sample route was removed; no environment or deployment configuration changed.
