/**
 * ProjectDetail 布局容器 — Engineering Blueprint 重做版本
 *
 * 路由机制完全保留：useParams / Outlet / useLocation 不变；
 * 仅重写页面顶部 header 视觉和标签条样式。
 */

import type { FC } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Github, Play, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectTabs } from "@/components/project-tabs";
import { SectionEyebrow } from "@/components/blueprint";

const ProjectDetail: FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <section className="flex flex-1 flex-col gap-6 p-8">
      {/* ── 顶部 header ─────────────────────────────────────────── */}
      <div>
        {/* 返回链接 */}
        <button
          type="button"
          onClick={() => navigate("/projects")}
          className="mb-2 inline-flex cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-2 py-1 text-[12px] text-fg-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Projects
        </button>

        {/* 标题区 + 操作按钮 */}
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <SectionEyebrow>project / workspace</SectionEyebrow>
            <h2 className="display mt-2 text-[30px]">
              {projectId ?? "Project"}
            </h2>
            <p className="mt-1.5 max-w-[600px] text-[13px] text-fg-muted">
              Manage project resources, pipelines, deployments and configuration.
            </p>
            {/* meta 串：repo · owner */}
            <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-[11.5px] text-fg-subtle">
              <span className="inline-flex items-center gap-1.5">
                <Github className="h-3 w-3" />
                arcentrix/{projectId}
              </span>
              <span aria-hidden>·</span>
              <span>maintained by <span className="text-fg-muted">@team</span></span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm">
              <Play className="mr-1.5 h-3.5 w-3.5" />
              Run pipeline
            </Button>
            <Button size="sm">
              <Rocket className="mr-1.5 h-3.5 w-3.5" />
              Deploy
            </Button>
          </div>
        </div>
      </div>

      {/* ── 子标签条 ────────────────────────────────────────────── */}
      {projectId && (
        <ProjectTabs projectId={projectId} pathname={location.pathname} />
      )}

      {/* ── 子页面内容（Outlet 保持不变） ────────────────────────── */}
      <Outlet />
    </section>
  );
};

export default ProjectDetail;
