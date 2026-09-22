/**
 * Typed mirror of supabase/migrations. Keep in lockstep with the SQL —
 * when a migration changes a table, update the matching types here.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ReportFileType = "pdf" | "image";
export type HealthMetric =
  | "heart_rate"
  | "sleep_minutes"
  | "steps"
  | "spo2"
  | "hrv"
  | "active_energy";
export type ReportStatus = "uploaded" | "processing" | "processed" | "failed";
/** Where the document was read. "on_device_ocr" means no file was uploaded. */
export type ExtractionSource = "cloud" | "on_device_ocr";
export type TimelineEventType = "report" | "pattern" | "symptom";
export type ProfileSex = "female" | "male" | "other" | "undisclosed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          date_of_birth: string | null;
          sex: ProfileSex | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          date_of_birth?: string | null;
          sex?: ProfileSex | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          date_of_birth?: string | null;
          sex?: ProfileSex | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          report_date: string | null;
          /** Null when the report was read on-device — no file was uploaded. */
          file_path: string | null;
          file_type: ReportFileType;
          status: ReportStatus;
          extraction_source: ExtractionSource;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          report_date?: string | null;
          file_path: string | null;
          file_type: ReportFileType;
          status?: ReportStatus;
          extraction_source?: ExtractionSource;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          report_date?: string | null;
          file_path?: string | null;
          file_type?: ReportFileType;
          status?: ReportStatus;
          extraction_source?: ExtractionSource;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      extracted_observations: {
        Row: {
          id: string;
          report_id: string;
          user_id: string;
          test_name: string;
          value: string;
          value_numeric: number | null;
          unit: string | null;
          reference_range: string | null;
          observed_at: string | null;
          category: string;
          flagged: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          user_id: string;
          test_name: string;
          value: string;
          value_numeric?: number | null;
          unit?: string | null;
          reference_range?: string | null;
          observed_at?: string | null;
          category?: string;
          flagged?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string;
          user_id?: string;
          test_name?: string;
          value?: string;
          value_numeric?: number | null;
          unit?: string | null;
          reference_range?: string | null;
          observed_at?: string | null;
          category?: string;
          flagged?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      timeline_events: {
        Row: {
          id: string;
          user_id: string;
          report_id: string | null;
          event_type: TimelineEventType;
          title: string;
          summary: string | null;
          occurred_at: string;
          metric: HealthMetric | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          report_id?: string | null;
          event_type?: TimelineEventType;
          title: string;
          summary?: string | null;
          occurred_at: string;
          metric?: HealthMetric | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          report_id?: string | null;
          event_type?: TimelineEventType;
          title?: string;
          summary?: string | null;
          occurred_at?: string;
          metric?: HealthMetric | null;
          created_at?: string;
        };
        Relationships: [];
      };
      share_tokens: {
        Row: {
          id: string;
          user_id: string;
          token_hash: string;
          expires_at: string;
          used_at: string | null;
          revoked_at: string | null;
          scope: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token_hash: string;
          expires_at: string;
          used_at?: string | null;
          revoked_at?: string | null;
          scope?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          token_hash?: string;
          expires_at?: string;
          used_at?: string | null;
          revoked_at?: string | null;
          scope?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      metric_samples: {
        Row: {
          id: string;
          user_id: string;
          metric: HealthMetric;
          value: number;
          unit: string;
          measured_at: string;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          metric: HealthMetric;
          value: number;
          unit: string;
          measured_at: string;
          source?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          metric?: HealthMetric;
          value?: number;
          unit?: string;
          measured_at?: string;
          source?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      metric_daily_rollups: {
        Row: {
          id: string;
          user_id: string;
          metric: HealthMetric;
          day: string;
          value: number;
          min_value: number | null;
          max_value: number | null;
          sample_count: number;
          unit: string;
          source: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          metric: HealthMetric;
          day: string;
          value: number;
          min_value?: number | null;
          max_value?: number | null;
          sample_count?: number;
          unit: string;
          source?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          metric?: HealthMetric;
          day?: string;
          value?: number;
          min_value?: number | null;
          max_value?: number | null;
          sample_count?: number;
          unit?: string;
          source?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ReportRow = Database["public"]["Tables"]["reports"]["Row"];
export type ObservationRow = Database["public"]["Tables"]["extracted_observations"]["Row"];
export type TimelineEventRow = Database["public"]["Tables"]["timeline_events"]["Row"];
export type ShareTokenRow = Database["public"]["Tables"]["share_tokens"]["Row"];
export type MetricSampleRow = Database["public"]["Tables"]["metric_samples"]["Row"];
export type MetricDailyRollupRow = Database["public"]["Tables"]["metric_daily_rollups"]["Row"];
