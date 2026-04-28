/**
 * Pipeline Flowchart - 流程图形式的 Pipeline 可视化组件
 * 参考 GitLab/GitHub Actions 的流程图风格
 */

import { FC } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  ArrowRight,
  GitBranch,
  Calendar,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Pipeline } from "./pipeline-editor-dialog";

interface PipelineFlowchartProps {
  pipeline: Pipeline;
}

const getStatusColor = (
  status: "success" | "failure" | "running" | "pending" = "pending",
) => {
  switch (status) {
    case "success":
      return "bg-green-50 text-green-700 border-green-200";
    case "failure":
      return "bg-red-50 text-red-700 border-red-200";
    case "running":
      return "bg-blue-50 text-blue-700 border-blue-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
};

const getStatusIcon = (
  status: "success" | "failure" | "running" | "pending" = "pending",
) => {
  switch (status) {
    case "success":
      return <CheckCircle2 className="h-5 w-5" />;
    case "failure":
      return <XCircle className="h-5 w-5" />;
    case "running":
      return <Play className="h-5 w-5" />;
    default:
      return <Clock className="h-5 w-5" />;
  }
};

export const PipelineFlowchart: FC<PipelineFlowchartProps> = ({ pipeline }) => {
  // 模拟执行状态（实际应该从 API 获取）
  const getStepStatus = (
    stageIndex: number,
    stepIndex: number,
  ): "success" | "failure" | "running" | "pending" => {
    if (stageIndex === 0 && stepIndex === 0) return "success";
    if (stageIndex === 0 && stepIndex === 1) return "running";
    return "pending";
  };

  const getStageStatus = (
    stageIndex: number,
  ): "success" | "failure" | "running" | "pending" => {
    if (stageIndex === 0) return "running";
    return "pending";
  };

  const hasStages = pipeline.stages && pipeline.stages.length > 0;

  return (
    <div className="space-y-6">
      {/* Pipeline Header */}
      <div>
        <h3 className="text-lg font-semibold">{pipeline.name || "Pipeline"}</h3>
        {pipeline.description && (
          <p className="text-sm text-muted-foreground mt-1">
            {pipeline.description}
          </p>
        )}
      </div>

      {/* Triggers */}
      {pipeline.triggers && pipeline.triggers.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Triggers:
          </span>
          <div className="flex flex-wrap gap-2">
            {pipeline.triggers.map((trigger, index) => (
              <Badge
                key={index}
                variant="outline"
                className="flex items-center gap-1"
              >
                {trigger.type === "push" && <GitBranch className="h-3 w-3" />}
                {trigger.type === "schedule" && (
                  <Calendar className="h-3 w-3" />
                )}
                {trigger.type === "manual" && <User className="h-3 w-3" />}
                <span className="capitalize">{trigger.type}</span>
                {trigger.branch && (
                  <span className="text-muted-foreground">
                    ({trigger.branch})
                  </span>
                )}
                {trigger.schedule && (
                  <span className="text-muted-foreground">
                    ({trigger.schedule})
                  </span>
                )}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Flowchart Visualization */}
      {hasStages ? (
        <div className="relative">
          {/* 流程图容器 */}
          <div className="flex items-start gap-6 overflow-x-auto pb-4 px-2">
            {pipeline.stages!.map((stage, stageIndex) => {
              const stageStatus = getStageStatus(stageIndex);
              const isLastStage = stageIndex === pipeline.stages!.length - 1;

              return (
                <div
                  key={stageIndex}
                  className="flex items-start gap-6 flex-shrink-0"
                >
                  {/* Stage Node */}
                  <div className="flex flex-col items-center min-w-[240px]">
                    {/* Stage Card */}
                    <Card
                      className={`w-full p-5 border-2 transition-all hover:shadow-md ${
                        stageStatus === "running"
                          ? "border-blue-500 shadow-lg shadow-blue-500/20 bg-blue-50/30"
                          : stageStatus === "success"
                            ? "border-green-500 bg-green-50/30"
                            : stageStatus === "failure"
                              ? "border-red-500 bg-red-50/30"
                              : "border-gray-300 bg-gray-50/30"
                      }`}
                    >
                      {/* Stage Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={`rounded-full p-1.5 ${getStatusColor(stageStatus)}`}
                          >
                            {getStatusIcon(stageStatus)}
                          </div>
                          <h4 className="font-semibold text-sm">
                            {stage.name || `Stage ${stageIndex + 1}`}
                          </h4>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs ${getStatusColor(stageStatus)}`}
                        >
                          {stageStatus}
                        </Badge>
                      </div>

                      {/* Steps List */}
                      {stage.steps && stage.steps.length > 0 && (
                        <div className="space-y-2 mt-4 pt-3 border-t border-border/50">
                          {stage.steps.map((step, stepIndex) => {
                            const stepStatus = getStepStatus(
                              stageIndex,
                              stepIndex,
                            );
                            return (
                              <div
                                key={stepIndex}
                                className={`flex items-start gap-2 p-2.5 rounded-md text-xs transition-colors ${
                                  stepStatus === "success"
                                    ? "bg-green-50/50 border border-green-200/50"
                                    : stepStatus === "running"
                                      ? "bg-blue-50/50 border border-blue-200/50"
                                      : stepStatus === "failure"
                                        ? "bg-red-50/50 border border-red-200/50"
                                        : "bg-gray-50/50 border border-gray-200/50"
                                }`}
                              >
                                <div
                                  className={`rounded-full p-0.5 flex-shrink-0 ${getStatusColor(stepStatus)}`}
                                >
                                  {getStatusIcon(stepStatus)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">
                                    {step.name}
                                  </p>
                                  {step.command && (
                                    <p className="text-muted-foreground font-mono truncate mt-1 text-[10px]">
                                      {step.command}
                                    </p>
                                  )}
                                  {step.type && (
                                    <Badge
                                      variant="outline"
                                      className="mt-1 text-[10px] px-1.5 py-0"
                                    >
                                      {step.type}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </Card>
                  </div>

                  {/* Arrow Connector */}
                  {!isLastStage && (
                    <div className="flex items-center justify-center pt-10 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <div className="h-0.5 w-8 bg-gray-300"></div>
                        <ArrowRight className="h-5 w-5 text-gray-400" />
                        <div className="h-0.5 w-8 bg-gray-300"></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No stages configured</p>
          <p className="text-sm text-muted-foreground mt-2">
            Click "Edit" to configure pipeline stages
          </p>
        </Card>
      )}
    </div>
  );
};
