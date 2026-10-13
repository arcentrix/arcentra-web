import { useEffect, useMemo, useState, type FC } from "react";
import { Eye, EyeOff, Pencil, RefreshCw, Search, SearchX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsCard, FormRow } from "@/components/blueprint";
import { GeneralSettingsSheet } from "@/components/general-settings-sheet";
import { listSettings, updateSetting } from "@/api/general-settings";
import type { SettingItem, SettingValue } from "@/api/general-settings/types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  GROUPED_SETTING_NAMES,
  SETTINGS_GROUPS,
  type SettingsGroup,
} from "./groups";
import { GroupEditSheet } from "./GroupEditSheet";

const SENSITIVE_KEYWORDS = ["secret", "key", "salt", "password", "token"];

function isSensitiveField(fieldName: string) {
  const lower = fieldName.toLowerCase();
  return SENSITIVE_KEYWORDS.some((kw) => lower.includes(kw));
}

const SensitiveValue: FC<{ value: string }> = ({ value }) => {
  const [revealed, setRevealed] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-[13px] text-foreground">
        {revealed ? value : "••••••••••"}
      </span>
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        className="inline-flex items-center justify-center rounded p-0.5 text-fg-muted transition-colors hover:text-foreground cursor-pointer"
        aria-label={revealed ? "Hide value" : "Show value"}
      >
        {revealed ? (
          <EyeOff className="h-3 w-3" />
        ) : (
          <Eye className="h-3 w-3" />
        )}
      </button>
    </span>
  );
};

function renderScalar(label: string, value: unknown): React.ReactNode {
  if (value === undefined || value === null) {
    return (
      <span className="font-mono text-[13px] italic text-fg-muted">—</span>
    );
  }
  if (typeof value === "string") {
    if (isSensitiveField(label)) return <SensitiveValue value={value} />;
    return (
      <span className="break-all font-mono text-[13px] text-foreground">
        {value}
      </span>
    );
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return (
      <span className="font-mono text-[13px] text-foreground">
        {String(value)}
      </span>
    );
  }
  return (
    <span className="font-mono text-[13px] text-foreground">
      {JSON.stringify(value)}
    </span>
  );
}

function renderRawValue(key: string, value: unknown): React.ReactNode {
  if (typeof value === "string") {
    if (isSensitiveField(key)) return <SensitiveValue value={value} />;
    return (
      <span className="break-all font-mono text-[13px] text-foreground">
        {value}
      </span>
    );
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return (
      <span className="font-mono text-[13px] text-foreground">
        {String(value)}
      </span>
    );
  }
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((item, idx) => (
          <Badge
            key={idx}
            variant="secondary"
            className="text-[10px] font-normal"
          >
            {String(item)}
          </Badge>
        ))}
      </div>
    );
  }
  if (value !== null && typeof value === "object") {
    return (
      <div className="space-y-0.5">
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k} className="text-[13px]">
            <span className="text-fg-muted">{k}:</span> {renderRawValue(k, v)}
          </div>
        ))}
      </div>
    );
  }
  return (
    <span className="font-mono text-[13px] text-foreground">
      {String(value)}
    </span>
  );
}

function getByPath(
  obj: Record<string, unknown> | undefined,
  path?: string,
): unknown {
  if (!obj) return undefined;
  if (!path) return obj;
  return obj[path];
}

/* ── GroupSettingsCard ─────────────────────────────────────────
   一个 SETTINGS_GROUPS group → 一张 SettingsCard，每个 field = FormRow */
interface GroupCardProps {
  group: SettingsGroup;
  settingsByName: Map<string, SettingItem>;
  onEdit: (group: SettingsGroup) => void;
}

const GroupSettingsCard: FC<GroupCardProps> = ({
  group,
  settingsByName,
  onEdit,
}) => {
  return (
    <SettingsCard
      title={group.title}
      sub={group.description}
      action={
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => onEdit(group)}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      }
    >
      {group.fields.map((field) => {
        const item = settingsByName.get(field.settingName);
        const value = getByPath(item?.value, field.path);
        return (
          <FormRow
            key={`${field.settingName}-${field.path ?? "_"}`}
            label={field.label}
            hint={field.suffix ? `Unit: ${field.suffix}` : undefined}
          >
            <div className="flex items-center gap-1.5">
              {field.path && item?.configuredFields?.includes(field.path) ? (
                <span className="text-[13px] text-fg-muted">
                  Configured (write-only)
                </span>
              ) : (
                renderScalar(field.label, value)
              )}
            </div>
          </FormRow>
        );
      })}
    </SettingsCard>
  );
};

/* ── Skeleton ─────────────────────────────────────────────────── */
function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-md border bg-background"
        >
          <div className="flex items-center justify-between gap-3 border-b px-5 py-[18px]">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
          <div className="space-y-0 p-5">
            {Array.from({ length: 3 }).map((__, j) => (
              <div
                key={j}
                className="grid gap-6 border-b py-3.5 last:border-b-0 [grid-template-columns:200px_1fr]"
              >
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Advanced item ─────────────────────────────────────────────── */
interface AdvancedItemProps {
  item: SettingItem;
  onEdit: (item: SettingItem) => void;
}

const AdvancedItem: FC<AdvancedItemProps> = ({ item, onEdit }) => (
  <div className="group rounded-md border bg-background p-5 transition-colors hover:border-border-strong">
    <div className="flex items-start justify-between gap-4">
      <code className="inline-block break-all rounded bg-bg-elevated px-1.5 py-0.5 font-mono text-[12px] text-foreground">
        {item.name}
      </code>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 cursor-pointer text-fg-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
        onClick={() => onEdit(item)}
        aria-label="Edit"
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
    <div className="mt-3 space-y-1 rounded-md bg-bg-elevated px-3 py-2.5">
      {(item.configuredFields ?? []).map((key) => (
        <div key={key} className="text-[13px] text-fg-muted">
          {key}: Configured (write-only)
        </div>
      ))}
      {Object.entries(item.value).length === 0 &&
      !item.configuredFields?.length ? (
        <span className="text-[13px] text-fg-muted">No value</span>
      ) : (
        Object.entries(item.value)
          .filter(([key]) => !item.configuredFields?.includes(key))
          .map(([key, value]) => (
            <div key={key} className="flex items-start gap-2 text-[13px]">
              <span className="shrink-0 text-fg-muted">{key}:</span>
              <span className="min-w-0">{renderRawValue(key, value)}</span>
            </div>
          ))
      )}
    </div>
  </div>
);

/* ── Page ─────────────────────────────────────────────────────── */

interface GeneralSettingsPageProps {
  /** 嵌入 Settings 侧栏分区时启用：去掉页头与外层留白。 */
  headless?: boolean;
}

const GeneralSettingsPage: FC<GeneralSettingsPageProps> = ({
  headless = false,
}) => {
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [groupSheetOpen, setGroupSheetOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SettingsGroup | null>(null);

  const [singleSheetOpen, setSingleSheetOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState<SettingItem | null>(
    null,
  );

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await listSettings();
      setSettings(Array.isArray(data) ? data : []);
    } catch (error) {
      const message = (error as Error)?.message || "Failed to load settings";
      toast.error("Failed to load settings", message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const settingsByName = useMemo(() => {
    const map = new Map<string, SettingItem>();
    settings.forEach((s) => map.set(s.name, s));
    return map;
  }, [settings]);

  const advancedItems = useMemo(() => {
    const ungrouped = settings.filter(
      (s) => !GROUPED_SETTING_NAMES.has(s.name),
    );
    if (!searchText.trim()) return ungrouped;
    const q = searchText.toLowerCase();
    return ungrouped.filter((item) => {
      if (item.name.toLowerCase().includes(q)) return true;
      try {
        return JSON.stringify(item.value).toLowerCase().includes(q);
      } catch {
        return false;
      }
    });
  }, [settings, searchText]);

  const ungroupedCount = settings.filter(
    (s) => !GROUPED_SETTING_NAMES.has(s.name),
  ).length;

  const handleEditGroup = (group: SettingsGroup) => {
    setEditingGroup(group);
    setGroupSheetOpen(true);
  };

  const handleEditSingle = (item: SettingItem) => {
    setEditingSetting(item);
    setSingleSheetOpen(true);
  };

  const handleSubmitGroup = async (
    updates: Array<{ name: string; value: Record<string, unknown> }>,
  ) => {
    try {
      await Promise.all(
        updates.map((u) => updateSetting(u.name, { value: u.value })),
      );
      toast.success(
        "Settings updated",
        `${editingGroup?.title} saved successfully.`,
      );
      setGroupSheetOpen(false);
      setEditingGroup(null);
      await loadSettings();
    } catch (error) {
      toast.error(
        "Failed to update settings",
        (error as Error)?.message || "Please try again.",
      );
    }
  };

  const handleSubmitSingle = async (value: SettingValue) => {
    if (!editingSetting) return;
    try {
      await updateSetting(editingSetting.name, { value });
      toast.success(
        "Setting updated",
        `${editingSetting.name} saved successfully.`,
      );
      setSingleSheetOpen(false);
      setEditingSetting(null);
      await loadSettings();
    } catch (error) {
      toast.error(
        "Failed to update setting",
        (error as Error)?.message || "Please try again.",
      );
    }
  };

  const outer = headless
    ? "flex flex-col gap-4"
    : "flex flex-1 flex-col gap-4 p-4 pt-6 md:p-8";

  return (
    <div className={outer}>
      {/* Header action */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={loadSettings}
          disabled={loading}
          aria-label="Refresh"
          className="gap-1.5"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Grouped cards */}
      {loading ? (
        <CardsSkeleton count={SETTINGS_GROUPS.length} />
      ) : (
        <>
          {SETTINGS_GROUPS.map((group) => (
            <GroupSettingsCard
              key={group.id}
              group={group}
              settingsByName={settingsByName}
              onEdit={handleEditGroup}
            />
          ))}

          {/* Advanced / ungrouped */}
          {ungroupedCount > 0 && (
            <SettingsCard
              title="Advanced"
              sub="Raw configuration keys not covered by the groups above."
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="gap-1.5 text-fg-muted"
                >
                  {showAdvanced ? "Hide" : "Show"}
                  <Badge
                    variant="secondary"
                    className="h-4 px-1 text-[10px] font-normal"
                  >
                    {ungroupedCount}
                  </Badge>
                </Button>
              }
            >
              {showAdvanced ? (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[240px] max-w-md">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
                      <Input
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        placeholder="Filter by name or value…"
                        className="pl-8 h-[34px] text-[13px]"
                      />
                    </div>
                    <Badge
                      variant="secondary"
                      className="gap-1.5 px-2 py-1 text-[11px]"
                    >
                      {advancedItems.length} of {ungroupedCount}
                    </Badge>
                  </div>

                  {advancedItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-12 text-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-bg-elevated">
                        <SearchX className="h-5 w-5 text-fg-muted" />
                      </div>
                      <div>
                        <div className="text-[13px] font-medium">
                          No matching configurations
                        </div>
                        <p className="mt-1 max-w-md text-[12px] text-fg-muted">
                          {settings.length === 0
                            ? "There are no settings to display yet."
                            : "Try a different search keyword."}
                        </p>
                      </div>
                      {searchText && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSearchText("")}
                        >
                          Clear search
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {advancedItems.map((item) => (
                        <AdvancedItem
                          key={item.name}
                          item={item}
                          onEdit={handleEditSingle}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[13px] text-fg-muted">
                  {ungroupedCount} raw configuration
                  {ungroupedCount === 1 ? "" : "s"} available. Click Show to
                  expand.
                </p>
              )}
            </SettingsCard>
          )}
        </>
      )}

      <GroupEditSheet
        open={groupSheetOpen}
        onOpenChange={(open) => {
          setGroupSheetOpen(open);
          if (!open) setEditingGroup(null);
        }}
        group={editingGroup}
        settingsByName={settingsByName}
        onSubmit={handleSubmitGroup}
      />

      <GeneralSettingsSheet
        open={singleSheetOpen}
        onOpenChange={(open) => {
          setSingleSheetOpen(open);
          if (!open) setEditingSetting(null);
        }}
        setting={editingSetting}
        onSubmit={handleSubmitSingle}
      />
    </div>
  );
};

export default GeneralSettingsPage;
