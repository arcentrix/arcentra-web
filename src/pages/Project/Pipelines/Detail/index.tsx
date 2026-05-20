/**
 * Pipeline Detail 页面 — Engineering Blueprint 重做
 * 两列布局：左侧步骤列表，右侧可视化面板。保留全部原有数据逻辑。
 */

import type { FC } from "react";
import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Edit, GitBranch, Check, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Panel,
  PanelHeader,
  SectionEyebrow,
  StatusBadge,
  type BadgeTone,
} from "@/components/blueprint";
import { PipelineVisualizer } from "@/components/pipeline-visualizer";
import {
  PipelineEditorDialog,
  type Pipeline,
} from "@/components/pipeline-editor-dialog";
import { toast } from "@/lib/toast";

const PipelineDetail: FC = () => {
  const { projectId: _projectId, id } = useParams<{
    projectId: string;
    id: string;
  }>();
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPipeline = async () => {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 500));

      const mockPipeline: Pipeline = {
        id: id || "1",
        name: `Pipeline ${id}`,
        description: "Main deployment pipeline",
        triggers: [{ type: "push", branch: "main" }],
        stages: [
          {
            name: "Build",
            steps: [
              { name: "Install dependencies", type: "build", command: "npm install" },
              { name: "Build project", type: "build", command: "npm run build" },
            ],
          },
          {
            name: "Test",
            steps: [{ name: "Run tests", type: "test", command: "npm test" }],
          },
          {
            name: "Deploy",
            steps: [
              { name: "Deploy to staging", type: "deploy", command: "npm run deploy:staging" },
            ],
          },
        ],
      };

      setPipeline(mockPipeline);
      setLoading(false);
    };

    loadPipeline();
  }, [id]);

  const handleEdit = () => setDialogOpen(true);

  const handleSubmit = async (data: Pipeline) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    setPipeline({ ...data, id: pipeline?.id });
    toast.success("Pipeline updated successfully");
    setDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[13px] text-fg-muted">
        Loading pipeline…
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="flex items-center justify-center py-16 text-[13px] text-fg-muted">
        Pipeline not found.
      </div>
    );
  }

  /** 将 stages + steps 展平为步骤列表用于详情面板 */
  type StepStatus = "ok" | "fail" | "running" | "pending";
  const steps: { name: string; status: StepStatus; duration: string }[] =
    (pipeline.stages ?? []).flatMap((stage) =>
      stage.steps.map((step) => ({
        name: step.name,
        status: "ok" as StepStatus,
        duration: "—",
      })),
    );

  const overallTone: BadgeTone = "ok";

  return (
    <>
      {/* Two-column layout: visualization (left) + detail panel (right) */}
      <div
        className="grid items-start gap-4"
        style={{ gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)" }}
      >
        {/* Left: pipeline visualization */}
        <Panel>
          <PanelHeader
            title={pipeline.name}
            sub={pipeline.description ?? "Pipeline configuration"}
            action={
              <Button size="sm" onClick={handleEdit}>
                <Edit className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
            }
          />
          <div className="p-5">
            <PipelineVisualizer pipeline={pipeline} />
          </div>
        </Panel>

        {/* Right: run detail */}
        <Panel>
          {/* Header region */}
          <div className="p-5">
            <div className="flex items-center justify-between">
              <SectionEyebrow>pipeline · {id}</SectionEyebrow>
              <StatusBadge tone={overallTone} />
            </div>
            <h3
              className="display mt-2.5 text-[20px] font-semibold leading-tight tracking-[-0.02em]"
            >
              {pipeline.name}
            </h3>
            <div className="mt-2 flex flex-wrap gap-3.5 font-mono text-[11.5px] text-fg-subtle">
              <span className="flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                main
              </span>
              <span>#{id}</span>
              <span>{pipeline.triggers?.[0]?.branch ?? "—"}</span>
            </div>
          </div>

          {/* Steps */}
          <div className="border-t p-5">
            <SectionEyebrow className="mb-3">steps</SectionEyebrow>
            <ol className="flex flex-col gap-1.5">
              {steps.map((step) => {
                const isRunning = step.status === "running";
                return (
                  <li
                    key={step.name}
                    className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px]"
                    style={{
                      border: isRunning
                        ? "1px solid var(--brand-signal-dim)"
                        : "1px solid var(--border)",
                      background: isRunning
                        ? "color-mix(in oklab, var(--brand-signal) 4%, transparent)"
                        : "transparent",
                    }}
                  >
                    {/* step icon */}
                    <span
                      className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border"
                      style={{
                        color:
                          step.status === "ok"
                            ? "var(--accent-success)"
                            : step.status === "fail"
                              ? "var(--accent-danger)"
                              : "var(--brand-signal)",
                      }}
                    >
                      {step.status === "ok" && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                      {step.status === "fail" && <X className="h-2.5 w-2.5" strokeWidth={3} />}
                      {isRunning && (
                        <RefreshCw className="h-2.5 w-2.5 animate-spin" strokeWidth={2.5} />
                      )}
                    </span>
                    <span
                      className="flex-1"
                      style={{
                        color: step.status === "pending"
                          ? "var(--fg-subtle)"
                          : "var(--fg)",
                      }}
                    >
                      {step.name}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-fg-subtle">
                      {step.duration}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Footer actions */}
          <div className="flex items-center gap-2 border-t p-4">
            <Button variant="outline" size="sm">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Re-run
            </Button>
            <Button variant="ghost" size="sm">View logs</Button>
          </div>
        </Panel>
      </div>

      <PipelineEditorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pipeline={pipeline}
        onSubmit={handleSubmit}
      />
    </>
  );
};

export default PipelineDetail;
