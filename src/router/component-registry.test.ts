import { describe, expect, it } from "vitest";
import { componentRegistry, resolveRouteComponent } from "./component-registry";

describe("production page registry", () => {
  it("includes the artifact page without shipping its co-located tests", () => {
    expect(resolveRouteComponent("Project/Artifacts")).not.toBeNull();
    expect(resolveRouteComponent("Project/Artifacts/index.test")).toBeNull();
    expect(
      Object.keys(componentRegistry).some((key) =>
        /\.(test|spec)$|__tests__/.test(key),
      ),
    ).toBe(false);
  });
});
