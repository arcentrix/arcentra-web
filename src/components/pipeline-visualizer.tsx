/**
 * Pipeline Visualizer - 类似 GitHub Actions 的流水线可视化组件
 */

import { FC } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  GitBranch,
  Calendar,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Pipeline } from "./pipeline-editor-dialog";

interface PipelineVisualizerProps {
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
      return <CheckCircle2 className="h-4 w-4" />;
    case "failure":
      return <XCircle className="h-4 w-4" />;
    case "running":
      return <Play className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

export const PipelineVisualizer: FC<PipelineVisualizerProps> = ({
  pipeline,
}) => {
  // 模拟执行状态（实际应该从 API 获取）
  const getStepStatus = (
    stageIndex: number,
    stepIndex: number,
  ): "success" | "failure" | "running" | "pending" => {
    // 简单的模拟逻辑：第一个 stage 的第一个 step 成功，其他待处理
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

  return (
    <div className="space-y-6">
      {/* Triggers */}
      {pipeline.triggers && pipeline.triggers.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Triggers
          </h3>
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

      {/* Stages Visualization */}
      <div className="space-y-4">
        {pipeline.stages && pipeline.stages.length > 0 ? (
          pipeline.stages.map((stage, stageIndex) => {
            const stageStatus = getStageStatus(stageIndex);
            const isLastStage = stageIndex === pipeline.stages!.length - 1;

            return (
              <div key={stageIndex} className="flex items-start gap-4">
                {/* Stage Column */}
                <div className="flex flex-col items-center">
                  {/* Stage Circle */}
                  <div
                    className={`w-12 h-12 rounded-full border-2 flex items-center justify-center ${getStatusColor(stageStatus)}`}
                  >
                    {getStatusIcon(stageStatus)}
                  </div>
                  {/* Connector Line */}
                  {!isLastStage && (
                    <div className="w-0.5 h-16 bg-gray-300 mt-2"></div>
                  )}
                </div>

                {/* Stage Content */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">
                      {stage.name || `Stage ${stageIndex + 1}`}
                    </h4>
                    <Badge
                      variant="outline"
                      className={getStatusColor(stageStatus)}
                    >
                      {getStatusIcon(stageStatus)}
                      <span className="ml-1 capitalize">{stageStatus}</span>
                    </Badge>
                  </div>

                  {/* Steps */}
                  {stage.steps && stage.steps.length > 0 && (
                    <div className="space-y-2 ml-4">
                      {stage.steps.map((step, stepIndex) => {
                        const stepStatus = getStepStatus(stageIndex, stepIndex);
                        return (
                          <Card
                            key={stepIndex}
                            className="p-3 border-l-4 border-l-blue-500"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`${getStatusColor(stepStatus)} rounded-full p-1`}
                                >
                                  {getStatusIcon(stepStatus)}
                                </div>
                                <div>
                                  <p className="text-sm font-medium">
                                    {step.name}
                                  </p>
                                  {step.command && (
                                    <p className="text-xs text-muted-foreground font-mono mt-1">
                                      {step.command}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {step.type}
                              </Badge>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No stages configured</p>
          </div>
        )}
      </div>
    </div>
  );
};
