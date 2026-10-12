import type { PipelineSpec } from "@/api/pipeline/types";

/** Rendering safeguards only. The server validates and authorizes the plan. */
export function deploymentReviewError(
  definition: PipelineSpec,
  projectId: string,
): string {
  if (
    !/^(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/.test(
      definition.headCommitSha ?? "",
    )
  )
    return "The definition revision is unavailable. Refresh before starting a run.";
  if (definition.deploymentReviewError) return definition.deploymentReviewError;
  if (definition.deploymentPlan === undefined)
    return "The backend deployment review is unavailable. A verified review is required before starting a run.";
  const plan = definition.deploymentPlan;
  if (plan === null) return "";
  const target = plan.target;
  if (
    !/^[a-fA-F0-9]{64}$/.test(definition.deploymentPlanHash ?? "") ||
    !plan.jobName ||
    !plan.stepName ||
    !plan.environmentId ||
    !plan.artifact?.job ||
    !plan.artifact?.step ||
    !plan.artifact?.name ||
    !Number.isFinite(plan.timeoutSeconds) ||
    plan.timeoutSeconds < 1 ||
    plan.timeoutSeconds > 3600 ||
    !target ||
    target.projectId !== projectId ||
    target.environmentId !== plan.environmentId ||
    !target.targetRef ||
    !target.namespace ||
    !target.deployment ||
    !target.container
  )
    return "The backend deployment review is incomplete or belongs to a different project. Refresh before starting a run.";
  if (!target.configured)
    return "The reviewed Kubernetes target is not configured. Ask an operator to configure it before starting this run.";
  if (!target.allowPipelineDeployments)
    return "This operator target does not allow pipeline deployments.";
  return "";
}
