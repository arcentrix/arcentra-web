import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "@/lib/toast";
import { Eye, EyeOff } from "lucide-react";
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
import { Apis } from "@/api";
import { APP_LOGO } from "@/constants/assets";

export function RegisterForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState<boolean>(false);
  const { register, handleSubmit } = useForm();
  const navigate = useNavigate();

  const onSubmit = handleSubmit(async (data) => {
    setIsLoading(true);

    if (data.password !== data.confirmPassword) {
      toast.error("Passwords do not match");
      setIsLoading(false);
      return;
    }

    if (data.password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      setIsLoading(false);
      return;
    }

    try {
      const username = data.email.split("@")[0];

      await Apis.auth.register({
        username: username,
        email: data.email,
        password: data.password,
      });
      toast.success("Registration successful!", "Please login to continue.");
      navigate("/login");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  });

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <Link
              to="/"
              className="flex flex-col items-center gap-2 font-medium"
            >
              <img
                alt="Arcentra"
                src={APP_LOGO}
                className="h-9 w-auto dark:invert"
              />
              <span className="sr-only">Arcentra</span>
            </Link>
            <h1 className="text-xl font-bold">Create your account</h1>
            <FieldDescription>
              Already have an account?{" "}
              <Link to="/login" className="underline underline-offset-4">
                Sign in
              </Link>
            </FieldDescription>
          </div>

          <Field>
            <FieldLabel htmlFor="name" required>
              Full Name
            </FieldLabel>
            <Input
              {...register("name", { required: true })}
              id="name"
              type="text"
              placeholder="John Doe"
              disabled={isLoading}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="email" required>
              Email
            </FieldLabel>
            <Input
              {...register("email", { required: true })}
              id="email"
              type="email"
              placeholder="m@example.com"
              autoComplete="email"
              disabled={isLoading}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="password" required>
              Password
            </FieldLabel>
            <div className="relative">
              <Input
                {...register("password", { required: true, minLength: 8 })}
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
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
            <FieldDescription>
              Must be at least 8 characters long.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="confirm-password" required>
              Confirm Password
            </FieldLabel>
            <div className="relative">
              <Input
                {...register("confirmPassword", { required: true })}
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                disabled={isLoading}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                disabled={isLoading}
                aria-label={
                  showConfirmPassword ? "Hide password" : "Show password"
                }
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </Field>

          <Field>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Create Account
            </Button>
          </Field>
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our{" "}
        <a href="#" className="underline underline-offset-4">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="#" className="underline underline-offset-4">
          Privacy Policy
        </a>
        .
      </FieldDescription>
    </div>
  );
}
