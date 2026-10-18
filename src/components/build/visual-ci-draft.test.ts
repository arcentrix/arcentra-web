import { describe, expect, it } from "vitest";
import {
  editDraft,
  identityBlockReason,
  parseDefinition,
  parseGraph,
  sourceFormat,
  type DraftEdit,
} from "./visual-ci-draft";
const step = (name = "compile") => ({
  name,
  uses: "shell",
  action: "run",
  args: { run: "echo original" },
  runOnAgent: true,
});
const fixture = () => ({
  namespace: "visual-ci",
  version: "1.0.0",
  jobs: [
    { name: "build", steps: [step()] },
    { name: "test", dependsOn: ["build"], steps: [step("check")] },
  ],
});
const text = (spec: unknown = fixture()) => JSON.stringify(spec, null, 2);
const apply = (edit: DraftEdit, spec: unknown = fixture()) =>
  JSON.parse(editDraft(text(spec), edit));

describe("retained visual CI draft", () => {
  it("preserves every advanced or unknown field when only a shell command is edited", () => {
    const spec = {
      ...fixture(),
      variables: { KEEP: "value" },
      runtime: { type: "local", env: { R: "v" } },
      meta: { extension: [true, 12.5, null, { nested: "value" }] },
      triggers: [{ type: "event", options: { branch: "main" } }],
      future: { opaque: true },
      jobs: [
        {
          ...fixture().jobs[0],
          retry: { mode: "failed_step", maxAttempts: 3 },
          approval: { required: true, plugin: "future-plugin" },
          source: {
            type: "git",
            repo: "https://example.test/repo",
            auth: { token: "${TOKEN_REF}" },
          },
          timeout: "5m",
          when: "${RUN}",
          env: { KEY: "preserved" },
          steps: [
            {
              ...step(),
              continueOnError: false,
              agentSelector: { matchLabels: { os: "linux" } },
              unknown: { preserve: "yes" },
              args: { run: "echo original", extra: { deeply: [1, 2] } },
            },
          ],
        },
      ],
    };
    const expected = structuredClone(spec);
    expected.jobs[0].steps[0].args.run = "echo changed";
    expect(
      apply(
        {
          type: "command",
          job: "build",
          step: "compile",
          value: "echo changed",
        },
        spec,
      ),
    ).toEqual(expected);
    expect(spec.jobs[0].steps[0].args.run).toBe("echo original");
    expect(identityBlockReason(parseGraph(text(spec)))).not.toBe("");
  });
  it("adds a real shell job and step without inventing serialized IDs", () => {
    const added = apply({ type: "add-job", name: "package" });
    expect(added.jobs[2]).toEqual({
      name: "package",
      dependsOn: [],
      steps: [{ ...step("step-1"), args: { run: "echo ready" } }],
    });
  });
  it("renames job identities and every known dependency atomically", () => {
    const renamed = apply({
      type: "rename-job",
      job: "build",
      name: "compile",
    });
    expect(renamed.jobs[0].name).toBe("compile");
    expect(renamed.jobs[1].dependsOn).toEqual(["compile"]);
    expect(
      apply({
        type: "rename-step",
        job: "build",
        step: "compile",
        name: "prepare",
      }).jobs[0].steps[0].name,
    ).toBe("prepare");
  });
  it("copies complete safe objects and reorders steps, preserving their content", () => {
    const copy = apply({ type: "copy-job", job: "build", name: "copy" });
    expect(copy.jobs[2]).toEqual({ ...fixture().jobs[0], name: "copy" });
    const copied = apply({
      type: "copy-step",
      job: "build",
      step: "compile",
      name: "copy",
    });
    expect(copied.jobs[0].steps[1]).toEqual({ ...step(), name: "copy" });
    const moved = apply(
      { type: "move-step", job: "build", step: "copy", direction: -1 },
      copied,
    );
    expect(moved.jobs[0].steps.map((s: { name: string }) => s.name)).toEqual([
      "copy",
      "compile",
    ]);
    expect(
      apply({ type: "delete-step", job: "build", step: "copy" }, moved),
    ).toEqual(fixture());
  });
  it("blocks deletion of referenced/last jobs and last steps rather than dropping references", () => {
    expect(() => apply({ type: "delete-job", job: "build" })).toThrow(
      /Disconnect/,
    );
    const removed = apply({ type: "delete-job", job: "test" });
    expect(() => apply({ type: "delete-job", job: "build" }, removed)).toThrow(
      /at least one job/,
    );
    expect(() =>
      apply({ type: "delete-step", job: "build", step: "compile" }),
    ).toThrow(/at least one step/);
  });
  it.each([
    { type: "dependency", job: "build", dependency: "test", enabled: true },
    { type: "dependency", job: "build", dependency: "build", enabled: true },
    { type: "dependency", job: "build", dependency: "missing", enabled: true },
    { type: "dependency", job: "test", dependency: "build", enabled: true },
    { type: "rename-job", job: "build", name: "test" },
    { type: "add-job", name: "bad name" },
    { type: "rename-step", job: "build", step: "missing", name: "new" },
  ] as DraftEdit[])("refuses invalid atomic operation $type", (operation) => {
    const original = text();
    expect(() => editDraft(original, operation)).toThrow();
    expect(original).toBe(text());
  });
  it("preserves offline linear chain independent of declared order", () => {
    const spec = { ...fixture(), runtime: { type: "containerd-offline-v1" } };
    spec.jobs.reverse();
    expect(
      apply({ type: "add-job", name: "package" }, spec).jobs[2].dependsOn,
    ).toEqual(["test"]);
    expect(
      apply({ type: "copy-job", job: "build", name: "copy" }, spec).jobs[2]
        .dependsOn,
    ).toEqual(["test"]);
    expect(() =>
      apply(
        {
          type: "dependency",
          job: "test",
          dependency: "build",
          enabled: false,
        },
        spec,
      ),
    ).toThrow(/linear chain/);
  });
  it.each(["approval", "source", "retry", "future"])(
    "blocks identity changes with opaque job %s",
    (key) => {
      const spec = fixture();
      Object.assign(spec.jobs[0], { [key]: { value: "reference" } });
      for (const operation of [
        { type: "rename-job", job: "build", name: "new" },
        { type: "copy-job", job: "build", name: "copy" },
        { type: "delete-job", job: "test" },
        { type: "rename-step", job: "build", step: "compile", name: "new" },
        { type: "move-step", job: "build", step: "compile", direction: 1 },
      ] as DraftEdit[])
        expect(() => apply(operation, spec)).toThrow(/blocked/);
    },
  );
  it("keeps plugin arguments and expressions in raw mode without conversion", () => {
    const spec = fixture();
    spec.jobs[0].steps[0].uses = "custom@1.0.0";
    expect(() =>
      apply(
        {
          type: "command",
          job: "build",
          step: "compile",
          value: "echo replacement",
        },
        spec,
      ),
    ).toThrow(/JSON mode/);
    expect(() =>
      apply({ type: "rename-job", job: "build", name: "new" }, spec),
    ).toThrow(/blocked/);
    spec.jobs[0].steps[0] = {
      ...step(),
      args: { run: "echo ${jobs.build.output}" },
    };
    expect(identityBlockReason(parseGraph(text(spec)))).toMatch(/expressions/);
  });
  it.each([
    '{"jobs":',
    '{"jobs":null}',
    '{"jobs":[null]}',
    '{"jobs":[{"name":"a","steps":[null]}]}',
    '{"jobs":[{"name":"a","steps":[{"name":"x","uses":"shell","run_on_agent":true}]}]}',
    '{"jobs":[{"name":"a","depends_on":[],"steps":[]}]}',
  ])(
    "blocks malformed and alternate shapes without normalization",
    (source) => {
      expect(() => parseGraph(source)).toThrow();
    },
  );
  it("rejects duplicate JSON keys and unsafe numbers before losing data", () => {
    for (const source of [
      '{"a":1,"a":2}',
      '{"nested":{"x":0,"x":1}}',
      '{"a":9007199254740993}',
      '{"a":1e999}',
    ])
      expect(() => parseDefinition(source)).toThrow();
    expect(
      parseDefinition(
        '{"escaped\\\"key":"a\\\\b", "array":[{},[],1.5,null,true],"braces":"{}[]"}',
      ),
    ).toMatchObject({ array: [{}, [], 1.5, null, true] });
  });
  it("blocks shell/environment identity references instead of blindly rewriting command strings", () => {
    for (const run of [
      "echo $JOB_NAME",
      "query-job build",
      "cat jobs/build/result",
    ]) {
      const source = fixture();
      source.jobs[0].steps[0].args.run = run;
      expect(() =>
        apply({ type: "rename-job", job: "build", name: "renamed" }, source),
      ).toThrow(/blocked/);
      expect(source.jobs[0].steps[0].args.run).toBe(run);
    }
  });

  it("blocks identity changes through unknown nested resources and malformed scalar/map shapes", () => {
    const source = fixture();
    const malformed = [
      { ...source, runtime: { type: "local", resources: { opaque: "build" } } },
      { ...source, variables: { opaque: { job: "build" } } },
      {
        ...source,
        jobs: [{ ...source.jobs[0], description: { reference: "build" } }],
      },
    ];
    for (const authored of malformed) {
      expect(() =>
        apply({ type: "rename-job", job: "build", name: "changed" }, authored),
      ).toThrow(/unsupported shape/);
    }
  });

  it("maps only supported returned formats, never guessing from a filename", () => {
    for (const value of ["json", "SPEC_FORMAT_JSON"])
      expect(sourceFormat(value)).toBe("json");
    for (const value of ["yaml", "yml", "SPEC_FORMAT_YAML"])
      expect(sourceFormat(value)).toBe("yaml");
    expect(() => sourceFormat("SPEC_FORMAT_UNSPECIFIED")).toThrow(/unknown/);
  });
});
