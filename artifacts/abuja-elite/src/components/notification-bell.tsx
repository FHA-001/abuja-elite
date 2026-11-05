import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { getSupabaseClient, supabaseConfig } from "@/lib/supabase/client";
import { useMemberSession } from "@/hooks/use-member";
import {
  listNotifications, markAllNotificationsRead, markNotificationRead, timeAgo, type AppNotification,
} from "@/lib/supabase/notifications";
import "./notification-bell.css";

/** The bell: unread count, latest notifications, mark as read. Used by members and by the admin. */
export function NotificationBell() {
  const session = useMemberSession();
  const userId = session.user?.id;
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const key = ["notifications", userId];

  const list = useQuery({
    queryKey: key,
    queryFn: listNotifications,
    enabled: Boolean(userId),
    refetchInterval: 30_000,
    staleTime: 10_000,
    retry: 1,
  });

  // New notifications show up straight away when Realtime is on; otherwise the 30-second refresh covers it.
  useEffect(() => {
    if (!userId || !supabaseConfig.isConfigured) return undefined;
    try {
      const client = getSupabaseClient();
      const channel = client
        .channel(`notifications-${userId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          () => { void queryClient.invalidateQueries({ queryKey: ["notifications", userId] }); })
        .subscribe();
      return () => { void client.removeChannel(channel); };
    } catch {
      return undefined;
    }
  }, [userId, queryClient]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!userId) return null;

  const items = list.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  async function openItem(n: AppNotification) {
    setOpen(false);
    try { if (!n.read_at) await markNotificationRead(n.id); } catch { /* the link still works */ }
    void refresh();
    if (n.link && n.link.startsWith("/") && !n.link.startsWith("//")) navigate(n.link);
  }

  async function readAll() {
    try { await markAllNotificationsRead(userId as string); } finally { void refresh(); }
  }

  return (
    <div className="notif" ref={wrap}>
      <button
        type="button"
        className="notif-button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        onClick={() => setOpen((v) => !v)}
        data-testid="button-notifications"
      >
        <Bell size={18} aria-hidden="true" />
        {unread > 0 && <span className="notif-count" aria-hidden="true">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-head">
            <strong>Notifications</strong>
            {unread > 0 && <button type="button" className="notif-readall" onClick={readAll}>Mark all as read</button>}
          </div>
          {list.isPending ? <p className="notif-empty" role="status">Loading…</p>
            : list.isError ? <p className="notif-empty" role="alert">Could not load. <button type="button" className="notif-readall" onClick={() => list.refetch()}>Try again</button></p>
            : items.length === 0 ? <p className="notif-empty">Nothing yet. We will let you know about payments, events and renewals here.</p>
            : (
              <ul className="notif-list">
                {items.map((n) => (
                  <li key={n.id}>
                    <button type="button" className={`notif-item ${n.read_at ? "" : "is-unread"}`} onClick={() => openItem(n)}>
                      <span className="notif-dot" aria-hidden="true" />
                      <span className="notif-text">
                        <strong>{n.title}</strong>
                        {n.body && <span>{n.body}</span>}
                        <small>{timeAgo(n.created_at)}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </div>
      )}
    </div>
  );
}
