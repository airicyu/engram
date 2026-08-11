/** Clarify HTTP handlers: list asking, submit, dismiss, aside. */

import { isLocked } from "../store/dreams/lock";
import {
  ClarifyValidationError,
  commitClarifyPaths,
  deleteAskingFile,
  ensureClarifyDirs,
  isValidClarifyId,
  listAskingItems,
  submitAsking,
  withClarifyWriteLock,
  writeAside,
} from "../store/memories/clarify";

function dreamLocked(): Response {
  return Response.json(
    { error: "dream_locked", message: "Dream in progress; clarify write rejected" },
    { status: 409 },
  );
}

function validationResponse(e: ClarifyValidationError): Response {
  return Response.json({ error: e.error, message: e.message }, { status: 400 });
}

/** GET /memories/clarify/asking */
export async function handleClarifyListAsking(): Promise<Response> {
  await ensureClarifyDirs();
  const items = await listAskingItems();
  return Response.json({ items });
}

/** POST /memories/clarify/asking/{id}/submit  body: { answer } */
export async function handleClarifySubmit(
  id: string,
  body: unknown,
): Promise<Response> {
  if (await isLocked()) return dreamLocked();
  if (!isValidClarifyId(id)) {
    return Response.json({ error: "not_found", message: "asking not found" }, { status: 404 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "invalid_body", message: "Expected JSON object" }, { status: 400 });
  }
  const answer = (body as { answer?: unknown }).answer;
  if (typeof answer !== "string") {
    return Response.json({ error: "answer_required", message: "`answer` string is required" }, { status: 400 });
  }

  try {
    const result = await withClarifyWriteLock(async () => {
      const moved = await submitAsking(id, answer);
      if (!moved) return null;
      await commitClarifyPaths(`engram: clarify submit ${id}`);
      return moved;
    });
    if (!result) {
      return Response.json({ error: "not_found", message: "asking not found" }, { status: 404 });
    }
    return Response.json({ id: result.id, queue: "pending" });
  } catch (e) {
    if (e instanceof ClarifyValidationError) return validationResponse(e);
    throw e;
  }
}

/** DELETE /memories/clarify/asking/{id} — dismiss (idempotent 200). */
export async function handleClarifyDismiss(id: string): Promise<Response> {
  if (await isLocked()) return dreamLocked();
  if (!isValidClarifyId(id)) {
    return Response.json({ ok: true, deleted: false });
  }
  await withClarifyWriteLock(async () => {
    const deleted = await deleteAskingFile(id);
    if (deleted) {
      await commitClarifyPaths(`engram: clarify dismiss ${id}`);
    }
  });
  return Response.json({ ok: true });
}

/** POST /memories/clarify/aside  body: { raw } → 201 */
export async function handleClarifyAside(body: unknown): Promise<Response> {
  if (await isLocked()) return dreamLocked();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "invalid_body", message: "Expected JSON object" }, { status: 400 });
  }
  const raw = (body as { raw?: unknown }).raw;
  if (typeof raw !== "string") {
    return Response.json({ error: "raw_required", message: "`raw` string is required" }, { status: 400 });
  }
  try {
    const result = await withClarifyWriteLock(async () => {
      const written = await writeAside(raw);
      await commitClarifyPaths(`engram: clarify aside ${written.id}`);
      return written;
    });
    return Response.json({ id: result.id, queue: "pending" }, { status: 201 });
  } catch (e) {
    if (e instanceof ClarifyValidationError) return validationResponse(e);
    throw e;
  }
}
