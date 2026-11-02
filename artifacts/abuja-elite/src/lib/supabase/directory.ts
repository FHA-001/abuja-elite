import { useQuery } from "@tanstack/react-query";
import type { Json } from "./database.types";
import { getSupabaseClient } from "./client";

/* ------------------------------------------------------------------ directory */

export type DirectoryMember = {
  user_id: string;
  full_name: string;
  photo_path: string | null;
  business_name: string | null;
  profession: string | null;
  industry: string | null;
  location: string | null;
  bio: string | null;
  skills: string[];
  linkedin_url: string | null;
  instagram_url: string | null;
  website_url: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
};

export type DirectoryFilters = { industries: string[]; locations: string[]; skills: string[] };
export const DIRECTORY_PAGE = 24;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

function parseMember(raw: unknown): DirectoryMember {
  const d = (raw ?? {}) as Record<string, unknown>;
  return {
    user_id: String(d.user_id ?? ""),
    full_name: String(d.full_name ?? "Member"),
    photo_path: str(d.photo_path),
    business_name: str(d.business_name),
    profession: str(d.profession),
    industry: str(d.industry),
    location: str(d.location),
    bio: str(d.bio),
    skills: Array.isArray(d.skills) ? d.skills.filter((x): x is string => typeof x === "string") : [],
    linkedin_url: str(d.linkedin_url),
    instagram_url: str(d.instagram_url),
    website_url: str(d.website_url),
    email: str(d.email),
    phone: str(d.phone),
    whatsapp: str(d.whatsapp),
  };
}

export async function searchDirectory(input: {
  query: string; industry: string; location: string; skill: string; page: number;
}): Promise<{ total: number; rows: DirectoryMember[] }> {
  const { data, error } = await getSupabaseClient().rpc("search_directory", {
    p_query: input.query.trim() || null,
    p_industry: input.industry || null,
    p_location: input.location || null,
    p_skill: input.skill || null,
    p_limit: DIRECTORY_PAGE,
    p_offset: input.page * DIRECTORY_PAGE,
  });
  if (error) throw new Error("The member list could not load. Please try again.");
  const d = (data ?? {}) as Record<string, Json | undefined>;
  return {
    total: typeof d.total === "number" ? d.total : 0,
    rows: Array.isArray(d.rows) ? d.rows.map(parseMember) : [],
  };
}

export async function getDirectoryFilters(): Promise<DirectoryFilters> {
  const { data, error } = await getSupabaseClient().rpc("directory_filters");
  if (error) return { industries: [], locations: [], skills: [] };
  const d = (data ?? {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return { industries: list(d.industries), locations: list(d.locations), skills: list(d.skills) };
}

/** A short-lived link to a member's photo. Shows only for people allowed to see it. */
export function useSignedPhoto(path: string | null | undefined) {
  return useQuery({
    queryKey: ["profile-photo", path],
    enabled: Boolean(path),
    staleTime: 50 * 60_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().storage.from("profile-photos").createSignedUrl(path as string, 3600);
      if (error || !data) throw new Error("Photo unavailable");
      return data.signedUrl;
    },
  });
}

/* ------------------------------------------------------------------ own profile */

export type MyProfile = {
  full_name: string;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  photo_path: string | null;
  business_name: string | null;
  profession: string | null;
  industry: string | null;
  location: string | null;
  bio: string | null;
  skills: string[];
  linkedin_url: string | null;
  instagram_url: string | null;
  website_url: string | null;
  show_email: boolean;
  show_phone: boolean;
  show_whatsapp: boolean;
  listed: boolean;
  updated_at: string;
};

const PROFILE_COLUMNS =
  "full_name,email,phone,whatsapp,photo_path,business_name,profession,industry,location,bio,skills,linkedin_url,instagram_url,website_url,show_email,show_phone,show_whatsapp,listed,updated_at";

export async function getMyProfile(userId: string): Promise<MyProfile | null> {
  const { data, error } = await getSupabaseClient().from("profiles").select(PROFILE_COLUMNS).eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Your profile could not load. Please try again.");
  return data as MyProfile | null;
}

export type ProfileEdits = Omit<MyProfile, "email" | "photo_path" | "updated_at">;

export async function saveMyProfile(userId: string, values: ProfileEdits): Promise<void> {
  const { data, error } = await getSupabaseClient().from("profiles").update(values).eq("user_id", userId).select("user_id").maybeSingle();
  if (error || !data) throw new Error("Your profile could not be saved. Please check your connection and try again.");
}

/* ------------------------------------------------------------------ photo upload */

const PHOTO_MAX_SIDE = 900;

/** Shrinks a phone photo to a sensible size before uploading (fast, and saves storage). */
async function shrinkImage(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Please choose a JPG, PNG or WebP photo.");
  if (file.size > 25 * 1024 * 1024) throw new Error("That photo is too large. Please choose a smaller one.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("That photo could not be read. Please try another.");
  }
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not prepare the photo.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  if (!blob) throw new Error("Your browser could not prepare the photo.");
  return blob;
}

export async function uploadProfilePhoto(userId: string, file: File): Promise<string> {
  const blob = await shrinkImage(file);
  const client = getSupabaseClient();
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const up = await client.storage.from("profile-photos").upload(path, blob, { contentType: "image/jpeg", cacheControl: "3600", upsert: false });
  if (up.error) throw new Error("The photo could not be uploaded. Please try again.");
  const { data, error } = await client.from("profiles").update({ photo_path: path }).eq("user_id", userId).select("user_id").maybeSingle();
  if (error || !data) throw new Error("The photo uploaded but could not be saved to your profile. Please try again.");
  // Tidy up older photos (best effort; the profile already points at the new one).
  const list = await client.storage.from("profile-photos").list(userId, { limit: 20 });
  const old = (list.data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== path);
  if (old.length) await client.storage.from("profile-photos").remove(old);
  return path;
}

/* ------------------------------------------------------------------ links */

/** Turns what someone typed into a safe web address, or null if it is not one. */
export function normalizeUrl(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.href.length <= 300 ? url.href : null;
  } catch {
    return null;
  }
}

/** A WhatsApp chat link from a phone number (Nigerian numbers starting with 0 become +234). */
export function whatsappLink(raw: string): string | null {
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) digits = `234${digits.slice(1)}`;
  return digits.length >= 8 && digits.length <= 15 ? `https://wa.me/${digits}` : null;
}

export function telLink(raw: string): string | null {
  const cleaned = raw.replace(/[^\d+]/g, "");
  return cleaned.length >= 6 ? `tel:${cleaned}` : null;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "AE";
}
