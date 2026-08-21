/** Attachments API handlers: upload, delete tmp. */

import { config } from "../config";
import {
  ALLOWED_MIME_TYPES,
  deleteTmpFile,
  ensureAttachmentsDir,
  housekeepTmpUploads,
  isValidAttachmentPath,
  writeUploadToTmp,
  type UploadResult,
} from "../store/memories/attachments";
import { logInfo } from "../log";

/** Handle multipart file upload to tmp. */
export async function handleUpload(req: Request): Promise<Response> {
  await ensureAttachmentsDir();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json(
      { error: "invalid_form_data", message: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return Response.json(
      { error: "missing_file", message: "Multipart field 'file' is required" },
      { status: 400 },
    );
  }

  // Validate MIME
  const mime = file.type;
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mime)) {
    return Response.json(
      {
        error: "invalid_mime",
        message: `MIME type '${mime}' not allowed. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  // Validate size
  const maxBytes = config.attachmentMaxBytes;
  if (file.size > maxBytes) {
    return Response.json(
      {
        error: "file_too_large",
        message: `File size ${file.size} exceeds max ${maxBytes} bytes`,
      },
      { status: 400 },
    );
  }

  // Determine candidate filename
  let candidateName: string;
  if (file instanceof File && file.name && file.name.trim()) {
    candidateName = file.name.trim();
    // Sanitize: only take the basename portion
    const lastSlash = Math.max(
      candidateName.lastIndexOf("/"),
      candidateName.lastIndexOf("\\"),
    );
    if (lastSlash >= 0) {
      candidateName = candidateName.slice(lastSlash + 1);
    }
    if (!candidateName) {
      candidateName = `upload${extFromMime(mime)}`;
    }
  } else {
    // No filename: generate UUID
    const uuid = crypto.randomUUID();
    candidateName = `${uuid}${extFromMime(mime)}`;
  }

  // Validate candidate filename
  if (candidateName.includes("..") || candidateName.includes("/") || candidateName.includes("\\")) {
    return Response.json(
      { error: "invalid_filename", message: "Filename contains invalid characters" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result: UploadResult = await writeUploadToTmp(buffer, candidateName, mime);

  logInfo("attachment upload", { path: result.path, day: result.day, filename: result.filename });

  return Response.json(result, { status: 201 });
}

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg": return ".jpg";
    case "image/png": return ".png";
    case "image/webp": return ".webp";
    case "image/gif": return ".gif";
    default: return ".bin";
  }
}

/** Handle DELETE /attachments/uploads/tmp?day=&filename= */
export async function handleDeleteTmp(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const day = url.searchParams.get("day");
  const filename = url.searchParams.get("filename");

  if (!day || !filename) {
    return Response.json(
      { error: "missing_params", message: "Query params 'day' and 'filename' are required" },
      { status: 400 },
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return Response.json(
      { error: "invalid_day", message: "day must be YYYY-MM-DD" },
      { status: 400 },
    );
  }

  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return Response.json(
      { error: "invalid_filename", message: "Invalid filename" },
      { status: 400 },
    );
  }

  await deleteTmpFile(day, filename);

  return Response.json({ deleted: true, day, filename });
}

/** Handle POST /attachments/housekeep — trigger tmp cleanup. */
export async function handleHousekeep(): Promise<Response> {
  const result = await housekeepTmpUploads();
  return Response.json(result);
}

/** Handle GET /attachments/file?path=... — serve an attachment file for preview. */
export async function handleGetFile(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const relPath = url.searchParams.get("path");

  if (!relPath) {
    return Response.json(
      { error: "missing_path", message: "Query param 'path' is required" },
      { status: 400 },
    );
  }

  const parsed = isValidAttachmentPath(relPath);
  if (!parsed.valid) {
    return Response.json(
      { error: "invalid_path", message: "Invalid attachment path" },
      { status: 400 },
    );
  }

  const { readFile } = await import("node:fs/promises");
  const { config } = await import("../config");
  const { join } = await import("node:path");

  // Try formal path first, then tmp
  const formalPath = join(config.storeDir, "memories", relPath);
  const tmpPath = join(config.storeDir, "memories", "_attachments", "uploads", "tmp", parsed.day, parsed.filename);

  let buffer: Buffer;
  try {
    buffer = await readFile(formalPath);
  } catch {
    try {
      buffer = await readFile(tmpPath);
    } catch {
      return Response.json(
        { error: "not_found", message: "File not found" },
        { status: 404 },
      );
    }
  }

  // Determine content type from extension
  const ext = parsed.filename.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  const contentType = mimeMap[ext ?? ""] ?? "application/octet-stream";

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}