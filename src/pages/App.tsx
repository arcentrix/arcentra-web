import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { ToastContainer } from "react-toastify";
import { useTheme } from "@/hooks/use-theme";
import AuthGuard from "@/components/Layouts/AuthGuard";
import DefaultLayouts from "@/components/Layouts/default";
import DockLayout from "@/components/Layouts/dock-layout";
import permissionStore from "@/store/permission";
import { buildDynamicRoutes } from "@/router/build-dynamic-routes";
import Login from "./Login";
import Register from "./Register";
import Forbidden from "./Forbidden";
import { AuthCallback } from "./AuthCallback";
import NotFound from "./NotFound";
import "react-toastify/dist/ReactToastify.css";

const AccountPage = lazy(() => import("./Account"));
const ChatPage = lazy(() => import("./Copilot"));
const InboxPage = lazy(() => import("./Inbox"));
const AgentsDetailPage = lazy(() => import("./Models/Agents/Detail"));
const ProjectDetailPage = lazy(() => import("./Projects/Detail"));
const ProjectOverviewPage = lazy(() => import("./Projects/Detail/Overview"));
const ProjectPipelinesPage = lazy(() => import("./Project/Pipelines"));
const PipelineHistoryPage = lazy(() => import("./Project/Pipelines/History"));
const PipelineDetailPage = lazy(() => import("./Project/Pipelines/Detail"));
const ProjectDeploymentsPage = lazy(() => import("./Project/Deployments"));
const ProjectArtifactsPage = lazy(() => import("./Project/Artifacts"));
const ProjectEnvironmentsPage = lazy(() => import("./Project/Environments"));
const ProjectSecretsPage = lazy(() => import("./Project/Secrets"));
const ProjectSettingsPage = lazy(() => import("./Project/Settings"));
const ProjectMembersPage = lazy(() => import("./Project/Members"));

/** 懒加载页面的 Suspense 包裹。 */
function Lazy({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm text-muted-foreground">Loading...</div>
      }
    >
      {children}
    </Suspense>
  );
}

function PermissionLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Loading workspace...
    </div>
  );
}

function App() {
  const { resolvedTheme } = useTheme();
  const permission = permissionStore.useState();

  let protectedRoutes: React.ReactNode;
  if (!permission.initialized) {
    protectedRoutes = <Route path="*" element={<PermissionLoading />} />;
  } else if (permission.menus.length > 0) {
    protectedRoutes = (
      <>
        <Route element={<Forbidden />} path="/403" />
        {buildDynamicRoutes(permission.menus)}
      </>
    );
  } else {
    protectedRoutes = (
      <>
        <Route element={<Forbidden />} path="/403" />
        <Route path="*" element={<Navigate to="/403" replace />} />
      </>
    );
  }

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route element={<DefaultLayouts />}>
            <Route element={<AuthGuard />}>
              <Route element={<DockLayout />}>
                {/* 静态页：登录后始终可达，不走后端动态菜单 */}
                <Route
                  path="/account"
                  element={
                    <Lazy>
                      <AccountPage />
                    </Lazy>
                  }
                />
                <Route
                  path="/workspace/:workspaceName/chat"
                  element={
                    <Lazy>
                      <ChatPage />
                    </Lazy>
                  }
                />
                <Route
                  path="/inbox"
                  element={
                    <Lazy>
                      <InboxPage />
                    </Lazy>
                  }
                />
                <Route
                  path="/agents/:id"
                  element={
                    <Lazy>
                      <AgentsDetailPage />
                    </Lazy>
                  }
                />
                {/* 项目详情：抽屉式下钻页，含 8 个嵌套子标签 */}
                <Route
                  path="/projects/:projectId"
                  element={
                    <Lazy>
                      <ProjectDetailPage />
                    </Lazy>
                  }
                >
                  <Route
                    index
                    element={
                      <Lazy>
                        <ProjectOverviewPage />
                      </Lazy>
                    }
                  />
                  <Route
                    path="pipelines"
                    element={
                      <Lazy>
                        <ProjectPipelinesPage />
                      </Lazy>
                    }
                  />
                  <Route
                    path="pipelines/runs"
                    element={
                      <Lazy>
                        <PipelineHistoryPage />
                      </Lazy>
                    }
                  />
                  <Route
                    path="pipelines/:id"
                    element={
                      <Lazy>
                        <PipelineDetailPage />
                      </Lazy>
                    }
                  />
                  <Route
                    path="deployments"
                    element={
                      <Lazy>
                        <ProjectDeploymentsPage />
                      </Lazy>
                    }
                  />
                  <Route
                    path="artifacts"
                    element={
                      <Lazy>
                        <ProjectArtifactsPage />
                      </Lazy>
                    }
                  />
                  <Route
                    path="environments"
                    element={
                      <Lazy>
                        <ProjectEnvironmentsPage />
                      </Lazy>
                    }
                  />
                  <Route
                    path="secrets"
                    element={
                      <Lazy>
                        <ProjectSecretsPage />
                      </Lazy>
                    }
                  />
                  <Route
                    path="settings"
                    element={
                      <Lazy>
                        <ProjectSettingsPage />
                      </Lazy>
                    }
                  />
                  <Route
                    path="members"
                    element={
                      <Lazy>
                        <ProjectMembersPage />
                      </Lazy>
                    }
                  />
                </Route>
                {protectedRoutes}
              </Route>
            </Route>
            <Route element={<Login />} path="/login" />
            <Route element={<Register />} path="/register" />
            <Route element={<AuthCallback />} path="/auth/callback/:type" />
            <Route element={<NotFound />} path="*" />
          </Route>
        </Routes>
      </BrowserRouter>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        icon={false}
        toastClassName="text-sm"
      />
    </>
  );
}

export default App;
