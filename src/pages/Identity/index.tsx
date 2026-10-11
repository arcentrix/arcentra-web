import { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Shield,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  ShieldCheck,
  ServerCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IdentityConfigDialog } from "@/components/identity-config-dialog";
import { PlaceholderPanel } from "@/components/placeholder-panel";
import { SettingsCard, FormRow, ColumnHead } from "@/components/blueprint";
import { toast } from "@/lib/toast";
import type {
  IdentityProvider,
  CreateIdentityProviderRequest,
  UpdateIdentityProviderRequest,
} from "@/api/identity/types";
import { Apis } from "@/api";

const PROVIDER_TYPE_LABELS: Record<string, string> = {
  oauth: "OAuth 2.0",
  ldap: "LDAP",
  oidc: "OIDC",
  saml: "SAML 2.0",
};

export default function IdentityPage({
  headless = false,
}: {
  /** 嵌入 Settings 侧栏分区时启用：去掉页头与外层留白。 */
  headless?: boolean;
}) {
  const [providers, setProviders] = useState<IdentityProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] =
    useState<IdentityProvider | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [pageNum, setPageNum] = useState(1);
  const [pageSize] = useState(10);
  const [activeSection, setActiveSection] = useState<string>("providers");
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      loadProviders();
    }

  }, []);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const list = await Apis.identity_integration.listIdentityProviders();
      setProviders(list.sort((a, b) => a.priority - b.priority));
    } catch (error) {
      toast.error("Failed to load providers");
      console.error("Load failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedProvider(null);
    setDialogOpen(true);
  };

  const handleEdit = async (provider: IdentityProvider) => {
    try {
      const fullProvider = await Apis.identity_integration.getIdentityProvider(
        provider.name,
      );
      setSelectedProvider(fullProvider);
      setDialogOpen(true);
    } catch (error) {
      toast.error("Failed to load provider details");
      console.error("Load provider failed:", error);
    }
  };

  const handleSubmit = async (data: CreateIdentityProviderRequest) => {
    if (selectedProvider) {
      const updateData: UpdateIdentityProviderRequest = {
        name: data.name,
        provider_type: data.provider_type,
        config: data.config,
        description: data.description,
        priority: data.priority,
      };
      await Apis.identity_integration.updateIdentityProvider(
        selectedProvider.name,
        updateData,
      );
    } else {
      await Apis.identity_integration.createIdentityProvider(data);
    }
    await loadProviders();
  };

  const handleDelete = async (name: string) => {
    if (!confirm("Are you sure you want to delete this provider?")) return;
    try {
      await Apis.identity_integration.deleteIdentityProvider(name);
      toast.success("Provider deleted successfully");
      await loadProviders();
    } catch (error) {
      toast.error("Failed to delete provider");
      console.error("Delete failed:", error);
    }
  };

  const handleToggle = async (provider: IdentityProvider) => {
    try {
      await Apis.identity_integration.toggleIdentityProvider(
        provider.name,
        provider.isEnabled === 0,
      );
      toast.success(
        provider.isEnabled === 1 ? "Provider disabled" : "Provider enabled",
      );
      await loadProviders();
    } catch (error) {
      toast.error("Failed to toggle provider status");
      console.error("Toggle failed:", error);
    }
  };

  const filteredProviders = useMemo(() => {
    return providers.filter((provider) => {
      if (filterType !== "all" && provider.providerType !== filterType)
        return false;
      if (filterStatus === "enabled" && provider.isEnabled !== 1) return false;
      if (filterStatus === "disabled" && provider.isEnabled !== 0) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          provider.name.toLowerCase().includes(term) ||
          (provider.description &&
            provider.description.toLowerCase().includes(term))
        );
      }
      return true;
    });
  }, [providers, filterType, filterStatus, searchTerm]);

  const totalPages = Math.ceil(filteredProviders.length / pageSize);
  const paginatedProviders = useMemo(() => {
    const startIndex = (pageNum - 1) * pageSize;
    return filteredProviders.slice(startIndex, startIndex + pageSize);
  }, [filteredProviders, pageNum, pageSize]);

  useEffect(() => {
    setPageNum(1);
  }, [searchTerm, filterType, filterStatus]);

  const enabledCount = providers.filter((p) => p.isEnabled === 1).length;
  const defaultProvider = providers.find((p) => p.isEnabled === 1)?.name || "—";

  const outer = headless
    ? "flex flex-col gap-4"
    : "flex flex-1 flex-col gap-4 p-4 md:p-8 pt-6";

  /* ── Section selector (pills) ──────────────────────────────── */
  const SECTIONS = [
    { id: "providers", label: "Providers" },
    { id: "login-policy", label: "Login policy" },
    { id: "session", label: "Session" },
    { id: "scim-ldap", label: "SCIM / LDAP" },
  ];

  return (
    <>
      <div className={outer}>
        {/* Section selector */}
        <div className="flex items-center gap-1">
          {SECTIONS.map((s) => {
            const active = s.id === activeSection;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(s.id)}
                className={`inline-flex h-8 cursor-pointer items-center rounded-md border px-3 text-[12.5px] font-medium transition-colors ${
                  active
                    ? "border-border-strong bg-bg-elevated text-foreground"
                    : "border-border text-fg-muted hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* ── Providers section ──────────────────────────────────── */}
        {activeSection === "providers" && (
          <>
            {/* Stats summary card */}
            <SettingsCard
              title="Identity providers"
              sub="Configure and manage supported identity providers (OAuth, LDAP, OIDC, SAML)."
              action={
                <Button size="sm" onClick={handleCreate} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Add provider
                </Button>
              }
            >
              {/* Stats row */}
              <div className="mb-4 flex flex-wrap items-center gap-4 border-b pb-4">
                <FormRow label="Enabled providers" hint="Highest-priority is default.">
                  <span className="font-mono text-[13px] text-foreground">
                    {enabledCount} / {providers.length}
                  </span>
                </FormRow>
                <FormRow label="Default provider" hint="Highest-priority enabled provider.">
                  <span className="font-mono text-[13px] text-foreground truncate max-w-[240px]">
                    {defaultProvider}
                  </span>
                </FormRow>
                <FormRow label="Login policy" hint="Default workspace policy.">
                  <span className="font-mono text-[13px] text-fg-muted">
                    SSO optional
                  </span>
                </FormRow>
              </div>

              {/* Filters */}
              <div className="mb-4 flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
                  <Input
                    placeholder="Search by name or description…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 h-[34px] text-[13px]"
                  />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[160px] h-[34px] text-[13px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="oauth">OAuth 2.0</SelectItem>
                    <SelectItem value="ldap">LDAP</SelectItem>
                    <SelectItem value="oidc">OpenID Connect</SelectItem>
                    <SelectItem value="saml">SAML 2.0</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[140px] h-[34px] text-[13px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="enabled">Enabled</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Provider list */}
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-[13px] text-fg-muted">Loading…</p>
                </div>
              ) : filteredProviders.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-10 text-center">
                  <Shield className="h-8 w-8 text-fg-subtle" />
                  <div className="text-[13px] font-medium">
                    {providers.length === 0
                      ? "No identity providers configured"
                      : "No providers match your filters"}
                  </div>
                  {providers.length === 0 ? (
                    <Button size="sm" onClick={handleCreate} className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Add your first provider
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchTerm("");
                        setFilterType("all");
                        setFilterStatus("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b">
                        <th className="pb-2 text-left">
                          <ColumnHead>Name</ColumnHead>
                        </th>
                        <th className="pb-2 px-3 text-left">
                          <ColumnHead>Type</ColumnHead>
                        </th>
                        <th className="pb-2 px-3 text-left">
                          <ColumnHead>Priority</ColumnHead>
                        </th>
                        <th className="pb-2 px-3 text-left">
                          <ColumnHead>Enabled</ColumnHead>
                        </th>
                        <th className="pb-2 px-3 text-left max-w-[180px]">
                          <ColumnHead>Description</ColumnHead>
                        </th>
                        <th className="pb-2 text-right">
                          <ColumnHead>Actions</ColumnHead>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedProviders.map((provider) => (
                        <tr key={provider.id} className="border-b last:border-b-0">
                          <td className="py-3 pr-3 font-medium">
                            {provider.name}
                          </td>
                          <td className="px-3 py-3">
                            <Badge
                              variant="outline"
                              className="font-mono text-[10.5px] uppercase tracking-[0.04em]"
                            >
                              {PROVIDER_TYPE_LABELS[provider.providerType] ??
                                provider.providerType.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="px-3 py-3">
                            <span className="font-mono text-[13px] text-fg-muted">
                              {provider.priority}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <Switch
                              checked={provider.isEnabled === 1}
                              onCheckedChange={() => handleToggle(provider)}
                              aria-label={`Toggle ${provider.name}`}
                            />
                          </td>
                          <td className="max-w-[180px] truncate px-3 py-3 text-fg-muted">
                            {provider.description || "—"}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(provider)}
                                className="h-7 px-2"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(provider.name)}
                                className="h-7 px-2 text-accent-danger hover:text-accent-danger"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between border-t pt-4">
                      <div className="text-[12px] text-fg-muted">
                        Showing {(pageNum - 1) * pageSize + 1}–
                        {Math.min(pageNum * pageSize, filteredProviders.length)}{" "}
                        of {filteredProviders.length} providers
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPageNum((p) => Math.max(1, p - 1))}
                          disabled={pageNum === 1}
                          className="h-7 gap-1 px-2.5"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                          Previous
                        </Button>
                        <span className="text-[12px] text-fg-muted">
                          {pageNum} / {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setPageNum((p) => Math.min(totalPages, p + 1))
                          }
                          disabled={pageNum === totalPages}
                          className="h-7 gap-1 px-2.5"
                        >
                          Next
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </SettingsCard>
          </>
        )}

        {/* ── Login policy section ──────────────────────────────── */}
        {activeSection === "login-policy" && (
          <PlaceholderPanel
            icon={ShieldCheck}
            title="Login Policy"
            description="Require MFA, restrict allowed identity providers, enforce IP allowlists and break-glass overrides. API not yet available."
          />
        )}

        {/* ── Session section ───────────────────────────────────── */}
        {activeSection === "session" && (
          <PlaceholderPanel
            icon={Clock}
            title="Session"
            description="Configure session lifetime, idle timeout and refresh token rotation. API not yet available."
          />
        )}

        {/* ── SCIM/LDAP section ─────────────────────────────────── */}
        {activeSection === "scim-ldap" && (
          <PlaceholderPanel
            icon={ServerCog}
            title="SCIM / LDAP sync"
            description="Provision users and groups from upstream directories. API not yet available."
          />
        )}
      </div>

      <IdentityConfigDialog
        key={selectedProvider?.id || "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        provider={selectedProvider}
        onSubmit={handleSubmit}
      />
    </>
  );
}
