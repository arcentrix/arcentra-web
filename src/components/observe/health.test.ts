import { describe, expect, it } from "vitest";
import type { Agent } from "@/api/agent/types";
import type { PipelineRun } from "@/api/pipeline/types";
import {
  buildRunLink,
  heartbeatTime,
  positivePage,
  summarizeAgents,
  summarizeRuns,
} from "./health";

describe("Observe snapshot summaries", () => {
  it("measures only loaded completed runs with recorded durations", () => {
    const runs = [
      { status: "success", duration: 1000 },
      { status: "failed", duration: 3000 },
      { status: "cancelled", duration: 0 },
      { status: "running", duration: 99000 },
      { status: "paused", duration: 15000 },
      { status: "success", duration: Number.NaN },
      { status: "failed", duration: -1 },
    ] as PipelineRun[];
    expect(summarizeRuns(runs)).toEqual({
      loaded: 7,
      failed: 2,
      active: 2,
      durationCount: 2,
      meanDuration: 2000,
    });
    expect(summarizeRuns([]).meanDuration).toBeNull();
  });
  it("distinguishes busy, idle, online, offline and disabled without a fake global online total", () => {
    const agents = [
      { status: 1, isEnabled: 1 },
      { status: 4, isEnabled: 1 },
      { status: 3, isEnabled: 1 },
      { status: 2, isEnabled: 1 },
      { status: 4, isEnabled: 0 },
      { status: 0, isEnabled: 1 },
    ] as Agent[];
    expect(summarizeAgents(agents)).toEqual({
      available: 2,
      busy: 1,
      offline: 1,
      disabled: 1,
    });
  });
  it("handles missing heartbeat, invalid pages and encoded Build links", () => {
    expect(heartbeatTime(null)).toBe("Not reported");
    expect(heartbeatTime("bad timestamp")).toBe("Not reported");
    expect(heartbeatTime("2026-10-12T04:00:00Z")).toBe(
      new Date("2026-10-12T04:00:00Z").toLocaleString(),
    );
    for (const value of [
      null,
      "-1",
      "0",
      "1.5",
      "Infinity",
      "9007199254740992",
      "4294967297",
      "1000001",
      "abc",
    ])
      expect(positivePage(value)).toBe(1);
    expect(positivePage("3")).toBe(3);
    expect(buildRunLink("pipe/a&b", "run=2")).toBe(
      "/build?pipeline=pipe%2Fa%26b&run=run%3D2",
    );
  });
});
