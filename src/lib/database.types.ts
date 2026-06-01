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
      activity_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          tenant_id: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          tenant_id: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          tenant_id?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          amount: number | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          amount?: number | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          amount?: number | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          is_active: boolean
          is_main: boolean
          name: string
          phone: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          is_main?: boolean
          name: string
          phone?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          is_main?: boolean
          name?: string
          phone?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          applies_to: string
          color_hex: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          parent_category_id: string | null
          slug: string
          sort_order: number
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          applies_to?: string
          color_hex?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          parent_category_id?: string | null
          slug: string
          sort_order?: number
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          applies_to?: string
          color_hex?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          parent_category_id?: string | null
          slug?: string
          sort_order?: number
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean
          last_visit: string | null
          name: string
          notes: string | null
          phone: string | null
          tenant_id: string | null
          total_purchases: number
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          last_visit?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          tenant_id?: string | null
          total_purchases?: number
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          last_visit?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          tenant_id?: string | null
          total_purchases?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          attachment_url: string | null
          branch_id: string | null
          category: string
          category_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          employee_id: string | null
          expense_date: string
          id: string
          is_recurring: boolean
          paid_at: string | null
          recurrence_interval: string | null
          recurring_end_date: string | null
          recurring_next_date: string | null
          recurring_pattern: string | null
          status: string
          sub_category: string | null
          submitted_by: string | null
          tenant_id: string | null
          updated_at: string | null
          wallet_transaction_id: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          branch_id?: string | null
          category?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          employee_id?: string | null
          expense_date?: string
          id?: string
          is_recurring?: boolean
          paid_at?: string | null
          recurrence_interval?: string | null
          recurring_end_date?: string | null
          recurring_next_date?: string | null
          recurring_pattern?: string | null
          status?: string
          sub_category?: string | null
          submitted_by?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          wallet_transaction_id?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          branch_id?: string | null
          category?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          employee_id?: string | null
          expense_date?: string
          id?: string
          is_recurring?: boolean
          paid_at?: string | null
          recurrence_interval?: string | null
          recurring_end_date?: string | null
          recurring_next_date?: string | null
          recurring_pattern?: string | null
          status?: string
          sub_category?: string | null
          submitted_by?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          wallet_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      income_entries: {
        Row: {
          amount: number
          branch_id: string | null
          category_id: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          id: string
          income_date: string | null
          is_recurring: boolean
          recurring_pattern: string | null
          source: string
          tenant_id: string | null
        }
        Insert: {
          amount: number
          branch_id?: string | null
          category_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          income_date?: string | null
          is_recurring?: boolean
          recurring_pattern?: string | null
          source: string
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          category_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          income_date?: string | null
          is_recurring?: boolean
          recurring_pattern?: string | null
          source?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "income_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          is_read: boolean
          link: string | null
          read_at: string | null
          tenant_id: string
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          read_at?: string | null
          tenant_id: string
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          read_at?: string | null
          tenant_id?: string
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          line_total: number
          notes: string | null
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: string
          line_total: number
          notes?: string | null
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          unit_price: number
        }
        Update: {
          id?: string
          line_total?: number
          notes?: string | null
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          branch_id: string | null
          cashier_id: string | null
          cashier_name: string | null
          completed_at: string | null
          created_at: string | null
          customer_name: string | null
          customer_phone: string | null
          discount_amount: number
          id: string
          notes: string | null
          order_ref: string
          payment_method: string | null
          payment_status: string
          return_status: string | null
          shift_id: string | null
          split_payments: Json | null
          status: string
          subtotal: number
          tax_amount: number
          tenant_id: string | null
          total: number
          type: string
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          cashier_id?: string | null
          cashier_name?: string | null
          completed_at?: string | null
          created_at?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_amount?: number
          id?: string
          notes?: string | null
          order_ref: string
          payment_method?: string | null
          payment_status?: string
          return_status?: string | null
          shift_id?: string | null
          split_payments?: Json | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tenant_id?: string | null
          total?: number
          type?: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          cashier_id?: string | null
          cashier_name?: string | null
          completed_at?: string | null
          created_at?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_amount?: number
          id?: string
          notes?: string | null
          order_ref?: string
          payment_method?: string | null
          payment_status?: string
          return_status?: string | null
          shift_id?: string | null
          split_payments?: Json | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tenant_id?: string | null
          total?: number
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_profile: {
        Row: {
          access_time_end: string | null
          access_time_start: string | null
          address: string | null
          closing_time: string | null
          currency: string
          currency_code: string | null
          currency_symbol: string | null
          einvoice_client_id: string | null
          einvoice_client_secret: string | null
          einvoice_enabled: boolean | null
          einvoice_env: string | null
          einvoice_reg_number: string | null
          email: string | null
          fiscal_year_start: string
          id: string
          last_order_cutoff_minutes: number | null
          logo_storage_path: string | null
          logo_url: string | null
          name: string
          opening_time: string | null
          phone: string | null
          print_invoices_enabled: boolean
          printer_name: string | null
          receipt_footer: string | null
          tax_number: string | null
          tax_rate: number | null
          tenant_id: string | null
        }
        Insert: {
          access_time_end?: string | null
          access_time_start?: string | null
          address?: string | null
          closing_time?: string | null
          currency?: string
          currency_code?: string | null
          currency_symbol?: string | null
          einvoice_client_id?: string | null
          einvoice_client_secret?: string | null
          einvoice_enabled?: boolean | null
          einvoice_env?: string | null
          einvoice_reg_number?: string | null
          email?: string | null
          fiscal_year_start?: string
          id?: string
          last_order_cutoff_minutes?: number | null
          logo_storage_path?: string | null
          logo_url?: string | null
          name?: string
          opening_time?: string | null
          phone?: string | null
          print_invoices_enabled?: boolean
          printer_name?: string | null
          receipt_footer?: string | null
          tax_number?: string | null
          tax_rate?: number | null
          tenant_id?: string | null
        }
        Update: {
          access_time_end?: string | null
          access_time_start?: string | null
          address?: string | null
          closing_time?: string | null
          currency?: string
          currency_code?: string | null
          currency_symbol?: string | null
          einvoice_client_id?: string | null
          einvoice_client_secret?: string | null
          einvoice_enabled?: boolean | null
          einvoice_env?: string | null
          einvoice_reg_number?: string | null
          email?: string | null
          fiscal_year_start?: string
          id?: string
          last_order_cutoff_minutes?: number | null
          logo_storage_path?: string | null
          logo_url?: string | null
          name?: string
          opening_time?: string | null
          phone?: string | null
          print_invoices_enabled?: boolean
          printer_name?: string | null
          receipt_footer?: string | null
          tax_number?: string | null
          tax_rate?: number | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_profile_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_addons: {
        Row: {
          created_at: string | null
          extra_price: number
          id: string
          is_active: boolean
          name: string
          product_id: string
          sort_order: number
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          extra_price?: number
          id?: string
          is_active?: boolean
          name: string
          product_id: string
          sort_order?: number
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          extra_price?: number
          id?: string
          is_active?: boolean
          name?: string
          product_id?: string
          sort_order?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_addons_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_addons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_bundles: {
        Row: {
          bundle_id: string
          created_at: string
          id: string
          item_id: string
          quantity: number
        }
        Insert: {
          bundle_id: string
          created_at?: string
          id?: string
          item_id: string
          quantity?: number
        }
        Update: {
          bundle_id?: string
          created_at?: string
          id?: string
          item_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_bundles_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_bundles_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string | null
          id: string
          image_url: string
          is_primary: boolean
          product_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url: string
          is_primary?: boolean
          product_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string
          is_primary?: boolean
          product_id?: string
          sort_order?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null
          batch_tracking: boolean
          cashier_description: string | null
          category: string
          category_id: string | null
          cost_price: number
          created_at: string
          deleted_at: string | null
          description: string | null
          emoji: string | null
          id: string
          is_active: boolean
          is_bundle: boolean
          low_stock_threshold: number
          name: string
          primary_image_url: string | null
          selling_price: number
          sku: string | null
          stock: number | null
          tenant_id: string | null
          track_stock: boolean
          unit: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          batch_tracking?: boolean
          cashier_description?: string | null
          category?: string
          category_id?: string | null
          cost_price?: number
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean
          is_bundle?: boolean
          low_stock_threshold?: number
          name: string
          primary_image_url?: string | null
          selling_price?: number
          sku?: string | null
          stock?: number | null
          tenant_id?: string | null
          track_stock?: boolean
          unit?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          batch_tracking?: boolean
          cashier_description?: string | null
          category?: string
          category_id?: string | null
          cost_price?: number
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean
          is_bundle?: boolean
          low_stock_threshold?: number
          name?: string
          primary_image_url?: string | null
          selling_price?: number
          sku?: string | null
          stock?: number | null
          tenant_id?: string | null
          track_stock?: boolean
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_uses: number | null
          min_order_amount: number | null
          tenant_id: string
          used_count: number
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          discount_type?: string
          discount_value: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_amount?: number | null
          tenant_id: string
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_amount?: number | null
          tenant_id?: string
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          id: string
          line_total: number
          product_id: string
          product_name: string
          purchase_order_id: string
          quantity: number
          received_quantity: number
          unit_price: number
        }
        Insert: {
          id?: string
          line_total: number
          product_id: string
          product_name: string
          purchase_order_id: string
          quantity: number
          received_quantity?: number
          unit_price: number
        }
        Update: {
          id?: string
          line_total?: number
          product_id?: string
          product_name?: string
          purchase_order_id?: string
          quantity?: number
          received_quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string | null
          created_by: string | null
          expected_date: string | null
          id: string
          notes: string | null
          po_number: string
          received_at: string | null
          status: string
          subtotal: number
          supplier_id: string
          tax_amount: number
          tenant_id: string
          total: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          po_number: string
          received_at?: string | null
          status?: string
          subtotal?: number
          supplier_id: string
          tax_amount?: number
          tenant_id: string
          total?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          po_number?: string
          received_at?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string
          tax_amount?: number
          tenant_id?: string
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_execution_log: {
        Row: {
          amount_posted: number | null
          created_at: string | null
          error_message: string | null
          id: string
          recurring_id: string
          run_date: string
          status: string
        }
        Insert: {
          amount_posted?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          recurring_id: string
          run_date?: string
          status?: string
        }
        Update: {
          amount_posted?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          recurring_id?: string
          run_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_execution_log_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_transactions: {
        Row: {
          amount: number
          amount_type: string
          auto_post: boolean
          category: string | null
          category_id: string | null
          created_at: string | null
          description: string | null
          end_date: string | null
          id: string
          is_active: boolean
          last_run_date: string | null
          name: string
          next_run_date: string
          recurrence_day: number | null
          recurrence_type: string
          start_date: string
          total_amount: number
          total_runs: number
          type: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          amount_type?: string
          auto_post?: boolean
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          last_run_date?: string | null
          name: string
          next_run_date?: string
          recurrence_day?: number | null
          recurrence_type: string
          start_date?: string
          total_amount?: number
          total_runs?: number
          type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          amount_type?: string
          auto_post?: boolean
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          last_run_date?: string | null
          name?: string
          next_run_date?: string
          recurrence_day?: number | null
          recurrence_type?: string
          start_date?: string
          total_amount?: number
          total_runs?: number
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      return_items: {
        Row: {
          id: string
          line_total: number
          order_item_id: string
          product_name: string
          quantity: number
          return_id: string
          unit_price: number
        }
        Insert: {
          id?: string
          line_total: number
          order_item_id: string
          product_name: string
          quantity: number
          return_id: string
          unit_price: number
        }
        Update: {
          id?: string
          line_total?: number
          order_item_id?: string
          product_name?: string
          quantity?: number
          return_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "return_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          order_id: string
          processed_by: string | null
          reason: string
          refund_amount: number
          refund_method: string
          return_ref: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id: string
          processed_by?: string | null
          reason: string
          refund_amount: number
          refund_method?: string
          return_ref: string
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          processed_by?: string | null
          reason?: string
          refund_amount?: number
          refund_method?: string
          return_ref?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          id: string
          module: string
          role_id: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          id?: string
          module: string
          role_id: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          id?: string
          module?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean
          name: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          actual_cash: number | null
          branch_id: string
          cash_difference: number | null
          cashier_id: string
          cashier_name: string
          closed_at: string | null
          expected_cash: number | null
          id: string
          notes: string | null
          opened_at: string
          starting_cash: number
          status: string
          tenant_id: string
          total_orders: number
          total_refunds: number
          total_sales: number
        }
        Insert: {
          actual_cash?: number | null
          branch_id: string
          cash_difference?: number | null
          cashier_id: string
          cashier_name: string
          closed_at?: string | null
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          starting_cash?: number
          status?: string
          tenant_id: string
          total_orders?: number
          total_refunds?: number
          total_sales?: number
        }
        Update: {
          actual_cash?: number | null
          branch_id?: string
          cash_difference?: number | null
          cashier_id?: string
          cashier_name?: string
          closed_at?: string | null
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          starting_cash?: number
          status?: string
          tenant_id?: string
          total_orders?: number
          total_refunds?: number
          total_sales?: number
        }
        Relationships: [
          {
            foreignKeyName: "shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_locations: {
        Row: {
          batch_number: string | null
          expiry_date: string | null
          id: string
          product_id: string
          quantity: number
          tenant_id: string
          updated_at: string | null
          warehouse_id: string
        }
        Insert: {
          batch_number?: string | null
          expiry_date?: string | null
          id?: string
          product_id: string
          quantity?: number
          tenant_id: string
          updated_at?: string | null
          warehouse_id: string
        }
        Update: {
          batch_number?: string | null
          expiry_date?: string | null
          id?: string
          product_id?: string
          quantity?: number
          tenant_id?: string
          updated_at?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_locations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          from_warehouse_id: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          status: string
          tenant_id: string
          to_warehouse_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          from_warehouse_id: string
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          status?: string
          tenant_id: string
          to_warehouse_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          from_warehouse_id?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          status?: string
          tenant_id?: string
          to_warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string
          reference: string | null
          supplier_id: string
          tenant_id: string
        }
        Insert: {
          amount: number
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string
          reference?: string | null
          supplier_id: string
          tenant_id: string
        }
        Update: {
          amount?: number
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string
          reference?: string | null
          supplier_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          balance: number
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          tax_number: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          balance?: number
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          tax_number?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          balance?: number
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          tax_number?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          max_branches: number
          max_users: number
          name: string
          owner_email: string
          plan: string
          plan_expires_at: string | null
          settings: Json
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          max_branches?: number
          max_users?: number
          name: string
          owner_email: string
          plan?: string
          plan_expires_at?: string | null
          settings?: Json
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          max_branches?: number
          max_users?: number
          name?: string
          owner_email?: string
          plan?: string
          plan_expires_at?: string | null
          settings?: Json
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          branch_id: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          last_login: string | null
          phone: string | null
          role: string | null
          role_name: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          last_login?: string | null
          phone?: string | null
          role?: string | null
          role_name?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          last_login?: string | null
          phone?: string | null
          role?: string | null
          role_name?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet: {
        Row: {
          current_balance: number
          id: string
          minimum_balance_alert: number | null
          updated_at: string | null
        }
        Insert: {
          current_balance?: number
          id?: string
          minimum_balance_alert?: number | null
          updated_at?: string | null
        }
        Update: {
          current_balance?: number
          id?: string
          minimum_balance_alert?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string | null
          description: string | null
          direction: string
          id: string
          is_voided: boolean
          reference_id: string | null
          transaction_date: string | null
          type: string
          void_reason: string | null
          wallet_id: string | null
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string | null
          description?: string | null
          direction: string
          id?: string
          is_voided?: boolean
          reference_id?: string | null
          transaction_date?: string | null
          type: string
          void_reason?: string | null
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string | null
          description?: string | null
          direction?: string
          id?: string
          is_voided?: boolean
          reference_id?: string | null
          transaction_date?: string | null
          type?: string
          void_reason?: string | null
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallet"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          branch_id: string | null
          created_at: string | null
          id: string
          is_active: boolean
          name: string
          tenant_id: string
        }
        Insert: {
          address?: string | null
          branch_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
        }
        Update: {
          address?: string | null
          branch_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      update_wallet_balance: {
        Args: {
          p_amount: number
          p_description?: string
          p_direction: string
          p_reference_id?: string
          p_type: string
        }
        Returns: string
      }
      uuid_generate_v4: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

