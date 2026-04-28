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
  FieldSeparator,
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
import { APP_LOGO } from "@/constants/assets";
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

  const applyLoginSession = (
    response: Awaited<ReturnType<typeof Apis.auth.login>>,
  ) => {
    userStore.updateState((state) => {
      state.userinfo = response.userinfo;
      state.role = response.role;
    });
    authStore.setTokens(response.token);
    navigate("/");
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
      const response = await Apis.auth.login({
        username: data.username,
        password: data.password,
        authMethod: "standard",
      });
      applyLoginSession(response);
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
      applyLoginSession(response);
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
          <div className="flex flex-col items-center gap-4 pb-2 text-center">
            <Link to="/" className="flex items-center font-medium">
              <img
                alt="Arcentra"
                src={APP_LOGO}
                className="h-7 w-auto dark:invert"
              />
              <span className="sr-only">Arcentra</span>
            </Link>
            <h1 className="text-lg font-semibold tracking-tight">
              Welcome back
            </h1>
          </div>

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
            />
          </Field>

          <Field>
            <div className="flex items-center">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <button
                type="button"
                className="ml-auto text-xs underline-offset-4 hover:underline cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
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
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
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

          <Field className="space-y-3">
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Login
            </Button>
            <FieldDescription className="text-center text-xs">
              Don&apos;t have an account?{" "}
              <Link
                to="/register"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Sign up
              </Link>
            </FieldDescription>
          </Field>

          {providers.length > 0 && (
            <>
              <FieldSeparator>Or</FieldSeparator>
              <Field
                className={cn(
                  "grid gap-4",
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
