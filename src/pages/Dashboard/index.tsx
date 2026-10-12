import { useState, useEffect } from "react";
import type { FC, ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  type LucideIcon,
  Pause,
  Play,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
  Server,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { Apis } from "@/api";

/** 实时集群状态片 —— 等宽大写小标 + 信号色脉冲点。 */
function LiveClusterChip() {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
      <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-brand-signal" />
      cluster · running
    </span>
  );
}

/** 指标卡：等宽大写标签 + `.reading` 测量线读数 + 脚注。 */
function DashCard({
  label,
  value,
  icon: Icon,
  footer,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  footer: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-md border bg-background px-5 py-[18px]">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-medium uppercase tracking-[0.04em] text-fg-muted">
          {label}
        </span>
        <Icon className="h-4 w-4 text-fg-subtle" />
      </div>
      <span className="reading font-mono text-[30px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-foreground">
        {value}
      </span>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {footer}
      </p>
    </div>
  );
}

const Dashboard: FC = () => {
  const [agentStats, setAgentStats] = useState<{
    total: number;
    online: number;
    offline: number;
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const loadAgentStatistics = async () => {
      try {
        const stats = await Apis.agent.getAgentStatistics();
        setAgentStats(stats);
      } catch (error) {
        console.error("Failed to load agent statistics:", error);
      } finally {
        setLoadingStats(false);
      }
    };

    loadAgentStatistics();
  }, []);

  return (
    <section className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader
        eyebrow="system / overview"
        title="Control Plane"
        action={<LiveClusterChip />}
      />

      {/* 1. 总览卡片 - Pipeline 状态 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashCard
          label="Running"
          value="12"
          icon={Play}
          footer={
            <>
              <TrendingUp className="inline h-3 w-3 text-accent-success" />
              +3 from last hour
            </>
          }
        />
        <DashCard
          label="Success"
          value="847"
          icon={CheckCircle2}
          footer="94.2% success rate (24h)"
        />
        <DashCard
          label="Failed"
          value="52"
          icon={XCircle}
          footer={
            <>
              <TrendingDown className="inline h-3 w-3 text-accent-danger" />
              +12 from yesterday
            </>
          }
        />
        <DashCard
          label="Avg Duration"
          value="8m 42s"
          icon={Clock}
          footer="-1m 20s from last week"
        />
      </div>

      {/* 2. 效率指标卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <DashCard
          label="Deploy Frequency"
          value="47"
          icon={Zap}
          footer="Deployments per day"
        />
        <DashCard
          label="Lead Time"
          value="2.4h"
          icon={Activity}
          footer="Commit to production"
        />
        <DashCard
          label="MTTR"
          value="24m"
          icon={RefreshCw}
          footer="Mean time to recovery"
        />
      </div>

      {/* 3. 系统健康指标 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashCard
          label="Agents Online"
          icon={Server}
          value={
            loadingStats ? (
              <Skeleton className="h-7 w-20" />
            ) : agentStats ? (
              `${agentStats.online} / ${agentStats.total}`
            ) : (
              "--"
            )
          }
          footer={
            loadingStats ? (
              <Skeleton className="h-4 w-32" />
            ) : agentStats ? (
              agentStats.total > 0 ? (
                `${Math.round(
                  (agentStats.online / agentStats.total) * 100,
                )}% capacity available`
              ) : (
                "No agents"
              )
            ) : (
              ""
            )
          }
        />
        <DashCard
          label="Queue Length"
          value="3"
          icon={Pause}
          footer="Pipelines waiting"
        />
        <DashCard
          label="Change Failure Rate"
          value="5.8%"
          icon={AlertCircle}
          footer="Last 7 days"
        />
        <DashCard
          label="Execution Delay"
          value="1.2s"
          icon={Clock}
          footer="Avg trigger to start"
        />
      </div>

      {/* 4. 最近执行的 Pipelines 和团队统计 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 最近 Pipelines 执行 */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center">
            <div className="grid gap-1">
              <CardTitle className="display text-[17px]">Recent runs</CardTitle>
              <CardDescription>
                Last 10 across all projects · 24h window
              </CardDescription>
            </div>
            <Button
              asChild
              className="ml-auto gap-1"
              size="sm"
              variant="outline"
            >
              <Link to="/projects">
                View all
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pipeline</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Build & Deploy</TableCell>
                  <TableCell className="font-mono text-xs">web-app</TableCell>
                  <TableCell>
                    <Badge variant="success">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Success
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">8m 32s</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost">
                      View
                    </Button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Test Suite</TableCell>
                  <TableCell className="font-mono text-xs">
                    api-service
                  </TableCell>
                  <TableCell>
                    <Badge variant="critical">
                      <XCircle className="mr-1 h-3 w-3" />
                      Failed
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">4m 12s</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost">
                      <RefreshCw className="mr-1 h-3 w-3" />
                      Retry
                    </Button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Docker Build</TableCell>
                  <TableCell className="font-mono text-xs">
                    mobile-app
                  </TableCell>
                  <TableCell>
                    <Badge variant="info">
                      <Play className="mr-1 h-3 w-3" />
                      Running
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">2m 45s</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost">
                      View
                    </Button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">
                    Integration Test
                  </TableCell>
                  <TableCell className="font-mono text-xs">web-app</TableCell>
                  <TableCell>
                    <Badge variant="success">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Success
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">12m 08s</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost">
                      View
                    </Button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">E2E Tests</TableCell>
                  <TableCell className="font-mono text-xs">web-app</TableCell>
                  <TableCell>
                    <Badge variant="warning">
                      <Pause className="mr-1 h-3 w-3" />
                      Queued
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">--</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost">
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 项目/团队统计 */}
        <Card>
          <CardHeader>
            <CardTitle className="display text-[17px]">Projects</CardTitle>
            <CardDescription>Performance by project</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">web-app</p>
                <p className="font-mono text-xs text-muted-foreground">
                  42 runs · 95.2% success
                </p>
              </div>
              <Badge variant="success">Healthy</Badge>
            </div>
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">api-service</p>
                <p className="font-mono text-xs text-muted-foreground">
                  38 runs · 87.5% success
                </p>
              </div>
              <Badge variant="warning">Warning</Badge>
            </div>
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">mobile-app</p>
                <p className="font-mono text-xs text-muted-foreground">
                  29 runs · 96.5% success
                </p>
              </div>
              <Badge variant="success">Healthy</Badge>
            </div>
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">
                  data-pipeline
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  15 runs · 73.3% success
                </p>
              </div>
              <Badge variant="critical">Critical</Badge>
            </div>
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">
                  infrastructure
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  8 runs · 100% success
                </p>
              </div>
              <Badge variant="success">Healthy</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default Dashboard;
