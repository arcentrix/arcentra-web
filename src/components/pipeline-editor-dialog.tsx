/**
 * Pipeline Editor Dialog - 支持表单和 YAML 两种编辑模式
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/lib/toast";
import { FileCode, FileText } from "lucide-react";
import { YamlEditor } from "@/components/yaml-editor";

export interface Pipeline {
  id?: string;
  name: string;
  description?: string;
  yaml?: string;
  triggers?: {
    type: "push" | "pull_request" | "schedule" | "manual";
    branch?: string;
    schedule?: string;
  }[];
  stages?: {
    name: string;
    steps: {
      name: string;
      type: "build" | "test" | "deploy" | "custom";
      command?: string;
      image?: string;
      env?: Record<string, string>;
    }[];
  }[];
}

interface PipelineEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipeline?: Pipeline | null;
  onSubmit: (data: Pipeline) => Promise<void>;
}

// 将 Pipeline 对象转换为 YAML（手动序列化，生成更标准的 YAML）
const pipelineToYaml = (pipeline: Pipeline): string => {
  const lines: string[] = [];

  lines.push(`name: ${pipeline.name}`);

  if (pipeline.description) {
    lines.push(`description: "${pipeline.description.replace(/"/g, '\\"')}"`);
  }

  if (pipeline.triggers && pipeline.triggers.length > 0) {
    lines.push("triggers:");
    pipeline.triggers.forEach((trigger) => {
      lines.push(`  - type: ${trigger.type}`);
      if (trigger.branch) {
        lines.push(`    branch: ${trigger.branch}`);
      }
      if (trigger.schedule) {
        lines.push(`    schedule: "${trigger.schedule}"`);
      }
    });
  }

  if (pipeline.stages && pipeline.stages.length > 0) {
    lines.push("stages:");
    pipeline.stages.forEach((stage) => {
      lines.push(`  - name: ${stage.name}`);
      if (stage.steps && stage.steps.length > 0) {
        lines.push("    steps:");
        stage.steps.forEach((step) => {
          lines.push(`      - name: ${step.name}`);
          lines.push(`        type: ${step.type}`);
          if (step.command) {
            lines.push(
              `        command: "${step.command.replace(/"/g, '\\"')}"`,
            );
          }
          if (step.image) {
            lines.push(`        image: ${step.image}`);
          }
          if (step.env && Object.keys(step.env).length > 0) {
            lines.push("        env:");
            Object.entries(step.env).forEach(([key, value]) => {
              lines.push(
                `          ${key}: "${String(value).replace(/"/g, '\\"')}"`,
              );
            });
          }
        });
      }
    });
  }

  return lines.join("\n");
};

// 将 YAML 转换为 Pipeline 对象（简单实现，实际项目中应该使用 yaml 库）
const yamlToPipeline = (
  yaml: string,
  currentPipeline?: Pipeline | null,
): Pipeline => {
  try {
    // 简单的 YAML 解析（将 YAML 转换为 JSON 然后解析）
    // 这是一个简化的实现，实际项目中应该使用 js-yaml 或类似的库
    let jsonStr = yaml
      .replace(/^(\s*)([a-zA-Z_][a-zA-Z0-9_]*):/gm, '"$2":') // 键名加引号
      .replace(/:\s*"([^"]*)"/g, ': "$1"') // 保留字符串值
      .replace(/:\s*([^"\[\n]+)$/gm, (_match, value) => {
        // 处理非字符串值
        const trimmed = value.trim();
        if (trimmed === "true" || trimmed === "false" || trimmed === "null") {
          return `: ${trimmed}`;
        }
        if (/^\d+$/.test(trimmed)) {
          return `: ${trimmed}`;
        }
        return `: "${trimmed}"`;
      })
      .replace(/^(\s*)-\s*/gm, "$1") // 移除数组标记
      .replace(/\n(\s+)([a-zA-Z_])/g, ',\n$1"$2') // 添加逗号
      .replace(/^(\s+)([a-zA-Z_][a-zA-Z0-9_]*):/gm, '$1"$2":'); // 嵌套键名加引号

    // 尝试解析为 JSON
    const obj = JSON.parse(`{${jsonStr}}`);

    return {
      id: currentPipeline?.id,
      name: obj.name || "",
      description: obj.description || "",
      yaml,
      triggers: obj.triggers || [],
      stages: obj.stages || [],
    };
  } catch (error) {
    // 如果解析失败，尝试更宽松的解析
    const nameMatch = yaml.match(/^name:\s*(.+)$/m);
    const descriptionMatch = yaml.match(/^description:\s*"?(.+?)"?$/m);

    return {
      id: currentPipeline?.id,
      name: nameMatch ? nameMatch[1].trim() : "",
      description: descriptionMatch ? descriptionMatch[1].trim() : "",
      yaml,
      triggers: [],
      stages: [],
    };
  }
};

export function PipelineEditorDialog({
  open,
  onOpenChange,
  pipeline,
  onSubmit,
}: PipelineEditorDialogProps) {
  const [mode, setMode] = useState<"form" | "yaml">("form");
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Pipeline>({
    name: "",
    description: "",
    triggers: [],
    stages: [],
  });
  const [yamlContent, setYamlContent] = useState("");

  useEffect(() => {
    if (pipeline && open) {
      setFormData(pipeline);
      setYamlContent(pipeline.yaml || pipelineToYaml(pipeline));
    } else if (open && !pipeline) {
      setFormData({
        name: "",
        description: "",
        triggers: [],
        stages: [],
      });
      setYamlContent(`name: new-pipeline
description: ""
triggers:
  - type: push
    branch: main
stages:
  - name: build
    steps:
      - name: build-step
        type: build
        command: npm install && npm run build
`);
    }
  }, [pipeline, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let finalData: Pipeline;
      if (mode === "yaml") {
        finalData = yamlToPipeline(yamlContent, pipeline);
      } else {
        finalData = { ...formData, yaml: pipelineToYaml(formData) };
      }

      await onSubmit(finalData);
      toast.success(
        pipeline
          ? "Pipeline updated successfully"
          : "Pipeline created successfully",
      );
      onOpenChange(false);
    } catch (error: any) {
      toast.error(
        error.message ||
          (pipeline
            ? "Failed to update pipeline"
            : "Failed to create pipeline"),
      );
      console.error("Submit failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTrigger = () => {
    setFormData({
      ...formData,
      triggers: [...(formData.triggers || []), { type: "push" }],
    });
  };

  const handleRemoveTrigger = (index: number) => {
    setFormData({
      ...formData,
      triggers: formData.triggers?.filter((_, i) => i !== index) || [],
    });
  };

  const handleTriggerChange = (index: number, field: string, value: any) => {
    const triggers = [...(formData.triggers || [])];
    triggers[index] = { ...triggers[index], [field]: value };
    setFormData({ ...formData, triggers });
  };

  const handleAddStage = () => {
    setFormData({
      ...formData,
      stages: [...(formData.stages || []), { name: "", steps: [] }],
    });
  };

  const handleRemoveStage = (index: number) => {
    setFormData({
      ...formData,
      stages: formData.stages?.filter((_, i) => i !== index) || [],
    });
  };

  const handleStageChange = (index: number, field: string, value: any) => {
    const stages = [...(formData.stages || [])];
    stages[index] = { ...stages[index], [field]: value };
    setFormData({ ...formData, stages });
  };

  const handleAddStep = (stageIndex: number) => {
    const stages = [...(formData.stages || [])];
    stages[stageIndex] = {
      ...stages[stageIndex],
      steps: [...(stages[stageIndex].steps || []), { name: "", type: "build" }],
    };
    setFormData({ ...formData, stages });
  };

  const handleRemoveStep = (stageIndex: number, stepIndex: number) => {
    const stages = [...(formData.stages || [])];
    stages[stageIndex] = {
      ...stages[stageIndex],
      steps: stages[stageIndex].steps?.filter((_, i) => i !== stepIndex) || [],
    };
    setFormData({ ...formData, stages });
  };

  const handleStepChange = (
    stageIndex: number,
    stepIndex: number,
    field: string,
    value: any,
  ) => {
    const stages = [...(formData.stages || [])];
    stages[stageIndex].steps[stepIndex] = {
      ...stages[stageIndex].steps[stepIndex],
      [field]: value,
    };
    setFormData({ ...formData, stages });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {pipeline ? "Edit Pipeline" : "Create Pipeline"}
          </DialogTitle>
          <DialogDescription>
            {pipeline
              ? "Update pipeline configuration using form or YAML editor"
              : "Create a new pipeline using form or YAML editor"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as "form" | "yaml")}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="form" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Form Editor
              </TabsTrigger>
              <TabsTrigger value="yaml" className="flex items-center gap-2">
                <FileCode className="h-4 w-4" />
                YAML Editor
              </TabsTrigger>
            </TabsList>

            <TabsContent value="form" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Pipeline Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g.: Main Deployment Pipeline"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Pipeline description"
                  rows={2}
                />
              </div>

              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label>Triggers</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddTrigger}
                  >
                    Add Trigger
                  </Button>
                </div>
                <div className="space-y-2">
                  {formData.triggers?.map((trigger, index) => (
                    <div
                      key={index}
                      className="flex gap-2 items-center border rounded-md p-3"
                    >
                      <select
                        value={trigger.type}
                        onChange={(e) =>
                          handleTriggerChange(index, "type", e.target.value)
                        }
                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="push">Push</option>
                        <option value="pull_request">Pull Request</option>
                        <option value="schedule">Schedule</option>
                        <option value="manual">Manual</option>
                      </select>
                      {trigger.type === "push" ||
                      trigger.type === "pull_request" ? (
                        <Input
                          placeholder="Branch (e.g.: main)"
                          value={trigger.branch || ""}
                          onChange={(e) =>
                            handleTriggerChange(index, "branch", e.target.value)
                          }
                          className="flex-1"
                        />
                      ) : trigger.type === "schedule" ? (
                        <Input
                          placeholder="Cron expression (e.g.: 0 0 * * *)"
                          value={trigger.schedule || ""}
                          onChange={(e) =>
                            handleTriggerChange(
                              index,
                              "schedule",
                              e.target.value,
                            )
                          }
                          className="flex-1"
                        />
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveTrigger(index)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label>Stages</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddStage}
                  >
                    Add Stage
                  </Button>
                </div>
                <div className="space-y-4">
                  {formData.stages?.map((stage, stageIndex) => (
                    <div
                      key={stageIndex}
                      className="border rounded-md p-4 space-y-3"
                    >
                      <div className="flex gap-2 items-center">
                        <Input
                          placeholder="Stage name (e.g.: Build)"
                          value={stage.name}
                          onChange={(e) =>
                            handleStageChange(
                              stageIndex,
                              "name",
                              e.target.value,
                            )
                          }
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveStage(stageIndex)}
                        >
                          ×
                        </Button>
                      </div>
                      <div className="space-y-2 pl-4 border-l-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Steps</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddStep(stageIndex)}
                          >
                            Add Step
                          </Button>
                        </div>
                        {stage.steps?.map((step, stepIndex) => (
                          <div
                            key={stepIndex}
                            className="flex gap-2 items-start border rounded-md p-3"
                          >
                            <div className="flex-1 space-y-2">
                              <Input
                                placeholder="Step name"
                                value={step.name}
                                onChange={(e) =>
                                  handleStepChange(
                                    stageIndex,
                                    stepIndex,
                                    "name",
                                    e.target.value,
                                  )
                                }
                              />
                              <select
                                value={step.type}
                                onChange={(e) =>
                                  handleStepChange(
                                    stageIndex,
                                    stepIndex,
                                    "type",
                                    e.target.value,
                                  )
                                }
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              >
                                <option value="build">Build</option>
                                <option value="test">Test</option>
                                <option value="deploy">Deploy</option>
                                <option value="custom">Custom</option>
                              </select>
                              <Input
                                placeholder="Command (e.g.: npm install)"
                                value={step.command || ""}
                                onChange={(e) =>
                                  handleStepChange(
                                    stageIndex,
                                    stepIndex,
                                    "command",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                handleRemoveStep(stageIndex, stepIndex)
                              }
                            >
                              ×
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="yaml" className="mt-4">
              <div className="space-y-2">
                <Label htmlFor="yaml">Pipeline YAML</Label>
                <YamlEditor
                  value={yamlContent}
                  onChange={setYamlContent}
                  height="500px"
                  className="border-input"
                />
                <p className="text-xs text-muted-foreground">
                  Edit pipeline configuration in YAML format. Changes will be
                  validated on save.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : pipeline ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
