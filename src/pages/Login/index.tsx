import type { FC } from "react";
import { LoginForm } from "@/components/login-form";

interface LoginProps {}

const Login: FC<LoginProps> = () => {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <div className="flex flex-1 items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <LoginForm />
        </div>
      </div>
      <footer className="pb-6 text-center text-[11px] text-muted-foreground/70">
        <a
          href="#"
          className="underline-offset-4 hover:text-muted-foreground hover:underline"
        >
          Terms of Service
        </a>
        <span className="mx-2">·</span>
        <a
          href="#"
          className="underline-offset-4 hover:text-muted-foreground hover:underline"
        >
          Privacy Policy
        </a>
      </footer>
    </div>
  );
};

export default Login;
