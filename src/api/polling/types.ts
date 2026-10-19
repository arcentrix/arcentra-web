/** Safe, permission-filtered polling views. No raw cursor or provider credentials. */
export interface PollingPipeline {
  pipelineId: string;
  name: string;
}
export interface PollingStatus {
  supported: boolean;
  state: "disabled" | "baselined" | "enabled" | "paused";
  revision: number;
  baselineId?: string;
  baselineCompletedAt?: string;
  baselineObservationCount?: number;
  authorizerId?: string;
  scope?:
    | { provider: "gitlab"; repository: string; stream: "merge_requests" }
    | {
        provider: "github" | "gitea";
        repository: string;
        stream: "pull_requests";
      };
  selectedPipelines: PollingPipeline[];
  blocker: string;
  capabilities: {
    canBaseline: boolean;
    canEnable: boolean;
    canDisable: boolean;
  };
  nextRetryAt?: string;
  lastPollError?: string;
  lastCompletedAt?: string;
  lastObservationCount?: number;
  lastTargetCount?: number;
}
export interface PollingCandidate extends PollingPipeline {
  defaultBranch: string;
  definitionPath: string;
  canEnable: boolean;
  eligible: boolean;
  blocker: string;
}
export interface PollingCandidates {
  items: PollingCandidate[];
  total: number;
  pageNum: number;
  pageSize: number;
}
export interface BaselinePollingInput {
  expectedRevision: number;
  acknowledgeDiscard: boolean;
}
export interface EnablePollingInput {
  expectedRevision: number;
  baselineId: string;
  pipelineIds: string[];
}
export interface DisablePollingInput {
  expectedRevision: number;
}
