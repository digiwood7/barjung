import { describe, expect, it } from "vitest";
import { properties } from "./data";
import { filterProperties, validateLegalDisclosure } from "./selectors";

describe("property selectors", () => {
  it("filters by type and failed distribution", () => {
    expect(filterProperties(properties, { type: "원룸", publish: "failed" }).map((item) => item.id)).toEqual(["p1"]);
  });

  it("reports missing mandatory disclosures", () => {
    expect(validateLegalDisclosure({ ...properties[0].disclosure, direction: "" })).toContain("방향");
  });
});
