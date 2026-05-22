import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  LayoutDashboard,
  MailQuestion,
  ShieldOff,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import permissionStore, {
  type PermissionMenuItem,
} from "@/store/permission";
import userStore from "@/store/user";
import type { UserRole } from "@/models/user";

interface ForbiddenLocationState {
  from?: string;
}

function findMenuByPath(
  menus: readonly PermissionMenuItem[],
  pathname: string,
): PermissionMenuItem | null {
  for (const menu of menus) {
    if (menu.path && menu.path === pathname) {
      return menu;
    }
    if (menu.children?.length) {
      const found = findMenuByPath(menu.children, pathname);
      if (found) return found;
    }
  }
  return null;
}

function resolveRoleLabel(role: UserRole | null | undefined): string | null {
  if (!role) return null;
  if (typeof role === "string") return role;
  return role.displayName ?? role.name ?? role.roleId ?? null;
}

interface DetailRowProps {
  label: string;
  children: ReactNode;
  className?: string;
}

function DetailRow({ label, children, className }: DetailRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-3 text-sm",
        className,
      )}
    >
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 max-w-[60%] truncate text-right font-medium text-foreground">
        {children}
      </dd>
    </div>
  );
}

export default function Forbidden() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ForbiddenLocationState | null;
  const fromPath = state?.from ?? null;

  const permission = permissionStore.useState();
  const user = userStore.useState();

  useEffect(() => {
    if (fromPath) {
      return;
    }
    if (!permission.initialized || permission.menus.length === 0) {
      return;
    }
    const firstMenu = permission.menus.find((menu) => menu.path);
    navigate(firstMenu?.path ?? "/", { replace: true });
  }, [fromPath, permission.initialized, permission.menus, navigate]);

  const { resourceLabel, requiredPermission } = useMemo(() => {
    if (!fromPath) {
      return {
        resourceLabel: null as string | null,
        requiredPermission: null as string | null,
      };
    }
    const matched = findMenuByPath(permission.menus, fromPath);
    return {
      resourceLabel:
        matched?.title ?? matched?.name ?? fromPath ?? null,
      requiredPermission: matched?.permissionAction ?? null,
    };
  }, [fromPath, permission.menus]);

  const userRoleLabel = resolveRoleLabel(user.role);
  // TODO: replace with the active workspace/organization from a global store
  // once the org switcher state is hoisted out of the top command bar.
  const workspaceLabel = "Arcentra";

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/", { replace: true });
  };

  const handleRequestAccess = () => {
    const subject = encodeURIComponent("Access request");
    const bodyLines = [
      "Hi,",
      "",
      "I'm requesting access to the following resource in Arcentra:",
      `- Resource: ${resourceLabel ?? "(not specified)"}`,
      `- Path: ${fromPath ?? "(not specified)"}`,
      requiredPermission
        ? `- Required permission: ${requiredPermission}`
        : null,
      `- My role: ${userRoleLabel ?? "(unknown)"}`,
      "",
      "Thanks.",
    ].filter(Boolean) as string[];
    const body = encodeURIComponent(bodyLines.join("\n"));
    window.location.href = `mailto:admin@arcentra.io?subject=${subject}&body=${body}`;
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col px-6 pb-16 pt-[12vh]">
      <div className="flex flex-col items-center text-center">
        <div
          aria-hidden
          className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground"
        >
          <ShieldOff className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
          Access denied
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-mono text-xs text-muted-foreground/80">
            403
          </span>
          <span className="mx-1.5 text-muted-foreground/50">·</span>
          You don&apos;t have permission to access this page in the current
          workspace.
        </p>
      </div>

      <div className="mt-8 rounded-lg border border-border/80 bg-card text-card-foreground">
        <dl className="divide-y divide-border/60 px-5">
          <DetailRow label="Workspace">
            <span className="inline-flex items-center gap-1.5">
              <Workflow
                aria-hidden
                className="h-3.5 w-3.5 text-muted-foreground"
              />
              {workspaceLabel}
            </span>
          </DetailRow>
          <DetailRow label="Resource">
            {resourceLabel ?? (
              <span className="text-muted-foreground">—</span>
            )}
          </DetailRow>
          <DetailRow label="Your role">
            {userRoleLabel ?? (
              <span className="text-muted-foreground">—</span>
            )}
          </DetailRow>
          <DetailRow label="Required permission">
            {requiredPermission ? (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                {requiredPermission}
              </code>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </DetailRow>
        </dl>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-center">
        <Button variant="outline" onClick={handleBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Go back
        </Button>
        <Button asChild className="gap-1.5">
          <Link to="/">
            <LayoutDashboard className="h-4 w-4" />
            Go to Overview
          </Link>
        </Button>
      </div>

      <div className="mt-3 flex justify-center">
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={handleRequestAccess}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <MailQuestion className="h-3.5 w-3.5" />
          Request access
        </Button>
      </div>

      <section
        aria-labelledby="forbidden-why"
        className="mt-10 rounded-lg border border-dashed border-border/70 bg-muted/20 px-5 py-4"
      >
        <h2
          id="forbidden-why"
          className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          Why am I seeing this?
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-foreground/80">
          <li className="flex gap-2">
            <span
              aria-hidden
              className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60"
            />
            Your current role does not include access to this module.
          </li>
          <li className="flex gap-2">
            <span
              aria-hidden
              className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60"
            />
            The resource may be restricted to workspace administrators.
          </li>
          <li className="flex gap-2">
            <span
              aria-hidden
              className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60"
            />
            You may be in the wrong workspace or project.
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Need access? Contact your workspace administrator.
        </p>
      </section>
    </div>
  );
}
