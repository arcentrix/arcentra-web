import { useEffect, useState, useCallback } from 'react';
import {
  Pencil,
  Search,
  RefreshCw,
  Settings,
  Database,
  Link as LinkIcon,
  Mail,
  Shield,
  Code,
  Bot,
  Puzzle,
  Eye,
  EyeOff,
  SearchX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { GeneralSettingsSheet } from '@/components/general-settings-sheet';
import {
  getGeneralSettingsList,
  updateGeneralSettings,
} from '@/api/general-settings';
import type {
  GeneralSettings,
  Category,
} from '@/api/general-settings/types';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

const SENSITIVE_KEYWORDS = ['secret', 'key', 'salt', 'password', 'token'];

function isSensitiveField(fieldName: string): boolean {
  const lower = fieldName.toLowerCase();
  return SENSITIVE_KEYWORDS.some((kw) => lower.includes(kw));
}

const categoryConfig: Record<string, { icon: typeof Settings; color: string; bgColor: string }> = {
  system: { icon: Settings, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950' },
  mongodb: { icon: Database, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-950' },
  agent: { icon: Bot, color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-50 dark:bg-cyan-950' },
  plugin: { icon: Puzzle, color: 'text-pink-600 dark:text-pink-400', bgColor: 'bg-pink-50 dark:bg-pink-950' },
  external: { icon: LinkIcon, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-950' },
  email: { icon: Mail, color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-950' },
  auth: { icon: Shield, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-950' },
  default: { icon: Code, color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-50 dark:bg-gray-950' },
};

function getCategoryConfig(category: string) {
  return categoryConfig[category] || categoryConfig.default;
}

// --- Sensitive Value Component ---

function SensitiveValue({ value }: { value: string }) {
  const [revealed, setRevealed] = useState(false);

  const toggle = useCallback(() => {
    setRevealed(true);
    const timer = setTimeout(() => setRevealed(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-xs text-foreground">
        {revealed ? value : '••••••••••'}
      </span>
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center justify-center rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        {revealed ? (
          <EyeOff className="h-3 w-3" />
        ) : (
          <Eye className="h-3 w-3" />
        )}
      </button>
    </span>
  );
}

// --- Skeleton Components ---

function CategoryListSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-5 w-6 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function SettingsCardsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border border-border p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
              <Skeleton className="h-4 w-52" />
            </div>
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
          <Skeleton className="h-16 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}

// --- Empty State ---

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <SearchX className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">
        No matching configurations
      </h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        Try adjusting your search keywords or selecting a different category
      </p>
      <Button variant="outline" size="sm" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}

// --- Main Page ---

export default function GeneralSettingsPage() {
  const [settings, setSettings] = useState<GeneralSettings[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingSettings, setEditingSettings] = useState<GeneralSettings | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getGeneralSettingsList();
      const list = response.list || [];
      setSettings(list);

      const categoryMap = new Map<string, { count: number; firstSettingsId: string }>();
      list.forEach((item) => {
        const existing = categoryMap.get(item.category);
        if (existing) {
          categoryMap.set(item.category, {
            count: existing.count + 1,
            firstSettingsId: existing.firstSettingsId,
          });
        } else {
          categoryMap.set(item.category, { count: 1, firstSettingsId: item.settingsId });
        }
      });

      const categoriesData: Category[] = Array.from(categoryMap.entries())
        .map(([category, info]) => ({ category, count: info.count }))
        .sort((a, b) => {
          const aId = categoryMap.get(a.category)!.firstSettingsId;
          const bId = categoryMap.get(b.category)!.firstSettingsId;
          return aId.localeCompare(bId);
        });

      setCategories(categoriesData);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const filteredSettings = settings.filter((item) => {
    const matchCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchSearch =
      !searchText ||
      item.displayName.toLowerCase().includes(searchText.toLowerCase()) ||
      item.name.toLowerCase().includes(searchText.toLowerCase()) ||
      item.category.toLowerCase().includes(searchText.toLowerCase());
    return matchCategory && matchSearch;
  });

  const filteredCategories = categories.filter((cat) => {
    if (!searchText) return true;
    const catSettings = settings.filter(
      (s) =>
        s.category === cat.category &&
        (s.displayName.toLowerCase().includes(searchText.toLowerCase()) ||
          s.name.toLowerCase().includes(searchText.toLowerCase()))
    );
    return catSettings.length > 0;
  });

  const totalCount = settings.length;

  const handleUpdate = async (data: any) => {
    if (!editingSettings) {
      toast.error('No settings selected');
      return;
    }
    const settingsId = editingSettings.settingsId;
    if (!settingsId) {
      toast.error('Settings ID is missing. Please refresh the page.');
      return;
    }
    try {
      await updateGeneralSettings(settingsId, data);
      toast.success('Configuration updated successfully');
      setEditingSettings(null);
      setSheetOpen(false);
      loadSettings();
    } catch {
      toast.error('Failed to update configuration');
    }
  };

  const openEditSheet = (item: GeneralSettings) => {
    setEditingSettings(item);
    setSheetOpen(true);
  };

  const clearFilters = () => {
    setSearchText('');
    setSelectedCategory('all');
  };

  const renderValue = (key: string, value: any) => {
    if (isSensitiveField(key) && typeof value === 'string') {
      return <SensitiveValue value={value} />;
    }
    if (typeof value === 'string') {
      return <span className="font-mono text-xs text-foreground break-all">{value}</span>;
    }
    if (Array.isArray(value)) {
      return (
        <div className="flex flex-wrap gap-1">
          {value.map((item, idx) => (
            <Badge key={idx} variant="secondary" className="text-[10px] font-normal">
              {String(item)}
            </Badge>
          ))}
        </div>
      );
    }
    if (typeof value === 'object' && value !== null) {
      return (
        <div className="space-y-0.5">
          {Object.entries(value).map(([k, v]) => (
            <div key={k} className="text-xs">
              <span className="text-muted-foreground">{k}:</span>{' '}
              {renderValue(k, v)}
            </div>
          ))}
        </div>
      );
    }
    return <span className="font-mono text-xs text-foreground">{String(value)}</span>;
  };

  const renderConfigData = (data: Record<string, any>) => {
    if (!data || Object.keys(data).length === 0) {
      return <span className="text-muted-foreground text-sm">No data</span>;
    }
    return (
      <div className="rounded-md bg-muted/50 px-3 py-2.5 space-y-1">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="flex items-start gap-2 text-xs">
            <span className="text-muted-foreground shrink-0 min-w-0">{key}:</span>
            <span className="min-w-0">{renderValue(key, value)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div className="flex-1 flex flex-col p-4 md:p-8 pt-6 gap-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">General Settings</h2>
            <p className="text-muted-foreground">
              Manage the general settings of the system, including various system settings
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={loadSettings}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>

        {/* Two-Panel Layout */}
        <div className="flex flex-1 gap-6 min-h-0">
          {/* Left Panel - Category Navigation (Desktop) */}
          <aside className="hidden lg:flex w-64 shrink-0 flex-col rounded-lg border border-border bg-card">
            {/* Search */}
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>
            <Separator />
            {/* Category List */}
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-0.5">
                {loading ? (
                  <CategoryListSkeleton />
                ) : (
                  <>
                    {/* All Categories */}
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('all')}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors cursor-pointer',
                        selectedCategory === 'all'
                          ? 'bg-accent text-accent-foreground font-medium'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                      )}
                    >
                      {selectedCategory === 'all' && (
                        <span className="absolute left-0 h-6 w-0.5 rounded-r bg-primary" />
                      )}
                      <Settings className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">All</span>
                      <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
                        {totalCount}
                      </Badge>
                    </button>

                    {filteredCategories.map((cat) => {
                      const config = getCategoryConfig(cat.category);
                      const Icon = config.icon;
                      const isActive = selectedCategory === cat.category;

                      return (
                        <button
                          key={cat.category}
                          type="button"
                          onClick={() => setSelectedCategory(cat.category)}
                          className={cn(
                            'relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors cursor-pointer',
                            isActive
                              ? 'bg-accent text-accent-foreground font-medium'
                              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                          )}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-r bg-primary" />
                          )}
                          <Icon className={cn('h-4 w-4 shrink-0', config.color)} />
                          <span className="flex-1 text-left capitalize">{cat.category}</span>
                          <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
                            {cat.count}
                          </Badge>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            </ScrollArea>
          </aside>

          {/* Right Panel - Settings Content */}
          <main className="flex-1 flex flex-col min-w-0">
            {/* Mobile: Search + Horizontal Category Tabs */}
            <div className="lg:hidden space-y-3 mb-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search configurations..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="pl-8"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                    selectedCategory === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  )}
                >
                  All ({totalCount})
                </button>
                {filteredCategories.map((cat) => {
                  const isActive = selectedCategory === cat.category;
                  return (
                    <button
                      key={cat.category}
                      type="button"
                      onClick={() => setSelectedCategory(cat.category)}
                      className={cn(
                        'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors cursor-pointer',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-accent'
                      )}
                    >
                      {cat.category} ({cat.count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category Header (when specific category selected) */}
            {selectedCategory !== 'all' && !loading && (
              <div className="flex items-center gap-3 mb-4">
                {(() => {
                  const config = getCategoryConfig(selectedCategory);
                  const Icon = config.icon;
                  return (
                    <>
                      <div className={cn('rounded-lg p-2', config.bgColor)}>
                        <Icon className={cn('h-5 w-5', config.color)} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold capitalize">{selectedCategory}</h3>
                        <p className="text-sm text-muted-foreground">
                          {filteredSettings.length} configuration{filteredSettings.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Settings Cards */}
            <ScrollArea className="flex-1">
              {loading ? (
                <SettingsCardsSkeleton />
              ) : filteredSettings.length === 0 ? (
                <EmptyState onClear={clearFilters} />
              ) : (
                <div className="space-y-3 pb-4">
                  {filteredSettings.map((item) => {
                    const config = getCategoryConfig(item.category);
                    const Icon = config.icon;

                    return (
                      <div
                        key={item.settingsId}
                        className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/20 hover:shadow-sm"
                      >
                        {/* Row 1: Title + Code Badge */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {selectedCategory === 'all' && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className={cn('rounded p-1', config.bgColor)}>
                                      <Icon className={cn('h-3.5 w-3.5', config.color)} />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="capitalize">{item.category}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              <h4 className="text-sm font-semibold text-foreground">
                                {item.displayName}
                              </h4>
                              <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                                {item.name}
                              </code>
                            </div>
                            {/* Row 2: Description */}
                            {item.description && (
                              <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                                {item.description}
                              </p>
                            )}
                          </div>
                          {/* Edit Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-primary cursor-pointer"
                            onClick={() => openEditSheet(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                        {/* Row 3: Config Data */}
                        <div className="mt-3">
                          {renderConfigData(item.data)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </main>
        </div>

        {/* Edit Sheet */}
        <GeneralSettingsSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          settings={editingSettings}
          onSubmit={handleUpdate}
        />
      </div>
    </TooltipProvider>
  );
}
