import { useEffect, useMemo, useState } from "react";
import {
  Crown,
  Edit,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { Apis } from "@/api";
import type {
  CreatePermissionRequest,
  PermissionDictItem,
} from "@/api/permission/types";

const SCOPE_OPTIONS = [
  { value: "platform", label: "Platform" },
  { value: "org", label: "Organization" },
  { value: "project", label: "Project" },
  { value: "team", label: "Team" },
  { value: "pipeline", label: "Pipeline" },
];

interface PermissionFormState {
  permissionId: string;
  resourceType: string;
  action: string;
  scopeType: string;
  description: string;
}

const DEFAULT_FORM: PermissionFormState = {
  permissionId: "",
  resourceType: "",
  action: "",
  scopeType: "project",
  description: "",
};

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<PermissionDictItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [resourceFilter, setResourceFilter] = useState<string>("all");
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PermissionFormState>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const response = await Apis.permission.listPermissions();
      setPermissions(response.permissions ?? []);
    } catch (error) {
      console.error("Failed to load permissions", error);
      toast.error("Failed to load permissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPermissions();
  }, []);

  const resourceTypes = useMemo(() => {
    const set = new Set<string>();
    permissions.forEach((item) => set.add(item.resourceType));
    return Array.from(set).sort();
  }, [permissions]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return permissions.filter((item) => {
      if (resourceFilter !== "all" && item.resourceType !== resourceFilter) {
        return false;
      }
      if (scopeFilter !== "all" && item.scopeType !== scopeFilter) {
        return false;
      }
      if (!term) return true;
      return (
        item.permissionId.toLowerCase().includes(term) ||
        item.action.toLowerCase().includes(term) ||
        (item.description ?? "").toLowerCase().includes(term)
      );
    });
  }, [permissions, searchTerm, resourceFilter, scopeFilter]);

  const summary = useMemo(() => {
    const builtin = permissions.filter((p) => p.isSystem === 1).length;
    return {
      total: permissions.length,
      builtin,
      custom: permissions.length - builtin,
    };
  }, [permissions]);

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (item: PermissionDictItem) => {
    if (item.isSystem === 1) {
      toast.error("Built-in permission is read-only");
      return;
    }
    setEditingId(item.permissionId);
    setForm({
      permissionId: item.permissionId,
      resourceType: item.resourceType,
      action: item.action,
      scopeType: item.scopeType,
      description: item.description ?? "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const resourceType = form.resourceType.trim();
    const action = form.action.trim();
    if (!resourceType || !action) {
      toast.error("Resource type and action are required");
      return;
    }
    setSubmitting(true);
    try {
      const payload: CreatePermissionRequest = {
        permissionId:
          form.permissionId.trim() || `${resourceType}:${action}`,
        resourceType,
        action,
        scopeType: form.scopeType,
        description: form.description.trim(),
      };
      if (editingId) {
        await Apis.permission.updatePermission(editingId, {
          resourceType: payload.resourceType,
          action: payload.action,
          scopeType: payload.scopeType,
          description: payload.description,
        });
        toast.success("Permission updated");
      } else {
        await Apis.permission.createPermission(payload);
        toast.success("Permission created");
      }
      setDialogOpen(false);
      await loadPermissions();
    } catch (error) {
      console.error("Failed to save permission", error);
      toast.error(
        editingId ? "Failed to update permission" : "Failed to create permission",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: PermissionDictItem) => {
    if (item.isSystem === 1) {
      toast.error("Built-in permission cannot be deleted");
      return;
    }
    if (!confirm(`Delete permission "${item.permissionId}"?`)) {
      return;
    }
    try {
      await Apis.permission.deletePermission(item.permissionId);
      toast.success("Permission deleted");
      await loadPermissions();
    } catch (error) {
      console.error("Failed to delete permission", error);
      toast.error("Failed to delete permission");
    }
  };

  return (
    <>
      <section className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Permissions
            </h2>
            <p className="mt-2 text-muted-foreground">
              Manage the permission dictionary used by roles and policies.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => void loadPermissions()}
              disabled={loading}
              aria-label="Reload"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              New permission
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
              <CardDescription className="text-xs">Built-in</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Crown className="h-5 w-5 text-amber-500" />
                {summary.builtin}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Custom</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                {summary.custom}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Permission catalog
            </CardTitle>
            <CardDescription>
              Built-in permissions are read-only. Add custom permissions for new actions.
            </CardDescription>
            <div className="mt-4 flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by id / action / description"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={resourceFilter} onValueChange={setResourceFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Resource type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All resources</SelectItem>
                  {resourceTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={scopeFilter} onValueChange={setScopeFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All scopes</SelectItem>
                  {SCOPE_OPTIONS.map((scope) => (
                    <SelectItem key={scope.value} value={scope.value}>
                      {scope.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-9 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <ShieldCheck className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {permissions.length === 0
                    ? "No permissions yet."
                    : "No permissions match the current filters."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Permission ID</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow key={item.permissionId}>
                      <TableCell className="font-mono text-xs">
                        {item.permissionId}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="bg-gray-50 text-gray-600 border border-gray-200"
                        >
                          {item.resourceType}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.action}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.scopeType}</Badge>
                      </TableCell>
                      <TableCell>
                        {item.isSystem === 1 ? (
                          <Badge
                            variant="outline"
                            className="bg-amber-100 text-amber-700 border border-amber-200"
                          >
                            <Crown className="mr-1 h-3 w-3" />
                            Built-in
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-gray-100 text-gray-600 border border-gray-200"
                          >
                            Custom
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {item.description ?? "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(item)}
                            disabled={item.isSystem === 1}
                            aria-label="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void handleDelete(item)}
                            disabled={item.isSystem === 1}
                            className="text-red-500 hover:text-red-700"
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit permission" : "New permission"}
            </DialogTitle>
            <DialogDescription>
              Permission ID is in the form <code>resource:action</code> (e.g. <code>pipeline:trigger</code>).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="perm-resource">Resource type *</Label>
              <Input
                id="perm-resource"
                value={form.resourceType}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, resourceType: e.target.value }))
                }
                placeholder="e.g. pipeline"
                disabled={!!editingId}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="perm-action">Action *</Label>
              <Input
                id="perm-action"
                value={form.action}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, action: e.target.value }))
                }
                placeholder="e.g. trigger"
                disabled={!!editingId}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="perm-id">Permission ID</Label>
              <Input
                id="perm-id"
                value={form.permissionId}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    permissionId: e.target.value,
                  }))
                }
                placeholder="(auto = resourceType:action)"
                disabled={!!editingId}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to auto-generate <code>{form.resourceType || "resource"}:{form.action || "action"}</code>.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select
                value={form.scopeType}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, scopeType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPE_OPTIONS.map((scope) => (
                    <SelectItem key={scope.value} value={scope.value}>
                      {scope.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="perm-description">Description</Label>
              <Input
                id="perm-description"
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="What does this permission allow?"
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
    </>
  );
}
