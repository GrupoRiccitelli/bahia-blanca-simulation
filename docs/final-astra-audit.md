# Final implementation audit — Astra

Date: 2026-10-06. Reviewed commit: `703e3126a395c726737d121efb4bfcea3d2b4cc9`.

Independent final audit of the implementation against `docs/full-app-astra-audit.md` and `docs/audit-fixes-implementation-plan.md`. Application code, tests, evidence, review decisions and Git history were not changed. Only this report was added.

## Verdict

Seven original findings are resolved for the supported supplied scenarios and tested UI flows. F6 is **partially resolved**: its original examples now agree, but additional independently reproduced inputs still disagree between the published schema, browser loader and offline validator. One new P3 export inconsistency remains when Luna Linda extends the illustrative horizon. No remaining P1 issue was reproduced.

The repaired frozen-source scene and all four bundled synthetic scenarios passed both the existing full-hull regression suite and an independent geometric probe. This supports those specific scenarios; it is not proof of continuous clearance or arbitrary imported layouts.

## Original findings

| Finding | Status | Evidence and limits |
| --- | --- | --- |
| F1 — simultaneous source movements intersect | Resolved for supplied scenarios | The visual plan serializes movements and retains `plannedStart` separately. C FORCE now moves at 3–3.75 h, BBG LIJIANG at 3.75–4.5 h, NORSE ADVANCE at 2–2.5 h and AGIOS LAZAROS at 2.5–3 h. Published tug timestamps are unchanged. The frozen scenario with Luna passed independent sampling. |
| F2 — synthetic routes cross waiting ships | Resolved for all four bundled scenarios | Shared holding columns are separated from the transit corridor. Both the repository full-hull test and independent sampling passed normal, delay, tug-outage and berth-closure scenarios. |
| F3 — hulls cross quay / berth heading snaps | Resolved for supplied scenarios | Shared maneuver segments rotate offshore, then translate laterally while parallel to the quay. Existing tests cover full hulls and continuity across segment and berth boundaries. Independent interior-footprint tests found no quay intersection. This is schematic motion, not a calibrated maneuver model. |
| F4 — provenance disclosure replaced each frame | Resolved | Source details are cached by bundle and selection; movement text updates in place. Production-handler DOM tests preserve the disclosure node, open state, focus and scroll through playback, seeks and overlay toggles. |
| F5 — stale load overrides latest choice | Resolved | A shared request generation and abort controller cover file/fetch loads and initial Luna loading. Production-handler tests cover superseded success/failure, two overlapping imports, and return to synthetic mode. |
| F6 — schema/loader contract disagreement | **Partial** | Original unknown/null/dimension/evidence/required-array cases are corrected. Full external schema fixtures pass. Additional contract divergences remain; see N1. |
| F7 — unknown location labeled anchorage | Resolved | Shared state mapping labels an unknown observation explicitly. Production-handler test also checks that imported strings remain text and the scene pose remains absent. |
| F8 — Luna cannot finish in short scenarios | Resolved in viewer | A half-hour source scenario extends visual playback to 1.75 h; Luna completes, removal clamps time/slider back to 0.5 h, and original coverage stays unchanged. Export does not yet use that extended horizon; see N2. |

## Remaining actionable findings

### N1 — P2: contract parity is still incomplete

Locations: [bundle_contract.py:106](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/scripts/bundle_contract.py:106), [bundle_contract.py:111](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/scripts/bundle_contract.py:111), [source-data.js:14](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/source-data.js:14). Related hash checks also appear at source-data.js lines 12 and 23.

Apply each of these changes separately to `tests/fixtures/source-bundle.json`, serialize it as JSON, and validate the same JSON with all three validators:

| Modification | Full JSON Schema, format checking enabled | Browser `validateBundle` | Python `validate_bundle_contract` |
| --- | --- | --- | --- |
| `assertions[0].page = 1.0` (retain `.0` in JSON) | Accepts | Accepts | Rejects: `Invalid row provenance` |
| `inventory[0].disposition = "excluded-with-reason"`, `reason = " "`, `exclusion_reason = "Valid reason"` | Accepts | Accepts | Rejects: `Excluded row requires a reason` |
| `bundle_hash = ["a" repeated 64 times]` | Rejects | Accepts | Rejects: `Invalid hash bundle_hash` |

The Python provenance check requires the native `int` type, although JSON Schema's integer semantics and JavaScript accept integral numeric values such as `1.0`. The exclusion check applies `or` before validating text, so a truthy whitespace primary reason suppresses a valid alternate reason. The JavaScript hash regex coerces arrays into strings instead of enforcing the schema's string type.

**Impact:** Valid schema-conforming evidence can still fail offline validation, while the UI can label a malformed hash field structurally valid. These are local shape/value disagreements, not the documented procedural cross-reference/coverage checks. The current frozen bundle is unaffected. This does not imply cryptographic authentication was promised.

**Fix:** Align Python integer validation with the JSON contract while excluding booleans; validate each possible exclusion reason independently; require JavaScript hashes to be strings before regex validation. Add these cases to the shared fixtures and run the external schema test as well as the browser/Python test.

### N2 — P3: export truncates the newly extended Luna playback time

Locations: [app.js:64](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/app.js:64), [source-motion.js:60](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/source-motion.js:60). The extended view is produced at [luna-linda.js:20](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/luna-linda.js:20).

**Reproduce:** Clone the valid contract fixture, remove intentions, set coverage end to 30 minutes after its start, import it, enable Luna Linda and seek to 1.75 h. The viewer reports time/bounds end `1.75` and Luna is `illustrative-alongside`. Exporting uses `sourceMotionExport(bundle, 1.75)`, then attaches the optional vessel metadata. The resulting JSON contains:

```json
{
  "illustrativeOverlay": {
    "time": 0.5,
    "bounds": {"start": 0, "end": 0.5}
  },
  "hypotheticalAdditionalVessels": [{
    "illustrativeSchedule": {"start": 1, "end": 1.75}
  }]
}
```

Unrelated fields are omitted above. The same construction was reproduced directly through the production functions used by the export handler; actual browser file saving was not tested.

**Impact:** Exported illustrative playback metadata no longer describes the displayed instant and has a horizon ending before its included hypothetical schedule. Original source coverage/evidence remains correct. The documented lack of session reimport is a separate limitation and does not account for this incorrect exported time.

**Fix:** Build export metadata from the effective displayed illustrative bounds/time, or represent base-source and combined-view times/bounds explicitly. Keep `bundle.coverage` unchanged. Add a short-coverage export regression with Luna enabled and disabled.

## Verification performed

- Read the final diff, prior audit and implementation plan, changed application modules, renderer and scheduler, validation schema/loader/pipeline, new tests and current documentation.
- `npm test`: all six JavaScript test files passed, including application-state, full-hull geometry, engine, source-contract, source-motion and view-state tests.
- `npm run test:data`: six Python tests ran; five passed, one explicitly skipped because the default interpreter lacks optional `jsonschema`. Frozen-report normalization and deterministic assembly integration ran and passed using the retained private local reports.
- Executed `test_source_contract.py` with `/home/santiago/.local/share/mise/installs/pipx-hermes-agent/0.19.0/hermes-agent/bin/python`, which has `jsonschema`: both tests passed, including full Draft 2020-12 schema validation with format checking. This validates the existing fixture set, not complete equivalence; N1 uses additional cases.
- An attempted full Python suite under that alternate interpreter stopped the frozen integration at `Review normalization mismatch`. The normalized content includes the Python version and the review pins its digest, so this is the expected environment gate, not a new application regression. The supported default interpreter passed the same integration. No review hashes or gates were modified.
- Independent geometry probe used its own Three.js-convention transforms and separating-axis intersection function, rather than the production collision helpers. It sampled rectangles strictly inside rendered hulls against every other nearby vessel and the renderer's quay rectangle at 0.00073 h intervals with a 0.00037 h phase offset. Results: 8,562 source-plus-Luna frames and 65,753 frames in each of four synthetic scenarios passed (271,574 total frames). Source JSON remained byte-for-byte unchanged after views and plans were generated. These interior rectangles can confirm intersections when present; their absence alone does not prove complete hull clearance. The separate repository tests check the complete sampled hull footprint.
- Independently compared schema, browser and Python behavior for the three N1 payloads, and reconstructed the short-horizon N2 export from production functions.

## Retained boundaries and unverified behavior

- Persisted `pagehide` now preserves the renderer, and `pageshow` resets the frame clock; the production-handler lifecycle test passes. Actual BFCache eligibility/restoration remains unverified in a browser.
- No new browser automation was performed in this independent audit. The earlier integration report records browser checks of source loading, seek/play/pause, open provenance, visual-delay disclosure and Luna. Those are prior evidence, not fresh browser observations from this audit.
- Actual download saving, GPU/context restoration, screen-reader behavior and mobile layout remain unverified.
- Clearance claims concern the supplied frozen and synthetic layouts. Arbitrary imported dimensions, multiple ships mapped to the same berth, and new traffic configurations require their own geometry checks. No navigation-safety claim is justified.
- Imported hashes remain structural metadata; no content digest/publisher authentication or row-to-assertion semantic reconciliation was added. Offline retained-source integrity/review gates still apply.
- Evidence exports remain wrappers whose `.bundle` can be imported separately; they do not restore playback settings as a session. This is now documented.
- Source motion plans are cached per bundle, and source detail DOM is stable. Large-dataset performance was not benchmarked.

## Recommended disposition

The supplied-scenario geometry and original UI regressions are repaired. Complete N1 before claiming full schema/browser/offline parity. Correct N2 so the new short-horizon behavior remains coherent in exported metadata. Keep the browser lifecycle/download and imported-layout limits explicit.
