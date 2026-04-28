/**
 * Project Pipelines 页面 - 单个 Pipeline 的流程图展示
 */

import type { FC } from "react";
import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { GitBranch, Plus, Edit, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  PipelineEditorDialog,
  type Pipeline,
} from "@/components/pipeline-editor-dialog";
import { PipelineFlowchart } from "@/components/pipeline-flowchart";
import { PipelineLogViewer } from "@/components/pipeline-log-viewer";
import { toast } from "@/lib/toast";

const Pipelines: FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [logViewerOpen, setLogViewerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);

  useEffect(() => {
    // 模拟加载单个 pipeline 数据
    const loadPipeline = async () => {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 模拟数据 - 一个项目只有一个 pipeline
      const mockPipeline: Pipeline = {
        id: "1",
        name: "Main Pipeline",
        description: "Main deployment pipeline for this project",
        triggers: [{ type: "push", branch: "main" }, { type: "pull_request" }],
        stages: [
          {
            name: "Build",
            steps: [
              {
                name: "Install dependencies",
                type: "build",
                command: "npm install",
              },
              {
                name: "Build project",
                type: "build",
                command: "npm run build",
              },
            ],
          },
          {
            name: "Test",
            steps: [
              { name: "Run unit tests", type: "test", command: "npm test" },
              {
                name: "Run integration tests",
                type: "test",
                command: "npm run test:integration",
              },
            ],
          },
          {
            name: "Deploy",
            steps: [
              {
                name: "Deploy to staging",
                type: "deploy",
                command: "npm run deploy:staging",
              },
            ],
          },
        ],
      };

      setPipeline(mockPipeline);
      setLoading(false);
    };

    loadPipeline();
  }, [projectId]);

  const handleCreate = () => {
    setDialogOpen(true);
  };

  const handleEdit = () => {
    setDialogOpen(true);
  };

  const handleSubmit = async (data: Pipeline) => {
    // 模拟 API 调用
    await new Promise((resolve) => setTimeout(resolve, 500));

    setPipeline({ ...data, id: pipeline?.id || "1" });
    toast.success(
      pipeline
        ? "Pipeline updated successfully"
        : "Pipeline created successfully",
    );
    setDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 md:p-8 pt-6">
        <p className="text-muted-foreground">Loading pipeline...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <GitBranch className="h-8 w-8 text-blue-500" />
            Pipeline
          </h2>
          <p className="text-muted-foreground mt-1">
            CI/CD pipeline configuration and visualization for project{" "}
            {projectId}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pipeline && (
            <Button variant="outline" onClick={() => setLogViewerOpen(true)}>
              <Terminal className="h-4 w-4 mr-2" />
              Real Time Logs
            </Button>
          )}
          <Button onClick={pipeline ? handleEdit : handleCreate}>
            {pipeline ? (
              <>
                <Edit className="h-4 w-4 mr-2" />
                Edit Pipeline
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create Pipeline
              </>
            )}
          </Button>
        </div>
      </div>

      {pipeline ? (
        <Card className="p-6">
          <PipelineFlowchart pipeline={pipeline} />
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Pipeline Configured</h3>
          <p className="text-muted-foreground mb-4">
            Create a pipeline to automate your build, test, and deployment
            processes.
          </p>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Pipeline
          </Button>
        </Card>
      )}

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
    </div>
  );
};

export default Pipelines;
