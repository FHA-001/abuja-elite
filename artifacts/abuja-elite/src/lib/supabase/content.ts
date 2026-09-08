import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabaseClient } from "./client";
import type { Database } from "./database.types";

const MAX_PAGE_SIZE = 100;

function boundedLimit(limit: number) {
  if (!Number.isFinite(limit)) return 24;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGE_SIZE);
}

function throwDataAccessError(resource: string, error: PostgrestError): never {
  throw new Error(`Unable to load ${resource}: ${error.message}`);
}

export async function listPublishedMembers(limit = 24) {
  const { data, error } = await getSupabaseClient()
    .from("members")
    .select("*")
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(boundedLimit(limit));

  if (error) throwDataAccessError("published members", error);
  return data;
}

export async function listPublishedCollaborations(limit = 24) {
  const { data, error } = await getSupabaseClient()
    .from("collaborations")
    .select("*")
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(boundedLimit(limit));

  if (error) throwDataAccessError("published collaborations", error);
  return data;
}

export async function listPublishedEvents(limit = 24) {
  const { data, error } = await getSupabaseClient()
    .from("events")
    .select("*")
    .eq("published", true)
    .eq("status", "scheduled")
    .order("starts_at", { ascending: true })
    .limit(boundedLimit(limit));

  if (error) throwDataAccessError("published events", error);
  return data;
}

export async function listPublishedStories(limit = 24) {
  const { data, error } = await getSupabaseClient()
    .from("stories")
    .select("*")
    .eq("published", true)
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(boundedLimit(limit));

  if (error) throwDataAccessError("published stories", error);
  return data;
}

export async function listPublishedGalleryItems(limit = 48) {
  const { data, error } = await getSupabaseClient()
    .from("gallery_items")
    .select("*")
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(boundedLimit(limit));

  if (error) throwDataAccessError("published gallery items", error);
  return data;
}

export async function listPublicSiteSettings(limit = 50) {
  const { data, error } = await getSupabaseClient()
    .from("site_settings")
    .select("*")
    .eq("is_public", true)
    .order("setting_key", { ascending: true })
    .limit(boundedLimit(limit));

  if (error) throwDataAccessError("public site settings", error);
  return data;
}

export type PublishedContent = {
  members: Database["public"]["Tables"]["members"]["Row"][];
  collaborations: Database["public"]["Tables"]["collaborations"]["Row"][];
  events: Database["public"]["Tables"]["events"]["Row"][];
  stories: Database["public"]["Tables"]["stories"]["Row"][];
  galleryItems: Database["public"]["Tables"]["gallery_items"]["Row"][];
};

type Tables = Database["public"]["Tables"];

export type AdminContent = {
  members: Tables["members"]["Row"][];
  collaborations: Tables["collaborations"]["Row"][];
  events: Tables["events"]["Row"][];
  stories: Tables["stories"]["Row"][];
  galleryItems: Tables["gallery_items"]["Row"][];
  siteSettings: Tables["site_settings"]["Row"][];
};

export type AdminResource = keyof AdminContent;

export type AdminDashboardCounts = {
  members: number;
  collaborations: number;
  events: number;
  stories: number;
  gallery_items: number;
  site_settings: number;
  new_applications: number;
  new_contact_messages: number;
  event_interests: number;
  subscribed_newsletters: number;
};

function throwAdminDataAccessError(
  resource: string,
  error: PostgrestError,
): never {
  throw new Error(`Unable to ${resource}: ${error.message}`);
}

export async function getAdminDashboardCounts(): Promise<AdminDashboardCounts> {
  const client = getSupabaseClient();
  const [
    members,
    collaborations,
    events,
    stories,
    galleryItems,
    siteSettings,
    newApplications,
    newContactMessages,
    eventInterests,
    subscribedNewsletters,
  ] = await Promise.all([
    client.from("members").select("id", { count: "exact", head: true }),
    client.from("collaborations").select("id", { count: "exact", head: true }),
    client.from("events").select("id", { count: "exact", head: true }),
    client.from("stories").select("id", { count: "exact", head: true }),
    client.from("gallery_items").select("id", { count: "exact", head: true }),
    client.from("site_settings").select("id", { count: "exact", head: true }),
    client
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
    client
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
    client.from("event_interests").select("id", { count: "exact", head: true }),
    client
      .from("newsletter_subscribers")
      .select("id", { count: "exact", head: true })
      .eq("status", "subscribed"),
  ]);

  const firstError = [
    members,
    collaborations,
    events,
    stories,
    galleryItems,
    siteSettings,
    newApplications,
    newContactMessages,
    eventInterests,
    subscribedNewsletters,
  ].find((result) => result.error)?.error;

  if (firstError) throwAdminDataAccessError("load dashboard counts", firstError);

  return {
    members: members.count ?? 0,
    collaborations: collaborations.count ?? 0,
    events: events.count ?? 0,
    stories: stories.count ?? 0,
    gallery_items: galleryItems.count ?? 0,
    site_settings: siteSettings.count ?? 0,
    new_applications: newApplications.count ?? 0,
    new_contact_messages: newContactMessages.count ?? 0,
    event_interests: eventInterests.count ?? 0,
    subscribed_newsletters: subscribedNewsletters.count ?? 0,
  };
}

function normalizeOptionalValues<T extends Record<string, unknown>>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload)
      .filter(([key]) => !["id", "created_at", "updated_at"].includes(key))
      .map(([key, value]) => [key, value === "" ? null : value]),
  ) as T;
}

function normalizeStoryPayload(
  payload: Tables["stories"]["Insert"] | Tables["stories"]["Update"],
) {
  const normalized = normalizeOptionalValues(payload as Record<string, unknown>) as Tables["stories"]["Insert"] | Tables["stories"]["Update"];
  if (normalized.published === true && !normalized.published_at) {
    normalized.published_at = new Date().toISOString();
  }
  return normalized;
}

export async function listAdminMembers() {
  const { data, error } = await getSupabaseClient()
    .from("members")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throwAdminDataAccessError("load members", error);
  return data;
}

export async function listAdminCollaborations() {
  const { data, error } = await getSupabaseClient()
    .from("collaborations")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throwAdminDataAccessError("load collaborations", error);
  return data;
}

export async function listAdminEvents() {
  const { data, error } = await getSupabaseClient()
    .from("events")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throwAdminDataAccessError("load events", error);
  return data;
}

export async function listAdminStories() {
  const { data, error } = await getSupabaseClient()
    .from("stories")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throwAdminDataAccessError("load stories", error);
  return data;
}

export async function listAdminGalleryItems() {
  const { data, error } = await getSupabaseClient()
    .from("gallery_items")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throwAdminDataAccessError("load gallery items", error);
  return data;
}

export async function listAdminSiteSettings() {
  const { data, error } = await getSupabaseClient()
    .from("site_settings")
    .select("*")
    .order("setting_key", { ascending: true });
  if (error) throwAdminDataAccessError("load site settings", error);
  return data;
}

export async function listAdminContent(): Promise<AdminContent> {
  const [members, collaborations, events, stories, galleryItems, siteSettings] =
    await Promise.all([
      listAdminMembers(),
      listAdminCollaborations(),
      listAdminEvents(),
      listAdminStories(),
      listAdminGalleryItems(),
      listAdminSiteSettings(),
    ]);
  return { members, collaborations, events, stories, galleryItems, siteSettings };
}

export async function createAdminMember(
  payload: Tables["members"]["Insert"],
) {
  const { data, error } = await getSupabaseClient()
    .from("members")
    .insert(normalizeOptionalValues(payload as Record<string, unknown>) as Tables["members"]["Insert"])
    .select("*")
    .single();
  if (error) throwAdminDataAccessError("create member", error);
  return data;
}

export async function updateAdminMember(
  id: string,
  payload: Tables["members"]["Update"],
) {
  const { data, error } = await getSupabaseClient()
    .from("members")
    .update(normalizeOptionalValues(payload as Record<string, unknown>) as Tables["members"]["Update"])
    .eq("id", id)
    .select("*")
    .single();
  if (error) throwAdminDataAccessError("update member", error);
  return data;
}

export async function deleteAdminMember(id: string) {
  const { error } = await getSupabaseClient().from("members").delete().eq("id", id);
  if (error) throwAdminDataAccessError("delete member", error);
}

export async function createAdminCollaboration(
  payload: Tables["collaborations"]["Insert"],
) {
  const { data, error } = await getSupabaseClient()
    .from("collaborations")
    .insert(normalizeOptionalValues(payload as Record<string, unknown>) as Tables["collaborations"]["Insert"])
    .select("*")
    .single();
  if (error) throwAdminDataAccessError("create collaboration", error);
  return data;
}

export async function updateAdminCollaboration(
  id: string,
  payload: Tables["collaborations"]["Update"],
) {
  const { data, error } = await getSupabaseClient()
    .from("collaborations")
    .update(normalizeOptionalValues(payload as Record<string, unknown>) as Tables["collaborations"]["Update"])
    .eq("id", id)
    .select("*")
    .single();
  if (error) throwAdminDataAccessError("update collaboration", error);
  return data;
}

export async function deleteAdminCollaboration(id: string) {
  const { error } = await getSupabaseClient().from("collaborations").delete().eq("id", id);
  if (error) throwAdminDataAccessError("delete collaboration", error);
}

export async function createAdminEvent(payload: Tables["events"]["Insert"]) {
  const { data, error } = await getSupabaseClient()
    .from("events")
    .insert(normalizeOptionalValues(payload as Record<string, unknown>) as Tables["events"]["Insert"])
    .select("*")
    .single();
  if (error) throwAdminDataAccessError("create event", error);
  return data;
}

export async function updateAdminEvent(
  id: string,
  payload: Tables["events"]["Update"],
) {
  const { data, error } = await getSupabaseClient()
    .from("events")
    .update(normalizeOptionalValues(payload as Record<string, unknown>) as Tables["events"]["Update"])
    .eq("id", id)
    .select("*")
    .single();
  if (error) throwAdminDataAccessError("update event", error);
  return data;
}

export async function deleteAdminEvent(id: string) {
  const { error } = await getSupabaseClient().from("events").delete().eq("id", id);
  if (error) throwAdminDataAccessError("delete event", error);
}

export async function createAdminStory(payload: Tables["stories"]["Insert"]) {
  const { data, error } = await getSupabaseClient()
    .from("stories")
    .insert(normalizeStoryPayload(payload) as Tables["stories"]["Insert"])
    .select("*")
    .single();
  if (error) throwAdminDataAccessError("create story", error);
  return data;
}

export async function updateAdminStory(
  id: string,
  payload: Tables["stories"]["Update"],
) {
  const { data, error } = await getSupabaseClient()
    .from("stories")
    .update(normalizeStoryPayload(payload))
    .eq("id", id)
    .select("*")
    .single();
  if (error) throwAdminDataAccessError("update story", error);
  return data;
}

export async function deleteAdminStory(id: string) {
  const { error } = await getSupabaseClient().from("stories").delete().eq("id", id);
  if (error) throwAdminDataAccessError("delete story", error);
}

export async function createAdminGalleryItem(
  payload: Tables["gallery_items"]["Insert"],
) {
  const { data, error } = await getSupabaseClient()
    .from("gallery_items")
    .insert(normalizeOptionalValues(payload as Record<string, unknown>) as Tables["gallery_items"]["Insert"])
    .select("*")
    .single();
  if (error) throwAdminDataAccessError("create gallery item", error);
  return data;
}

export async function updateAdminGalleryItem(
  id: string,
  payload: Tables["gallery_items"]["Update"],
) {
  const { data, error } = await getSupabaseClient()
    .from("gallery_items")
    .update(normalizeOptionalValues(payload as Record<string, unknown>) as Tables["gallery_items"]["Update"])
    .eq("id", id)
    .select("*")
    .single();
  if (error) throwAdminDataAccessError("update gallery item", error);
  return data;
}

export async function deleteAdminGalleryItem(id: string) {
  const { error } = await getSupabaseClient().from("gallery_items").delete().eq("id", id);
  if (error) throwAdminDataAccessError("delete gallery item", error);
}

export async function createAdminSiteSetting(
  payload: Tables["site_settings"]["Insert"],
) {
  const { data, error } = await getSupabaseClient()
    .from("site_settings")
    .insert(normalizeOptionalValues(payload as Record<string, unknown>) as Tables["site_settings"]["Insert"])
    .select("*")
    .single();
  if (error) throwAdminDataAccessError("create site setting", error);
  return data;
}

export async function updateAdminSiteSetting(
  id: string,
  payload: Tables["site_settings"]["Update"],
) {
  const { data, error } = await getSupabaseClient()
    .from("site_settings")
    .update(normalizeOptionalValues(payload as Record<string, unknown>) as Tables["site_settings"]["Update"])
    .eq("id", id)
    .select("*")
    .single();
  if (error) throwAdminDataAccessError("update site setting", error);
  return data;
}

export async function deleteAdminSiteSetting(id: string) {
  const { error } = await getSupabaseClient().from("site_settings").delete().eq("id", id);
  if (error) throwAdminDataAccessError("delete site setting", error);
}