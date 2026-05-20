import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import RoutePermissionGuard from "./route-permission-guard";
import permissionStore from "@/store/permission";

describe("RoutePermissionGuard", () => {
  afterEach(() => {
    permissionStore.clear();
  });

  it("允许有权限的路由访问", () => {
    permissionStore.getState().actions = ["pipeline:read"];

    render(
      <MemoryRouter initialEntries={["/secure"]}>
        <Routes>
          <Route
            path="/secure"
            element={
              <RoutePermissionGuard permissionAction="pipeline:read">
                <div>secure-content</div>
              </RoutePermissionGuard>
            }
          />
          <Route path="/403" element={<div>forbidden-page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("secure-content")).toBeInTheDocument();
  });

  it("拒绝无权限访问并跳转到 403", async () => {
    render(
      <MemoryRouter initialEntries={["/secure"]}>
        <Routes>
          <Route
            path="/secure"
            element={
              <RoutePermissionGuard permissionAction="pipeline:read">
                <div>secure-content</div>
              </RoutePermissionGuard>
            }
          />
          <Route path="/403" element={<div>forbidden-page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("forbidden-page")).toBeInTheDocument();
  });
});
