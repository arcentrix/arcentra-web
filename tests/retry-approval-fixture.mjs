/** Synthetic browser-only evidence; exact backend nested wire casing. */
export function retryFixture() {
  return {
    approval: {
      approvalId: "approval",
      pipelineRunId: "run",
      jobName: "build",
      stepName: "",
      plugin: "builtin:retry-approval",
      bindingKind: "retry_whole_job_v1",
      status: 0,
      mode: "any",
      requiredApproverCount: 1,
      approvedCount: 0,
      rejectedCount: 0,
      requestedBy: "requester",
      candidateApprovers: '["operator"]',
      expiresAt: "2099-01-01T01:00:00Z",
      retryJobRunId: "job",
      evidenceHash:
        "v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      version: 1,
      canApprove: true,
      canReject: true,
      retryReview: {
        approvalId: "approval",
        retryJobRunId: "job",
        evidenceHash:
          "v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        status: 0,
        evidence: {
          version: 1,
          kind: "retry_whole_job_v1",
          approvalId: "approval",
          context: {
            version: 1,
            projectId: "project",
            pipelineId: "pipeline",
            pipelineRunId: "run",
            actorId: "requester",
            definitionCommitSha: "dddddddddddddddddddddddddddddddddddddddd",
            definitionPath: ".arcentra/pipeline.yaml",
            resolvedDefinitionDigest:
              "v1:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
            gatedJobs: ["build"],
            policy: {
              id: "operator-policy",
              fingerprint:
                "v1:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
              candidates: ["operator"],
              mode: "any",
              requiredApproverCount: 1,
              timeoutSeconds: 3600,
            },
          },
          identity: {
            pipelineId: "pipeline",
            pipelineRunId: "run",
            jobRunId: "job",
            agentId: "agent",
            claimId: "claim",
            runtimeBindingDigest:
              "v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            sourceBindingDigest:
              "v1:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          },
          jobName: "build",
          retryPlan: {
            version: 1,
            retryApprovalRequired: true,
            retryApprovalTimeoutSeconds: 3600,
            definitionDigest:
              "v1:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            policy: {
              mode: "whole_job",
              max_attempts: 2,
              idempotent: true,
              allowed_exit_codes: [23],
              delay: "1s",
            },
            steps: [
              {
                name: "compile",
                stepIndex: 0,
                uses: "builtin:shell",
                action: "run",
                continueOnError: false,
                attemptRunIds: ["attempt-1", "attempt-2"],
                definitionDigest:
                  "v1:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
              },
            ],
          },
          retryPlanDigest:
            "v1:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          runtime: {
            type: "containerd-offline-v1",
            image:
              "docker.io/library/alpine@sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
            resources: {
              cpu: "500m",
              memory: "128Mi",
            },
            bindingDigest:
              "v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          },
          source: {
            PipelineID: "pipeline",
            PipelineRunID: "run",
            JobRunID: "job",
            Type: "git",
            Repository: "https://github.com/example/source.git",
            Ref: "main",
            Digest:
              "v1:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          },
          inputs: {
            version: 1,
            sourceCommit: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
            artifacts: [
              {
                name: "input",
                key: "project/run/producer/input",
                reference: {
                  storageId: "storage",
                  fingerprint:
                    "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                  sha256:
                    "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                  size: 7,
                },
              },
            ],
          },
          inputManifestDigest:
            "v1:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
          artifacts: [
            {
              name: "input",
              producerJobRunId: "producer",
              producerStepRunId: "producer-step",
              storageKey: "project/run/producer/input",
              reference: {
                storageId: "storage",
                fingerprint:
                  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                sha256:
                  "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                size: 7,
              },
            },
          ],
          createdAtUnixMilli: 4070908800000,
          expiresAtUnixMilli: 4070912400000,
        },
      },
    },
    evidence: {
      version: 1,
      kind: "retry_whole_job_v1",
      approvalId: "approval",
      context: {
        version: 1,
        projectId: "project",
        pipelineId: "pipeline",
        pipelineRunId: "run",
        actorId: "requester",
        definitionCommitSha: "dddddddddddddddddddddddddddddddddddddddd",
        definitionPath: ".arcentra/pipeline.yaml",
        resolvedDefinitionDigest:
          "v1:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        gatedJobs: ["build"],
        policy: {
          id: "operator-policy",
          fingerprint:
            "v1:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          candidates: ["operator"],
          mode: "any",
          requiredApproverCount: 1,
          timeoutSeconds: 3600,
        },
      },
      identity: {
        pipelineId: "pipeline",
        pipelineRunId: "run",
        jobRunId: "job",
        agentId: "agent",
        claimId: "claim",
        runtimeBindingDigest:
          "v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        sourceBindingDigest:
          "v1:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
      jobName: "build",
      retryPlan: {
        version: 1,
        retryApprovalRequired: true,
        retryApprovalTimeoutSeconds: 3600,
        definitionDigest:
          "v1:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        policy: {
          mode: "whole_job",
          max_attempts: 2,
          idempotent: true,
          allowed_exit_codes: [23],
          delay: "1s",
        },
        steps: [
          {
            name: "compile",
            stepIndex: 0,
            uses: "builtin:shell",
            action: "run",
            continueOnError: false,
            attemptRunIds: ["attempt-1", "attempt-2"],
            definitionDigest:
              "v1:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
          },
        ],
      },
      retryPlanDigest:
        "v1:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      runtime: {
        type: "containerd-offline-v1",
        image:
          "docker.io/library/alpine@sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        resources: {
          cpu: "500m",
          memory: "128Mi",
        },
        bindingDigest:
          "v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      source: {
        PipelineID: "pipeline",
        PipelineRunID: "run",
        JobRunID: "job",
        Type: "git",
        Repository: "https://github.com/example/source.git",
        Ref: "main",
        Digest:
          "v1:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
      inputs: {
        version: 1,
        sourceCommit: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        artifacts: [
          {
            name: "input",
            key: "project/run/producer/input",
            reference: {
              storageId: "storage",
              fingerprint:
                "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
              sha256:
                "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
              size: 7,
            },
          },
        ],
      },
      inputManifestDigest:
        "v1:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      artifacts: [
        {
          name: "input",
          producerJobRunId: "producer",
          producerStepRunId: "producer-step",
          storageKey: "project/run/producer/input",
          reference: {
            storageId: "storage",
            fingerprint:
              "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            sha256:
              "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            size: 7,
          },
        },
      ],
      createdAtUnixMilli: 4070908800000,
      expiresAtUnixMilli: 4070912400000,
    },
    run: {
      runId: "run",
      pipelineId: "pipeline",
      status: "running",
      definitionCommitSha: "dddddddddddddddddddddddddddddddddddddddd",
    },
  };
}
