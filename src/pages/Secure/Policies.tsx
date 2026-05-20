import { useEffect, useMemo, useState, type FC } from "react";
import {
  CheckCircle2,
  Lock,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast";
import { Apis } from "@/api";
import type {
  ApprovalPolicy,
  CreateApprovalPolicyRequest,
  PolicyScopeType,
} from "@/api/policy/types";

const SCOPES: { value: PolicyScopeType; label: string }[] = [
  { value: "platform", label: "Platform" },
  { value: "org", label: "Organization" },
  { value: "project", label: "Project" },
  { value: "pipeline", label: "Pipeline" },
];

const MODES: { value: ApprovalPolicy["mode"]; label: string }[] = [
  { value: "any", label: "Any approver" },
  { value: "parallel", label: "Parallel" },
  { value: "serial", label: "Serial" },
];

interface PolicyFormState {
  name: string;
  scopeType: PolicyScopeType;
  scopeId: string;
  description: string;
  mode: ApprovalPolicy["mode"];
  minApprovals: number;
  timeoutSeconds: number;
  matchRule: string;
  approverRule: string;
  enabled: number;
}

const DEFAULT_FORM: PolicyFormState = {
  name: "",
  scopeType: "platform",
  scopeId: "",
  description: "",
  mode: "any",
  minApprovals: 1,
  timeoutSeconds: 3600,
  matchRule: "{}",
  approverRule: "{}",
  enabled: 1,
};

function parseJSON(input: string): unknown {
  if (!input.trim()) return {};
  return JSON.parse(input);
}

function formatJSON(value: unknown): string {
  if (value === null || value === undefined) return "{}";
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}

const SecurePolicies: FC = () => {
  const [policies, setPolicies] = useState<ApprovalPolicy[]>([]);
  const [loading, setLoading] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<PolicyScopeType>("platform");
  const [scopeIdFilter, setScopeIdFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<PolicyFormState>(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadPolicies = async () => {
    setLoading(true);
    try {
      const response = await Apis.policy.listApprovalPolicies(
        scopeFilter,
        scopeIdFilter || undefined,
      );
      setPolicies(response.policies ?? []);
    } catch (error) {
      console.error("Failed to load approval policies", error);
      toast.error("Failed to load approval policies");
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPolicies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeFilter]);

  const openCreateDialog = () => {
    setEditingId(null);
    setForm({ ...DEFAULT_FORM, scopeType: scopeFilter, scopeId: scopeIdFilter });
    setDialogOpen(true);
  };

  const openEditDialog = (policy: ApprovalPolicy) => {
    setEditingId(policy.policyId);
    setForm({
      name: policy.name,
      scopeType: policy.scopeType,
      scopeId: policy.scopeId,
      description: policy.description ?? "",
      mode: policy.mode,
      minApprovals: policy.minApprovals,
      timeoutSeconds: policy.timeoutSeconds,
      matchRule: formatJSON(policy.matchRule),
      approverRule: formatJSON(policy.approverRule),
      enabled: policy.enabled,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Policy name is required");
      return;
    }
    let matchRule: unknown;
    let approverRule: unknown;
    try {
      matchRule = parseJSON(form.matchRule);
    } catch {
      toast.error("Match rule must be valid JSON");
      return;
    }
    try {
      approverRule = parseJSON(form.approverRule);
    } catch {
      toast.error("Approver rule must be valid JSON");
      return;
    }
    setSubmitting(true);
    try {
      const payload: CreateApprovalPolicyRequest = {
        scopeType: form.scopeType,
        scopeId: form.scopeId,
        name: form.name.trim(),
        description: form.description,
        mode: form.mode,
        minApprovals: Number(form.minApprovals) || 1,
        timeoutSeconds: Number(form.timeoutSeconds) || 3600,
        matchRule: matchRule as CreateApprovalPolicyRequest["matchRule"],
        approverRule: approverRule as CreateApprovalPolicyRequest["approverRule"],
        enabled: form.enabled,
      };
      if (editingId) {
        await Apis.policy.updateApprovalPolicy(editingId, payload);
        toast.success("Approval policy updated");
      } else {
        await Apis.policy.createApprovalPolicy(payload);
        toast.success("Approval policy created");
      }
      setDialogOpen(false);
      await loadPolicies();
    } catch (error) {
      console.error("Failed to save approval policy", error);
      toast.error(
        editingId
          ? "Failed to update approval policy"
          : "Failed to create approval policy",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (policy: ApprovalPolicy) => {
    if (!confirm(`Delete policy "${policy.name}"?`)) {
      return;
    }
    try {
      await Apis.policy.deleteApprovalPolicy(policy.policyId);
      toast.success("Approval policy deleted");
      await loadPolicies();
    } catch (error) {
      console.error("Failed to delete approval policy", error);
      toast.error("Failed to delete approval policy");
    }
  };

  const summary = useMemo(() => {
    const enabled = policies.filter((p) => p.enabled === 1).length;
    return {
      total: policies.length,
      enabled,
      disabled: policies.length - enabled,
    };
  }, [policies]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            Approval Policies
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure approval rules for protected operations (release / deploy / sensitive resources).
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Scope</Label>
            <Select
              value={scopeFilter}
              onValueChange={(value) =>
                setScopeFilter(value as PolicyScopeType)
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPES.map((scope) => (
                  <SelectItem key={scope.value} value={scope.value}>
                    {scope.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Scope ID</Label>
            <Input
              value={scopeIdFilter}
              onChange={(event) => setScopeIdFilter(event.target.value)}
              placeholder="(optional)"
              className="w-[220px]"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void loadPolicies();
                }
              }}
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void loadPolicies()}
            disabled={loading}
            aria-label="Reload"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={openCreateDialog} className="gap-1.5">
            <Plus className="h-4 w-4" />
            New policy
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Total</CardDescription>
            <CardTitle className="text-2xl">{summary.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Enabled</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              {summary.enabled}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Disabled</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              {summary.disabled}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Skeleton key={idx} className="h-24 w-full" />
          ))}
        </div>
      ) : policies.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <Lock className="mb-2 h-8 w-8 text-muted-foreground" />
            <CardTitle className="text-base">No approval policies</CardTitle>
            <CardDescription>
              Define rules to gate sensitive operations (e.g. production deploys).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-6">
            <Button onClick={openCreateDialog} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Create first policy
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {policies.map((policy) => (
            <Card key={policy.policyId} className="hover:bg-accent/30">
              <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="truncate text-base">
                      {policy.name}
                    </CardTitle>
                    {policy.enabled === 1 ? (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Enabled
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Disabled</Badge>
                    )}
                  </div>
                  <CardDescription className="mt-1">
                    {policy.description || "No description"}
                  </CardDescription>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="outline">{policy.scopeType}</Badge>
                    {policy.scopeId ? (
                      <Badge variant="outline">scope: {policy.scopeId}</Badge>
                    ) : null}
                    <Badge variant="outline">mode: {policy.mode}</Badge>
                    <Badge variant="outline">
                      min approvals: {policy.minApprovals}
                    </Badge>
                    <Badge variant="outline">
                      timeout: {policy.timeoutSeconds}s
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-end gap-2 pl-[60px]">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openEditDialog(policy)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-500 hover:text-red-600"
                  onClick={() => void handleDelete(policy)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit approval policy" : "New approval policy"}
            </DialogTitle>
            <DialogDescription>
              Approver matching uses JSON rules; refer to the documentation for the schema.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="policy-name">Name</Label>
              <Input
                id="policy-name"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g. prod-deploy-approval"
              />
            </div>
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select
                value={form.scopeType}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    scopeType: value as PolicyScopeType,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPES.map((scope) => (
                    <SelectItem key={scope.value} value={scope.value}>
                      {scope.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy-scope-id">Scope ID</Label>
              <Input
                id="policy-scope-id"
                value={form.scopeId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, scopeId: e.target.value }))
                }
                placeholder="(optional for platform)"
              />
            </div>
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select
                value={form.mode}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    mode: value as ApprovalPolicy["mode"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODES.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>
                      {mode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy-min">Min approvals</Label>
              <Input
                id="policy-min"
                type="number"
                min={1}
                value={form.minApprovals}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    minApprovals: Number(e.target.value) || 1,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy-timeout">Timeout (s)</Label>
              <Input
                id="policy-timeout"
                type="number"
                min={60}
                value={form.timeoutSeconds}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    timeoutSeconds: Number(e.target.value) || 3600,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={String(form.enabled)}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, enabled: Number(value) }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Enabled</SelectItem>
                  <SelectItem value="0">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="policy-description">Description</Label>
              <Textarea
                id="policy-description"
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="What does this policy gate?"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy-match">Match rule (JSON)</Label>
              <Textarea
                id="policy-match"
                value={form.matchRule}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, matchRule: e.target.value }))
                }
                rows={6}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy-approver">Approver rule (JSON)</Label>
              <Textarea
                id="policy-approver"
                value={form.approverRule}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    approverRule: e.target.value,
                  }))
                }
                rows={6}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting ? "Saving..." : editingId ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SecurePolicies;
