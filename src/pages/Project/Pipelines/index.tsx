/**
 * Project Pipelines 标签面板 — Engineering Blueprint 重做
 * 嵌入 Project Detail 标签页，headless（无页头/外层留白）。
 */

import type { FC } from "react";
import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Plus, Edit, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Panel,
  PanelHeader,
  StatusDot,
  ColumnHead,
  type DotTone,
} from "@/components/blueprint";
import {
  PipelineEditorDialog,
  type Pipeline,
} from "@/components/pipeline-editor-dialog";
import { PipelineLogViewer } from "@/components/pipeline-log-viewer";
import { toast } from "@/lib/toast";

/** pipeline 状态 → DotTone 映射 */
function toneForStatus(status: string): DotTone {
  switch (status) {
    case "running":
      return "running";
    case "success":
    case "ok":
      return "ok";
    case "failed":
    case "fail":
      return "fail";
    case "warn":
      return "warn";
    default:
      return "muted";
  }
}

const Pipelines: FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [logViewerOpen, setLogViewerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);

  useEffect(() => {
    const loadPipeline = async () => {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 500));

      const mockPipeline: Pipeline = {
        id: "1",
        name: "Main Pipeline",
        description: "Main deployment pipeline for this project",
        triggers: [{ type: "push", branch: "main" }, { type: "pull_request" }],
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
            steps: [
              { name: "Run unit tests", type: "test", command: "npm test" },
              { name: "Run integration tests", type: "test", command: "npm run test:integration" },
            ],
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
  }, [projectId]);

  const handleCreate = () => setDialogOpen(true);
  const handleEdit = () => setDialogOpen(true);

  const handleSubmit = async (data: Pipeline) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    setPipeline({ ...data, id: pipeline?.id || "1" });
    toast.success(
      pipeline ? "Pipeline updated successfully" : "Pipeline created successfully",
    );
    setDialogOpen(false);
  };

  /** 从 pipeline stages 生成表格行数据（用于展示每个 step）*/
  const rows = pipeline
    ? (pipeline.stages ?? []).flatMap((stage) =>
        stage.steps.map((step) => ({
          key: `${stage.name}-${step.name}`,
          pipeline: pipeline.name,
          trigger: step.type === "build"
            ? "push · main"
            : step.type === "test"
              ? "push · any"
              : "tag · v*",
          schedule: "—",
          last: "—",
          status: "ok" as const,
          runs: "—",
        })),
      )
    : [];

  return (
    <>
      <Panel>
        <PanelHeader
          title="Pipelines"
          sub={
            loading
              ? "Loading…"
              : pipeline
                ? `${(pipeline.stages ?? []).length} stages configured`
                : "No pipeline configured"
          }
          action={
            <div className="flex items-center gap-2">
              {pipeline && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLogViewerOpen(true)}
                >
                  <Terminal className="mr-1.5 h-3.5 w-3.5" />
                  Logs
                </Button>
              )}
              <Button
                size="sm"
                onClick={pipeline ? handleEdit : handleCreate}
              >
                {pipeline ? (
                  <>
                    <Edit className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </>
                ) : (
                  <>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    New pipeline
                  </>
                )}
              </Button>
            </div>
          }
        />

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[13px] text-fg-muted">
            Loading pipeline…
          </div>
        ) : !pipeline ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-[13px] text-fg-muted">No pipeline configured.</p>
            <Button size="sm" onClick={handleCreate}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create pipeline
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><ColumnHead>Name</ColumnHead></TableHead>
                <TableHead><ColumnHead>Trigger</ColumnHead></TableHead>
                <TableHead><ColumnHead>Schedule</ColumnHead></TableHead>
                <TableHead><ColumnHead>Last run</ColumnHead></TableHead>
                <TableHead><ColumnHead>Status</ColumnHead></TableHead>
                <TableHead className="text-right"><ColumnHead>Total runs</ColumnHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="font-medium">{row.pipeline}</TableCell>
                  <TableCell className="font-mono text-[12px] text-fg-muted">
                    {row.trigger}
                  </TableCell>
                  <TableCell className="font-mono text-[12px] text-fg-muted">
                    {row.schedule}
                  </TableCell>
                  <TableCell className="text-[13px] text-fg-muted">{row.last}</TableCell>
                  <TableCell>
                    <StatusDot tone={toneForStatus(row.status)} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-[12px]">
                    {row.runs}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <PipelineEditorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pipeline={pipeline}
        onSubmit={handleSubmit}
      />

      {projectId && (
        <PipelineLogViewer
          open={logViewerOpen}
          onOpenChange={setLogViewerOpen}
          projectId={projectId}
          pipelineId={pipeline?.id}
        />
      )}
    </>
  );
};

export default Pipelines;
