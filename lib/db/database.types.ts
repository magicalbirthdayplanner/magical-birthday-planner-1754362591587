
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activities": {
                  Row: {
                    "age_group": (string)[] | null,"category": string,"created_at": string | null,"description": string | null,"duration": string,"duration_minutes": number,"effort_level": string,"full_description": string | null,"helpers_required": number | null,"host_script": string | null,"id": string,"max_participants": number | null,"min_participants": number | null,"name": string,"participant_range": string | null,"setup_time": number,"step_by_step_instructions": string,"supplies_needed": (string)[] | null,"tags": (string)[] | null,"theme_compatibility": (string)[] | null,"updated_at": string | null,"venue_type": (string)[] | null
                  }
                  Insert: {
                    "age_group"?: (string)[] | null,"category"?: string,"created_at"?: string | null,"description"?: string | null,"duration"?: string,"duration_minutes"?: number,"effort_level"?: string,"full_description"?: string | null,"helpers_required"?: number | null,"host_script"?: string | null,"id"?: string,"max_participants"?: number | null,"min_participants"?: number | null,"name": string,"participant_range"?: string | null,"setup_time"?: number,"step_by_step_instructions"?: string,"supplies_needed"?: (string)[] | null,"tags"?: (string)[] | null,"theme_compatibility"?: (string)[] | null,"updated_at"?: string | null,"venue_type"?: (string)[] | null
                  }
                  Update: {
                    "age_group"?: (string)[] | null,"category"?: string,"created_at"?: string | null,"description"?: string | null,"duration"?: string,"duration_minutes"?: number,"effort_level"?: string,"full_description"?: string | null,"helpers_required"?: number | null,"host_script"?: string | null,"id"?: string,"max_participants"?: number | null,"min_participants"?: number | null,"name"?: string,"participant_range"?: string | null,"setup_time"?: number,"step_by_step_instructions"?: string,"supplies_needed"?: (string)[] | null,"tags"?: (string)[] | null,"theme_compatibility"?: (string)[] | null,"updated_at"?: string | null,"venue_type"?: (string)[] | null
                  }
                  Relationships: [
                    
                  ]
                },"activity_favorites": {
                  Row: {
                    "activity_id": string,"created_at": string | null,"id": string,"user_id": string
                  }
                  Insert: {
                    "activity_id": string,"created_at"?: string | null,"id"?: string,"user_id": string
                  }
                  Update: {
                    "activity_id"?: string,"created_at"?: string | null,"id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_favorites_activity_id_fkey"
      columns: ["activity_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_favorites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "user_trial_status"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_favorites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_cache": {
                  Row: {
                    "cache_key": string,"created_at": string,"expires_at": string,"kind": string,"payload": NonNullable<Json>
                  }
                  Insert: {
                    "cache_key": string,"created_at"?: string,"expires_at": string,"kind": string,"payload": NonNullable<Json>
                  }
                  Update: {
                    "cache_key"?: string,"created_at"?: string,"expires_at"?: string,"kind"?: string,"payload"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"analytics_events": {
                  Row: {
                    "anonymous_id": string | null,"created_at": string,"event": string,"id": number,"party_id": string | null,"path": string | null,"properties": NonNullable<Json>,"session_id": string | null,"source": string,"user_id": string | null
                  }
                  Insert: {
                    "anonymous_id"?: string | null,"created_at"?: string,"event": string,"id"?: never,"party_id"?: string | null,"path"?: string | null,"properties"?: NonNullable<Json>,"session_id"?: string | null,"source"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "anonymous_id"?: string | null,"created_at"?: string,"event"?: string,"id"?: never,"party_id"?: string | null,"path"?: string | null,"properties"?: NonNullable<Json>,"session_id"?: string | null,"source"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"checklist_items": {
                  Row: {
                    "category": string,"completed_at": string | null,"created_at": string,"detail": string | null,"due_date": string | null,"id": string,"is_custom": boolean,"party_id": string,"sort_order": number,"task_key": string,"title": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "category"?: string,"completed_at"?: string | null,"created_at"?: string,"detail"?: string | null,"due_date"?: string | null,"id"?: string,"is_custom"?: boolean,"party_id": string,"sort_order"?: number,"task_key": string,"title": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "category"?: string,"completed_at"?: string | null,"created_at"?: string,"detail"?: string | null,"due_date"?: string | null,"id"?: string,"is_custom"?: boolean,"party_id"?: string,"sort_order"?: number,"task_key"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "checklist_items_party_id_fkey"
      columns: ["party_id"]
isOneToOne: false
      referencedRelation: "parties"
      referencedColumns: ["id"]
    }
                  ]
                },"email_logs": {
                  Row: {
                    "created_at": string | null,"email_type": string | null,"error_message": string | null,"id": string,"party_id": string | null,"recipient_email": string | null,"sent_at": string | null,"status": string | null,"subject": string | null,"user_id": string | null
                  }
                  Insert: {
                    "created_at"?: string | null,"email_type"?: string | null,"error_message"?: string | null,"id"?: string,"party_id"?: string | null,"recipient_email"?: string | null,"sent_at"?: string | null,"status"?: string | null,"subject"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"email_type"?: string | null,"error_message"?: string | null,"id"?: string,"party_id"?: string | null,"recipient_email"?: string | null,"sent_at"?: string | null,"status"?: string | null,"subject"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "email_logs_party_id_fkey"
      columns: ["party_id"]
isOneToOne: false
      referencedRelation: "parties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "email_logs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "user_trial_status"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "email_logs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"guests": {
                  Row: {
                    "adult_count": number,"age": number | null,"child_count": number,"created_at": string | null,"dietary_restrictions": (string)[] | null,"email": string | null,"id": string,"invite_status": string,"invited_at": string | null,"name": string,"notes": string | null,"party_id": string,"phone": string | null,"responded_at": string | null,"rsvp_status": string | null,"source": string,"type": string | null,"updated_at": string | null,"user_id": string
                  }
                  Insert: {
                    "adult_count"?: number,"age"?: number | null,"child_count"?: number,"created_at"?: string | null,"dietary_restrictions"?: (string)[] | null,"email"?: string | null,"id"?: string,"invite_status"?: string,"invited_at"?: string | null,"name": string,"notes"?: string | null,"party_id": string,"phone"?: string | null,"responded_at"?: string | null,"rsvp_status"?: string | null,"source"?: string,"type"?: string | null,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "adult_count"?: number,"age"?: number | null,"child_count"?: number,"created_at"?: string | null,"dietary_restrictions"?: (string)[] | null,"email"?: string | null,"id"?: string,"invite_status"?: string,"invited_at"?: string | null,"name"?: string,"notes"?: string | null,"party_id"?: string,"phone"?: string | null,"responded_at"?: string | null,"rsvp_status"?: string | null,"source"?: string,"type"?: string | null,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "guests_party_id_fkey"
      columns: ["party_id"]
isOneToOne: false
      referencedRelation: "parties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "user_trial_status"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "created_at": string | null,"email_opened": boolean | null,"email_sent": boolean | null,"guest_id": string,"id": string,"message": string | null,"notes": string | null,"opened_at": string | null,"party_id": string,"responded_at": string | null,"sent_at": string | null,"status": string | null,"token": string,"updated_at": string | null,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string | null,"email_opened"?: boolean | null,"email_sent"?: boolean | null,"guest_id": string,"id"?: string,"message"?: string | null,"notes"?: string | null,"opened_at"?: string | null,"party_id": string,"responded_at"?: string | null,"sent_at"?: string | null,"status"?: string | null,"token": string,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"email_opened"?: boolean | null,"email_sent"?: boolean | null,"guest_id"?: string,"id"?: string,"message"?: string | null,"notes"?: string | null,"opened_at"?: string | null,"party_id"?: string,"responded_at"?: string | null,"sent_at"?: string | null,"status"?: string | null,"token"?: string,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_guest_id_fkey"
      columns: ["guest_id"]
isOneToOne: false
      referencedRelation: "guests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_party_id_fkey"
      columns: ["party_id"]
isOneToOne: false
      referencedRelation: "parties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "user_trial_status"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"parties": {
                  Row: {
                    "budget": number | null,"checklist_data": Json | null,"child_age": number,"child_gender": string | null,"child_name": string,"city": string | null,"colors": (string)[] | null,"created_at": string | null,"guest_count": number | null,"id": string,"interests": (string)[],"is_shared": boolean | null,"latitude": number | null,"location": unknown,"longitude": number | null,"party_date": string,"party_location": string | null,"party_time": string | null,"search_radius_miles": number,"selected_theme": string | null,"share_token": string | null,"shared_at": string | null,"state": string | null,"status": string | null,"theme": string | null,"updated_at": string | null,"user_id": string,"venue_type": string | null,"zip_code": string | null
                  }
                  Insert: {
                    "budget"?: number | null,"checklist_data"?: Json | null,"child_age": number,"child_gender"?: string | null,"child_name": string,"city"?: string | null,"colors"?: (string)[] | null,"created_at"?: string | null,"guest_count"?: number | null,"id"?: string,"interests"?: (string)[],"is_shared"?: boolean | null,"latitude"?: number | null,"location"?: unknown,"longitude"?: number | null,"party_date": string,"party_location"?: string | null,"party_time"?: string | null,"search_radius_miles"?: number,"selected_theme"?: string | null,"share_token"?: string | null,"shared_at"?: string | null,"state"?: string | null,"status"?: string | null,"theme"?: string | null,"updated_at"?: string | null,"user_id": string,"venue_type"?: string | null,"zip_code"?: string | null
                  }
                  Update: {
                    "budget"?: number | null,"checklist_data"?: Json | null,"child_age"?: number,"child_gender"?: string | null,"child_name"?: string,"city"?: string | null,"colors"?: (string)[] | null,"created_at"?: string | null,"guest_count"?: number | null,"id"?: string,"interests"?: (string)[],"is_shared"?: boolean | null,"latitude"?: number | null,"location"?: unknown,"longitude"?: number | null,"party_date"?: string,"party_location"?: string | null,"party_time"?: string | null,"search_radius_miles"?: number,"selected_theme"?: string | null,"share_token"?: string | null,"shared_at"?: string | null,"state"?: string | null,"status"?: string | null,"theme"?: string | null,"updated_at"?: string | null,"user_id"?: string,"venue_type"?: string | null,"zip_code"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "parties_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "user_trial_status"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "parties_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"party_activities": {
                  Row: {
                    "activity_id": string,"created_at": string | null,"custom_notes": string | null,"estimated_time": number | null,"id": string,"is_selected": boolean | null,"party_id": string,"people_required": number | null,"sort_order": number | null,"updated_at": string | null,"user_id": string
                  }
                  Insert: {
                    "activity_id": string,"created_at"?: string | null,"custom_notes"?: string | null,"estimated_time"?: number | null,"id"?: string,"is_selected"?: boolean | null,"party_id": string,"people_required"?: number | null,"sort_order"?: number | null,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "activity_id"?: string,"created_at"?: string | null,"custom_notes"?: string | null,"estimated_time"?: number | null,"id"?: string,"is_selected"?: boolean | null,"party_id"?: string,"people_required"?: number | null,"sort_order"?: number | null,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "party_activities_activity_id_fkey"
      columns: ["activity_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "party_activities_party_id_fkey"
      columns: ["party_id"]
isOneToOne: false
      referencedRelation: "parties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "party_activities_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "user_trial_status"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "party_activities_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"party_invitations": {
                  Row: {
                    "created_at": string,"design": string,"end_time": string | null,"headline": string | null,"host_name": string | null,"id": string,"is_active": boolean,"last_shared_at": string | null,"location_text": string | null,"message": string | null,"party_id": string,"rsvp_by": string | null,"share_count": number,"start_time": string | null,"token": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"design"?: string,"end_time"?: string | null,"headline"?: string | null,"host_name"?: string | null,"id"?: string,"is_active"?: boolean,"last_shared_at"?: string | null,"location_text"?: string | null,"message"?: string | null,"party_id": string,"rsvp_by"?: string | null,"share_count"?: number,"start_time"?: string | null,"token"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"design"?: string,"end_time"?: string | null,"headline"?: string | null,"host_name"?: string | null,"id"?: string,"is_active"?: boolean,"last_shared_at"?: string | null,"location_text"?: string | null,"message"?: string | null,"party_id"?: string,"rsvp_by"?: string | null,"share_count"?: number,"start_time"?: string | null,"token"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "party_invitations_party_id_fkey"
      columns: ["party_id"]
isOneToOne: true
      referencedRelation: "parties"
      referencedColumns: ["id"]
    }
                  ]
                },"party_venues": {
                  Row: {
                    "created_at": string | null,"custom_address": string | null,"custom_name": string | null,"custom_notes": string | null,"id": string,"is_custom": boolean | null,"party_id": string | null,"selected_at": string | null,"updated_at": string | null,"user_id": string | null,"venue_id": string | null
                  }
                  Insert: {
                    "created_at"?: string | null,"custom_address"?: string | null,"custom_name"?: string | null,"custom_notes"?: string | null,"id"?: string,"is_custom"?: boolean | null,"party_id"?: string | null,"selected_at"?: string | null,"updated_at"?: string | null,"user_id"?: string | null,"venue_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"custom_address"?: string | null,"custom_name"?: string | null,"custom_notes"?: string | null,"id"?: string,"is_custom"?: boolean | null,"party_id"?: string | null,"selected_at"?: string | null,"updated_at"?: string | null,"user_id"?: string | null,"venue_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "party_venues_party_id_fkey"
      columns: ["party_id"]
isOneToOne: true
      referencedRelation: "parties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "party_venues_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "user_trial_status"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "party_venues_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "party_venues_venue_id_fkey"
      columns: ["venue_id"]
isOneToOne: false
      referencedRelation: "venues"
      referencedColumns: ["id"]
    }
                  ]
                },"saved_venues": {
                  Row: {
                    "created_at": string,"id": string,"notes": string | null,"party_id": string,"place_id": string,"updated_at": string,"user_id": string,"venue_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"notes"?: string | null,"party_id": string,"place_id": string,"updated_at"?: string,"user_id"?: string,"venue_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"notes"?: string | null,"party_id"?: string,"place_id"?: string,"updated_at"?: string,"user_id"?: string,"venue_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_venues_party_id_fkey"
      columns: ["party_id"]
isOneToOne: false
      referencedRelation: "parties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saved_venues_venue_id_fkey"
      columns: ["venue_id"]
isOneToOne: false
      referencedRelation: "venues"
      referencedColumns: ["id"]
    }
                  ]
                },"theme_preferences": {
                  Row: {
                    "created_at": string | null,"id": string,"is_favorite": boolean | null,"theme_name": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string | null,"id"?: string,"is_favorite"?: boolean | null,"theme_name": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"id"?: string,"is_favorite"?: boolean | null,"theme_name"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "theme_preferences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "user_trial_status"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "theme_preferences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"users": {
                  Row: {
                    "avatar_url": string | null,"created_at": string | null,"current_plan": string | null,"display_name": string | null,"displayName": string | null,"email": string,"email_notifications": boolean | null,"full_name": string | null,"has_used_trial": boolean | null,"id": string,"is_trial_active": boolean | null,"marketing_emails": boolean | null,"name": string | null,"party_reminders": boolean | null,"trial_expires_at": string | null,"trial_plan": string | null,"trial_started_at": string | null,"updated_at": string | null
                  }
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string | null,"current_plan"?: string | null,"display_name"?: string | null,"displayName"?: string | null,"email": string,"email_notifications"?: boolean | null,"full_name"?: string | null,"has_used_trial"?: boolean | null,"id": string,"is_trial_active"?: boolean | null,"marketing_emails"?: boolean | null,"name"?: string | null,"party_reminders"?: boolean | null,"trial_expires_at"?: string | null,"trial_plan"?: string | null,"trial_started_at"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string | null,"current_plan"?: string | null,"display_name"?: string | null,"displayName"?: string | null,"email"?: string,"email_notifications"?: boolean | null,"full_name"?: string | null,"has_used_trial"?: boolean | null,"id"?: string,"is_trial_active"?: boolean | null,"marketing_emails"?: boolean | null,"name"?: string | null,"party_reminders"?: boolean | null,"trial_expires_at"?: string | null,"trial_plan"?: string | null,"trial_started_at"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"venue_search_results": {
                  Row: {
                    "created_at": string | null,"distance_miles": number | null,"id": string,"search_id": string | null,"search_rank": number | null,"venue_id": string | null
                  }
                  Insert: {
                    "created_at"?: string | null,"distance_miles"?: number | null,"id"?: string,"search_id"?: string | null,"search_rank"?: number | null,"venue_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"distance_miles"?: number | null,"id"?: string,"search_id"?: string | null,"search_rank"?: number | null,"venue_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "venue_search_results_search_id_fkey"
      columns: ["search_id"]
isOneToOne: false
      referencedRelation: "venue_searches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "venue_search_results_venue_id_fkey"
      columns: ["venue_id"]
isOneToOne: false
      referencedRelation: "venues"
      referencedColumns: ["id"]
    }
                  ]
                },"venue_searches": {
                  Row: {
                    "api_latency_ms": number | null,"cache_key": string | null,"category": string,"created_at": string | null,"expires_at": string | null,"fetched_at": string | null,"id": string,"latitude": number | null,"location": unknown,"longitude": number | null,"min_rating": number | null,"query_id": string | null,"radius_meters": number | null,"radius_miles": number | null,"search_completed_at": string | null,"search_query": string | null,"status": string,"total_results": number | null,"zip_code": string | null
                  }
                  Insert: {
                    "api_latency_ms"?: number | null,"cache_key"?: string | null,"category"?: string,"created_at"?: string | null,"expires_at"?: string | null,"fetched_at"?: string | null,"id"?: string,"latitude"?: number | null,"location"?: unknown,"longitude"?: number | null,"min_rating"?: number | null,"query_id"?: string | null,"radius_meters"?: number | null,"radius_miles"?: number | null,"search_completed_at"?: string | null,"search_query"?: string | null,"status"?: string,"total_results"?: number | null,"zip_code"?: string | null
                  }
                  Update: {
                    "api_latency_ms"?: number | null,"cache_key"?: string | null,"category"?: string,"created_at"?: string | null,"expires_at"?: string | null,"fetched_at"?: string | null,"id"?: string,"latitude"?: number | null,"location"?: unknown,"longitude"?: number | null,"min_rating"?: number | null,"query_id"?: string | null,"radius_meters"?: number | null,"radius_miles"?: number | null,"search_completed_at"?: string | null,"search_query"?: string | null,"status"?: string,"total_results"?: number | null,"zip_code"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"venues": {
                  Row: {
                    "accessibility_info": string | null,"address": string | null,"age_restrictions": string | null,"amenities": (string)[] | null,"business_status": string | null,"categories": (string)[],"category": string | null,"city": string | null,"country": string | null,"created_at": string | null,"data_freshness_days": number | null,"description": string | null,"details_synced_at": string | null,"editorial_summary": string | null,"formatted_address": string | null,"good_for_children": boolean | null,"good_for_groups": boolean | null,"google_maps_url": string | null,"id": string,"is_active": boolean | null,"last_synced_at": string | null,"last_validated_at": string | null,"latitude": number | null,"location": unknown,"longitude": number | null,"max_capacity": number | null,"name": string,"opening_hours": Json | null,"parking_info": string | null,"party_packages_available": boolean | null,"phone": string | null,"photo_refs": NonNullable<Json>,"photos": (string)[] | null,"place_id": string,"price_level": number | null,"primary_type": string | null,"primary_type_label": string | null,"rating": number | null,"reviews_count": number | null,"short_address": string | null,"source": string,"state": string | null,"tags": (string)[],"types": (string)[] | null,"updated_at": string | null,"website": string | null,"zip_code": string | null
                  }
                  Insert: {
                    "accessibility_info"?: string | null,"address"?: string | null,"age_restrictions"?: string | null,"amenities"?: (string)[] | null,"business_status"?: string | null,"categories"?: (string)[],"category"?: string | null,"city"?: string | null,"country"?: string | null,"created_at"?: string | null,"data_freshness_days"?: number | null,"description"?: string | null,"details_synced_at"?: string | null,"editorial_summary"?: string | null,"formatted_address"?: string | null,"good_for_children"?: boolean | null,"good_for_groups"?: boolean | null,"google_maps_url"?: string | null,"id"?: string,"is_active"?: boolean | null,"last_synced_at"?: string | null,"last_validated_at"?: string | null,"latitude"?: number | null,"location"?: unknown,"longitude"?: number | null,"max_capacity"?: number | null,"name": string,"opening_hours"?: Json | null,"parking_info"?: string | null,"party_packages_available"?: boolean | null,"phone"?: string | null,"photo_refs"?: NonNullable<Json>,"photos"?: (string)[] | null,"place_id": string,"price_level"?: number | null,"primary_type"?: string | null,"primary_type_label"?: string | null,"rating"?: number | null,"reviews_count"?: number | null,"short_address"?: string | null,"source"?: string,"state"?: string | null,"tags"?: (string)[],"types"?: (string)[] | null,"updated_at"?: string | null,"website"?: string | null,"zip_code"?: string | null
                  }
                  Update: {
                    "accessibility_info"?: string | null,"address"?: string | null,"age_restrictions"?: string | null,"amenities"?: (string)[] | null,"business_status"?: string | null,"categories"?: (string)[],"category"?: string | null,"city"?: string | null,"country"?: string | null,"created_at"?: string | null,"data_freshness_days"?: number | null,"description"?: string | null,"details_synced_at"?: string | null,"editorial_summary"?: string | null,"formatted_address"?: string | null,"good_for_children"?: boolean | null,"good_for_groups"?: boolean | null,"google_maps_url"?: string | null,"id"?: string,"is_active"?: boolean | null,"last_synced_at"?: string | null,"last_validated_at"?: string | null,"latitude"?: number | null,"location"?: unknown,"longitude"?: number | null,"max_capacity"?: number | null,"name"?: string,"opening_hours"?: Json | null,"parking_info"?: string | null,"party_packages_available"?: boolean | null,"phone"?: string | null,"photo_refs"?: NonNullable<Json>,"photos"?: (string)[] | null,"place_id"?: string,"price_level"?: number | null,"primary_type"?: string | null,"primary_type_label"?: string | null,"rating"?: number | null,"reviews_count"?: number | null,"short_address"?: string | null,"source"?: string,"state"?: string | null,"tags"?: (string)[],"types"?: (string)[] | null,"updated_at"?: string | null,"website"?: string | null,"zip_code"?: string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "user_trial_status": {
                  Row: {
                    "current_plan": string | null,"email": string | null,"has_used_trial": boolean | null,"id": string | null,"is_trial_active": boolean | null,"trial_expires_at": string | null
                  }
                  Insert: {
                           "current_plan"?: string | null,"email"?: string | null,"has_used_trial"?: boolean | null,"id"?: string | null,"is_trial_active"?: boolean | null,"trial_expires_at"?: string | null
                         }
                        Update: {
                           "current_plan"?: string | null,"email"?: string | null,"has_used_trial"?: boolean | null,"id"?: string | null,"is_trial_active"?: boolean | null,"trial_expires_at"?: string | null
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "check_and_expire_trial":
{ Args: { "user_id": string }; Returns: boolean
                           },
"get_invitation":
{ Args: { "p_token": string }; Returns: Json
                           },
"get_trial_status":
{ Args: { "user_id": string }; Returns: Json
                           },
"owns_party":
{ Args: { "p_party_id": string }; Returns: boolean
                           },
"purge_stale_places_content":
{ Args: { "p_max_age_days"?: number }; Returns: number
                           },
"start_24_hour_trial":
{ Args: { "user_id": string }; Returns: undefined
                           },
"submit_rsvp":
{ Args: { "p_adults"?: number,"p_children"?: number,"p_email": string,"p_name": string,"p_note"?: string,"p_status": string,"p_token": string }; Returns: Json
                           },
"venues_near":
{ Args: { "p_lat": number,"p_limit"?: number,"p_lng": number,"p_radius_m": number }; Returns: {
              "distance_m": number,"venue_id": string
            }[]
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
