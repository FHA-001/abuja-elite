import { getSupabaseClient } from "./client";

export type AppNotification = {
  id: string; kind: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string;
};

export async function listNotifications(): Promise<AppNotification[]> {
  const { data, error } = await getSupabaseClient()
    .from("notifications")
    .select("id,kind,title,body,link,read_at,created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error("Notifications could not load.");
  return data ?? [];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  if (error) throw new Error("Could not update the notification.");
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await getSupabaseClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
  if (error) throw new Error("Could not update your notifications.");
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(new Date(iso));
}
