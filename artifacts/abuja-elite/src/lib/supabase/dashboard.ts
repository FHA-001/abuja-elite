import { getSupabaseClient } from "./client";

/* Everything here is for paid members (the database enforces it). */

export type Announcement = { id: string; title: string; body: string; pinned: boolean; published_at: string };
export type DashEvent = { id: string; title: string; slug: string; starts_at: string; location: string | null };
export type DashOpportunity = { id: string; name: string; slug: string; category: string | null };
export type NewMember = {
  user_id: string; full_name: string; photo_path: string | null;
  profession: string | null; business_name: string | null; location: string | null;
};

export async function listAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await getSupabaseClient()
    .from("announcements")
    .select("id,title,body,pinned,published_at")
    .eq("published", true)
    .lte("published_at", new Date().toISOString())
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(12);
  if (error) throw new Error("Announcements could not load.");
  return data ?? [];
}

export async function listUpcomingEvents(): Promise<DashEvent[]> {
  const { data, error } = await getSupabaseClient()
    .from("events")
    .select("id,title,slug,starts_at,location")
    .eq("published", true)
    .eq("status", "scheduled")
    .gte("starts_at", new Date(Date.now() - 3 * 3600_000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(4);
  if (error) throw new Error("Events could not load.");
  return data ?? [];
}

export async function listOpportunities(): Promise<DashOpportunity[]> {
  const { data, error } = await getSupabaseClient()
    .from("collaborations")
    .select("id,name,slug,category")
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(3);
  if (error) throw new Error("Opportunities could not load.");
  return data ?? [];
}

export async function listNewMembers(): Promise<NewMember[]> {
  const { data, error } = await getSupabaseClient().rpc("recent_members", { p_limit: 6 });
  if (error) throw new Error("New members could not load.");
  const rows = Array.isArray(data) ? data : [];
  return rows.map((r) => {
    const d = r as Record<string, unknown>;
    const s = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
    return {
      user_id: String(d.user_id ?? ""), full_name: String(d.full_name ?? "Member"), photo_path: s(d.photo_path),
      profession: s(d.profession), business_name: s(d.business_name), location: s(d.location),
    };
  });
}
