import { expect, test } from "bun:test";
import { isValidNodeId } from "./id.ts";

test("isValidNodeId aligns with Engram path safety", () => {
  expect(isValidNodeId("zhou-qiming")).toBe(true);
  expect(isValidNodeId("虛構甲")).toBe(true);
  expect(isValidNodeId("../x")).toBe(false);
  expect(isValidNodeId("a/b")).toBe(false);
});
