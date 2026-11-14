import { isAllowedImageContentType, MAX_IMAGE_BYTES } from "@flowio/shared";
import { z } from "zod";
import type { AuthContext } from "../auth/types.js";
import type { HandlerResult } from "../handlers.js";
import type { PresignedUpload, UploadPresigner } from "./uploadPresigner.js";

const requestSchema = z.object({
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

/** P3-7: issues a presigned upload for an image, after checking size/type limits. */
export async function createUploadUrl(
  presigner: UploadPresigner,
  auth: AuthContext | null,
  rawBody: unknown,
): Promise<HandlerResult<PresignedUpload>> {
  if (!auth) return { ok: false, status: 401, error: "Missing or invalid Authorization header" };

  const parsed = requestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Invalid upload request", issues: parsed.error.issues };
  }

  const { contentType, sizeBytes } = parsed.data;
  if (!isAllowedImageContentType(contentType)) {
    return { ok: false, status: 400, error: `Unsupported content type: ${contentType}` };
  }
  if (sizeBytes > MAX_IMAGE_BYTES) {
    return { ok: false, status: 400, error: `File too large: max ${MAX_IMAGE_BYTES} bytes` };
  }

  const upload = await presigner.createUploadUrl(auth.userId, contentType, MAX_IMAGE_BYTES);
  return { ok: true, status: 200, body: upload };
}
