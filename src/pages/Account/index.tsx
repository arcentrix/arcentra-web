/**
 * Account — 个人资料页。
 *
 * 路由：/account（静态，已登录 DockLayout 内）。
 * 标签页：Profile · Security · Sessions · Preferences · API tokens。
 *
 * 数据接入：
 * - Profile / 基本信息：userStore（UserInfo）+ Apis.user.updateUserInfo /
 *   uploadAvatar——可编辑并保存（原 dock 用户菜单的 Edit profile 弹窗已并入此处）。
 * - Security / Password：Apis.user_management.resetPassword——已接入。
 * - 2FA / Sessions / API tokens：后端 API 尚未实现，用占位 + TODO 注释。
 * - Preferences：纯本地 state（主题/密度/通知偏好无对应 API），TODO 注释说明。
 */

import { useEffect, useRef, useState, type FC } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Copy,
  Monitor,
  Moon,
  Plus,
  RefreshCw,
  ServerCog,
  Settings,
  Shield,
  Sun,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/blueprint";
import { StatusDot } from "@/components/blueprint";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import userStore from "@/store/user";
import { Apis } from "@/api";
import { toast } from "@/lib/toast";

/* ─────────────────────────── 类型 ─────────────────────────── */

type AccountTab = "profile" | "security" | "sessions" | "preferences" | "tokens";

const TABS: { id: AccountTab; label: string; icon: typeof User }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Security", icon: Shield },
  { id: "sessions", label: "Sessions", icon: ServerCog },
  { id: "preferences", label: "Preferences", icon: Settings },
  { id: "tokens", label: "API tokens", icon: Copy },
];

const VALID_TABS = TABS.map((t) => t.id);

function isAccountTab(value: string | null): value is AccountTab {
  return !!value && (VALID_TABS as string[]).includes(value);
}

/* ─────────────────────────── 共享基元 ─────────────────────────── */

function AccountCard({
  title,
  sub,
  children,
  action,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Panel>
      <div className="flex items-center justify-between gap-3 border-b px-5 py-[18px]">
        <div>
          <h3
            className="display text-[16px] font-semibold leading-tight tracking-[-0.01em]"
          >
            {title}
          </h3>
          {sub && (
            <p className="mt-1 text-[12.5px] text-fg-muted">{sub}</p>
          )}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </Panel>
  );
}

function FormRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid items-center gap-6 border-b py-3.5 last:border-b-0 [grid-template-columns:180px_1fr]">
      <div>
        <div className="text-[13px] font-medium">{label}</div>
        {hint && (
          <div className="mt-0.5 text-[12px] text-fg-subtle">{hint}</div>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

/* ─────────────────────────── Profile tab ─────────────────────────── */

function ProfileSection() {
  const { userinfo } = userStore.useState();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 可编辑字段的本地编辑态
  const [fullName, setFullName] = useState(userinfo?.fullName ?? "");
  const [email, setEmail] = useState(userinfo?.email ?? "");
  const [phone, setPhone] = useState(userinfo?.phone ?? "");
  const [avatar, setAvatar] = useState(userinfo?.avatar ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // userinfo 首次加载或被其他位置刷新时，同步本地编辑态
  useEffect(() => {
    setFullName(userinfo?.fullName ?? "");
    setEmail(userinfo?.email ?? "");
    setPhone(userinfo?.phone ?? "");
    setAvatar(userinfo?.avatar ?? "");
  }, [userinfo]);

  // 从 userinfo 提取首字母缩写作为 avatar fallback
  const initials = userinfo?.fullName
    ? userinfo.fullName
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0]?.toUpperCase() ?? "")
        .join("")
    : (userinfo?.username?.slice(0, 2).toUpperCase() ?? "??");

  const roleName =
    typeof userStore.getState().role === "string"
      ? (userStore.getState().role as string)
      : ((userStore.getState().role as { displayName?: string; name?: string })
          ?.displayName ??
        (userStore.getState().role as { name?: string })?.name ??
        "member");

  const dirty =
    fullName !== (userinfo?.fullName ?? "") ||
    email !== (userinfo?.email ?? "") ||
    phone !== (userinfo?.phone ?? "");

  const resetEdits = () => {
    setFullName(userinfo?.fullName ?? "");
    setEmail(userinfo?.email ?? "");
    setPhone(userinfo?.phone ?? "");
  };

  const handleSave = async () => {
    const userId = userStore.getState().userinfo?.userId;
    if (!userId) {
      toast.error("Failed to update profile", "User ID not found");
      return;
    }
    setSaving(true);
    try {
      await Apis.user.updateUserInfo(userId, { fullName, email, phone, avatar });
      const refreshed = await Apis.user.getUserInfo();
      userStore.updateState((state) => {
        state.userinfo = refreshed;
      });
      toast.success(
        "Profile updated",
        "Your profile has been updated successfully.",
      );
    } catch (error) {
      toast.error("Failed to update profile", (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const validTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!validTypes.includes(file.type)) {
      toast.error(
        "Invalid file type",
        "Please upload a JPEG, PNG, GIF or WebP image.",
      );
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", "Please upload an image smaller than 5MB.");
      return;
    }

    setUploading(true);
    try {
      const response = await Apis.user.uploadAvatar(file);
      const refreshed = await Apis.user.getUserInfo();
      userStore.updateState((state) => {
        state.userinfo = refreshed;
      });
      setAvatar(refreshed.avatar || response.url);
      toast.success("Avatar uploaded", "Your avatar has been updated.");
    } catch (error) {
      toast.error("Upload failed", (error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <AccountCard title="Identity" sub="How you appear across the platform.">
        {/* Avatar block */}
        <div className="flex items-center gap-5 border-b pb-4">
          <div className="relative shrink-0">
            {avatar ? (
              <img
                src={avatar}
                alt="Avatar"
                className="rounded-full border object-cover"
                style={{ width: 64, height: 64 }}
              />
            ) : (
              <span
                className="inline-flex items-center justify-center rounded-full border bg-bg-elevated font-mono text-[20px] font-semibold"
                style={{ width: 64, height: 64 }}
              >
                {initials}
              </span>
            )}
            <button
              type="button"
              aria-label="Upload avatar"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-border-strong bg-background text-foreground transition-colors hover:bg-bg-elevated disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <div className="flex-1">
            <p className="text-[13px] text-fg-muted">
              PNG, JPEG, GIF or WebP, square, 5MB max.
            </p>
            <div className="mt-2.5 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? "Uploading..." : "Upload image"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-fg-muted"
                onClick={() => setAvatar("")}
                disabled={uploading || !avatar}
              >
                Remove
              </Button>
            </div>
          </div>
        </div>

        <FormRow
          label="Display name"
          hint="Shown in audit logs, approvals and mentions."
        >
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            className="max-w-[360px] h-[34px] font-sans text-[13px]"
            disabled={saving}
          />
        </FormRow>

        {/* Handle / username — 不可改，由系统分配 */}
        <FormRow label="Handle" hint="Used in @mentions and the CLI.">
          <div
            className="inline-flex max-w-[360px] w-full items-center rounded-md border bg-bg-elevated opacity-60"
            style={{ cursor: "not-allowed" }}
          >
            <span className="pl-3 pr-1.5 font-mono text-[13px] text-fg-subtle">
              @
            </span>
            <input
              className="h-[32px] flex-1 border-0 bg-transparent pr-3 font-mono text-[13px] text-foreground outline-none"
              value={userinfo?.username ?? ""}
              readOnly
              disabled
            />
          </div>
        </FormRow>

        <FormRow label="Phone" hint="Optional. Used for SMS alerts.">
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="optional"
            className="max-w-[360px] h-[34px] font-sans text-[13px]"
            disabled={saving}
          />
        </FormRow>
      </AccountCard>

      <AccountCard
        title="Contact"
        sub="How Arcentra reaches you for approvals and security events."
      >
        <FormRow
          label="Primary email"
          hint="Used for login and critical security notifications."
        >
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="max-w-[360px] h-[34px] font-mono text-[13px]"
            disabled={saving}
          />
        </FormRow>
        <FormRow label="Role" hint="Assigned by your workspace administrator.">
          <span className="font-mono text-[13px] text-fg-muted capitalize">
            {roleName}
          </span>
        </FormRow>
        {/* Secondary email & Slack — 占位，后端 profile 字段尚未提供 */}
        <FormRow
          label="Secondary email"
          hint="Personal backup for account recovery."
        >
          {/* TODO: persist when a profile API field is available */}
          <Input
            placeholder="optional"
            className="max-w-[360px] h-[34px] font-sans text-[13px]"
            disabled
          />
        </FormRow>
        <FormRow
          label="Slack handle"
          hint="Used to route on-call pages and approvals."
        >
          {/* TODO: persist when a profile API field is available */}
          <Input
            placeholder="@you"
            className="max-w-[360px] h-[34px] font-mono text-[13px]"
            disabled
          />
        </FormRow>
      </AccountCard>

      {/* 保存栏 —— 覆盖上面两张卡的所有可编辑字段 */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={resetEdits}
          disabled={!dirty || saving}
        >
          Reset
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!dirty || saving}
        >
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </>
  );
}

/* ─────────────────────────── Security tab ─────────────────────────── */

type TFAMethod = "totp" | "webauthn" | "sms";

const TFA_OPTIONS: { id: TFAMethod; title: string; sub: string }[] = [
  {
    id: "totp",
    title: "Authenticator app",
    sub: "TOTP code from 1Password / Authy / Google Authenticator",
  },
  {
    id: "webauthn",
    title: "Hardware key · WebAuthn",
    sub: "YubiKey, Titan or platform passkey",
  },
  {
    id: "sms",
    title: "SMS code",
    sub: "Backup only — phishable, not recommended",
  },
];

const PLACEHOLDER_CODES = [
  "9F4A-2B71-D3CE",
  "4811-CC0A-7E29",
  "AAFD-2204-9182",
  "5733-EA8B-F0CC",
  "BC91-7240-EE3A",
  "0FA2-5B19-873D",
];

function SecuritySection() {
  const [tfa, setTfa] = useState<TFAMethod>("totp");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      toast.error("New passwords do not match.");
      return;
    }
    if (newPw.length < 12) {
      toast.error("Password must be at least 12 characters.");
      return;
    }
    setPwLoading(true);
    try {
      await Apis.user_management.resetPassword(currentPw, newPw);
      toast.success("Password updated successfully.");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to update password.");
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <>
      <AccountCard title="Password" sub="Last changed —.">
        <form onSubmit={handlePasswordUpdate}>
          <FormRow label="Current password">
            <Input
              type="password"
              placeholder="••••••••"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="max-w-[360px] h-[34px]"
              required
            />
          </FormRow>
          <FormRow
            label="New password"
            hint="Minimum 12 characters · 1 number · 1 symbol."
          >
            <Input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="max-w-[360px] h-[34px]"
              required
            />
          </FormRow>
          <FormRow label="Confirm new password">
            <Input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="max-w-[360px] h-[34px]"
              required
            />
          </FormRow>
          <div className="flex gap-2 pt-2.5">
            <Button type="submit" size="sm" disabled={pwLoading}>
              {pwLoading ? "Updating..." : "Update password"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setCurrentPw("");
                setNewPw("");
                setConfirmPw("");
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </AccountCard>

      <AccountCard
        title="Two-factor authentication"
        sub="Required for production approvals and secret rotation."
        action={
          <Badge variant="success">
            Enabled · TOTP
          </Badge>
        }
      >
        {/* TODO: 2FA management endpoints not yet available — UI is display-only */}
        <div className="flex flex-col gap-2.5">
          {TFA_OPTIONS.map(({ id, title, sub }) => {
            const active = id === tfa;
            return (
              <label
                key={id}
                className="flex cursor-pointer items-start gap-3 rounded-md p-3.5"
                style={{
                  border: active
                    ? "1px solid var(--brand-signal-dim)"
                    : "1px solid var(--border)",
                  background: active
                    ? "color-mix(in oklab, var(--brand-signal) 5%, transparent)"
                    : "transparent",
                }}
              >
                <input
                  type="radio"
                  name="tfa"
                  checked={active}
                  onChange={() => setTfa(id)}
                  className="mt-0.5"
                  style={{ accentColor: "var(--brand-signal)" }}
                />
                <div className="flex-1">
                  <div className="text-[13px] font-medium">{title}</div>
                  <div className="mt-0.5 text-[12px] text-fg-muted">{sub}</div>
                </div>
                {active && (
                  <Button variant="outline" size="sm" type="button" disabled>
                    Manage
                  </Button>
                )}
              </label>
            );
          })}
        </div>
      </AccountCard>

      <AccountCard
        title="Recovery codes"
        sub="Generate one-time codes for account recovery."
        action={
          /* TODO: hook up regenerate when API is available */
          <Button variant="outline" size="sm" type="button" disabled>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Regenerate
          </Button>
        }
      >
        {/* TODO: fetch real codes from API when /me/recovery-codes is available */}
        <div className="grid grid-cols-2 gap-2.5 font-mono text-[13px]">
          {PLACEHOLDER_CODES.map((c) => (
            <div
              key={c}
              className="rounded-md border bg-bg-elevated px-3 py-2 text-fg-muted"
            >
              {c}
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-fg-subtle">
          These are placeholder codes. Real codes will load when the API is available.
        </p>
      </AccountCard>
    </>
  );
}

/* ─────────────────────────── Sessions tab ─────────────────────────── */

// TODO: replace with real session data from a /me/sessions API endpoint when available
const PLACEHOLDER_SESSIONS = [
  {
    device: "MacBook Pro · Berlin",
    browser: "Chrome · 124",
    ip: "94.234.117.42",
    current: true,
    last: "now",
    provider: "github",
  },
  {
    device: "iPhone 15 · Berlin",
    browser: "Safari · iOS 17",
    ip: "94.234.117.42",
    current: false,
    last: "12m ago",
    provider: "github",
  },
  {
    device: "Linux desktop · Tokyo",
    browser: "Firefox · 124",
    ip: "203.0.113.18",
    current: false,
    last: "2 days ago",
    provider: "okta",
  },
] as const;

const PLACEHOLDER_HISTORY = [
  { when: "now", where: "94.234.117.42 · Berlin", tone: "ok" as const, note: "github" },
  { when: "12m ago", where: "94.234.117.42 · Berlin", tone: "ok" as const, note: "github" },
  { when: "2 days ago", where: "203.0.113.18 · Tokyo", tone: "info" as const, note: "okta · approved" },
  { when: "5 days ago", where: "94.234.117.42 · Berlin", tone: "ok" as const, note: "github" },
  { when: "12 days ago", where: "172.16.4.9 · unknown", tone: "fail" as const, note: "blocked · geo policy" },
];

const thCell = "px-4 py-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-muted text-left";
const tdCell = "px-4 py-3 align-middle";

function SessionsSection() {
  return (
    <>
      <AccountCard
        title="Active sessions"
        sub={`${PLACEHOLDER_SESSIONS.length} devices currently signed in.`}
        action={
          /* TODO: wire to DELETE /me/sessions/others when available */
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled
            className="text-accent-danger"
            style={{
              borderColor: "color-mix(in oklab, var(--accent-danger) 40%, var(--border))",
            }}
          >
            Revoke all others
          </Button>
        }
      >
        {/* TODO: load from /me/sessions when API is available */}
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className={thCell}>Device</th>
              <th className={thCell}>IP</th>
              <th className={thCell}>Provider</th>
              <th className={thCell}>Last seen</th>
              <th className={cn(thCell, "text-right")}>Action</th>
            </tr>
          </thead>
          <tbody>
            {PLACEHOLDER_SESSIONS.map((s, i) => (
              <tr key={i} className="border-t">
                <td className={tdCell}>
                  <div className="font-medium">{s.device}</div>
                  <div className="font-mono text-[11px] text-fg-subtle">
                    {s.browser}
                  </div>
                </td>
                <td className={cn(tdCell, "font-mono text-fg-muted")}>{s.ip}</td>
                <td className={cn(tdCell, "font-mono text-fg-muted")}>{s.provider}</td>
                <td className={cn(tdCell, "text-fg-muted")}>{s.last}</td>
                <td className={cn(tdCell, "text-right")}>
                  {s.current ? (
                    <Badge variant="success" className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full bg-accent-success"
                      />
                      this device
                    </Badge>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      disabled
                      className="text-accent-danger"
                    >
                      Revoke
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AccountCard>

      <AccountCard title="Login history" sub="Last 5 sign-ins.">
        {/* TODO: load from /me/login-history when API is available */}
        <ul className="m-0 list-none p-0">
          {PLACEHOLDER_HISTORY.map((h, i) => (
            <li
              key={i}
              className={cn(
                "flex items-center gap-3.5 py-2.5 text-[13px]",
                i > 0 && "border-t",
              )}
            >
              <StatusDot tone={h.tone} />
              <div className="flex-1">
                <div className="font-mono text-[12px]">{h.where}</div>
                <div className="mt-0.5 font-mono text-[11.5px] text-fg-subtle">
                  {h.note}
                </div>
              </div>
              <span className="font-mono text-[11px] text-fg-subtle">{h.when}</span>
            </li>
          ))}
        </ul>
      </AccountCard>
    </>
  );
}

/* ─────────────────────────── Preferences tab ─────────────────────────── */

// TODO: preferences (theme, density, notifications) have no dedicated API.
// They are persisted locally via state here. When a /me/preferences endpoint
// is added, replace useState with an API-backed approach.

type ThemeOption = "dark" | "light" | "system";
type DensityOption = "comfortable" | "compact";

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border bg-bg-elevated p-0.5">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={cn(
              "inline-flex h-7 cursor-pointer items-center justify-center rounded-md px-3 text-[12.5px] font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-[inset_0_0_0_1px_var(--border-strong)]"
                : "bg-transparent text-fg-muted hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const PREF_NOTIFICATIONS = [
  { id: "failures", title: "Pipeline failures on projects I own", sub: "Slack DM + email", defaultOn: true },
  { id: "approvals", title: "Approvals waiting on me", sub: "Slack DM", defaultOn: true },
  { id: "mentions", title: "@mentions in comments", sub: "Slack DM", defaultOn: true },
  { id: "digest", title: "Weekly digest · pipelines & deploys", sub: "Email · Mon 9am", defaultOn: true },
  { id: "security", title: "Security alerts on my workspace", sub: "Email + SMS", defaultOn: true },
  { id: "marketing", title: "Product updates from Arcentra", sub: "Email · monthly", defaultOn: false },
];

function PreferencesSection() {
  const [theme, setTheme] = useState<ThemeOption>("dark");
  const [density, setDensity] = useState<DensityOption>("comfortable");
  const [pulseAnim, setPulseAnim] = useState(true);
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(PREF_NOTIFICATIONS.map((n) => [n.id, n.defaultOn])),
  );

  const themeIcons = { dark: Moon, light: Sun, system: Monitor };

  return (
    <>
      <AccountCard title="Appearance" sub="Visual preferences for this account.">
        <FormRow label="Theme" hint="Light, dark, or follow the system.">
          <SegmentedControl<ThemeOption>
            options={[
              { id: "dark", label: "Dark" },
              { id: "light", label: "Light" },
              { id: "system", label: "System" },
            ]}
            value={theme}
            onChange={setTheme}
          />
          {(() => {
            const Icon = themeIcons[theme];
            return <Icon className="ml-2 inline-block h-3.5 w-3.5 text-fg-subtle" />;
          })()}
        </FormRow>
        <FormRow label="Density" hint="Compact rows fit more data per screen.">
          <SegmentedControl<DensityOption>
            options={[
              { id: "comfortable", label: "Comfortable" },
              { id: "compact", label: "Compact" },
            ]}
            value={density}
            onChange={setDensity}
          />
        </FormRow>
        <FormRow
          label="Accent dot animation"
          hint="Pulsing dots on running pipelines."
        >
          <Switch
            checked={pulseAnim}
            onCheckedChange={setPulseAnim}
            aria-label="Toggle accent dot animation"
          />
        </FormRow>
      </AccountCard>

      <AccountCard
        title="Notifications"
        sub="Personal channel · separate from workspace alerts."
      >
        {PREF_NOTIFICATIONS.map((n) => (
          <div
            key={n.id}
            className="flex items-center gap-3.5 border-b py-3 last:border-b-0"
          >
            <div className="flex-1">
              <div className="text-[13px] font-medium">{n.title}</div>
              <div className="mt-0.5 font-mono text-[12px] text-fg-subtle">
                {n.sub}
              </div>
            </div>
            <Switch
              checked={notifPrefs[n.id]}
              onCheckedChange={(v) =>
                setNotifPrefs((prev) => ({ ...prev, [n.id]: v }))
              }
              aria-label={n.title}
            />
          </div>
        ))}
      </AccountCard>

      <AccountCard title="Defaults" sub="Where the app sends you by default.">
        {/* TODO: persist defaults when /me/preferences API is available */}
        <FormRow label="Default landing page" hint="Where the app navigates after login.">
          <Input
            defaultValue="/"
            className="max-w-[360px] h-[34px] font-mono text-[13px]"
            disabled
          />
        </FormRow>
        <FormRow label="Default time range" hint="For Observe charts.">
          <Input
            defaultValue="6h"
            className="max-w-[360px] h-[34px] font-mono text-[13px]"
            disabled
          />
        </FormRow>
      </AccountCard>
    </>
  );
}

/* ─────────────────────────── API tokens tab ─────────────────────────── */

// TODO: replace with real data from /me/tokens API when available
const PLACEHOLDER_TOKENS = [
  { name: "My CLI", scopes: "wrk:read · pipe:run", lastUsed: "32d ago", expires: "12d" },
  { name: "Local dev macbook", scopes: "wrk:read", lastUsed: "1d ago", expires: "47d" },
  {
    name: "github-actions · pr",
    scopes: "pipe:run · deploy:read",
    lastUsed: "never",
    expires: "expired",
  },
];

function PersonalTokensSection() {
  return (
    <AccountCard
      title="Personal API tokens"
      sub="Tokens scoped to your identity. Workspace-wide tokens live under Settings."
      action={
        /* TODO: implement new token dialog when /me/tokens POST API is available */
        <Button variant="default" size="sm" type="button" disabled>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New token
        </Button>
      }
    >
      {/* TODO: load from /me/tokens when API is available */}
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={cn(thCell, "pl-0")}>Name</th>
            <th className={thCell}>Scopes</th>
            <th className={thCell}>Last used</th>
            <th className={cn(thCell, "pr-0 text-right")}>Expires</th>
          </tr>
        </thead>
        <tbody>
          {PLACEHOLDER_TOKENS.map((t) => (
            <tr key={t.name} className="border-t">
              <td className={cn(tdCell, "pl-0 font-medium")}>{t.name}</td>
              <td className={cn(tdCell, "font-mono text-[11px] text-fg-muted")}>{t.scopes}</td>
              <td className={cn(tdCell, "text-fg-muted")}>{t.lastUsed}</td>
              <td
                className={cn(
                  tdCell,
                  "pr-0 text-right font-mono",
                  t.expires === "expired" ? "text-accent-danger" : "text-fg-subtle",
                )}
              >
                {t.expires}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </AccountCard>
  );
}

/* ─────────────────────────── Page root ─────────────────────────── */

const AccountPage: FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const section: AccountTab = isAccountTab(rawTab) ? rawTab : "profile";
  const setSection = (next: AccountTab) => {
    const params = new URLSearchParams(searchParams);
    if (next === "profile") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  };
  const { userinfo } = userStore.useState();

  const initials = userinfo?.fullName
    ? userinfo.fullName
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0]?.toUpperCase() ?? "")
        .join("")
    : (userinfo?.username?.slice(0, 2).toUpperCase() ?? "??");

  const roleName =
    typeof userStore.getState().role === "string"
      ? (userStore.getState().role as string)
      : ((userStore.getState().role as { displayName?: string; name?: string })
          ?.displayName ??
        (userStore.getState().role as { name?: string })?.name ??
        "member");

  return (
    <section className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader
        eyebrow="account / personal"
        title="Account"
        sub="Your profile, security and personal preferences — separate from workspace settings."
      />

      <div className="grid items-start gap-6 md:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <div>
          {/* Identity card */}
          <div className="mb-3.5 flex items-center gap-3 rounded-md border bg-background p-3.5">
            <span
              className="inline-flex shrink-0 items-center justify-center rounded-full border bg-bg-elevated font-mono text-[13px] font-semibold"
              style={{ width: 40, height: 40 }}
            >
              {initials}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium">
                {userinfo?.fullName || userinfo?.username || "—"}
              </div>
              <div className="font-mono text-[10.5px] text-fg-subtle">
                {userinfo?.username ? `${userinfo.username} · ` : ""}
                {roleName}
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex flex-col gap-0.5" aria-label="Account sections">
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = id === section;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSection(id)}
                  aria-current={active ? "page" : undefined}
                  style={
                    active
                      ? { boxShadow: "inset 2px 0 0 0 var(--brand-signal)" }
                      : undefined
                  }
                  className={cn(
                    "flex h-[34px] cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] transition-colors",
                    active
                      ? "bg-bg-elevated font-medium text-foreground"
                      : "text-fg-muted hover:bg-accent/40 hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Section body */}
        <div className="flex min-w-0 flex-col gap-4">
          {section === "profile" && <ProfileSection />}
          {section === "security" && <SecuritySection />}
          {section === "sessions" && <SessionsSection />}
          {section === "preferences" && <PreferencesSection />}
          {section === "tokens" && <PersonalTokensSection />}
        </div>
      </div>
    </section>
  );
};

export default AccountPage;
