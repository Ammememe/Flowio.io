/** P3-7: size and type limits, shared by the client (pre-check, nicer error) and the API (real enforcement). */
export const ALLOWED_IMAGE_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const;
export type AllowedImageContentType = (typeof ALLOWED_IMAGE_CONTENT_TYPES)[number];

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export function isAllowedImageContentType(contentType: string): contentType is AllowedImageContentType {
  return (ALLOWED_IMAGE_CONTENT_TYPES as readonly string[]).includes(contentType);
}
