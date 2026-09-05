import { describe, expect, it } from "vitest";

import { getEcosystemHref, getEcosystemRouteHref } from "./apps";

describe("ecosystem routing", () => {
  it("preserves Project context on primary app navigation", () => {
    expect(getEcosystemHref("notebook", "writer", "project 1")).toBe("/notebook/workspace?project=project+1");
  });

  it("routes Project evidence to Writer new without duplicating documents", () => {
    expect(getEcosystemRouteHref("writer", "/new", "writer", "p1", { source: "project", objectId: "o1" }))
      .toBe("/writer/new?project=p1&source=project&objectId=o1");
  });

  it("routes to Mathematics while preserving Project context", () => {
    expect(getEcosystemRouteHref("math", "/laboratory/integral-studio", "writer", "p1"))
      .toBe("/math/laboratory/integral-studio?project=p1");
  });
});
