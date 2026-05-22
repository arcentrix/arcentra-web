import type { FC } from "react";
import { LoginForm } from "@/components/login-form";

interface LoginProps {}

const Login: FC<LoginProps> = () => {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-background">
      {/* dot-grid background — gentler than blueprint-bg for full-bleed login surfaces */}
      <div className="pointer-events-none absolute inset-0 grid-bg fade-mask-radial" />

      <div className="relative flex flex-1 items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <LoginForm />
        </div>
      </div>

      <footer className="relative pb-6 text-center text-[11px] text-fg-subtle">
        <a
          href="#"
          className="underline-offset-4 hover:text-fg-muted hover:underline"
        >
          Terms of Service
        </a>
        <span className="mx-2">·</span>
        <a
          href="#"
          className="underline-offset-4 hover:text-fg-muted hover:underline"
        >
          Privacy Policy
        </a>
      </footer>
    </div>
  );
};

export default Login;
