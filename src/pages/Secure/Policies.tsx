import type { FC } from "react";
import {
  CheckCircle2,
  GitMerge,
  Lock,
  ShieldCheck,
  ShieldX,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlaceholderPanel } from "@/components/placeholder-panel";

interface Policy {
  id: string;
  title: string;
  description: string;
  status: "active" | "warning" | "disabled";
  scope: string;
  icon: LucideIcon;
}

const POLICIES: Policy[] = [
  {
    id: "p1",
    title: "Production deploy requires approval",
    description:
      "At least 1 approver from the maintainers team must approve before promote.",
    status: "active",
    scope: "Environments: production",
    icon: ShieldCheck,
  },
  {
    id: "p2",
    title: "Secrets cannot be exposed to public runners",
    description:
      "Pipelines using `public-cloud` agent pool cannot access secret scope `prod:*`.",
    status: "active",
    scope: "Agent pools: public-cloud",
    icon: Lock,
  },
  {
    id: "p3",
    title: "Admin role requires MFA",
    description:
      "Members with the Admin role must have MFA enabled within 24 hours.",
    status: "warning",
    scope: "Identity: 2 admins without MFA",
    icon: ShieldX,
  },
  {
    id: "p4",
    title: "External agents need scoped runner tokens",
    description:
      "Agents registered outside the cluster require tokens limited to `build:*`.",
    status: "active",
    scope: "Agents: external",
    icon: ShieldCheck,
  },
];

function policyBadge(status: Policy["status"]) {
  if (status === "active")
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Enforced
      </Badge>
    );
  if (status === "warning")
    return (
      <Badge variant="warning" className="gap-1">
        <ShieldX className="h-3 w-3" />
        Violated
      </Badge>
    );
  return <Badge variant="secondary">Disabled</Badge>;
}

const SecurePolicies: FC = () => {
  return (
    <Tabs defaultValue="access" className="w-full">
      <TabsList>
        <TabsTrigger value="access">Access Policies</TabsTrigger>
        <TabsTrigger value="deployment">Deployment Rules</TabsTrigger>
        <TabsTrigger value="approval">Approval Flows</TabsTrigger>
        <TabsTrigger value="enforcement">Enforcement</TabsTrigger>
      </TabsList>

      <TabsContent value="access" className="mt-4">
        <div className="grid gap-3">
          {POLICIES.map((policy) => (
            <Card
              key={policy.id}
              className="transition-colors hover:bg-accent/30"
            >
              <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                  <policy.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{policy.title}</CardTitle>
                    {policyBadge(policy.status)}
                  </div>
                  <CardDescription className="mt-1">
                    {policy.description}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between pl-[60px]">
                <span className="text-xs text-muted-foreground">
                  {policy.scope}
                </span>
                <Button size="sm" variant="ghost">
                  Edit
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="deployment" className="mt-4">
        <PlaceholderPanel
          icon={GitMerge}
          title="Deployment gates"
          description="Branch protection, environment guards and deploy windows."
        />
      </TabsContent>

      <TabsContent value="approval" className="mt-4">
        <PlaceholderPanel
          icon={CheckCircle2}
          title="Approval flows"
          description="Multi-step approval, code-owner reviews and break-glass overrides."
        />
      </TabsContent>

      <TabsContent value="enforcement" className="mt-4">
        <PlaceholderPanel
          icon={Lock}
          title="Enforcement & exceptions"
          description="Track which workloads bypass policies and why."
        />
      </TabsContent>
    </Tabs>
  );
};

export default SecurePolicies;
