import { get, post } from "../client";

export interface PipelineApprovalPolicy {
  approvers: string[];
  minApprovals: number;
  timeoutSeconds: number;
}
export interface ApprovalTarget {
  projectId: string;
  environmentId: string;
  targetRef: string;
  namespace: string;
  deployment: string;
  container: string;
}
export interface DeploymentEnvironment {
  environmentId: string;
  projectId: string;
  name: string;
  targetRef: string;
  namespace: string;
  deployment: string;
  container: string;
  configured: boolean;
  activeReleaseId?: string;
  pipelineApproval?: PipelineApprovalPolicy;
}
export type ReleaseStatus =
  | "queued"
  | "applying"
  | "observing"
  | "succeeded"
  | "failed"
  | "superseded"
  | "cancelled";
export interface DeploymentRelease {
  approvalId?: string;
  approvalEvidenceHash?: string;
  approvalTarget?: ApprovalTarget;
  origin?: "manual" | "pipeline_job";
  executionJobRunId?: string;
  executionStepRunId?: string;
  producerJobRunId?: string;
  producerStepRunId?: string;
  deploymentPlanHash?: string;
  releaseId: string;
  projectId: string;
  requestId: string;
  environmentId: string;
  pipelineId: string;
  pipelineRunId: string;
  artifactId: string;
  artifactSha256: string;
  commitSha: string;
  image: string;
  createdBy: string;
  status: ReleaseStatus;
  reason?: string;
  workloadUid?: string;
  appliedGeneration?: number;
  observedGeneration?: number;
  desiredReplicas: number;
  updatedReplicas: number;
  availableReplicas: number;
  lastObservedAt?: string;
  finishedAt?: string;
}
export interface DeploymentPage<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface EnvironmentInput {
  name: string;
  targetRef: string;
  namespace: string;
  deployment: string;
  container: string;
}
export interface ReleaseInput {
  requestId: string;
  environmentId: string;
  pipelineId: string;
  pipelineRunId: string;
  artifactId: string;
}
const root = (projectId: string) =>
  `/projects/${encodeURIComponent(projectId)}`;
export async function listEnvironments(
  projectId: string,
  page = 1,
  signal?: AbortSignal,
): Promise<DeploymentPage<DeploymentEnvironment>> {
  const result = await get<DeploymentPage<DeploymentEnvironment>>(
    `${root(projectId)}/environments`,
    { params: { page, pageSize: 20 }, signal, silence: true },
  );
  return { ...result, list: result.list ?? [] };
}
export async function listReleases(
  projectId: string,
  page = 1,
  signal?: AbortSignal,
): Promise<DeploymentPage<DeploymentRelease>> {
  const result = await get<DeploymentPage<DeploymentRelease>>(
    `${root(projectId)}/releases`,
    { params: { page, pageSize: 20 }, signal, silence: true },
  );
  return { ...result, list: result.list ?? [] };
}
export const createEnvironment = (projectId: string, input: EnvironmentInput) =>
  post<DeploymentEnvironment>(`${root(projectId)}/environments`, input, {
    silence: true,
  });
export const createRelease = (projectId: string, input: ReleaseInput) =>
  post<DeploymentRelease>(`${root(projectId)}/releases`, input, {
    silence: true,
  });
export const advanceRelease = (projectId: string, releaseId: string) =>
  post<DeploymentRelease>(
    `${root(projectId)}/releases/${encodeURIComponent(releaseId)}/advance`,
    {},
    { silence: true },
  );
export const cancelRelease = (projectId: string, releaseId: string) =>
  post<DeploymentRelease>(
    `${root(projectId)}/releases/${encodeURIComponent(releaseId)}/cancel`,
    {},
    { silence: true },
  );

/** Fetches a release in its project scope; never substitutes paginated history. */
export async function getRelease(
  projectId: string,
  releaseId: string,
  signal?: AbortSignal,
): Promise<DeploymentRelease> {
  const release = await get<DeploymentRelease>(
    `${root(projectId)}/releases/${encodeURIComponent(releaseId)}`,
    { signal, silence: true },
  );
  if (release.projectId !== projectId || release.releaseId !== releaseId)
    throw new Error(
      "Release response does not match the requested project and release.",
    );
  return release;
}

export interface ReleaseInspection {
  releaseId: string;
  persistedStatus: ReleaseStatus;
  status: string;
  reason: string;
  observedGeneration: number;
  desiredReplicas: number;
  updatedReplicas: number;
  availableReplicas: number;
}
export async function inspectRelease(
  projectId: string,
  releaseId: string,
): Promise<ReleaseInspection> {
  const inspection = await get<ReleaseInspection>(
    `${root(projectId)}/releases/${encodeURIComponent(releaseId)}/inspect`,
    { silence: true },
  );
  if (inspection.releaseId !== releaseId)
    throw new Error("Inspection does not match the requested release.");
  return inspection;
}
/** Explicit human confirmation; ordinary refresh and inspection never call this. */
export const recoverRelease = (projectId: string, releaseId: string) =>
  post<DeploymentRelease>(
    `${root(projectId)}/releases/${encodeURIComponent(releaseId)}/recover`,
    { confirmRecovery: true },
    { silence: true },
  );
