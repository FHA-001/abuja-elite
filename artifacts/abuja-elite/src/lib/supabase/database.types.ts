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
      profiles: {
        Row: {
          user_id: string;
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
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: {
          full_name?: string;
          phone?: string | null;
          whatsapp?: string | null;
          photo_path?: string | null;
          business_name?: string | null;
          profession?: string | null;
          industry?: string | null;
          location?: string | null;
          bio?: string | null;
          skills?: string[];
          linkedin_url?: string | null;
          instagram_url?: string | null;
          website_url?: string | null;
          show_email?: boolean;
          show_phone?: boolean;
          show_whatsapp?: boolean;
          listed?: boolean;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          user_id: string;
          access_expires_at: string | null;
          last_approved_at: string | null;
          suspended: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      payment_settings: {
        Row: {
          id: number;
          monthly_fee_amount: number;
          currency: string;
          bank_name: string | null;
          account_name: string | null;
          account_number: string | null;
          payment_instructions: string | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: never;
        Update: {
          monthly_fee_amount?: number;
          currency?: string;
          bank_name?: string | null;
          account_name?: string | null;
          account_number?: string | null;
          payment_instructions?: string | null;
        };
        Relationships: [];
      };
      payment_submissions: {
        Row: {
          id: string;
          user_id: string;
          receipt_path: string;
          member_note: string | null;
          fee_amount: number;
          currency: string;
          status: "pending" | "approved" | "rejected";
          admin_comment: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          period_start: string | null;
          period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      announcements: {
        Row: {
          id: string;
          title: string;
          body: string;
          pinned: boolean;
          published: boolean;
          published_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          title: string;
          body: string;
          pinned?: boolean;
          published?: boolean;
          published_at?: string;
        };
        Update: {
          title?: string;
          body?: string;
          pinned?: boolean;
          published?: boolean;
          published_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          kind: string;
          title: string;
          body: string | null;
          link: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: { read_at?: string | null };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      submit_public_enquiry: {Args: {p_kind: string; p_payload: Json; p_rate_key: string}; Returns: Json};
      get_my_membership: {Args: Record<string, never>; Returns: Json};
      submit_payment: {Args: {p_receipt_path: string; p_note?: string | null}; Returns: string};
      admin_approve_payment: {Args: {p_submission_id: string}; Returns: Json};
      admin_reject_payment: {Args: {p_submission_id: string; p_comment: string}; Returns: Json};
      recent_members: {Args: {p_limit?: number}; Returns: Json};
      search_directory: {Args: {p_query?: string | null; p_industry?: string | null; p_location?: string | null; p_skill?: string | null; p_limit?: number; p_offset?: number}; Returns: Json};
      directory_filters: {Args: Record<string, never>; Returns: Json};
      get_teasers: {Args: {p_kind: string; p_limit?: number}; Returns: Json};
      admin_set_suspended: {Args: {p_user_id: string; p_suspended: boolean}; Returns: Json};
      admin_membership_summary: {Args: Record<string, never>; Returns: Json};
      is_current_user_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};