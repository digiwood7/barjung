export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          image_max_edge: number
          image_quality: number
          image_target_kb: number
          office_id: string
          platform_settings: Json
          publish_mode: Database["public"]["Enums"]["publish_mode"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          image_max_edge?: number
          image_quality?: number
          image_target_kb?: number
          office_id: string
          platform_settings?: Json
          publish_mode?: Database["public"]["Enums"]["publish_mode"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          image_max_edge?: number
          image_quality?: number
          image_target_kb?: number
          office_id?: string
          platform_settings?: Json
          publish_mode?: Database["public"]["Enums"]["publish_mode"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      building_register_snapshots: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          fetched_at: string
          id: string
          normalized_fields: Json
          office_id: string
          property_id: string
          raw_response: Json
          source: string
          source_identifier: string | null
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          fetched_at?: string
          id?: string
          normalized_fields?: Json
          office_id: string
          property_id: string
          raw_response?: Json
          source: string
          source_identifier?: string | null
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          fetched_at?: string
          id?: string
          normalized_fields?: Json
          office_id?: string
          property_id?: string
          raw_response?: Json
          source?: string
          source_identifier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "building_register_snapshots_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_register_snapshots_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_register_snapshots_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      content_drafts: {
        Row: {
          created_at: string
          created_by: string | null
          employee_copy: string
          id: string
          legal_block: string
          office_id: string
          platform: Database["public"]["Enums"]["platform_name"] | null
          property_id: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_copy: string
          id?: string
          legal_block: string
          office_id: string
          platform?: Database["public"]["Enums"]["platform_name"] | null
          property_id: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_copy?: string
          id?: string
          legal_block?: string
          office_id?: string
          platform?: Database["public"]["Enums"]["platform_name"] | null
          property_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_drafts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_drafts_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_drafts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          desired_conditions: string
          follow_up_at: string | null
          id: string
          inquiry_type: string
          memo: string
          name: string
          office_id: string
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          desired_conditions?: string
          follow_up_at?: string | null
          id?: string
          inquiry_type?: string
          memo?: string
          name: string
          office_id: string
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          desired_conditions?: string
          follow_up_at?: string | null
          id?: string
          inquiry_type?: string
          memo?: string
          name?: string
          office_id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_events: {
        Row: {
          created_at: string
          distribution_target_id: string
          event_data: Json
          from_status: Database["public"]["Enums"]["publish_status"] | null
          id: number
          office_id: string
          to_status: Database["public"]["Enums"]["publish_status"]
        }
        Insert: {
          created_at?: string
          distribution_target_id: string
          event_data?: Json
          from_status?: Database["public"]["Enums"]["publish_status"] | null
          id?: never
          office_id: string
          to_status: Database["public"]["Enums"]["publish_status"]
        }
        Update: {
          created_at?: string
          distribution_target_id?: string
          event_data?: Json
          from_status?: Database["public"]["Enums"]["publish_status"] | null
          id?: never
          office_id?: string
          to_status?: Database["public"]["Enums"]["publish_status"]
        }
        Relationships: [
          {
            foreignKeyName: "distribution_events_distribution_target_id_fkey"
            columns: ["distribution_target_id"]
            isOneToOne: false
            referencedRelation: "distribution_targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_events_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_jobs: {
        Row: {
          completed_at: string | null
          id: string
          idempotency_key: string
          mode: Database["public"]["Enums"]["publish_mode"]
          office_id: string
          overall_status: Database["public"]["Enums"]["publish_status"]
          property_id: string
          requested_at: string
          requested_by: string | null
          started_at: string | null
        }
        Insert: {
          completed_at?: string | null
          id?: string
          idempotency_key: string
          mode?: Database["public"]["Enums"]["publish_mode"]
          office_id: string
          overall_status?: Database["public"]["Enums"]["publish_status"]
          property_id: string
          requested_at?: string
          requested_by?: string | null
          started_at?: string | null
        }
        Update: {
          completed_at?: string | null
          id?: string
          idempotency_key?: string
          mode?: Database["public"]["Enums"]["publish_mode"]
          office_id?: string
          overall_status?: Database["public"]["Enums"]["publish_status"]
          property_id?: string
          requested_at?: string
          requested_by?: string | null
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distribution_jobs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_jobs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_jobs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_targets: {
        Row: {
          completed_at: string | null
          content_draft_id: string | null
          created_at: string
          distribution_job_id: string
          error_code: string | null
          error_summary: string | null
          id: string
          lease_agent_id: string | null
          lease_expires_at: string | null
          office_id: string
          platform: Database["public"]["Enums"]["platform_name"]
          published_url: string | null
          retry_count: number
          started_at: string | null
          status: Database["public"]["Enums"]["publish_status"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          content_draft_id?: string | null
          created_at?: string
          distribution_job_id: string
          error_code?: string | null
          error_summary?: string | null
          id?: string
          lease_agent_id?: string | null
          lease_expires_at?: string | null
          office_id: string
          platform: Database["public"]["Enums"]["platform_name"]
          published_url?: string | null
          retry_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["publish_status"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          content_draft_id?: string | null
          created_at?: string
          distribution_job_id?: string
          error_code?: string | null
          error_summary?: string | null
          id?: string
          lease_agent_id?: string | null
          lease_expires_at?: string | null
          office_id?: string
          platform?: Database["public"]["Enums"]["platform_name"]
          published_url?: string | null
          retry_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["publish_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "distribution_targets_content_draft_id_fkey"
            columns: ["content_draft_id"]
            isOneToOne: false
            referencedRelation: "content_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_targets_distribution_job_id_fkey"
            columns: ["distribution_job_id"]
            isOneToOne: false
            referencedRelation: "distribution_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_targets_lease_agent_id_fkey"
            columns: ["lease_agent_id"]
            isOneToOne: false
            referencedRelation: "local_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_targets_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          auth_user_id: string | null
          created_at: string
          employment_status: Database["public"]["Enums"]["employment_status"]
          id: string
          name: string
          office_id: string
          phone: string
          position: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          employment_status?: Database["public"]["Enums"]["employment_status"]
          id?: string
          name: string
          office_id: string
          phone: string
          position: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          employment_status?: Database["public"]["Enums"]["employment_status"]
          id?: string
          name?: string
          office_id?: string
          phone?: string
          position?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_disclosures: {
        Row: {
          approval_date: string
          available_from: string
          confirmed_at: string | null
          confirmed_by: string | null
          contract_area: string
          created_at: string
          direction_text: string
          floor_text: string
          id: string
          location: string
          lot_number_notice: string
          maintenance_text: string
          measurement_notice: string
          office_id: string
          parking_text: string
          property_category: string
          property_id: string
          rooms_text: string
          transaction_type: string
          updated_at: string
          validation_status: string
        }
        Insert: {
          approval_date: string
          available_from: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          contract_area: string
          created_at?: string
          direction_text: string
          floor_text: string
          id?: string
          location: string
          lot_number_notice: string
          maintenance_text: string
          measurement_notice: string
          office_id: string
          parking_text: string
          property_category: string
          property_id: string
          rooms_text: string
          transaction_type: string
          updated_at?: string
          validation_status?: string
        }
        Update: {
          approval_date?: string
          available_from?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          contract_area?: string
          created_at?: string
          direction_text?: string
          floor_text?: string
          id?: string
          location?: string
          lot_number_notice?: string
          maintenance_text?: string
          measurement_notice?: string
          office_id?: string
          parking_text?: string
          property_category?: string
          property_id?: string
          rooms_text?: string
          transaction_type?: string
          updated_at?: string
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_disclosures_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_disclosures_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_disclosures_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      local_agents: {
        Row: {
          created_at: string
          device_name: string
          id: string
          last_heartbeat_at: string | null
          office_id: string
          operating_system: string
          status: string
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          device_name: string
          id?: string
          last_heartbeat_at?: string | null
          office_id: string
          operating_system?: string
          status?: string
          updated_at?: string
          version: string
        }
        Update: {
          created_at?: string
          device_name?: string
          id?: string
          last_heartbeat_at?: string | null
          office_id?: string
          operating_system?: string
          status?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "local_agents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      offices: {
        Row: {
          created_at: string
          id: string
          name: string
          region_label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          region_label?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          region_label?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_connections: {
        Row: {
          created_at: string
          id: string
          last_checked_at: string | null
          office_id: string
          platform: Database["public"]["Enums"]["platform_name"]
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_checked_at?: string | null
          office_id: string
          platform: Database["public"]["Enums"]["platform_name"]
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_checked_at?: string | null
          office_id?: string
          platform?: Database["public"]["Enums"]["platform_name"]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_connections_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          available_from: string
          bathroom_count: number | null
          created_at: string
          default_address_policy: Database["public"]["Enums"]["address_policy"]
          deposit_won: number
          direction: string
          direction_basis: string
          exact_address: string
          id: string
          maintenance_fee_won: number
          monthly_rent_won: number
          office_id: string
          property_kind: Database["public"]["Enums"]["property_kind"]
          property_number: string
          public_address: string
          registered_by: string | null
          room_count: number | null
          status: Database["public"]["Enums"]["property_status"]
          title: string
          updated_at: string
        }
        Insert: {
          available_from?: string
          bathroom_count?: number | null
          created_at?: string
          default_address_policy?: Database["public"]["Enums"]["address_policy"]
          deposit_won?: number
          direction?: string
          direction_basis?: string
          exact_address: string
          id?: string
          maintenance_fee_won?: number
          monthly_rent_won?: number
          office_id: string
          property_kind: Database["public"]["Enums"]["property_kind"]
          property_number: string
          public_address: string
          registered_by?: string | null
          room_count?: number | null
          status?: Database["public"]["Enums"]["property_status"]
          title: string
          updated_at?: string
        }
        Update: {
          available_from?: string
          bathroom_count?: number | null
          created_at?: string
          default_address_policy?: Database["public"]["Enums"]["address_policy"]
          deposit_won?: number
          direction?: string
          direction_basis?: string
          exact_address?: string
          id?: string
          maintenance_fee_won?: number
          monthly_rent_won?: number
          office_id?: string
          property_kind?: Database["public"]["Enums"]["property_kind"]
          property_number?: string
          public_address?: string
          registered_by?: string | null
          room_count?: number | null
          status?: Database["public"]["Enums"]["property_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      property_media: {
        Row: {
          checksum_sha256: string
          created_at: string
          height: number
          id: string
          mime_type: string
          office_id: string
          optimized_size_bytes: number
          original_size_bytes: number
          property_id: string
          sort_order: number
          storage_path: string
          width: number
        }
        Insert: {
          checksum_sha256: string
          created_at?: string
          height: number
          id?: string
          mime_type: string
          office_id: string
          optimized_size_bytes: number
          original_size_bytes: number
          property_id: string
          sort_order?: number
          storage_path: string
          width: number
        }
        Update: {
          checksum_sha256?: string
          created_at?: string
          height?: number
          id?: string
          mime_type?: string
          office_id?: string
          optimized_size_bytes?: number
          original_size_bytes?: number
          property_id?: string
          sort_order?: number
          storage_path?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_media_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_media_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: Database["public"]["Enums"]["property_status"] | null
          id: string
          office_id: string
          property_id: string
          to_status: Database["public"]["Enums"]["property_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["property_status"] | null
          id?: string
          office_id: string
          property_id: string
          to_status: Database["public"]["Enums"]["property_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["property_status"] | null
          id?: string
          office_id?: string
          property_id?: string
          to_status?: Database["public"]["Enums"]["property_status"]
        }
        Relationships: [
          {
            foreignKeyName: "property_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_status_history_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_status_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_distribution_target: {
        Args: { p_agent_id: string; p_lease_seconds?: number }
        Returns: {
          completed_at: string | null
          content_draft_id: string | null
          created_at: string
          distribution_job_id: string
          error_code: string | null
          error_summary: string | null
          id: string
          lease_agent_id: string | null
          lease_expires_at: string | null
          office_id: string
          platform: Database["public"]["Enums"]["platform_name"]
          published_url: string | null
          retry_count: number
          started_at: string | null
          status: Database["public"]["Enums"]["publish_status"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "distribution_targets"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      address_policy: "lot" | "district" | "hidden"
      employment_status: "active" | "leave" | "inactive"
      platform_name: "naver" | "instagram" | "daangn" | "zigbang"
      property_kind: "one_room" | "two_room" | "officetel"
      property_status:
        | "draft"
        | "reviewed"
        | "advertising"
        | "contracting"
        | "completed"
        | "paused"
        | "closed"
      publish_mode: "review" | "automatic"
      publish_status:
        | "not_requested"
        | "queued"
        | "running"
        | "succeeded"
        | "failed"
        | "cancelled"
        | "not_configured"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      address_policy: ["lot", "district", "hidden"],
      employment_status: ["active", "leave", "inactive"],
      platform_name: ["naver", "instagram", "daangn", "zigbang"],
      property_kind: ["one_room", "two_room", "officetel"],
      property_status: [
        "draft",
        "reviewed",
        "advertising",
        "contracting",
        "completed",
        "paused",
        "closed",
      ],
      publish_mode: ["review", "automatic"],
      publish_status: [
        "not_requested",
        "queued",
        "running",
        "succeeded",
        "failed",
        "cancelled",
        "not_configured",
      ],
    },
  },
} as const
