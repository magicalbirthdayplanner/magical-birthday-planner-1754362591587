
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
                },"admin_audit_log": {
                  Row: {
                    "action": string,"admin_user_id": string | null,"created_at": string,"id": number,"new_plan": string | null,"old_plan": string | null,"override_expires_at": string | null,"target_email": string | null,"target_user_id": string | null
                  }
                  Insert: {
                    "action": string,"admin_user_id"?: string | null,"created_at"?: string,"id"?: never,"new_plan"?: string | null,"old_plan"?: string | null,"override_expires_at"?: string | null,"target_email"?: string | null,"target_user_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"admin_user_id"?: string | null,"created_at"?: string,"id"?: never,"new_plan"?: string | null,"old_plan"?: string | null,"override_expires_at"?: string | null,"target_email"?: string | null,"target_user_id"?: string | null
                  }
                  Relationships: [
                    
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
                },"ai_generations": {
                  Row: {
                    "applied": NonNullable<Json>,"created_at": string,"duration_ms": number | null,"error_code": string | null,"feature": string,"id": string,"input_summary": NonNullable<Json>,"input_tokens": number | null,"model": string | null,"output_tokens": number | null,"party_id": string | null,"provider": string | null,"result": Json | null,"status": string,"updated_at": string,"user_id": string | null
                  }
                  Insert: {
                    "applied"?: NonNullable<Json>,"created_at"?: string,"duration_ms"?: number | null,"error_code"?: string | null,"feature": string,"id"?: string,"input_summary"?: NonNullable<Json>,"input_tokens"?: number | null,"model"?: string | null,"output_tokens"?: number | null,"party_id"?: string | null,"provider"?: string | null,"result"?: Json | null,"status"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "applied"?: NonNullable<Json>,"created_at"?: string,"duration_ms"?: number | null,"error_code"?: string | null,"feature"?: string,"id"?: string,"input_summary"?: NonNullable<Json>,"input_tokens"?: number | null,"model"?: string | null,"output_tokens"?: number | null,"party_id"?: string | null,"provider"?: string | null,"result"?: Json | null,"status"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_generations_party_id_fkey"
      columns: ["party_id"]
isOneToOne: false
      referencedRelation: "parties"
      referencedColumns: ["id"]
    }
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
                },"billing_checkouts": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"customer_email": string | null,"id": string,"party_id": string | null,"payment_ref": string | null,"plan": string,"product_id": string,"session_id": string | null,"status": string,"user_id": string
                  }
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"customer_email"?: string | null,"id"?: string,"party_id"?: string | null,"payment_ref"?: string | null,"plan": string,"product_id": string,"session_id"?: string | null,"status"?: string,"user_id": string
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"customer_email"?: string | null,"id"?: string,"party_id"?: string | null,"payment_ref"?: string | null,"plan"?: string,"product_id"?: string,"session_id"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "billing_checkouts_party_id_fkey"
      columns: ["party_id"]
isOneToOne: false
      referencedRelation: "parties"
      referencedColumns: ["id"]
    }
                  ]
                },"billing_customers": {
                  Row: {
                    "created_at": string,"email": string | null,"provider": string,"provider_customer_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"provider"?: string,"provider_customer_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"provider"?: string,"provider_customer_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"billing_purchases": {
                  Row: {
                    "amount_minor": number | null,"created_at": string,"currency": string | null,"current_period_end": string | null,"customer_ref": string | null,"id": string,"kind": string,"last_event_at": string | null,"party_id": string | null,"plan": string,"product_id": string | null,"provider": string,"provider_ref": string,"scope": string,"status": string,"unresolved_reason": string | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "amount_minor"?: number | null,"created_at"?: string,"currency"?: string | null,"current_period_end"?: string | null,"customer_ref"?: string | null,"id"?: string,"kind": string,"last_event_at"?: string | null,"party_id"?: string | null,"plan": string,"product_id"?: string | null,"provider"?: string,"provider_ref": string,"scope"?: string,"status": string,"unresolved_reason"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "amount_minor"?: number | null,"created_at"?: string,"currency"?: string | null,"current_period_end"?: string | null,"customer_ref"?: string | null,"id"?: string,"kind"?: string,"last_event_at"?: string | null,"party_id"?: string | null,"plan"?: string,"product_id"?: string | null,"provider"?: string,"provider_ref"?: string,"scope"?: string,"status"?: string,"unresolved_reason"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "billing_purchases_party_id_fkey"
      columns: ["party_id"]
isOneToOne: false
      referencedRelation: "parties"
      referencedColumns: ["id"]
    }
                  ]
                },"billing_webhook_events": {
                  Row: {
                    "attempts": number,"detail": string | null,"event_id": string,"event_type": string,"processed_at": string | null,"received_at": string,"status": string,"user_id": string | null
                  }
                  Insert: {
                    "attempts"?: number,"detail"?: string | null,"event_id": string,"event_type": string,"processed_at"?: string | null,"received_at"?: string,"status"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"detail"?: string | null,"event_id"?: string,"event_type"?: string,"processed_at"?: string | null,"received_at"?: string,"status"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"checklist_items": {
                  Row: {
                    "category": string,"completed_at": string | null,"created_at": string,"detail": string | null,"due_date": string | null,"id": string,"is_custom": boolean,"party_id": string,"sort_order": number,"source_activity_id": string | null,"task_key": string,"title": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "category"?: string,"completed_at"?: string | null,"created_at"?: string,"detail"?: string | null,"due_date"?: string | null,"id"?: string,"is_custom"?: boolean,"party_id": string,"sort_order"?: number,"source_activity_id"?: string | null,"task_key": string,"title": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "category"?: string,"completed_at"?: string | null,"created_at"?: string,"detail"?: string | null,"due_date"?: string | null,"id"?: string,"is_custom"?: boolean,"party_id"?: string,"sort_order"?: number,"source_activity_id"?: string | null,"task_key"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "checklist_items_party_id_fkey"
      columns: ["party_id"]
isOneToOne: false
      referencedRelation: "parties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checklist_items_source_activity_id_fkey"
      columns: ["source_activity_id"]
isOneToOne: false
      referencedRelation: "party_ai_activities"
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
                    "adult_count": number,"age": number | null,"child_count": number,"created_at": string | null,"dietary_restrictions": (string)[] | null,"email": string | null,"id": string,"invite_status": string,"invited_at": string | null,"name": string,"notes": string | null,"party_id": string,"phone": string | null,"responded_at": string | null,"rsvp_respondent": string | null,"rsvp_status": string | null,"source": string,"type": string | null,"updated_at": string | null,"user_id": string
                  }
                  Insert: {
                    "adult_count"?: number,"age"?: number | null,"child_count"?: number,"created_at"?: string | null,"dietary_restrictions"?: (string)[] | null,"email"?: string | null,"id"?: string,"invite_status"?: string,"invited_at"?: string | null,"name": string,"notes"?: string | null,"party_id": string,"phone"?: string | null,"responded_at"?: string | null,"rsvp_respondent"?: string | null,"rsvp_status"?: string | null,"source"?: string,"type"?: string | null,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "adult_count"?: number,"age"?: number | null,"child_count"?: number,"created_at"?: string | null,"dietary_restrictions"?: (string)[] | null,"email"?: string | null,"id"?: string,"invite_status"?: string,"invited_at"?: string | null,"name"?: string,"notes"?: string | null,"party_id"?: string,"phone"?: string | null,"responded_at"?: string | null,"rsvp_respondent"?: string | null,"rsvp_status"?: string | null,"source"?: string,"type"?: string | null,"updated_at"?: string | null,"user_id"?: string
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
                },"launch_waitlist": {
                  Row: {
                    "confirmation_sent_at": string | null,"created_at": string,"email": string,"first_name": string | null,"id": string,"launch_reminder_sent_at": string | null,"signup_count": number,"source": string | null,"status": string,"unsubscribe_token": string,"updated_at": string,"utm_campaign": string | null,"utm_content": string | null,"utm_medium": string | null,"utm_source": string | null
                  }
                  Insert: {
                    "confirmation_sent_at"?: string | null,"created_at"?: string,"email": string,"first_name"?: string | null,"id"?: string,"launch_reminder_sent_at"?: string | null,"signup_count"?: number,"source"?: string | null,"status"?: string,"unsubscribe_token"?: string,"updated_at"?: string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null
                  }
                  Update: {
                    "confirmation_sent_at"?: string | null,"created_at"?: string,"email"?: string,"first_name"?: string | null,"id"?: string,"launch_reminder_sent_at"?: string | null,"signup_count"?: number,"source"?: string | null,"status"?: string,"unsubscribe_token"?: string,"updated_at"?: string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"parties": {
                  Row: {
                    "budget": number | null,"checklist_data": Json | null,"child_age": number,"child_gender": string | null,"child_name": string,"city": string | null,"colors": (string)[] | null,"created_at": string | null,"guest_count": number | null,"id": string,"interests": (string)[],"is_shared": boolean | null,"latitude": number | null,"location": unknown,"longitude": number | null,"party_date": string,"party_location": string | null,"party_time": string | null,"search_radius_miles": number,"selected_theme": string | null,"share_token": string | null,"shared_at": string | null,"state": string | null,"status": string | null,"theme": string | null,"theme_details": Json | null,"updated_at": string | null,"user_id": string,"venue_type": string | null,"zip_code": string | null
                  }
                  Insert: {
                    "budget"?: number | null,"checklist_data"?: Json | null,"child_age": number,"child_gender"?: string | null,"child_name": string,"city"?: string | null,"colors"?: (string)[] | null,"created_at"?: string | null,"guest_count"?: number | null,"id"?: string,"interests"?: (string)[],"is_shared"?: boolean | null,"latitude"?: number | null,"location"?: unknown,"longitude"?: number | null,"party_date": string,"party_location"?: string | null,"party_time"?: string | null,"search_radius_miles"?: number,"selected_theme"?: string | null,"share_token"?: string | null,"shared_at"?: string | null,"state"?: string | null,"status"?: string | null,"theme"?: string | null,"theme_details"?: Json | null,"updated_at"?: string | null,"user_id": string,"venue_type"?: string | null,"zip_code"?: string | null
                  }
                  Update: {
                    "budget"?: number | null,"checklist_data"?: Json | null,"child_age"?: number,"child_gender"?: string | null,"child_name"?: string,"city"?: string | null,"colors"?: (string)[] | null,"created_at"?: string | null,"guest_count"?: number | null,"id"?: string,"interests"?: (string)[],"is_shared"?: boolean | null,"latitude"?: number | null,"location"?: unknown,"longitude"?: number | null,"party_date"?: string,"party_location"?: string | null,"party_time"?: string | null,"search_radius_miles"?: number,"selected_theme"?: string | null,"share_token"?: string | null,"shared_at"?: string | null,"state"?: string | null,"status"?: string | null,"theme"?: string | null,"theme_details"?: Json | null,"updated_at"?: string | null,"user_id"?: string,"venue_type"?: string | null,"zip_code"?: string | null
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
                },"party_ai_activities": {
                  Row: {
                    "age_max": number | null,"age_min": number | null,"approved_at": string | null,"category": string,"cleanup_level": string,"created_at": string,"description": string | null,"designed_for_guests": number | null,"designed_for_theme": string | null,"details": NonNullable<Json>,"difficulty": string,"duration_min": number | null,"estimated_cost": number | null,"id": string,"materials": (string)[],"name": string,"origin": string,"party_id": string,"setting": string,"sort_order": number,"source_generation_id": string | null,"source_item_id": string | null,"status": string,"updated_at": string,"user_edited": boolean,"user_id": string
                  }
                  Insert: {
                    "age_max"?: number | null,"age_min"?: number | null,"approved_at"?: string | null,"category"?: string,"cleanup_level"?: string,"created_at"?: string,"description"?: string | null,"designed_for_guests"?: number | null,"designed_for_theme"?: string | null,"details"?: NonNullable<Json>,"difficulty"?: string,"duration_min"?: number | null,"estimated_cost"?: number | null,"id"?: string,"materials"?: (string)[],"name": string,"origin"?: string,"party_id": string,"setting"?: string,"sort_order"?: number,"source_generation_id"?: string | null,"source_item_id"?: string | null,"status"?: string,"updated_at"?: string,"user_edited"?: boolean,"user_id"?: string
                  }
                  Update: {
                    "age_max"?: number | null,"age_min"?: number | null,"approved_at"?: string | null,"category"?: string,"cleanup_level"?: string,"created_at"?: string,"description"?: string | null,"designed_for_guests"?: number | null,"designed_for_theme"?: string | null,"details"?: NonNullable<Json>,"difficulty"?: string,"duration_min"?: number | null,"estimated_cost"?: number | null,"id"?: string,"materials"?: (string)[],"name"?: string,"origin"?: string,"party_id"?: string,"setting"?: string,"sort_order"?: number,"source_generation_id"?: string | null,"source_item_id"?: string | null,"status"?: string,"updated_at"?: string,"user_edited"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "party_ai_activities_party_id_fkey"
      columns: ["party_id"]
isOneToOne: false
      referencedRelation: "parties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "party_ai_activities_source_generation_id_fkey"
      columns: ["source_generation_id"]
isOneToOne: false
      referencedRelation: "ai_generations"
      referencedColumns: ["id"]
    }
                  ]
                },"party_budget_lines": {
                  Row: {
                    "actual_amount": number | null,"amount": number,"category": string,"created_at": string,"id": string,"label": string | null,"party_id": string,"source_activity_id": string | null,"source_generation_id": string | null,"source_item_id": string | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "actual_amount"?: number | null,"amount": number,"category": string,"created_at"?: string,"id"?: string,"label"?: string | null,"party_id": string,"source_activity_id"?: string | null,"source_generation_id"?: string | null,"source_item_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "actual_amount"?: number | null,"amount"?: number,"category"?: string,"created_at"?: string,"id"?: string,"label"?: string | null,"party_id"?: string,"source_activity_id"?: string | null,"source_generation_id"?: string | null,"source_item_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "party_budget_lines_party_id_fkey"
      columns: ["party_id"]
isOneToOne: false
      referencedRelation: "parties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "party_budget_lines_source_activity_id_fkey"
      columns: ["source_activity_id"]
isOneToOne: false
      referencedRelation: "party_ai_activities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "party_budget_lines_source_generation_id_fkey"
      columns: ["source_generation_id"]
isOneToOne: false
      referencedRelation: "ai_generations"
      referencedColumns: ["id"]
    }
                  ]
                },"party_food_items": {
                  Row: {
                    "category": string,"created_at": string,"designed_for_guests": number | null,"dietary_tags": (string)[],"estimated_cost": number | null,"id": string,"name": string,"notes": string | null,"origin": string,"party_id": string,"quantity": number | null,"source_generation_id": string | null,"source_item_id": string | null,"unit": string | null,"updated_at": string,"user_edited": boolean,"user_id": string
                  }
                  Insert: {
                    "category"?: string,"created_at"?: string,"designed_for_guests"?: number | null,"dietary_tags"?: (string)[],"estimated_cost"?: number | null,"id"?: string,"name": string,"notes"?: string | null,"origin"?: string,"party_id": string,"quantity"?: number | null,"source_generation_id"?: string | null,"source_item_id"?: string | null,"unit"?: string | null,"updated_at"?: string,"user_edited"?: boolean,"user_id"?: string
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"designed_for_guests"?: number | null,"dietary_tags"?: (string)[],"estimated_cost"?: number | null,"id"?: string,"name"?: string,"notes"?: string | null,"origin"?: string,"party_id"?: string,"quantity"?: number | null,"source_generation_id"?: string | null,"source_item_id"?: string | null,"unit"?: string | null,"updated_at"?: string,"user_edited"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "party_food_items_party_id_fkey"
      columns: ["party_id"]
isOneToOne: false
      referencedRelation: "parties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "party_food_items_source_generation_id_fkey"
      columns: ["source_generation_id"]
isOneToOne: false
      referencedRelation: "ai_generations"
      referencedColumns: ["id"]
    }
                  ]
                },"party_host_content": {
                  Row: {
                    "activity_id": string | null,"body": string,"created_at": string,"guest_id": string | null,"id": string,"kind": string,"origin": string,"party_id": string,"source_generation_id": string | null,"source_item_id": string | null,"title": string | null,"updated_at": string,"user_edited": boolean,"user_id": string
                  }
                  Insert: {
                    "activity_id"?: string | null,"body": string,"created_at"?: string,"guest_id"?: string | null,"id"?: string,"kind": string,"origin"?: string,"party_id": string,"source_generation_id"?: string | null,"source_item_id"?: string | null,"title"?: string | null,"updated_at"?: string,"user_edited"?: boolean,"user_id"?: string
                  }
                  Update: {
                    "activity_id"?: string | null,"body"?: string,"created_at"?: string,"guest_id"?: string | null,"id"?: string,"kind"?: string,"origin"?: string,"party_id"?: string,"source_generation_id"?: string | null,"source_item_id"?: string | null,"title"?: string | null,"updated_at"?: string,"user_edited"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "party_host_content_activity_id_fkey"
      columns: ["activity_id"]
isOneToOne: false
      referencedRelation: "party_ai_activities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "party_host_content_guest_id_fkey"
      columns: ["guest_id"]
isOneToOne: false
      referencedRelation: "guests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "party_host_content_party_id_fkey"
      columns: ["party_id"]
isOneToOne: false
      referencedRelation: "parties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "party_host_content_source_generation_id_fkey"
      columns: ["source_generation_id"]
isOneToOne: false
      referencedRelation: "ai_generations"
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
                },"party_shopping_items": {
                  Row: {
                    "category": string,"created_at": string,"done": boolean,"estimated_cost": number | null,"id": string,"item": string,"party_id": string,"qty": string | null,"source_activity_id": string | null,"source_generation_id": string | null,"source_item_id": string | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "category"?: string,"created_at"?: string,"done"?: boolean,"estimated_cost"?: number | null,"id"?: string,"item": string,"party_id": string,"qty"?: string | null,"source_activity_id"?: string | null,"source_generation_id"?: string | null,"source_item_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"done"?: boolean,"estimated_cost"?: number | null,"id"?: string,"item"?: string,"party_id"?: string,"qty"?: string | null,"source_activity_id"?: string | null,"source_generation_id"?: string | null,"source_item_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "party_shopping_items_party_id_fkey"
      columns: ["party_id"]
isOneToOne: false
      referencedRelation: "parties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "party_shopping_items_source_activity_id_fkey"
      columns: ["source_activity_id"]
isOneToOne: false
      referencedRelation: "party_ai_activities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "party_shopping_items_source_generation_id_fkey"
      columns: ["source_generation_id"]
isOneToOne: false
      referencedRelation: "ai_generations"
      referencedColumns: ["id"]
    }
                  ]
                },"party_timeline_items": {
                  Row: {
                    "activity_id": string | null,"created_at": string,"duration_min": number | null,"id": string,"kind": string,"label": string,"origin": string,"party_id": string,"sort_order": number,"source_generation_id": string | null,"source_item_id": string | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "activity_id"?: string | null,"created_at"?: string,"duration_min"?: number | null,"id"?: string,"kind"?: string,"label": string,"origin"?: string,"party_id": string,"sort_order"?: number,"source_generation_id"?: string | null,"source_item_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "activity_id"?: string | null,"created_at"?: string,"duration_min"?: number | null,"id"?: string,"kind"?: string,"label"?: string,"origin"?: string,"party_id"?: string,"sort_order"?: number,"source_generation_id"?: string | null,"source_item_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "party_timeline_items_activity_id_fkey"
      columns: ["activity_id"]
isOneToOne: false
      referencedRelation: "party_ai_activities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "party_timeline_items_party_id_fkey"
      columns: ["party_id"]
isOneToOne: false
      referencedRelation: "parties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "party_timeline_items_source_generation_id_fkey"
      columns: ["source_generation_id"]
isOneToOne: false
      referencedRelation: "ai_generations"
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
                },"plan_overrides": {
                  Row: {
                    "created_at": string,"expires_at": string | null,"plan": string,"set_by": string | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"expires_at"?: string | null,"plan": string,"set_by"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string | null,"plan"?: string,"set_by"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
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
                },"user_roles": {
                  Row: {
                    "granted_at": string,"granted_by": string | null,"role": string,"user_id": string
                  }
                  Insert: {
                    "granted_at"?: string,"granted_by"?: string | null,"role": string,"user_id": string
                  }
                  Update: {
                    "granted_at"?: string,"granted_by"?: string | null,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
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
            "ai_finalize":
{ Args: { "p_duration_ms": number,"p_error_code": string,"p_id": string,"p_input_tokens": number,"p_model": string,"p_output_tokens": number,"p_provider": string,"p_result": Json,"p_status": string,"p_user": string }; Returns: undefined
                           },
"ai_global_count_today":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"ai_mark_applied":
{ Args: { "p_entry": Json,"p_id": string }; Returns: undefined
                           },
"ai_reserve":
{ Args: { "p_feature": string,"p_global_limit"?: number,"p_input_summary"?: Json,"p_party": string,"p_user": string }; Returns: string
                           },
"check_and_expire_trial":
{ Args: { "user_id": string }; Returns: boolean
                           },
"get_invitation":
{ Args: { "p_token": string }; Returns: Json
                           },
"get_trial_status":
{ Args: { "user_id": string }; Returns: Json
                           },
"has_paid_access":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           } |
{ Args: { "p_party": string }; Returns: boolean
                           },
"is_end_user_request":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"join_launch_waitlist":
{ Args: { "p_email": string,"p_first_name"?: string,"p_source"?: string,"p_utm_campaign"?: string,"p_utm_content"?: string,"p_utm_medium"?: string,"p_utm_source"?: string }; Returns: string
                           },
"launch_waitlist_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"owns_party":
{ Args: { "p_party_id": string }; Returns: boolean
                           },
"party_plan":
{ Args: { "p_party": string }; Returns: string
                           },
"purge_stale_places_content":
{ Args: { "p_max_age_days"?: number }; Returns: number
                           },
"recompute_entitlement":
{ Args: { "p_user": string }; Returns: string
                           },
"reconcile_purchase":
{ Args: { "p_party": string,"p_purchase": string }; Returns: undefined
                           },
"remove_party_activity":
{ Args: { "p_activity": string }; Returns: Json
                           },
"start_24_hour_trial":
{ Args: { "user_id": string }; Returns: undefined
                           },
"submit_rsvp":
{ Args: { "p_adults"?: number,"p_children"?: number,"p_email": string,"p_name": string,"p_note"?: string,"p_respondent"?: string,"p_status": string,"p_token": string }; Returns: Json
                           },
"unsubscribe_launch_waitlist":
{ Args: { "p_token": string }; Returns: boolean
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
