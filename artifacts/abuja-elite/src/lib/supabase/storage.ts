import { getSupabaseClient } from "./client";

export const MEDIA_BUCKETS = [
  "member-images",
  "event-images",
  "collaboration-images",
  "story-images",
  "gallery-images",
  "site-assets",
] as const;

export type MediaBucket = (typeof MEDIA_BUCKETS)[number];

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function safeFileName(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}

function validateImage(file: File) {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("Only JPEG, PNG, and WebP images are supported.");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Images must be 5 MiB or smaller.");
  }
}

export async function uploadAdminMedia(
  bucket: MediaBucket,
  file: File,
  folder = "uploads",
) {
  validateImage(file);
  const path = `${folder}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error } = await getSupabaseClient()
    .storage.from(bucket)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(`Unable to upload media: ${error.message}`);
  }

  return path;
}

export async function deleteAdminMedia(bucket: MediaBucket, path: string) {
  const { error } = await getSupabaseClient().storage.from(bucket).remove([path]);
  if (error) {
    throw new Error(`Unable to delete media: ${error.message}`);
  }
}

export async function createAdminMediaPreview(
  bucket: MediaBucket,
  path: string,
  expiresInSeconds = 300,
) {
  const expiresIn = Math.min(Math.max(Math.trunc(expiresInSeconds), 60), 3600);
  const { data, error } = await getSupabaseClient()
    .storage.from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(`Unable to create media preview: ${error.message}`);
  }

  return data.signedUrl;
}