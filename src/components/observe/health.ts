import type { Agent } from "@/api/agent/types";
import { isActiveRun, isTerminalRun } from "@/api/pipeline";
import type { PipelineRun } from "@/api/pipeline/types";

/** Summaries are only about the loaded page, never an inferred global total. */
export function summarizeRuns(runs: PipelineRun[]) {
  const durations = runs
    .filter((run) => isTerminalRun(run.status))
    .map((run) => run.duration)
    .filter((duration) => Number.isFinite(duration) && duration > 0);
  return {
    loaded: runs.length,
    failed: runs.filter((run) => run.status === "failed").length,
    active: runs.filter((run) => isActiveRun(run.status)).length,
    durationCount: durations.length,
    meanDuration: durations.length
      ? durations.reduce((sum, duration) => sum + duration, 0) /
        durations.length
      : null,
  };
}

export function summarizeAgents(agents: Agent[]) {
  return {
    available: agents.filter(
      (agent) => agent.isEnabled === 1 && [1, 4].includes(agent.status),
    ).length,
    busy: agents.filter((agent) => agent.isEnabled === 1 && agent.status === 3)
      .length,
    offline: agents.filter((agent) => agent.status === 2).length,
    disabled: agents.filter((agent) => agent.isEnabled === 0).length,
  };
}

export function heartbeatTime(value?: string | null) {
  if (!value) return "Not reported";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not reported" : date.toLocaleString();
}

export function positivePage(value: string | null) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 && number <= 1_000_000
    ? number
    : 1;
}

export function buildRunLink(pipelineId: string, runId?: string) {
  const params = new URLSearchParams({ pipeline: pipelineId });
  if (runId) params.set("run", runId);
  return `/build?${params.toString()}`;
}
