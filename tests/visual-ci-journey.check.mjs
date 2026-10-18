import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  semanticDefinition,
  visualCIConfig,
  visualCIEvidence,
  visualCISteps,
  visualCIStages,
} from "./visual-ci-journey.mjs";
const config = () => ({
  projectId: "visual-project",
  repoUrl: "git://127.0.0.1:19418/visual.git",
  branch: "main",
  pipelineFilePath: "pipeline.json",
  expectedHeadCommitSha: "a".repeat(40),
  marker: "VISUAL_ACCEPTANCE",
  expectedSpec: {
    namespace: "visual-editor-acceptance",
    variables: { PRESERVED_VISUAL_VALUE: "retained" },
    jobs: [
      {
        name: "visual-build",
        description: "Original job",
        steps: [
          {
            name: "original-step",
            uses: "shell",
            action: "run",
            runOnAgent: true,
            args: { run: "printf 'VISUAL_ORIGINAL_STEP\\n'" },
          },
        ],
      },
    ],
  },
});
test("visual acceptance configuration binds the exact disposable repo, branch, file and fixture identities", () => {
  assert.deepEqual(visualCIConfig(config()), config());
  assert.equal(
    visualCIConfig({ ...config(), repoUrl: "git://git:9418/visual.git" })
      .repoUrl,
    "git://git:9418/visual.git",
  );
  for (const patch of [
    { repoUrl: "https://example.com/visual.git" },
    { repoUrl: "git://127.0.0.1:9999/visual.git" },
    { repoUrl: "git://other:9418/visual.git" },
    { repoUrl: "git://127.0.0.1:19418/other.git" },
    { repoUrl: "git://user:password@127.0.0.1:19418/visual.git" },
    { branch: "other" },
    { pipelineFilePath: "other.json" },
    { marker: "unsafe';command" },
    { expectedHeadCommitSha: "short" },
    { projectId: "../../other" },
  ])
    assert.throws(() => visualCIConfig({ ...config(), ...patch }));
});
test("visual summary exposes only bounded identifiers and exact verified steps", () => {
  const input = {
    steps: [...visualCISteps],
    projectId: "project",
    pipelineId: "pipeline",
    runId: "run",
    baseDefinitionCommit: "a".repeat(40),
    savedDefinitionCommit: "b".repeat(40),
    secret: "CANARY",
  };
  const summary = visualCIEvidence(input).visualCI;
  assert.equal(summary.completed, true);
  assert.equal("secret" in summary, false);
  assert.equal(visualCIEvidence({ steps: [] }).visualCI.completed, false);
  assert.throws(() =>
    visualCIEvidence({ ...input, steps: [...visualCISteps, "fabricated"] }),
  );
  assert.throws(() =>
    visualCIEvidence({ ...input, steps: [...visualCISteps, visualCISteps[0]] }),
  );
  assert.throws(() =>
    visualCIEvidence({
      ...input,
      savedDefinitionCommit: input.baseDefinitionCommit,
    }),
  );
  assert.throws(() => visualCIEvidence({ steps: [...visualCISteps] }));
});
test("semantic comparison removes only protobuf defaults and retains arbitrary Struct values", () => {
  const initial = config().expectedSpec;
  const wire = structuredClone(initial);
  Object.assign(wire, { version: "", runtime: null, meta: null, triggers: [] });
  Object.assign(wire.jobs[0], {
    env: {},
    dependsOn: [],
    retry: null,
    when: "",
  });
  Object.assign(wire.jobs[0].steps[0], {
    timeout: "",
    env: {},
    continueOnError: false,
    agentSelector: null,
  });
  assert.deepEqual(semanticDefinition(wire), semanticDefinition(initial));
  wire.jobs[0].steps[0].args.extra = {
    flag: false,
    zero: 0,
    empty: "",
    nothing: null,
    array: [],
    object: {},
  };
  assert.deepEqual(
    semanticDefinition(wire).jobs[0].steps[0].args.extra,
    wire.jobs[0].steps[0].args.extra,
  );
  wire.jobs[0].steps[0].args.run = "changed";
  assert.notDeepEqual(semanticDefinition(wire), semanticDefinition(initial));
});
test("all declared visual stages match the emitted stages, without fixture transport shortcuts", async () => {
  const source = await readFile(
    new URL("./visual-ci-journey.mjs", import.meta.url),
    "utf8",
  );
  assert.deepEqual(
    [...source.matchAll(/setStage\("([^\"]+)"\)/g)].map((match) => match[1]),
    [...visualCIStages],
  );
  assert.doesNotMatch(
    source,
    /route\.fulfill|addInitScript|localStorage\.setItem|page\.request/,
  );
});
