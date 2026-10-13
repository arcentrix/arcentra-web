import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";
import { Apis } from "@/api";
import authStore from "@/store/auth";
import userStore from "@/store/user";
import { toast } from "@/lib/toast";

vi.mock("@/api", () => ({
  Apis: {
    user: { getUserInfo: vi.fn() },
    auth: {
      login: vi.fn(),
      listLoginProviders: vi.fn().mockResolvedValue([]),
    },
  },
}));
vi.mock("@/store/user", () => ({
  default: { updateState: vi.fn(), clearUserinfo: vi.fn() },
}));
vi.mock("@/store/auth", () => ({
  default: { setTokens: vi.fn(), clearTokens: vi.fn() },
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(Apis.user.getUserInfo).mockResolvedValue({
    username: "ci-admin",
    userId: "ci-user",
    fullName: "",
    avatar: "",
    email: "ci-admin@example.test",
    phone: "",
  });
  vi.mocked(Apis.auth.login).mockResolvedValue({
    token: {
      accessToken: "synthetic-test-token",
      refreshToken: "synthetic-test-token",
    },
    role: "user",
  } as Awaited<ReturnType<typeof Apis.auth.login>>);
});

describe("standard login identifier", () => {
  it.each([
    ["  ci-admin  ", { username: "ci-admin" }],
    ["  ci-admin@example.test  ", { email: "ci-admin@example.test" }],
  ])("sends the correct backend field for %s", async (identifier, identity) => {
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>,
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "Email / Username" }),
      { target: { value: identifier } },
    );
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: "test-only-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Login" }));
    await waitFor(() =>
      expect(Apis.auth.login).toHaveBeenCalledWith({
        ...identity,
        password: "test-only-password",
        authMethod: "standard",
      }),
    );
    expect(Apis.auth.login).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(Apis.user.getUserInfo).toHaveBeenCalledTimes(1));
    expect(authStore.setTokens).toHaveBeenCalled();
    expect(userStore.updateState).toHaveBeenCalled();
  });
  it("clears the partial session when the authenticated profile fetch fails", async () => {
    vi.mocked(Apis.user.getUserInfo).mockRejectedValue(
      new Error("Profile unavailable"),
    );
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>,
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "Email / Username" }),
      { target: { value: "ci-admin" } },
    );
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: "test-only-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Login" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Profile unavailable"),
    );
    expect(authStore.clearTokens).toHaveBeenCalledTimes(1);
    expect(userStore.clearUserinfo).toHaveBeenCalledTimes(1);
    expect(userStore.updateState).not.toHaveBeenCalled();
  });
});
