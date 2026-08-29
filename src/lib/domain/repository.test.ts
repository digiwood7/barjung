import { describe, expect, it } from "vitest";
import { createDemoRepository } from "./repository";

describe("demo repository", () => {
  it("creates, updates, and removes a customer through one contract", async () => {
    const repo = createDemoRepository({ properties: [], employees: [], customers: [] });
    const created = await repo.customers.create({
      name: "김고객", phone: "010-1111-2222", interest: "북문 원룸", budget: "월 45 이하",
      followUp: "내일", note: "채광 우선",
    });
    await repo.customers.update(created.id, { note: "주차 우선" });
    expect((await repo.customers.list())[0]?.note).toBe("주차 우선");
    await repo.customers.remove(created.id);
    expect(await repo.customers.list()).toEqual([]);
  });
});
