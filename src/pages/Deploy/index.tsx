import { type FC } from "react";
import { ArrowUpRight, RefreshCw, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import {
  Panel,
  PanelHeader,
  MetaRow,
  SectionEyebrow,
  StatusDot,
  StatusBadge,
  ColumnHead,
  type DotTone,
  type BadgeTone,
} from "@/components/blueprint";

/* ─────────────────────── 静态原型数据 ───────────────────────── */

interface EnvData {
  name: string;
  region: string;
  revision: string;
  status: DotTone;
  age: string;
  lastDeploy: string;
  strategy: string;
}

const ENVS: EnvData[] = [
  {
    name: "production",
    region: "eu-west-1",
    revision: "v2.3.7",
    status: "running",
    age: "rolling 4/8",
    lastDeploy: "12m ago",
    strategy: "canary 25%",
  },
  {
    name: "staging",
    region: "eu-west-1",
    revision: "v2.4.0-rc.2",
    status: "ok",
    age: "stable",
    lastDeploy: "2h ago",
    strategy: "rolling",
  },
  {
    name: "dev",
    region: "us-east-2",
    revision: "v2.4.0-rc.3",
    status: "ok",
    age: "stable",
    lastDeploy: "12m ago",
    strategy: "recreate",
  },
];

interface ReleaseRow {
  version: string;
  env: string;
  status: BadgeTone;
  /** 部署语境下的状态文案，覆盖 StatusBadge 的默认标签。 */
  statusLabel: string;
  when: string;
  by: string;
  strategy: string;
  progress: string;
}

const RELEASES: ReleaseRow[] = [
  {
    version: "v2.4.0-rc.3",
    env: "dev",
    status: "ok",
    statusLabel: "Deployed",
    when: "12m ago",
    by: "e.chen",
    strategy: "rolling",
    progress: "—",
  },
  {
    version: "v2.4.0-rc.2",
    env: "staging",
    status: "ok",
    statusLabel: "Deployed",
    when: "2h ago",
    by: "mark.weber",
    strategy: "rolling",
    progress: "—",
  },
  {
    version: "v2.4.0-rc.1",
    env: "dev",
    status: "ok",
    statusLabel: "Deployed",
    when: "6h ago",
    by: "j.park",
    strategy: "rolling",
    progress: "—",
  },
  {
    version: "v2.3.8",
    env: "production",
    status: "running",
    statusLabel: "Rolling",
    when: "12m ago",
    by: "e.chen",
    strategy: "canary 25%",
    progress: "4/8 pods",
  },
  {
    version: "v2.3.7",
    env: "production",
    status: "ok",
    statusLabel: "Deployed",
    when: "1d ago",
    by: "e.chen",
    strategy: "blue-green",
    progress: "—",
  },
  {
    version: "v2.3.6",
    env: "production",
    status: "fail",
    statusLabel: "Rolled back",
    when: "2d ago",
    by: "deploy-bot",
    strategy: "rolled back",
    progress: "—",
  },
  {
    version: "v2.3.5",
    env: "production",
    status: "ok",
    statusLabel: "Deployed",
    when: "3d ago",
    by: "mark.weber",
    strategy: "rolling",
    progress: "—",
  },
];

/* ─────────────────────── 环境卡 ────────────────────────────── */

function EnvironmentCard({ env }: { env: EnvData }) {
  return (
    <Panel className="flex flex-col">
      {/* 主体 */}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between">
          <SectionEyebrow>{env.region}</SectionEyebrow>
          <StatusDot tone={env.status} pulse={env.status === "running"} />
        </div>
        <h3 className="display mt-2.5 text-[22px] font-semibold tracking-[-0.02em]">
          {env.name}
        </h3>
        <div className="mt-4 flex flex-col gap-1.5">
          <MetaRow label="Revision" value={env.revision} mono />
          <MetaRow label="State" value={env.age} mono={false} />
          <MetaRow label="Strategy" value={env.strategy} mono={false} />
          <MetaRow label="Updated" value={env.lastDeploy} mono={false} />
        </div>
      </div>

      {/* 操作栏 */}
      <div className="flex gap-1.5 border-t px-3 py-3">
        <Button variant="outline" size="sm">
          View
        </Button>
        <Button variant="ghost" size="sm">
          Rollback
        </Button>
        <Button variant="ghost" size="sm" className="ml-auto gap-1">
          Logs
          <ArrowUpRight className="h-3 w-3" />
        </Button>
      </div>
    </Panel>
  );
}

/* ─────────────────────── 主页面 ────────────────────────────── */

const Deploy: FC = () => {
  return (
    <section className="flex flex-1 flex-col gap-6 p-8">
      {/* 页头 */}
      <PageHeader
        eyebrow="deploy / environments"
        title="Deploy"
        sub="Environments, releases and GitOps reconciliation across your fleet."
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Sync
            </Button>
            <Button size="sm" className="gap-1.5">
              <Rocket className="h-3.5 w-3.5" />
              Release
            </Button>
          </div>
        }
      />

      {/* 3 个环境卡 — 等宽三列 */}
      <div className="grid grid-cols-3 gap-4">
        {ENVS.map((env) => (
          <EnvironmentCard key={env.name} env={env} />
        ))}
      </div>

      {/* 发布历史表 */}
      <Panel>
        <PanelHeader
          title="Release history"
          sub="Last 7 releases · production · staging · dev"
          action={
            <Button variant="outline" size="sm" className="gap-1.5">
              View all
              <ArrowUpRight className="h-3 w-3" />
            </Button>
          }
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <ColumnHead>Version</ColumnHead>
              </TableHead>
              <TableHead>
                <ColumnHead>Env</ColumnHead>
              </TableHead>
              <TableHead>
                <ColumnHead>Status</ColumnHead>
              </TableHead>
              <TableHead>
                <ColumnHead>When</ColumnHead>
              </TableHead>
              <TableHead>
                <ColumnHead>By</ColumnHead>
              </TableHead>
              <TableHead>
                <ColumnHead>Strategy</ColumnHead>
              </TableHead>
              <TableHead className="text-right">
                <ColumnHead>Progress</ColumnHead>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {RELEASES.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-[13px] font-medium">
                  {r.version}
                </TableCell>
                <TableCell className="text-[13px]">{r.env}</TableCell>
                <TableCell>
                  <StatusBadge tone={r.status}>{r.statusLabel}</StatusBadge>
                </TableCell>
                <TableCell className="text-[13px] text-fg-muted">
                  {r.when}
                </TableCell>
                <TableCell className="text-[13px]">{r.by}</TableCell>
                <TableCell className="text-[13px] text-fg-muted">
                  {r.strategy}
                </TableCell>
                <TableCell className="text-right font-mono text-[11.5px] text-fg-muted">
                  {r.progress}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </section>
  );
};

export default Deploy;
