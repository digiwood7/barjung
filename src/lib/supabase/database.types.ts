export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type PlatformName = "naver" | "instagram" | "daangn" | "zigbang";
export type PublishStatus = "not_requested" | "queued" | "running" | "succeeded" | "failed" | "cancelled" | "not_configured";

type Row<T> = T & { id: string; office_id: string; created_at: string };

export interface Database {
  public: {
    Tables: {
      offices: { Row: { id: string; name: string; region_label: string; created_at: string; updated_at: string } };
      employees: { Row: Row<{ name: string; phone: string; position: string; employment_status: "active" | "leave" | "inactive"; updated_at: string }> };
      customers: { Row: Row<{ name: string; phone: string; inquiry_type: string; desired_conditions: string; memo: string; follow_up_at: string | null; updated_at: string }> };
      properties: { Row: Row<{ property_number: string; title: string; property_kind: "one_room" | "two_room" | "officetel"; status: "draft" | "reviewed" | "advertising" | "contracting" | "completed" | "paused" | "closed"; exact_address: string; public_address: string; deposit_won: number; monthly_rent_won: number; maintenance_fee_won: number; updated_at: string }> };
      legal_disclosures: { Row: Row<{ property_id: string; location: string; contract_area: string; property_category: string; transaction_type: string; floor_text: string; available_from: string; rooms_text: string; approval_date: string; parking_text: string; maintenance_text: string; direction_text: string; lot_number_notice: string; measurement_notice: string; validation_status: "pending" | "valid" | "invalid"; updated_at: string }> };
      distribution_jobs: { Row: Row<{ property_id: string; mode: "review" | "automatic"; overall_status: PublishStatus; idempotency_key: string; requested_at: string }> };
      distribution_targets: { Row: Row<{ distribution_job_id: string; platform: PlatformName; status: PublishStatus; error_code: string | null; error_summary: string | null; retry_count: number; published_url: string | null; lease_agent_id: string | null; lease_expires_at: string | null; updated_at: string }> };
      local_agents: { Row: Row<{ device_name: string; operating_system: string; version: string; status: "online" | "offline" | "degraded"; last_heartbeat_at: string | null; updated_at: string }> };
      runner_commands: { Row: Row<{ command: "naver_login"; status: "queued" | "running" | "succeeded" | "failed"; result_message: string | null; lease_agent_id: string | null; lease_expires_at: string | null; started_at: string | null; completed_at: string | null; updated_at: string }> };
    };
    Views: Record<string, never>;
    Functions: {
      claim_distribution_target: { Args: { p_agent_id: string; p_lease_seconds?: number }; Returns: unknown[] };
      claim_runner_command: { Args: { p_agent_id: string; p_lease_seconds?: number }; Returns: unknown[] };
    };
    Enums: { platform_name: PlatformName; publish_status: PublishStatus };
    CompositeTypes: Record<string, never>;
  };
}
