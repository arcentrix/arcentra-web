/**
 * Project Overview 页面 - 显示项目概览信息
 */

import type { FC } from "react";
import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  GitBranch,
  Users,
  Globe,
  Rocket,
} from "lucide-react";

const ProjectOverview: FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [loading, setLoading] = useState(true);

  // 模拟 pipeline 统计数据
  const [pipelineStats, setPipelineStats] = useState({
    total: 0,
    success: 0,
    failure: 0,
    running: 0,
  });

  useEffect(() => {
    // 模拟加载 pipeline 统计数据
    const loadStats = async () => {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 模拟数据
      setPipelineStats({
        total: 156,
        success: 142,
        failure: 8,
        running: 6,
      });
      setLoading(false);
    };

    loadStats();
  }, [projectId]);

  return (
    <div className="space-y-6">
      {/* Pipeline 统计 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-blue-500" />
            Pipeline Statistics
          </CardTitle>
          <CardDescription>
            Pipeline execution statistics for this project
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading statistics...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-lg border bg-card p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Total Runs
                    </p>
                    <p className="text-3xl font-bold mt-2">
                      {pipelineStats.total}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <Play className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-card p-6 hover:shadow-md transition-shadow border-green-200 bg-green-50/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Success
                    </p>
                    <p className="text-3xl font-bold mt-2 text-green-700">
                      {pipelineStats.success}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {pipelineStats.total > 0
                        ? `${Math.round((pipelineStats.success / pipelineStats.total) * 100)}% success rate`
                        : "0% success rate"}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-card p-6 hover:shadow-md transition-shadow border-red-200 bg-red-50/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Failed
                    </p>
                    <p className="text-3xl font-bold mt-2 text-red-700">
                      {pipelineStats.failure}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {pipelineStats.total > 0
                        ? `${Math.round((pipelineStats.failure / pipelineStats.total) * 100)}% failure rate`
                        : "0% failure rate"}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-card p-6 hover:shadow-md transition-shadow border-blue-200 bg-blue-50/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Running
                    </p>
                    <p className="text-3xl font-bold mt-2 text-blue-700">
                      {pipelineStats.running}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Currently executing
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 其他项目统计 */}
      <Card>
        <CardHeader>
          <CardTitle>Project Information</CardTitle>
          <CardDescription>
            Overview of project {projectId} information and statistics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Rocket className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Active Deployments
                  </p>
                  <p className="text-2xl font-bold mt-1">5</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Environments
                  </p>
                  <p className="text-2xl font-bold mt-1">3</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Team Members
                  </p>
                  <p className="text-2xl font-bold mt-1">8</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <GitBranch className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Pipelines
                  </p>
                  <p className="text-2xl font-bold mt-1">1</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectOverview;
