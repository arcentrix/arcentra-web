# Visual CI orchestration

Open **Definition** from Build or a project's Pipelines page. **Graph** and **JSON** edit the same retained JSON draft. This is a static definition diagram; it displays no invented execution status. JSON remains the initial mode for compatibility with existing editing workflows.

## Supported graph operations

- Select jobs in the dependency diagram or named keyboard-accessible buttons.
- Add shell jobs and ordered shell steps, edit job descriptions and `args.run`, and connect/disconnect job dependencies.
- Rename/copy/delete jobs and steps and reorder steps only when the whole document is provably within the reference-free subset. Job rename updates every `dependsOn` reference atomically. Delete refuses dependent jobs, the last job and the last step. Copy requires a distinct explicit identity.
- Job names are pipeline-unique; step names are unique inside their job. Names are the real DSL identities, not generated IDs. Diagram coordinates never enter the repository.
- The editor rejects missing references, duplicate edges and cycles. For `containerd-offline-v1`, it enforces one explicit linear chain and appends new/copied jobs to the tail; it never interprets declaration order as dependency order.

All operations start from a fresh parse and patch only selected fields. Unknown/advanced values remain untouched. Plugin steps, source/auth references, approvals, retry, triggers, arbitrary extension data or expressions/command data mentioning existing identities can make identity operations unsafe; those operations are then visibly blocked and the author must review JSON explicitly. Other narrow edits can remain available without removing those fields. Unsupported field spellings/shapes, duplicate JSON keys and unsafe integer values block graph projection rather than silently normalize them. Invalid JSON stays byte-for-byte in the text draft when switching modes.

Server validation is still authoritative for runtime policy, plugins, artifact/deployment references, approval semantics and execution capability. Graph validation does not authorize a run. Nonempty named concurrency is unsupported; the editor warns instead of dropping it. Existing retry editing remains available in JSON mode. Its projection and Apply/Off mutations share the same lossless parser; ambiguous keys or unsafe numbers disable retry editing and retain the raw draft until it is repaired explicitly.

## Repository write and permission behavior

**Validate** makes only a validation request. **Save to repository** validates again, then submits the same spec, current `expectedHeadCommitSha`, draft-bound `requestId`, and the loaded JSON/YAML format. It never triggers a run, votes on approval, cancels execution or changes project access. Request locks prevent duplicate saves. Unmount/account/pipeline changes discard the previous local editor state; a late validation cannot start a save in another context. Read-only access cannot mutate or validate.

A successful save retains and locks the reviewed draft. **Reload definition** asks before discarding it, and replaces it only after a successful, minimally valid read (object spec, complete commit SHA, supported format, branch and file path). A malformed HTTP-success payload preserves the previous draft and disables saving. Saved commit SHAs must also be complete 40/64-hex values. PR-mode success uses the server save mode even when an idempotent response omits the PR URL; missing/PR save modes never claim that the default branch was updated. A 409 retains the draft and disables another save until explicit reload/review. A failed reload preserves the draft; access-denied responses hide the previous private snapshot. API errors use scoped redaction, including client diagnostic logging.

The API returns parsed protobuf DSL, not original source bytes. JSON/YAML encoding is preserved on save, but comments, anchors, formatting and spelling can be normalized. Exact source-preserving YAML editing needs a separate backend raw-source/AST contract. Definitions the backend cannot parse/validate, including unsupported source/include structures, cannot be repaired through this GET endpoint. No compatibility claim is made for the legacy `stages` editor.

## Tests and actual acceptance integration

- `src/components/build/visual-ci-draft.test.ts`: semantic preservation, all structural edits, identity/reference guards, cycles/dangling edges, linear container chains, unsafe/ambiguous JSON and format mapping.
- `src/components/build/visual-ci-editor.test.tsx`: Graph/JSON roundtrip, explicit CAS saves, 403/409, malformed/failed reload, malformed save evidence, PR idempotent retry, read-only, stale permissions/account/pipeline changes and keyboard controls. jsdom does not establish mobile geometry.
- `src/components/build/retry-policy-{editor,draft}.test.tsx`: duplicate/escaped keys and unsafe numbers cannot be washed away through retry Apply/Off; repairing raw JSON restores editing.
- `tests/visual-ci-journey.check.mjs`: fixed configuration/summary contracts and protobuf-default semantic comparison. Run with `node --test tests/visual-ci-journey.check.mjs`.
- `tests/visual-ci-journey.mjs`: dedicated real-browser journey invoked by the actual-backend harness when `ARCENTRA_ACCEPTANCE_VISUAL_CI` supplies its bounded JSON configuration in the genuine build phase. No simulated transport, session injection or direct browser API mutations.

The runner must supply `config.visualCI` with `projectId`, `repoUrl`, `branch`, `pipelineFilePath`, `expectedHeadCommitSha`, `expectedSpec`, and a bounded uppercase `marker`. Only `git://127.0.0.1:19418/visual.git` and `git://git:9418/visual.git`, branch `main`, file `pipeline.json` are accepted. The disposable initial definition is `visual-editor-acceptance`, with one `visual-build` job and one `original-step`, no source checkout, and preserved variables/description. This repository is separate from the immutable Go build-source fixture.

Pass `page`, `base`, `output`, `diagnostics`, `responseFor`, `envelope`, `setStage`, and `evidence: {steps: []}` to `runVisualCIJourney`. The shared harness allowlists every exported `visualCIStages` entry and this helper filename, then serializes only `visualCIEvidence(evidence)`. `pnpm test:browser:harness` runs the dedicated check file. The backend runner must bind execution evidence to the returned identifiers and definition commits. The existing six-step Secrets journey and strict persisted-log marker assertions remain enabled when their fixtures are configured.

The journey creates a pipeline through UI, edits the original command, adds a step and a second dependent job, rejects a cycle, and checks graph controls at 320/390/1440 pixels. It validates, saves the exact draft, reloads the complete semantic DSL, then separately opens run review and explicitly starts the saved definition. It requires two persisted successful Agent jobs, all three expected log markers and unknown source-checkout provenance. Definition and source SHAs are never conflated. The fixed public summary contains only bounded IDs, full definition commits and verified step names, not commands, repository data, credentials or raw failures.

Browser acceptance remains unproven until that actual journey completes against real Git/Control/Agent services. Local component tests and a script's existence are not equivalent evidence.
