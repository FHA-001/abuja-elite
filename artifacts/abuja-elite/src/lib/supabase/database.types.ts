/**
 * This file is intentionally checked in as a hand-maintained interim type
 * contract for the Phase 2 migrations. Once the migrations are applied to the
 * intended Supabase project, replace it with generated types:
 *
 *   npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
 *
 * Do not put secrets or service-role credentials in this file.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      members: {
        Row: {
          id: string;
          name: string;
          slug: string;
          profile_image_path: string | null;
          bio: string | null;
          role: string | null;
          category: string | null;
          location: string | null;
          instagram_url: string | null;
          website_url: string | null;
          featured: boolean;
          published: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          profile_image_path?: string | null;
          bio?: string | null;
          role?: string | null;
          category?: string | null;
          location?: string | null;
          instagram_url?: string | null;
          website_url?: string | null;
          featured?: boolean;
          published?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["members"]["Insert"]>;
        Relationships: [];
      };
      collaborations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_path: string | null;
          cover_image_path: string | null;
          description: string | null;
          website_url: string | null;
          instagram_url: string | null;
          category: string | null;
          featured: boolean;
          published: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo_path?: string | null;
          cover_image_path?: string | null;
          description?: string | null;
          website_url?: string | null;
          instagram_url?: string | null;
          category?: string | null;
          featured?: boolean;
          published?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["collaborations"]["Insert"]
        >;
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          title: string;
          slug: string;
          description: string | null;
          starts_at: string;
          ends_at: string | null;
          location: string | null;
          cover_image_path: string | null;
          registration_url: string | null;
          status: "scheduled" | "cancelled";
          featured: boolean;
          published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          description?: string | null;
          starts_at: string;
          ends_at?: string | null;
          location?: string | null;
          cover_image_path?: string | null;
          registration_url?: string | null;
          status?: "scheduled" | "cancelled";
          featured?: boolean;
          published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
        Relationships: [];
      };
      stories: {
        Row: {
          id: string;
          title: string;
          slug: string;
          excerpt: string | null;
          content: string;
          cover_image_path: string | null;
          category: string | null;
          author_name: string | null;
          published_at: string | null;
          featured: boolean;
          published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          excerpt?: string | null;
          content: string;
          cover_image_path?: string | null;
          category?: string | null;
          author_name?: string | null;
          published_at?: string | null;
          featured?: boolean;
          published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stories"]["Insert"]>;
        Relationships: [];
      };
      gallery_items: {
        Row: {
          id: string;
          image_path: string;
          thumbnail_path: string | null;
          caption: string | null;
          alt_text: string;
          category: string | null;
          event_id: string | null;
          story_id: string | null;
          collaboration_id: string | null;
          featured: boolean;
          published: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          image_path: string;
          thumbnail_path?: string | null;
          caption?: string | null;
          alt_text: string;
          category?: string | null;
          event_id?: string | null;
          story_id?: string | null;
          collaboration_id?: string | null;
          featured?: boolean;
          published?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["gallery_items"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "gallery_items_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gallery_items_story_id_fkey";
            columns: ["story_id"];
            isOneToOne: false;
            referencedRelation: "stories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gallery_items_collaboration_id_fkey";
            columns: ["collaboration_id"];
            isOneToOne: false;
            referencedRelation: "collaborations";
            referencedColumns: ["id"];
          }
        ];
      };
      applications: {
        Row: {
          id: string;
          name: string;
          email: string;
          phone: string | null;
          message: string;
          interest: string;
          status:
            | "new"
            | "reviewed"
            | "contacted"
            | "accepted"
            | "declined"
            | "archived";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          phone?: string | null;
          message: string;
          interest: string;
          status?:
            | "new"
            | "reviewed"
            | "contacted"
            | "accepted"
            | "declined"
            | "archived";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["applications"]["Insert"]>;
        Relationships: [];
      };
      contact_messages: {
        Row: {
          id: string;
          name: string;
          email: string;
          subject: string | null;
          message: string;
          status: "new" | "reviewed" | "replied" | "archived";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          subject?: string | null;
          message: string;
          status?: "new" | "reviewed" | "replied" | "archived";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["contact_messages"]["Insert"]
        >;
        Relationships: [];
      };
      event_interests: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          email: string;
          normalized_email: string;
          message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          name: string;
          email: string;
          message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["event_interests"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "event_interests_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          }
        ];
      };
      newsletter_subscribers: {
        Row: {
          id: string;
          normalized_email: string;
          status: "pending" | "subscribed" | "unsubscribed";
          consent: boolean;
          consent_at: string | null;
          subscribed_at: string | null;
          unsubscribed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          normalized_email: string;
          status?: "pending" | "subscribed" | "unsubscribed";
          consent?: boolean;
          consent_at?: string | null;
          subscribed_at?: string | null;
          unsubscribed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["newsletter_subscribers"]["Insert"]
        >;
        Relationships: [];
      };
      site_settings: {
        Row: {
          id: string;
          setting_key: string;
          value: Json;
          is_public: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          setting_key: string;
          value: Json;
          is_public?: boolean;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["site_settings"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      submit_public_enquiry: {Args: {p_kind: string; p_payload: Json; p_rate_key: string}; Returns: Json};
      is_current_user_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};