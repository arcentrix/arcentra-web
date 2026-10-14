import { expect, it } from "vitest";
import {
  retryApprovalReviewKey,
  validateRetryApproval,
} from "./retry-approval-review";
import { retryFixture, retryScope } from "./retry-approval.test-fixture";
it("accepts complete exact source, input and finite plan evidence using actual nested wire casing", () => {
  const f = retryFixture();
  const review = validateRetryApproval(retryScope, f.approval, f.run);
  expect(review.evidence.inputs.sourceCommit).toBe("e".repeat(40));
  expect(review.evidence.retryPlan.policy.max_attempts).toBe(2);
  const key = retryApprovalReviewKey(review);
  f.evidence.retryPlan.steps[0].definitionDigest = "v1:" + "f".repeat(64);
  expect(retryApprovalReviewKey(review)).not.toBe(key);
});
it("accepts explicit source-free jobs but never invents a source commit", () => {
  const f = retryFixture();
  f.evidence.source = null;
  f.evidence.inputs.sourceCommit = "";
  f.evidence.identity.sourceBindingDigest = "";
  expect(() =>
    validateRetryApproval(retryScope, f.approval, f.run),
  ).not.toThrow();
  f.evidence.inputs.sourceCommit = "e".repeat(40);
  expect(() => validateRetryApproval(retryScope, f.approval, f.run)).toThrow();
});
it.each([
  (f: ReturnType<typeof retryFixture>) => {
    f.evidence.retryPlan.retryApprovalTimeoutSeconds = 1;
  },
  (f: ReturnType<typeof retryFixture>) => {
    Object.assign(f.evidence.retryPlan, { retryApprovalRequired: false });
  },
  (f: ReturnType<typeof retryFixture>) => {
    f.approval.retryJobRunId = "other";
  },
  (f: ReturnType<typeof retryFixture>) => {
    f.approval.deploymentReleaseId = "release";
  },
  (f: ReturnType<typeof retryFixture>) => {
    f.approval.bindingKind = "unknown";
  },
  (f: ReturnType<typeof retryFixture>) => {
    f.evidence.context.projectId = "other";
  },
  (f: ReturnType<typeof retryFixture>) => {
    f.evidence.context.actorId = "spoof";
  },
  (f: ReturnType<typeof retryFixture>) => {
    f.evidence.context.definitionCommitSha = "main";
  },
  (f: ReturnType<typeof retryFixture>) => {
    f.evidence.context.gatedJobs = [];
  },
  (f: ReturnType<typeof retryFixture>) => {
    f.evidence.context.policy.candidates = ["requester"];
  },
  (f: ReturnType<typeof retryFixture>) => {
    f.evidence.context.policy.timeoutSeconds = 86400;
  },
  (f: ReturnType<typeof retryFixture>) => {
    f.evidence.expiresAtUnixMilli++;
  },
  (f: ReturnType<typeof retryFixture>) => {
    f.evidence.inputs.sourceCommit = "main";
  },
  (f: ReturnType<typeof retryFixture>) => {
    f.evidence.source!.JobRunID = "other";
  },
  (f: ReturnType<typeof retryFixture>) => {
    f.evidence.retryPlan.policy.max_attempts = 6;
  },
  (f: ReturnType<typeof retryFixture>) => {
    f.evidence.retryPlan.policy.allowed_exit_codes = [23, 23];
  },
  (f: ReturnType<typeof retryFixture>) => {
    f.evidence.retryPlan.steps[0].attemptRunIds = ["same", "same"];
  },
  (f: ReturnType<typeof retryFixture>) => {
    f.evidence.retryPlan.steps[0].attemptRunIds.pop();
  },
  (f: ReturnType<typeof retryFixture>) => {
    f.evidence.artifacts[0].reference.sha256 = "changed";
  },
  (f: ReturnType<typeof retryFixture>) => {
    f.evidence.artifacts[0].reference.size = 8;
  },
  (f: ReturnType<typeof retryFixture>) => {
    f.evidence.artifacts[0].producerJobRunId = "job";
  },
  (f: ReturnType<typeof retryFixture>) => {
    f.evidence.artifacts = [];
  },
  (f: ReturnType<typeof retryFixture>) => {
    f.evidence.runtime.bindingDigest = "bad";
  },
  (f: ReturnType<typeof retryFixture>) => {
    f.evidence.runtime.image = "alpine:latest";
  },
  (f: ReturnType<typeof retryFixture>) => {
    f.approval.retryReview!.status = 1;
  },
])("rejects malformed or cross-bound approval evidence %#", (change) => {
  const f = retryFixture();
  change(f);
  expect(() => validateRetryApproval(retryScope, f.approval, f.run)).toThrow();
});
