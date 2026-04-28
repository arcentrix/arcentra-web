/**
 * Project Detail 布局页面 - 作为项目子页面的布局容器
 */

import type { FC } from "react";
import { Outlet, useLocation, useParams } from "react-router-dom";
import { Frame } from "lucide-react";
import { ProjectTabs } from "@/components/project-tabs";

const ProjectDetail: FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <Frame className="h-8 w-8 text-blue-500" />
            Project {projectId}
          </h2>
          <p className="mt-1 text-muted-foreground">
            Manage project resources and configurations
          </p>
        </div>
      </div>

      {projectId && (
        <ProjectTabs projectId={projectId} pathname={location.pathname} />
      )}

      <Outlet />
    </div>
  );
};

export default ProjectDetail;
