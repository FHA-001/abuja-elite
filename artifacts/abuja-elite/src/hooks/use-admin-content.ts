import { useCallback, useEffect, useState } from "react";
import type {
  AdminContent,
  AdminDashboardCounts,
} from "@/lib/supabase/content";
import {
  createAdminCollaboration,
  createAdminEvent,
  createAdminGalleryItem,
  createAdminMember,
  createAdminSiteSetting,
  createAdminStory,
  deleteAdminCollaboration,
  deleteAdminEvent,
  deleteAdminGalleryItem,
  deleteAdminMember,
  deleteAdminSiteSetting,
  deleteAdminStory,
  getAdminDashboardCounts,
  listAdminContent,
  updateAdminCollaboration,
  updateAdminEvent,
  updateAdminGalleryItem,
  updateAdminMember,
  updateAdminSiteSetting,
  updateAdminStory,
} from "@/lib/supabase/content";
import type { Database } from "@/lib/supabase/database.types";
import type { DashboardResource } from "@/pages/admin-dashboard";

type Tables = Database["public"]["Tables"];

const emptyContent: AdminContent = {
  members: [],
  collaborations: [],
  events: [],
  stories: [],
  galleryItems: [],
  siteSettings: [],
};

const resourceKeys: Record<DashboardResource, keyof AdminContent> = {
  members: "members",
  collaborations: "collaborations",
  events: "events",
  stories: "stories",
  gallery_items: "galleryItems",
  site_settings: "siteSettings",
};

export function useAdminContent(enabled: boolean, identity?: string) {
  const [content, setContent] = useState<AdminContent>(emptyContent);
  const [counts, setCounts] = useState<AdminDashboardCounts | null>(null);
  const [loading, setLoading] = useState<Record<DashboardResource, boolean>>({
    members: false,
    collaborations: false,
    events: false,
    stories: false,
    gallery_items: false,
    site_settings: false,
  });
  const [errors, setErrors] = useState<
    Partial<Record<DashboardResource, string | null>>
  >({});
  const [countsLoading, setCountsLoading] = useState(false);
  const [countsError, setCountsError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading({
      members: true,
      collaborations: true,
      events: true,
      stories: true,
      gallery_items: true,
      site_settings: true,
    });
    setErrors({});
    setCountsLoading(true);
    setCountsError(null);
    const [contentResult, countsResult] = await Promise.allSettled([
      listAdminContent(),
      getAdminDashboardCounts(),
    ]);

    if (contentResult.status === "fulfilled") {
      setContent(contentResult.value);
    } else {
      const message = contentResult.reason instanceof Error
        ? contentResult.reason.message
        : "Unable to load editorial content.";
      setErrors({
        members: message,
        collaborations: message,
        events: message,
        stories: message,
        gallery_items: message,
        site_settings: message,
      });
    }

    if (countsResult.status === "fulfilled") {
      setCounts(countsResult.value);
    } else {
      setCountsError(
        countsResult.reason instanceof Error
          ? countsResult.reason.message
          : "Unable to load dashboard counts.",
      );
    }

    setLoading({
      members: false,
      collaborations: false,
      events: false,
      stories: false,
      gallery_items: false,
      site_settings: false,
    });
    setCountsLoading(false);
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      setContent(emptyContent);
      setCounts(null);
      void load();
    } else {
      setContent(emptyContent);
      setCounts(null);
      setErrors({});
      setCountsError(null);
    }
  }, [enabled, identity, load]);

  const refresh = useCallback(
    async (resource?: DashboardResource) => {
      await load();
      if (resource) {
        setErrors((current) => ({ ...current, [resource]: null }));
      }
    },
    [load],
  );

  const create = useCallback(
    async (resource: DashboardResource, payload: Record<string, unknown>) => {
      switch (resource) {
        case "members":
          await createAdminMember(payload as Tables["members"]["Insert"]);
          break;
        case "collaborations":
          await createAdminCollaboration(
            payload as Tables["collaborations"]["Insert"],
          );
          break;
        case "events":
          await createAdminEvent(payload as Tables["events"]["Insert"]);
          break;
        case "stories":
          await createAdminStory(payload as Tables["stories"]["Insert"]);
          break;
        case "gallery_items":
          await createAdminGalleryItem(
            payload as Tables["gallery_items"]["Insert"],
          );
          break;
        case "site_settings":
          await createAdminSiteSetting(
            payload as Tables["site_settings"]["Insert"],
          );
          break;
      }
      await refresh(resource);
    },
    [refresh],
  );

  const update = useCallback(
    async (
      resource: DashboardResource,
      id: string,
      payload: Record<string, unknown>,
    ) => {
      switch (resource) {
        case "members":
          await updateAdminMember(id, payload as Tables["members"]["Update"]);
          break;
        case "collaborations":
          await updateAdminCollaboration(
            id,
            payload as Tables["collaborations"]["Update"],
          );
          break;
        case "events":
          await updateAdminEvent(id, payload as Tables["events"]["Update"]);
          break;
        case "stories":
          await updateAdminStory(id, payload as Tables["stories"]["Update"]);
          break;
        case "gallery_items":
          await updateAdminGalleryItem(
            id,
            payload as Tables["gallery_items"]["Update"],
          );
          break;
        case "site_settings":
          await updateAdminSiteSetting(
            id,
            payload as Tables["site_settings"]["Update"],
          );
          break;
      }
      await refresh(resource);
    },
    [refresh],
  );

  const remove = useCallback(
    async (resource: DashboardResource, id: string) => {
      switch (resource) {
        case "members":
          await deleteAdminMember(id);
          break;
        case "collaborations":
          await deleteAdminCollaboration(id);
          break;
        case "events":
          await deleteAdminEvent(id);
          break;
        case "stories":
          await deleteAdminStory(id);
          break;
        case "gallery_items":
          await deleteAdminGalleryItem(id);
          break;
        case "site_settings":
          await deleteAdminSiteSetting(id);
          break;
      }
      await refresh(resource);
    },
    [refresh],
  );

  return {
    ...content,
    counts,
    loading,
    errors,
    countsLoading,
    countsError,
    reload: load,
    onRetry: refresh,
    onCreate: create,
    onUpdate: update,
    onDelete: remove,
    getResource: (resource: DashboardResource) => content[resourceKeys[resource]],
  };
}