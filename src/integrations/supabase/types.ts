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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      blog_posts: {
        Row: {
          content: Json | null
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          published_at: string | null
          reading_time_minutes: number
          slug: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: Json | null
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          reading_time_minutes?: number
          slug: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json | null
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          reading_time_minutes?: number
          slug?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolio_cash_flows: {
        Row: {
          amount: number
          created_at: string
          flow_type: string
          id: string
          note: string | null
          portfolio_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          flow_type: string
          id?: string
          note?: string | null
          portfolio_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          flow_type?: string
          id?: string
          note?: string | null
          portfolio_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_cash_flows_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_events: {
        Row: {
          amount_tl: number
          created_at: string
          event_type: Database["public"]["Enums"]["portfolio_event_type"]
          id: string
          note: string | null
          trade_id: string | null
          user_id: string
        }
        Insert: {
          amount_tl: number
          created_at?: string
          event_type: Database["public"]["Enums"]["portfolio_event_type"]
          id?: string
          note?: string | null
          trade_id?: string | null
          user_id: string
        }
        Update: {
          amount_tl?: number
          created_at?: string
          event_type?: Database["public"]["Enums"]["portfolio_event_type"]
          id?: string
          note?: string | null
          trade_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_events_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_snapshots: {
        Row: {
          created_at: string
          event_id: string
          id: string
          portfolio_value: number
          shares_total: number
          snapshot_date: string
          unit_price: number
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          portfolio_value: number
          shares_total: number
          snapshot_date: string
          unit_price: number
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          portfolio_value?: number
          shares_total?: number
          snapshot_date?: string
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_snapshots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "portfolio_events"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_value_snapshots: {
        Row: {
          created_at: string
          id: string
          portfolio_id: string
          snapshot_date: string
          user_id: string
          value_try: number | null
          value_usd: number
        }
        Insert: {
          created_at?: string
          id?: string
          portfolio_id: string
          snapshot_date: string
          user_id: string
          value_try?: number | null
          value_usd?: number
        }
        Update: {
          created_at?: string
          id?: string
          portfolio_id?: string
          snapshot_date?: string
          user_id?: string
          value_try?: number | null
          value_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_value_snapshots_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolios: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          name: string
          status: Database["public"]["Enums"]["portfolio_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["portfolio_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["portfolio_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_partial_closes: {
        Row: {
          closing_note: string | null
          closing_type: string
          created_at: string
          exit_price: number
          id: string
          lot_quantity: number
          portfolio_id: string
          realized_pnl: number | null
          stop_reason: string | null
          trade_id: string
          user_id: string
        }
        Insert: {
          closing_note?: string | null
          closing_type: string
          created_at?: string
          exit_price: number
          id?: string
          lot_quantity: number
          portfolio_id: string
          realized_pnl?: number | null
          stop_reason?: string | null
          trade_id: string
          user_id: string
        }
        Update: {
          closing_note?: string | null
          closing_type?: string
          created_at?: string
          exit_price?: number
          id?: string
          lot_quantity?: number
          portfolio_id?: string
          realized_pnl?: number | null
          stop_reason?: string | null
          trade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_partial_closes_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_partial_closes_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          closed_at: string | null
          closing_note: string | null
          closing_type: string | null
          created_at: string
          entry_price: number
          exit_price: number | null
          id: string
          is_successful: boolean | null
          lot_quantity: number
          merge_count: number
          merge_history: Json
          portfolio_id: string
          position_amount: number | null
          progress_percent: number | null
          reasons: string[] | null
          remaining_lot: number
          rr_ratio: number | null
          status: Database["public"]["Enums"]["trade_status"]
          stock_name: string
          stock_symbol: string
          stop_price: number
          stop_reason: string | null
          target_price: number
          trade_type: Database["public"]["Enums"]["trade_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          closing_note?: string | null
          closing_type?: string | null
          created_at?: string
          entry_price: number
          exit_price?: number | null
          id?: string
          is_successful?: boolean | null
          lot_quantity?: number
          merge_count?: number
          merge_history?: Json
          portfolio_id: string
          position_amount?: number | null
          progress_percent?: number | null
          reasons?: string[] | null
          remaining_lot?: number
          rr_ratio?: number | null
          status?: Database["public"]["Enums"]["trade_status"]
          stock_name: string
          stock_symbol: string
          stop_price: number
          stop_reason?: string | null
          target_price: number
          trade_type: Database["public"]["Enums"]["trade_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          closing_note?: string | null
          closing_type?: string | null
          created_at?: string
          entry_price?: number
          exit_price?: number | null
          id?: string
          is_successful?: boolean | null
          lot_quantity?: number
          merge_count?: number
          merge_history?: Json
          portfolio_id?: string
          position_amount?: number | null
          progress_percent?: number | null
          reasons?: string[] | null
          remaining_lot?: number
          rr_ratio?: number | null
          status?: Database["public"]["Enums"]["trade_status"]
          stock_name?: string
          stock_symbol?: string
          stop_price?: number
          stop_reason?: string | null
          target_price?: number
          trade_type?: Database["public"]["Enums"]["trade_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      user_assets: {
        Row: {
          amount_usd: number
          asset_type: string
          category: string
          created_at: string
          id: string
          metadata: Json | null
          note: string | null
          portfolio_id: string
          quantity: number
          quantity_unit: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_usd: number
          asset_type: string
          category: string
          created_at?: string
          id?: string
          metadata?: Json | null
          note?: string | null
          portfolio_id: string
          quantity?: number
          quantity_unit?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_usd?: number
          asset_type?: string
          category?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          note?: string | null
          portfolio_id?: string
          quantity?: number
          quantity_unit?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_assets_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_available_cash:
        | { Args: { p_user_id: string }; Returns: number }
        | {
            Args: { p_portfolio_id?: string; p_user_id: string }
            Returns: number
          }
      calculate_progress_percent: {
        Args: {
          p_entry_price: number
          p_exit_price: number
          p_target_price: number
          p_trade_type: Database["public"]["Enums"]["trade_type"]
        }
        Returns: number
      }
      calculate_rr_ratio: {
        Args: {
          p_entry_price: number
          p_stop_price: number
          p_target_price: number
          p_trade_type: Database["public"]["Enums"]["trade_type"]
        }
        Returns: number
      }
      close_trade_partial: {
        Args: {
          p_closing_note?: string
          p_closing_type: string
          p_exit_price: number
          p_lot_quantity: number
          p_stop_reason?: string
          p_trade_id: string
          p_user_id: string
        }
        Returns: string
      }
      create_trade_with_cash_check: {
        Args: {
          p_entry_price: number
          p_lot_quantity: number
          p_portfolio_id: string
          p_reasons?: string[]
          p_stock_name: string
          p_stock_symbol: string
          p_stop_price: number
          p_target_price: number
          p_trade_type: Database["public"]["Enums"]["trade_type"]
          p_user_id: string
        }
        Returns: string
      }
      create_withdraw_with_check: {
        Args: {
          p_amount: number
          p_note?: string
          p_portfolio_id: string
          p_user_id: string
        }
        Returns: string
      }
      merge_into_trade: {
        Args: {
          p_add_entry_price: number
          p_add_lot_quantity: number
          p_add_reasons?: string[]
          p_add_stop_price: number
          p_add_target_price: number
          p_target_trade_id: string
          p_user_id: string
        }
        Returns: string
      }
      transfer_portfolio_items: {
        Args: {
          p_from_portfolio_id: string
          p_items: Json
          p_to_portfolio_id: string
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      portfolio_event_type: "deposit" | "withdraw" | "pnl"
      portfolio_status: "active" | "closed"
      trade_status: "active" | "closed"
      trade_type: "buy" | "sell"
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
      portfolio_event_type: ["deposit", "withdraw", "pnl"],
      portfolio_status: ["active", "closed"],
      trade_status: ["active", "closed"],
      trade_type: ["buy", "sell"],
    },
  },
} as const
