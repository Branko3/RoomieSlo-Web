export type ListingStatus = "available" | "filled";
export type MatchStatus = "pending" | "accepted" | "rejected";
export type MessageDeliveryStatus = "sent" | "delivered" | "read";
export type ReportStatus = "open" | "reviewed" | "dismissed";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          academic_status_verified: boolean;
          is_available: boolean;
          created_at: string;
          age: number | null;
          faculty: string;
          bio: string;
          avatar_url: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["profiles"]["Row"], "id">> & {
          id: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      questionnaire_answers: {
        Row: {
          id: string;
          profile_id: string;
          question_id: string;
          value: number;
          weight: number;
        };
        Insert: Omit<Database["public"]["Tables"]["questionnaire_answers"]["Row"], "id"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["questionnaire_answers"]["Insert"]>;
      };
      listings: {
        Row: {
          id: string;
          owner_id: string;
          location: string;
          price_per_month: number;
          description: string;
          is_filled: boolean;
          version: number;
          created_at: string;
          title: string;
          room_type: string;
          district: string;
          available_from: string | null;
          size_sqm: number | null;
          deposit: number | null;
          bills_included: boolean;
          furnished: boolean;
          flatmates_count: number;
          photo_url: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["listings"]["Row"], "id" | "owner_id">> & {
          id?: string;
          owner_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["listings"]["Insert"]>;
      };
      favorites: {
        Row: { profile_id: string; listing_id: string; created_at: string };
        Insert: { profile_id: string; listing_id: string; created_at?: string };
        Update: never;
      };
      matches: {
        Row: {
          id: string;
          user_id_a: string;
          user_id_b: string;
          status: MatchStatus;
          version: number;
          created_at: string;
        };
        Insert: Partial<Pick<Database["public"]["Tables"]["matches"]["Row"], "id" | "status" | "version" | "created_at">> & {
          user_id_a: string;
          user_id_b: string;
        };
        Update: Partial<Pick<Database["public"]["Tables"]["matches"]["Row"], "status" | "version">>;
      };
      messages: {
        Row: {
          id: string;
          match_id: string;
          sender_id: string;
          body: string;
          delivery_status: MessageDeliveryStatus;
          sent_at: string;
        };
        Insert: Partial<Pick<Database["public"]["Tables"]["messages"]["Row"], "id" | "delivery_status" | "sent_at">> & {
          match_id: string;
          sender_id: string;
          body: string;
        };
        Update: Partial<Pick<Database["public"]["Tables"]["messages"]["Row"], "body" | "delivery_status">>;
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          reported_id: string;
          reason: string;
          description: string;
          status: ReportStatus;
          created_at: string;
        };
        Insert: Partial<Pick<Database["public"]["Tables"]["reports"]["Row"], "id" | "status" | "created_at">> & {
          reporter_id: string;
          reported_id: string;
          reason: string;
          description?: string;
        };
        Update: Partial<Pick<Database["public"]["Tables"]["reports"]["Row"], "status" | "description">>;
      };
      admins: {
        Row: { user_id: string };
        Insert: { user_id: string };
        Update: never;
      };
    };
  };
};

export type TableName = keyof Database["public"]["Tables"];
export type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];
export type Insert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];
export type Update<T extends TableName> = Database["public"]["Tables"][T]["Update"];

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: { id: string; email?: string; user_metadata: Record<string, unknown> };
};
