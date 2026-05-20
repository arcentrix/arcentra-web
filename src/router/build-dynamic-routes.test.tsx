import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { buildDynamicRoutes } from "./build-dynamic-routes";
import type { PermissionMenuItem } from "@/store/permission";
import permissionStore from "@/store/permission";

const baseMenu = {
  parentId: "",
  name: "forbidden",
  title: "forbidden",
  component: "Forbidden",
  path: "/forbidden",
} satisfies Partial<PermissionMenuItem>;

describe("buildDynamicRoutes", () => {
  afterEach(() => {
    permissionStore.clear();
  });

  it("渲染启用的动态路由页面", async () => {
    const menus: PermissionMenuItem[] = [
      {
        ...baseMenu,
        menuId: "menu-1",
        isEnabled: true,
      } as PermissionMenuItem,
    ];

    render(
      <MemoryRouter initialEntries={["/forbidden"]}>
        <Routes>
          {buildDynamicRoutes(menus)}
          <Route path="*" element={<div>not-found</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Access denied")).toBeInTheDocument();
  });

  it("过滤禁用路由并落到兜底页面", async () => {
    const menus: PermissionMenuItem[] = [
      {
        ...baseMenu,
        menuId: "menu-2",
        path: "/hidden",
        isEnabled: false,
      } as PermissionMenuItem,
    ];

    render(
      <MemoryRouter initialEntries={["/hidden"]}>
        <Routes>
          {buildDynamicRoutes(menus)}
          <Route path="*" element={<div>not-found</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("not-found")).toBeInTheDocument();
  });
});
