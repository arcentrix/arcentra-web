/**
 * Pipeline Detail 页面
 */

import type { FC } from "react";
import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { GitBranch, Edit } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    // 模拟加载 pipeline 数据
    const loadPipeline = async () => {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 模拟数据
      const mockPipeline: Pipeline = {
        id: id || "1",
        name: `Pipeline ${id}`,
        description: "Main deployment pipeline",
        triggers: [{ type: "push", branch: "main" }],
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
            steps: [{ name: "Run tests", type: "test", command: "npm test" }],
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
  }, [id]);

  const handleEdit = () => {
    setDialogOpen(true);
  };

  const handleSubmit = async (data: Pipeline) => {
    // 模拟 API 调用
    await new Promise((resolve) => setTimeout(resolve, 500));
    setPipeline({ ...data, id: pipeline?.id });
    toast.success("Pipeline updated successfully");
    setDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 md:p-8 pt-6">
        <p className="text-muted-foreground">Loading pipeline...</p>
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 md:p-8 pt-6">
        <p className="text-muted-foreground">Pipeline not found</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <GitBranch className="h-8 w-8 text-blue-500" />
            {pipeline.name}
          </h2>
          <p className="text-muted-foreground mt-1">
            {pipeline.description ||
              "Pipeline configuration and execution details"}
          </p>
        </div>
        <Button onClick={handleEdit}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Pipeline
        </Button>
      </div>

      <Tabs defaultValue="visualization" className="w-full">
        <TabsList>
          <TabsTrigger value="visualization">Visualization</TabsTrigger>
          <TabsTrigger value="yaml">YAML</TabsTrigger>
          <TabsTrigger value="info">Information</TabsTrigger>
        </TabsList>

        <TabsContent value="visualization" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Visualization</CardTitle>
              <CardDescription>
                Visual representation of pipeline stages and steps
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PipelineVisualizer pipeline={pipeline} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="yaml" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>YAML Configuration</CardTitle>
              <CardDescription>
                Pipeline configuration in YAML format
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-md overflow-x-auto">
                <code className="text-sm font-mono">
                  {pipeline.yaml || JSON.stringify(pipeline, null, 2)}
                </code>
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Information</CardTitle>
              <CardDescription>Details about this pipeline</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium">Pipeline ID</p>
                  <p className="text-sm text-muted-foreground">{pipeline.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Name</p>
                  <p className="text-sm text-muted-foreground">
                    {pipeline.name}
                  </p>
                </div>
                {pipeline.description && (
                  <div>
                    <p className="text-sm font-medium">Description</p>
                    <p className="text-sm text-muted-foreground">
                      {pipeline.description}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">Stages</p>
                  <p className="text-sm text-muted-foreground">
                    {pipeline.stages?.length || 0} stage
                    {pipeline.stages?.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Triggers</p>
                  <p className="text-sm text-muted-foreground">
                    {pipeline.triggers?.length || 0} trigger
                    {pipeline.triggers?.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PipelineEditorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pipeline={pipeline}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default PipelineDetail;
