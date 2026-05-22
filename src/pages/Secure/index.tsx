import { useEffect, useState, type FC } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import SecureOverview from "./Overview";
import SecureIdentity from "./Identity";
import SecureSecrets from "./Secrets";
import SecurePolicies from "./Policies";
import SecureAudit from "./Audit";
import { UsersPanel } from "@/pages/Users";
import { RolesPanel } from "@/pages/Roles";

type SecureTab =
  | "overview"
  | "users"
  | "roles"
  | "identity"
  | "secrets"
  | "policies"
  | "audit";

const VALID_TABS: SecureTab[] = [
  "overview",
  "users",
  "roles",
  "identity",
  "secrets",
  "policies",
  "audit",
];

const TAB_LABELS: Record<SecureTab, string> = {
  overview: "Overview",
  users: "Users",
  roles: "Roles",
  identity: "Identity",
  secrets: "Secrets",
  policies: "Policies",
  audit: "Audit",
};

function isSecureTab(value: string | null): value is SecureTab {
  return !!value && (VALID_TABS as string[]).includes(value);
}

const Secure: FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab: SecureTab = isSecureTab(rawTab) ? rawTab : "overview";

  // strip invalid tab params from URL
  useEffect(() => {
    if (rawTab && !isSecureTab(rawTab)) {
      const next = new URLSearchParams(searchParams);
      next.delete("tab");
      setSearchParams(next, { replace: true });
    }
  }, [rawTab, searchParams, setSearchParams]);

  const onTabChange = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    setSearchParams(params, { replace: true });
  };

  // SecureIdentity 仍按既有契约接收 invite 控制属性。
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <section className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader
        eyebrow="workspace / security"
        title="Secure"
        sub="Control identity, users, roles, secrets, policies and audit trails across this workspace."
      />

      <Tabs value={tab} onValueChange={onTabChange} className="w-full">
        <TabsList className="h-auto rounded-[10px] border bg-bg-elevated p-1">
          {VALID_TABS.map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              className="h-7 text-[13px] text-fg-muted data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_0_0_1px_var(--border-strong)]"
            >
              {TAB_LABELS[t]}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <SecureOverview onNavigate={(t) => onTabChange(t)} />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <UsersPanel headless />
        </TabsContent>
        <TabsContent value="roles" className="mt-6">
          <RolesPanel headless />
        </TabsContent>
        <TabsContent value="identity" className="mt-6">
          <SecureIdentity
            inviteOpen={inviteOpen}
            onInviteOpenChange={setInviteOpen}
          />
        </TabsContent>
        <TabsContent value="secrets" className="mt-6">
          <SecureSecrets />
        </TabsContent>
        <TabsContent value="policies" className="mt-6">
          <SecurePolicies />
        </TabsContent>
        <TabsContent value="audit" className="mt-6">
          <SecureAudit />
        </TabsContent>
      </Tabs>
    </section>
  );
};

export default Secure;
