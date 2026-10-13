import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "@/lib/toast";
import { Eye, EyeOff, KeyRound, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Apis } from "@/api";
import userStore from "@/store/user";
import authStore from "@/store/auth";
import { LogoLockup } from "@/components/logo-lockup";
import type { IdentityProvider } from "@/api/auth/types";

const SUPPORTED_PROVIDER_TYPES = new Set(["oauth", "oidc", "ldap"]);

const providerIcons: Record<string, React.ReactNode> = {
  github: <Icons.GitHub className="size-4" />,
  google: <Icons.Google className="size-4" />,
  apple: <Icons.Apple className="size-4" />,
  slack: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="size-4"
    >
      <path
        d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"
        fill="currentColor"
      />
    </svg>
  ),
};

function getProviderIcon(name: string, providerType: string) {
  const key = name.toLowerCase();
  if (providerIcons[key]) return providerIcons[key];
  if (providerType === "ldap") return <Network className="size-4" />;
  return <KeyRound className="size-4" />;
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [providers, setProviders] = useState<IdentityProvider[]>([]);
  const [ldapProvider, setLdapProvider] = useState<IdentityProvider | null>(
    null,
  );
  const [ldapLoading, setLdapLoading] = useState<boolean>(false);
  const [showLdapPassword, setShowLdapPassword] = useState<boolean>(false);
  const { register, handleSubmit } = useForm();
  const {
    register: registerLdap,
    handleSubmit: handleLdapSubmit,
    reset: resetLdap,
  } = useForm<{ username: string; password: string }>();
  const navigate = useNavigate();
  const hasFetchedProvidersRef = useRef(false);

  useEffect(() => {
    if (hasFetchedProvidersRef.current) {
      return;
    }
    hasFetchedProvidersRef.current = true;

    Apis.auth
      .listLoginProviders()
      .then((data) => {
        const filtered = data.filter((p) =>
          SUPPORTED_PROVIDER_TYPES.has(p.providerType),
        );
        const sorted = [...filtered].sort((a, b) => a.priority - b.priority);
        setProviders(sorted);
      })
      .catch(() => {});
  }, []);

  const applyLoginSession = async (
    response: Awaited<ReturnType<typeof Apis.auth.login>>,
  ) => {
    const normalizedRole = Array.isArray(response.role)
      ? ((response.role[0] as any)?.roleId ?? "user")
      : response.role;
    authStore.setTokens(response.token);
    try {
      // Standard login returns tokens and roles, not a user profile. Fetch it
      // through the authenticated endpoint before showing the workspace.
      const userinfo = await Apis.user.getUserInfo();
      userStore.updateState((state) => {
        state.userinfo = userinfo;
        state.role = normalizedRole as any;
      });
      navigate("/");
    } catch (error) {
      authStore.clearTokens();
      userStore.clearUserinfo();
      throw error;
    }
  };

  // 后端约定 authUrl 始终是相对路径（如 /identity/authorize/github），统一拼接 API base
  const buildAuthorizeUrl = (authUrl: string, redirectUri: string) => {
    const apiBase = import.meta.env.VITE_API_CLIENT_URL || "/api/v1";
    const normalizedBase = apiBase.endsWith("/")
      ? apiBase.slice(0, -1)
      : apiBase;
    const path = authUrl.startsWith("/") ? authUrl : `/${authUrl}`;
    const params = new URLSearchParams({
      redirect_uri: redirectUri,
      redirectUri,
    });
    return `${normalizedBase}${path}?${params.toString()}`;
  };

  const startOAuthRedirect = (provider: IdentityProvider) => {
    try {
      setIsLoading(true);
      const providerName = provider.name;
      Object.keys(sessionStorage)
        .filter((key) => key.startsWith("OAUTH_BACKEND_REDIRECTED"))
        .forEach((key) => sessionStorage.removeItem(key));
      sessionStorage.removeItem("OAUTH_INTENT");

      const redirectUri = `${window.location.origin}/auth/callback/${providerName}`;
      const url = buildAuthorizeUrl(provider.authUrl, redirectUri);

      sessionStorage.setItem(
        "OAUTH_INTENT",
        JSON.stringify({ provider: providerName, ts: Date.now() }),
      );
      window.location.href = url;
    } catch (error) {
      toast.error((error as Error).message);
      setIsLoading(false);
    }
  };

  const openLdapDialog = (provider: IdentityProvider) => {
    resetLdap({ username: "", password: "" });
    setShowLdapPassword(false);
    setLdapProvider(provider);
  };

  const handleProviderLogin = (provider: IdentityProvider) => {
    switch (provider.providerType) {
      case "oauth":
      case "oidc":
        startOAuthRedirect(provider);
        return;
      case "ldap":
        openLdapDialog(provider);
        return;
      default:
        toast.error(`Unsupported provider type: ${provider.providerType}`);
    }
  };

  const onSubmit = handleSubmit(async (data) => {
    setIsLoading(true);

    try {
      const identifier = String(data.username).trim();
      const response = await Apis.auth.login({
        ...(identifier.includes("@")
          ? { email: identifier }
          : { username: identifier }),
        password: data.password,
        authMethod: "standard",
      });
      await applyLoginSession(response);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  });

  const onLdapSubmit = handleLdapSubmit(async (data) => {
    if (!ldapProvider) return;
    setLdapLoading(true);
    try {
      const response = await Apis.auth.loginWithLDAP(ldapProvider.name, {
        username: data.username,
        password: data.password,
      });
      await applyLoginSession(response);
      setLdapProvider(null);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLdapLoading(false);
    }
  });

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={onSubmit}>
        <FieldGroup className="space-y-5">
          {/* ── Header: logo lockup + welcome ── */}
          <div className="flex flex-col items-center gap-3.5 pb-1 text-center">
            <Link to="/" aria-label="Arcentra" className="flex items-center">
              <LogoLockup size={28} />
            </Link>
            <h1
              className="display text-[22px] font-semibold"
              style={{ letterSpacing: "-0.02em", margin: 0 }}
            >
              Welcome back
            </h1>
          </div>

          {/* ── Email / Username ── */}
          <Field>
            <FieldLabel htmlFor="username">Email / Username</FieldLabel>
            <Input
              {...register("username", { required: true })}
              id="username"
              type="text"
              placeholder="m@example.com"
              autoCapitalize="none"
              autoComplete="username"
              autoCorrect="off"
              disabled={isLoading}
              required
              className="h-[38px] bg-bg-elevated text-[13px]"
            />
          </Field>

          {/* ── Password ── */}
          <Field>
            <div className="flex items-center">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <button
                type="button"
                className="ml-auto cursor-pointer text-xs text-fg-muted underline-offset-4 transition-colors hover:text-foreground hover:underline"
                onClick={() => {
                  /* TODO: implement forgot password */
                }}
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Input
                {...register("password", { required: true })}
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={isLoading}
                required
                className="h-[38px] bg-bg-elevated pr-10 text-[13px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-fg-muted transition-colors hover:text-foreground"
                disabled={isLoading}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </Field>

          {/* ── Submit + sign-up link ── */}
          <Field className="space-y-3">
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Login
            </Button>
            <FieldDescription className="text-center text-xs text-fg-muted">
              Don&apos;t have an account?{" "}
              <Link
                to="/register"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Sign up
              </Link>
            </FieldDescription>
          </Field>

          {/* ── Social / external providers ── */}
          {providers.length > 0 && (
            <>
              {/* OR separator */}
              <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
                <div className="h-px flex-1 bg-border" />
                <span>Or</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <Field
                className={cn(
                  "grid gap-3",
                  providers.length > 1 && "sm:grid-cols-2",
                )}
              >
                {providers.map((provider) => (
                  <Button
                    key={provider.name}
                    variant="outline"
                    type="button"
                    disabled={isLoading}
                    title={provider.description || undefined}
                    onClick={() => handleProviderLogin(provider)}
                    className="h-[38px] text-[13px]"
                  >
                    {getProviderIcon(provider.name, provider.providerType)}
                    {provider.name}
                  </Button>
                ))}
              </Field>
            </>
          )}
        </FieldGroup>
      </form>

      <Dialog
        open={!!ldapProvider}
        onOpenChange={(open) => {
          if (!open) {
            setLdapProvider(null);
            setShowLdapPassword(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="size-4" />
              Sign in with {ldapProvider?.name}
            </DialogTitle>
            {ldapProvider?.description ? (
              <DialogDescription>{ldapProvider.description}</DialogDescription>
            ) : (
              <DialogDescription>
                Enter your directory credentials to continue.
              </DialogDescription>
            )}
          </DialogHeader>
          <form onSubmit={onLdapSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="ldap-username">Username</FieldLabel>
                <Input
                  {...registerLdap("username", { required: true })}
                  id="ldap-username"
                  type="text"
                  autoCapitalize="none"
                  autoComplete="username"
                  autoCorrect="off"
                  disabled={ldapLoading}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ldap-password">Password</FieldLabel>
                <div className="relative">
                  <Input
                    {...registerLdap("password", { required: true })}
                    id="ldap-password"
                    type={showLdapPassword ? "text" : "password"}
                    autoComplete="current-password"
                    disabled={ldapLoading}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLdapPassword(!showLdapPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                    disabled={ldapLoading}
                    aria-label={
                      showLdapPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showLdapPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </Field>
            </FieldGroup>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                disabled={ldapLoading}
                onClick={() => setLdapProvider(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={ldapLoading}>
                {ldapLoading ? (
                  <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Sign in
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
