// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createSequentialIdGenerator } from "./ids";

describe("createSequentialIdGenerator", () => {
  it("produces padded, increasing IDs", () => {
    const next = createSequentialIdGenerator("ACC", 4);
    expect([next(), next(), next()]).toEqual(["ACC-0001", "ACC-0002", "ACC-0003"]);
  });

  it("keeps counting past the padding width", () => {
    const next = createSequentialIdGenerator("X", 1);
    for (let i = 0; i < 9; i++) next();
    expect(next()).toBe("X-10");
  });

  it("gives each generator its own sequence", () => {
    const a = createSequentialIdGenerator("A", 1);
    const b = createSequentialIdGenerator("B", 1);
    a();
    expect(b()).toBe("B-1");
  });
});
