import type { FC } from "react";
import { Cloud, KeyRound, RefreshCw, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlaceholderPanel } from "@/components/placeholder-panel";

interface Secret {
  id: string;
  name: string;
  source: string;
  health: "healthy" | "warning" | "critical";
  consumers: number;
  expires?: string;
}

const SECRETS: Secret[] = [
  {
    id: "s1",
    name: "GitHub Token",
    source: "External Secrets Operator",
    health: "healthy",
    consumers: 4,
    expires: "90 days",
  },
  {
    id: "s2",
    name: "Docker Registry",
    source: "Manually managed",
    health: "warning",
    consumers: 2,
    expires: "No rotation",
  },
  {
    id: "s3",
    name: "GCP Credentials",
    source: "GCP Secret Manager",
    health: "critical",
    consumers: 3,
    expires: "5 days",
  },
  {
    id: "s4",
    name: "Stripe Webhook",
    source: "AWS Secrets Manager",
    health: "healthy",
    consumers: 1,
    expires: "180 days",
  },
];

function healthBadge(health: Secret["health"]) {
  if (health === "healthy") return <Badge variant="success">Healthy</Badge>;
  if (health === "warning") return <Badge variant="warning">Warning</Badge>;
  return <Badge variant="critical">Expiring</Badge>;
}

const SecureSecrets: FC = () => {
  return (
    <Tabs defaultValue="all" className="w-full">
      <TabsList>
        <TabsTrigger value="all">All Secrets</TabsTrigger>
        <TabsTrigger value="providers">Providers</TabsTrigger>
        <TabsTrigger value="rotation">Rotation</TabsTrigger>
        <TabsTrigger value="usage">Usage</TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="mt-4">
        <div className="grid gap-3">
          {SECRETS.map((secret) => (
            <Card
              key={secret.id}
              className="transition-colors hover:bg-accent/30"
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                  <KeyRound className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{secret.name}</span>
                    {healthBadge(secret.health)}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {secret.source} · used by {secret.consumers} pipeline
                    {secret.consumers === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="hidden text-right text-xs text-muted-foreground sm:block">
                  <div className="font-medium text-foreground">
                    {secret.expires}
                  </div>
                  <div>until rotation</div>
                </div>
                <Button size="sm" variant="outline">
                  Manage
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="providers" className="mt-4">
        <div className="grid gap-3 md:grid-cols-2">
          {[
            { name: "GCP Secret Manager", status: "connected", secrets: 6 },
            { name: "AWS Secrets Manager", status: "connected", secrets: 3 },
            { name: "HashiCorp Vault", status: "not connected", secrets: 0 },
            {
              name: "External Secrets Operator",
              status: "connected",
              secrets: 5,
            },
          ].map((provider) => (
            <Card key={provider.name}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Cloud className="h-4 w-4 text-muted-foreground" />
                  {provider.name}
                </CardTitle>
                {provider.status === "connected" ? (
                  <Badge variant="success">Connected</Badge>
                ) : (
                  <Badge variant="outline">Not connected</Badge>
                )}
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {provider.secrets > 0
                  ? `${provider.secrets} secrets synced`
                  : "Connect to start syncing secrets"}
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="rotation" className="mt-4">
        <PlaceholderPanel
          icon={RefreshCw}
          title="Rotation schedule"
          description="Automated secret rotation, expiry alerts and renewal jobs are coming soon."
        />
      </TabsContent>

      <TabsContent value="usage" className="mt-4">
        <PlaceholderPanel
          icon={Wrench}
          title="Secret usage map"
          description="See which pipelines, agents and environments consume each secret."
        />
      </TabsContent>
    </Tabs>
  );
};

export default SecureSecrets;
