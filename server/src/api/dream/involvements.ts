/** PATCH /dreams/pending/node-score-involvements — 2a category fix. */

import { getPendingRun } from "../../store/dreams/dream-runs";
import { logInfo } from "../../log";

/** PATCH involvements: change one involvement category while pending. */
export async function handlePatchNodeScoreInvolvements(body?: {
  id?: string;
  category?: string;
}): Promise<Response> {
  const pending = await getPendingRun();
  if (!pending) {
    return Response.json(
      { error: "no_pending", message: "no pending dream to act on" },
      { status: 409 },
    );
  }

  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const category = typeof body?.category === "string" ? body.category.trim() : "";
  if (!id) {
    return Response.json(
      { error: "missing_id", message: "Body field `id` is required." },
      { status: 400 },
    );
  }
  if (!category) {
    return Response.json(
      { error: "missing_category", message: "Body field `category` is required." },
      { status: 400 },
    );
  }

  try {
    const {
      patchInvolvementCategory,
      PatchInvalidCategoryError,
      InvolvementNotFoundError,
    } = await import("../../dream/score/involvements");
    const row = await patchInvolvementCategory(pending.id, id, category);
    logInfo("node-score involvement patched", {
      dream_run_id: pending.id,
      id: row.id,
      category: row.category,
    });
    return Response.json({
      ok: true,
      id: row.id,
      category: row.category,
      reason: row.reason ?? null,
    });
  } catch (e) {
    const { PatchInvalidCategoryError, InvolvementNotFoundError } = await import(
      "../../dream/score/involvements"
    );
    if (e instanceof PatchInvalidCategoryError) {
      return Response.json(
        {
          error: "invalid_category",
          message: `category must be mention | update | focus (got ${e.category})`,
        },
        { status: 400 },
      );
    }
    if (e instanceof InvolvementNotFoundError) {
      return Response.json(
        {
          error: "involvement_not_found",
          message: `id not in involvements artifact: ${e.id}`,
        },
        { status: 404 },
      );
    }
    throw e;
  }
}
