/** Node id rules (aligned with Engram `isValidNodeId`). */

export function isValidNodeId(id: string): boolean {
  if (!id || id.includes("/") || id.includes("\\") || id.includes("..")) return false;
  if (id.includes("\0")) return false;
  return true;
}
