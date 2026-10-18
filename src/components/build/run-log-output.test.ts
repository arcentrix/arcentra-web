import { describe, expect, it } from "vitest";
import { normalizeJob } from "@/api/pipeline";
import type { RunLog, RunLogs } from "@/api/pipeline/types";
import {
  formatRunLogOutput,
  MAX_LOG_CHUNKS,
  MAX_LOG_TEXT,
} from "./run-log-output";

const chunk = (
  lineNumber: number,
  message: string,
  extra: Partial<RunLog> = {},
): RunLog => ({
  jobId: "job",
  stepId: "step",
  stream: "stdout",
  lineNumber,
  timestamp: 123,
  level: "info",
  message,
  ...extra,
});
const knownJobs = [
  normalizeJob({
    jobRunId: "job",
    jobName: "Build",
    steps: [{ stepRunId: "step", name: "Test" }],
  }),
];
const output = (entries: RunLog[]) =>
  formatRunLogOutput({ entries }, knownJobs).text;

describe("run log output reconstruction", () => {
  it("orders step-global positions rather than timestamp/response order and restores fragmented markers", () => {
    const text = output([
      chunk(3, "IED\n", { timestamp: 1 }),
      chunk(1, "SECRET_", { timestamp: 300 }),
      chunk(2, "VERIF", { timestamp: 200 }),
    ]);
    expect(text).toContain("SECRET_VERIFIED\n");
    expect(text).not.toContain("INFO");
    expect(text).toContain("contiguous reported step range 1–3");
  });

  it("reconstructs streams separately when the whole interleaved step sequence is present", () => {
    const text = output([
      chunk(1, "ACTUAL_PROJECT_"),
      chunk(2, "warning_", { stream: "stderr" }),
      chunk(3, "BUILD go build\n"),
      chunk(4, "complete\n", { stream: "stderr" }),
    ]);
    expect(text).toContain("ACTUAL_PROJECT_BUILD go build\n");
    expect(text).toContain("warning_complete\n");
    expect(text).toContain('Stream "stdout"');
    expect(text).toContain('Stream "stderr"');
    expect(text).toContain("do not imply cross-stream timing");
  });

  it("never joins across stream, job or step identities", () => {
    for (const extra of [
      { stream: "stderr" },
      { jobId: "another-job" },
      { stepId: "another-step" },
    ]) {
      expect(
        output([chunk(1, "PREFIX_"), chunk(2, "SUFFIX", extra)]),
      ).not.toContain("PREFIX_SUFFIX");
    }
  });

  it("breaks every stream at a step-global gap, including an absent interleaved position", () => {
    const text = output([chunk(1, "PREFIX_"), chunk(3, "SUFFIX")]);
    expect(text).not.toContain("PREFIX_SUFFIX");
    expect(text).toContain("Gap: chunks 2–2 are absent from this page");
  });

  it("retains identical duplicate records without claiming replay identity or joining adjacent output", () => {
    const text = output([
      chunk(1, "PREFIX_"),
      chunk(2, "MIDDLE"),
      chunk(2, "MIDDLE"),
      chunk(3, "_SUFFIX"),
    ]);
    expect(text.match(/MIDDLE/g)).toHaveLength(2);
    expect(text).toContain("replay identity is unverified");
    expect(text).not.toContain("PREFIX_MIDDLE");
    expect(text).not.toContain("MIDDLE_SUFFIX");
  });

  it("retains conflicting variants and breaks all streams around them", () => {
    const text = output([
      chunk(1, "PREFIX_"),
      chunk(2, "left"),
      chunk(2, "right", { stream: "stderr" }),
      chunk(3, "SUFFIX"),
    ]);
    expect(text).toContain("conflicting position(s)");
    expect(text).toContain("left");
    expect(text).toContain("right");
    expect(text).not.toContain("PREFIX_SUFFIX");
    expect(text).not.toContain("PREFIX_left");
  });

  it("retains distinguishing timestamp and level metadata outside conflicting payloads", () => {
    const text = output([
      chunk(1, "same", { timestamp: 100, level: "info" }),
      chunk(1, "same", { timestamp: 200, level: "warn" }),
    ]);
    expect(text).toContain('timestamp 100; level "info"');
    expect(text).toContain('timestamp 200; level "warn"');
    expect(text.match(/\nsame/g)).toHaveLength(2);
  });

  it("does not skip unseen duplicate/conflicting boundary variants when paging", () => {
    for (const message of ["same", "different"]) {
      const result = formatRunLogOutput(
        {
          entries: [chunk(1, "start"), chunk(2, "same"), chunk(2, message)],
          truncated: true,
        },
        [],
        { stepId: "step" },
      );
      expect(result.nextLine).toBeUndefined();
      expect(result.text).toContain("safe continuation position is unknown");
      expect(result.text).not.toContain("Use Next output to continue");
    }
    const legacy = formatRunLogOutput(
      {
        entries: [
          chunk(1, "one", { jobId: undefined }),
          chunk(1, "two", { jobId: undefined }),
        ],
        truncated: true,
      },
      knownJobs,
      { stepId: "step" },
    );
    expect(legacy.nextLine).toBeUndefined();
  });

  it.each(["jobId", "stepId", "stream", "lineNumber"] as const)(
    "keeps chunks without %s explicitly unverified and separate",
    (field) => {
      const text = output([
        chunk(1, "PREFIX_", { [field]: undefined }),
        chunk(2, "SUFFIX", { [field]: undefined }),
      ]);
      expect(text).toContain("Unverified legacy");
      expect(text).not.toContain("PREFIX_SUFFIX");
    },
  );

  it("keeps known positions with an unknown stream as a reconstruction barrier", () => {
    const text = output([
      chunk(1, "PREFIX_"),
      chunk(2, "unknown", { stream: undefined }),
      chunk(3, "SUFFIX"),
    ]);
    expect(text).not.toContain("PREFIX_SUFFIX");
    expect(text).toContain("stream unknown");
  });

  it.each(["console", "STDOUT", " ", undefined])(
    "does not reconstruct an unknown stream %s",
    (stream) => {
      const text = output([
        chunk(1, "PREFIX_", { stream }),
        chunk(2, "SUFFIX", { stream }),
      ]);
      expect(text).not.toContain("PREFIX_SUFFIX");
      expect(text).toContain("Unverified legacy, unknown inventory/stream");
    },
  );

  it.each([undefined, [], [normalizeJob({ jobRunId: "job", steps: [] })]])(
    "does not reconstruct output without a matching job/step inventory",
    (jobs) => {
      const result = formatRunLogOutput(
        { entries: [chunk(1, "PREFIX_"), chunk(2, "SUFFIX")] },
        jobs,
      );
      expect(result.text).not.toContain("PREFIX_SUFFIX");
      expect(result.text).toContain(
        "inventory is unavailable or does not match",
      );
      expect(result.text).not.toContain("contiguous reported step range");
    },
  );

  it.each([
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER,
    "1",
  ])("does not coerce or accept invalid position %s", (lineNumber) => {
    const result = formatRunLogOutput(
      {
        entries: [{ ...chunk(1, "raw"), lineNumber } as RunLog],
        truncated: true,
      },
      [],
      { stepId: "step" },
    );
    expect(result.text).toContain("position unknown");
    expect(result.nextLine).toBeUndefined();
    expect(result.text).toContain("Next output is unavailable");
  });

  it("labels unknown job/step metadata honestly and does not use a selected step as a missing identity", () => {
    const result = formatRunLogOutput(
      {
        entries: [chunk(1, "hello"), chunk(2, "world", { stepId: undefined })],
      },
      [],
      { stepId: "step" },
    );
    expect(result.text).toContain('Job unknown ("job"); step unknown ("step")');
    expect(result.text).toContain("step unknown; stream");
    expect(result.text).not.toContain("helloworld");
  });

  it("labels partial and subsequent pages without claiming the missing prefix is known", () => {
    const result = formatRunLogOutput(
      { entries: [chunk(8, "SUFFIX"), chunk(7, "PREFIX_")], truncated: true },
      knownJobs,
      { stepId: "step", fromLine: 7 },
    );
    expect(result.text).toContain("Partial page starting at chunk 7");
    expect(result.text).toContain("no fragments are joined across pages");
    expect(result.text).toContain("PREFIX_SUFFIX");
    expect(result.text).not.toContain("Gap: chunks 1–6");
    expect(result.nextLine).toBe(9);
    expect(
      formatRunLogOutput({ entries: [chunk(9, "next")] }, [], {
        stepId: "step",
        fromLine: 9,
      }).text,
    ).not.toContain("PREFIX_");
  });

  it("does not page past unexpected step identities", () => {
    const result = formatRunLogOutput(
      { entries: [chunk(1, "raw")], truncated: true },
      [],
      { stepId: "different-step" },
    );
    expect(result.text).toContain("Unexpected step");
    expect(result.nextLine).toBeUndefined();
  });

  it("preserves raw whitespace, HTML-like text, CRLF, Unicode and a missing trailing newline", () => {
    const raw = "  <script>literal</script>\r\n\t🙂 tail  ";
    expect(
      output([chunk(1, raw.slice(0, 20)), chunk(2, raw.slice(20))]),
    ).toContain(raw);
    expect(output([chunk(1, "without newline")])).toMatch(/without newline$/);
  });

  it("bounds oversized pages and text with explicit incompleteness and no unsafe cursor", () => {
    const rows = formatRunLogOutput(
      {
        entries: Array.from({ length: MAX_LOG_CHUNKS + 1 }, (_, i) =>
          chunk(i + 1, `row-${i};`),
        ),
        truncated: true,
      },
      [],
      { stepId: "step" },
    );
    expect(rows.text).toContain("Display limit reached");
    expect(rows.text).not.toContain(`row-${MAX_LOG_CHUNKS};`);
    expect(rows.nextLine).toBeUndefined();
    const text = formatRunLogOutput(
      {
        entries: [chunk(1, "a".repeat(MAX_LOG_TEXT) + "EXCESS")],
        truncated: true,
      },
      [],
      { stepId: "step" },
    );
    expect(text.text).toContain("Display limit reached");
    expect(text.text).not.toContain("EXCESS");
    expect(text.text.length).toBeLessThan(MAX_LOG_TEXT + 2000);
    expect(text.nextLine).toBeUndefined();
  });

  it("handles malformed response rows without coercing objects into output", () => {
    const text = formatRunLogOutput(
      {
        entries: [null, { message: { payload: "hidden" } }],
      } as unknown as RunLogs,
      [],
    ).text;
    expect(text).toContain("Chunk text is missing, invalid");
    expect(text).not.toContain("[object Object]");
    expect(text).not.toContain("hidden");
  });
});
