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
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      customer_tiers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          notes: string | null
          shop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          notes?: string | null
          shop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          notes?: string | null
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'customer_tiers_shop_id_fkey'
            columns: ['shop_id']
            isOneToOne: false
            referencedRelation: 'shops'
            referencedColumns: ['id']
          }
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          outstanding_balance: number
          phone: string
          shop_id: string
          tier_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          outstanding_balance?: number
          phone: string
          shop_id: string
          tier_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          outstanding_balance?: number
          phone?: string
          shop_id?: string
          tier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'customers_shop_id_fkey'
            columns: ['shop_id']
            isOneToOne: false
            referencedRelation: 'shops'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customers_tier_id_fkey'
            columns: ['tier_id']
            isOneToOne: false
            referencedRelation: 'customer_tiers'
            referencedColumns: ['id']
          }
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string
          expense_date: string
          id: string
          note: string | null
          shop_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by: string
          expense_date?: string
          id?: string
          note?: string | null
          shop_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string
          expense_date?: string
          id?: string
          note?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'expenses_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expenses_shop_id_fkey'
            columns: ['shop_id']
            isOneToOne: false
            referencedRelation: 'shops'
            referencedColumns: ['id']
          }
        ]
      }
      inventory_batches: {
        Row: {
          batch_no: string
          cost_per_unit: number
          created_at: string
          expiry_date: string | null
          id: string
          is_active: boolean
          manufactured_date: string | null
          notes: string | null
          purchase_item_id: string | null
          qty_received: number
          qty_remaining: number
          received_at: string
          supplier_id: string | null
          supplier_warranty_days: number | null
          updated_at: string
          variant_id: string
          warranty_expires_at: string | null
        }
        Insert: {
          batch_no: string
          cost_per_unit: number
          created_at?: string
          expiry_date?: string | null
          id?: string
          is_active?: boolean
          manufactured_date?: string | null
          notes?: string | null
          purchase_item_id?: string | null
          qty_received: number
          qty_remaining: number
          received_at?: string
          supplier_id?: string | null
          supplier_warranty_days?: number | null
          updated_at?: string
          variant_id: string
          warranty_expires_at?: string | null
        }
        Update: {
          batch_no?: string
          cost_per_unit?: number
          created_at?: string
          expiry_date?: string | null
          id?: string
          is_active?: boolean
          manufactured_date?: string | null
          notes?: string | null
          purchase_item_id?: string | null
          qty_received?: number
          qty_remaining?: number
          received_at?: string
          supplier_id?: string | null
          supplier_warranty_days?: number | null
          updated_at?: string
          variant_id?: string
          warranty_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'inventory_batches_purchase_item_id_fkey'
            columns: ['purchase_item_id']
            isOneToOne: false
            referencedRelation: 'purchase_item_financials'
            referencedColumns: ['purchase_item_id']
          },
          {
            foreignKeyName: 'inventory_batches_purchase_item_id_fkey'
            columns: ['purchase_item_id']
            isOneToOne: false
            referencedRelation: 'purchase_items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'inventory_batches_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'inventory_batches_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'batches_expiring_soon'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'inventory_batches_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'batches_warranty_expiring_soon'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'inventory_batches_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_stock_display'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'inventory_batches_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variant_full'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'inventory_batches_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'inventory_batches_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_with_default_variant'
            referencedColumns: ['variant_id']
          }
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          cashier_id: string
          created_at: string
          customer_id: string | null
          id: string
          notes: string | null
          outstanding: number | null
          payment_type: string
          sale_discount_amount: number
          sale_discount_percent_snapshot: number | null
          sale_discount_type: string | null
          sale_discount_value: number | null
          service_charge: number
          shop_id: string
          tier_id: string | null
          total: number
        }
        Insert: {
          amount_paid?: number
          cashier_id: string
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          outstanding?: number | null
          payment_type: string
          sale_discount_amount?: number
          sale_discount_percent_snapshot?: number | null
          sale_discount_type?: string | null
          sale_discount_value?: number | null
          service_charge?: number
          shop_id: string
          tier_id?: string | null
          total: number
        }
        Update: {
          amount_paid?: number
          cashier_id?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          outstanding?: number | null
          payment_type?: string
          sale_discount_amount?: number
          sale_discount_percent_snapshot?: number | null
          sale_discount_type?: string | null
          sale_discount_value?: number | null
          service_charge?: number
          shop_id?: string
          tier_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: 'invoices_cashier_id_fkey'
            columns: ['cashier_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customer_balance_reconciliation'
            referencedColumns: ['customer_id']
          },
          {
            foreignKeyName: 'invoices_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customer_outstanding'
            referencedColumns: ['customer_id']
          },
          {
            foreignKeyName: 'invoices_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_shop_id_fkey'
            columns: ['shop_id']
            isOneToOne: false
            referencedRelation: 'shops'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_tier_id_fkey'
            columns: ['tier_id']
            isOneToOne: false
            referencedRelation: 'customer_tiers'
            referencedColumns: ['id']
          }
        ]
      }
      ledger_entries: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          id: string
          invoice_id: string | null
          notes: string | null
          occurred_at: string
          paid_at: string | null
          reverses_entry_id: string | null
          shop_id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          occurred_at?: string
          paid_at?: string | null
          reverses_entry_id?: string | null
          shop_id: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          occurred_at?: string
          paid_at?: string | null
          reverses_entry_id?: string | null
          shop_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ledger_entries_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customer_balance_reconciliation'
            referencedColumns: ['customer_id']
          },
          {
            foreignKeyName: 'ledger_entries_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customer_outstanding'
            referencedColumns: ['customer_id']
          },
          {
            foreignKeyName: 'ledger_entries_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ledger_entries_invoice_id_fkey'
            columns: ['invoice_id']
            isOneToOne: false
            referencedRelation: 'invoice_financials'
            referencedColumns: ['invoice_id']
          },
          {
            foreignKeyName: 'ledger_entries_invoice_id_fkey'
            columns: ['invoice_id']
            isOneToOne: false
            referencedRelation: 'invoice_with_discount_detail'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ledger_entries_invoice_id_fkey'
            columns: ['invoice_id']
            isOneToOne: false
            referencedRelation: 'invoices'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ledger_entries_reverses_entry_id_fkey'
            columns: ['reverses_entry_id']
            isOneToOne: false
            referencedRelation: 'ledger_entries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ledger_entries_reverses_entry_id_fkey'
            columns: ['reverses_entry_id']
            isOneToOne: false
            referencedRelation: 'ledger_entries_view'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ledger_entries_shop_id_fkey'
            columns: ['shop_id']
            isOneToOne: false
            referencedRelation: 'shops'
            referencedColumns: ['id']
          }
        ]
      }
      monthly_targets: {
        Row: {
          created_at: string
          id: string
          month: string
          shop_id: string
          target_gross_profit: number
          target_net_profit: number
          target_sale: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          month: string
          shop_id: string
          target_gross_profit?: number
          target_net_profit?: number
          target_sale?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          month?: string
          shop_id?: string
          target_gross_profit?: number
          target_net_profit?: number
          target_sale?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'monthly_targets_shop_id_fkey'
            columns: ['shop_id']
            isOneToOne: false
            referencedRelation: 'shops'
            referencedColumns: ['id']
          }
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          shop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          shop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'product_categories_shop_id_fkey'
            columns: ['shop_id']
            isOneToOne: false
            referencedRelation: 'shops'
            referencedColumns: ['id']
          }
        ]
      }
      product_packs: {
        Row: {
          base_qty: number
          created_at: string
          id: string
          is_active: boolean
          is_default_purchase: boolean
          product_id: string
          unit_id: string
          updated_at: string
          variant_id: string
        }
        Insert: {
          base_qty: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_default_purchase?: boolean
          product_id: string
          unit_id: string
          updated_at?: string
          variant_id: string
        }
        Update: {
          base_qty?: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_default_purchase?: boolean
          product_id?: string
          unit_id?: string
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'product_packs_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'batches_expiring_soon'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'product_packs_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'batches_warranty_expiring_soon'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'product_packs_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'product_stock_display'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'product_packs_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'product_variant_full'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'product_packs_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'product_with_default_variant'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'product_packs_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_packs_unit_id_fkey'
            columns: ['unit_id']
            isOneToOne: false
            referencedRelation: 'units_of_measure'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_packs_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'batches_expiring_soon'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'product_packs_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'batches_warranty_expiring_soon'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'product_packs_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_stock_display'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'product_packs_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variant_full'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'product_packs_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_packs_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_with_default_variant'
            referencedColumns: ['variant_id']
          }
        ]
      }
      product_variant_attribute_values: {
        Row: {
          attribute_value_id: string
          variant_id: string
        }
        Insert: {
          attribute_value_id: string
          variant_id: string
        }
        Update: {
          attribute_value_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'product_variant_attribute_values_attribute_value_id_fkey'
            columns: ['attribute_value_id']
            isOneToOne: false
            referencedRelation: 'variant_attribute_values'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_variant_attribute_values_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'batches_expiring_soon'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'product_variant_attribute_values_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'batches_warranty_expiring_soon'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'product_variant_attribute_values_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_stock_display'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'product_variant_attribute_values_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variant_full'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'product_variant_attribute_values_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_variant_attribute_values_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_with_default_variant'
            referencedColumns: ['variant_id']
          }
        ]
      }
      product_variants: {
        Row: {
          avg_cost: number
          cost: number | null
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          last_purchase_cost: number | null
          price: number | null
          product_id: string
          sku: string | null
          stock: number
          updated_at: string
        }
        Insert: {
          avg_cost?: number
          cost?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          last_purchase_cost?: number | null
          price?: number | null
          product_id: string
          sku?: string | null
          stock?: number
          updated_at?: string
        }
        Update: {
          avg_cost?: number
          cost?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          last_purchase_cost?: number | null
          price?: number | null
          product_id?: string
          sku?: string | null
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'product_variants_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'batches_expiring_soon'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'product_variants_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'batches_warranty_expiring_soon'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'product_variants_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'product_stock_display'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'product_variants_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'product_variant_full'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'product_variants_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'product_with_default_variant'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'product_variants_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          }
        ]
      }
      products: {
        Row: {
          avg_cost: number
          base_unit_id: string
          category_id: string
          cost: number
          created_at: string
          description: string | null
          expiry_alert_days: number | null
          has_batches: boolean
          has_variants: boolean
          id: string
          is_active: boolean
          is_scan_only: boolean
          last_purchase_cost: number | null
          name: string
          price: number | null
          shop_id: string
          stock: number
          type: string
          updated_at: string
          warranty_alert_days: number | null
        }
        Insert: {
          avg_cost?: number
          base_unit_id: string
          category_id: string
          cost: number
          created_at?: string
          description?: string | null
          expiry_alert_days?: number | null
          has_batches?: boolean
          has_variants?: boolean
          id?: string
          is_active?: boolean
          is_scan_only?: boolean
          last_purchase_cost?: number | null
          name: string
          price?: number | null
          shop_id: string
          stock?: number
          type: string
          updated_at?: string
          warranty_alert_days?: number | null
        }
        Update: {
          avg_cost?: number
          base_unit_id?: string
          category_id?: string
          cost?: number
          created_at?: string
          description?: string | null
          expiry_alert_days?: number | null
          has_batches?: boolean
          has_variants?: boolean
          id?: string
          is_active?: boolean
          is_scan_only?: boolean
          last_purchase_cost?: number | null
          name?: string
          price?: number | null
          shop_id?: string
          stock?: number
          type?: string
          updated_at?: string
          warranty_alert_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'products_base_unit_id_fkey'
            columns: ['base_unit_id']
            isOneToOne: false
            referencedRelation: 'units_of_measure'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'product_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_shop_id_fkey'
            columns: ['shop_id']
            isOneToOne: false
            referencedRelation: 'shops'
            referencedColumns: ['id']
          }
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          onboarding_completed: boolean
          preferred_language: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          onboarding_completed?: boolean
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          onboarding_completed?: boolean
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          avg_cost_after: number | null
          avg_cost_before: number | null
          batch_id: string | null
          cost_at_purchase: number
          id: string
          line_overhead_amount: number
          overhead_per_unit: number
          pack_base_qty_snapshot: number | null
          pack_id: string | null
          pack_qty: number | null
          product_id: string
          purchase_id: string
          qty: number
          qty_in_base: number
          variant_id: string
        }
        Insert: {
          avg_cost_after?: number | null
          avg_cost_before?: number | null
          batch_id?: string | null
          cost_at_purchase: number
          id?: string
          line_overhead_amount?: number
          overhead_per_unit?: number
          pack_base_qty_snapshot?: number | null
          pack_id?: string | null
          pack_qty?: number | null
          product_id: string
          purchase_id: string
          qty: number
          qty_in_base: number
          variant_id: string
        }
        Update: {
          avg_cost_after?: number | null
          avg_cost_before?: number | null
          batch_id?: string | null
          cost_at_purchase?: number
          id?: string
          line_overhead_amount?: number
          overhead_per_unit?: number
          pack_base_qty_snapshot?: number | null
          pack_id?: string | null
          pack_qty?: number | null
          product_id?: string
          purchase_id?: string
          qty?: number
          qty_in_base?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'purchase_items_batch_id_fkey'
            columns: ['batch_id']
            isOneToOne: false
            referencedRelation: 'batches_expiring_soon'
            referencedColumns: ['batch_id']
          },
          {
            foreignKeyName: 'purchase_items_batch_id_fkey'
            columns: ['batch_id']
            isOneToOne: false
            referencedRelation: 'batches_warranty_expiring_soon'
            referencedColumns: ['batch_id']
          },
          {
            foreignKeyName: 'purchase_items_batch_id_fkey'
            columns: ['batch_id']
            isOneToOne: false
            referencedRelation: 'inventory_batches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchase_items_pack_id_fkey'
            columns: ['pack_id']
            isOneToOne: false
            referencedRelation: 'product_packs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchase_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'batches_expiring_soon'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'purchase_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'batches_warranty_expiring_soon'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'purchase_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'product_stock_display'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'purchase_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'product_variant_full'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'purchase_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'product_with_default_variant'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'purchase_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchase_items_purchase_id_fkey'
            columns: ['purchase_id']
            isOneToOne: false
            referencedRelation: 'purchases'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchase_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'batches_expiring_soon'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'purchase_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'batches_warranty_expiring_soon'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'purchase_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_stock_display'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'purchase_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variant_full'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'purchase_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchase_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_with_default_variant'
            referencedColumns: ['variant_id']
          }
        ]
      }
      purchase_overhead_items: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          id: string
          purchase_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          id?: string
          purchase_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          purchase_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'purchase_overhead_items_purchase_id_fkey'
            columns: ['purchase_id']
            isOneToOne: false
            referencedRelation: 'purchases'
            referencedColumns: ['id']
          }
        ]
      }
      purchases: {
        Row: {
          cashier_id: string
          created_at: string
          id: string
          is_opening: boolean
          items_subtotal: number
          note: string | null
          overhead_subtotal: number
          purchase_date: string
          shop_id: string
          source: string | null
          supplier_id: string | null
          total_cost: number
        }
        Insert: {
          cashier_id: string
          created_at?: string
          id?: string
          is_opening?: boolean
          items_subtotal?: number
          note?: string | null
          overhead_subtotal?: number
          purchase_date?: string
          shop_id: string
          source?: string | null
          supplier_id?: string | null
          total_cost: number
        }
        Update: {
          cashier_id?: string
          created_at?: string
          id?: string
          is_opening?: boolean
          items_subtotal?: number
          note?: string | null
          overhead_subtotal?: number
          purchase_date?: string
          shop_id?: string
          source?: string | null
          supplier_id?: string | null
          total_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: 'purchases_cashier_id_fkey'
            columns: ['cashier_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchases_shop_id_fkey'
            columns: ['shop_id']
            isOneToOne: false
            referencedRelation: 'shops'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchases_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          }
        ]
      }
      sale_items: {
        Row: {
          batch_id: string | null
          cost_at_sale: number
          id: string
          invoice_id: string
          line_discount_amount: number
          line_discount_type: string | null
          line_discount_value: number | null
          price_at_sale: number
          product_id: string
          qty: number
          variant_id: string
        }
        Insert: {
          batch_id?: string | null
          cost_at_sale: number
          id?: string
          invoice_id: string
          line_discount_amount?: number
          line_discount_type?: string | null
          line_discount_value?: number | null
          price_at_sale: number
          product_id: string
          qty: number
          variant_id: string
        }
        Update: {
          batch_id?: string | null
          cost_at_sale?: number
          id?: string
          invoice_id?: string
          line_discount_amount?: number
          line_discount_type?: string | null
          line_discount_value?: number | null
          price_at_sale?: number
          product_id?: string
          qty?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sale_items_batch_id_fkey'
            columns: ['batch_id']
            isOneToOne: false
            referencedRelation: 'batches_expiring_soon'
            referencedColumns: ['batch_id']
          },
          {
            foreignKeyName: 'sale_items_batch_id_fkey'
            columns: ['batch_id']
            isOneToOne: false
            referencedRelation: 'batches_warranty_expiring_soon'
            referencedColumns: ['batch_id']
          },
          {
            foreignKeyName: 'sale_items_batch_id_fkey'
            columns: ['batch_id']
            isOneToOne: false
            referencedRelation: 'inventory_batches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sale_items_invoice_id_fkey'
            columns: ['invoice_id']
            isOneToOne: false
            referencedRelation: 'invoice_financials'
            referencedColumns: ['invoice_id']
          },
          {
            foreignKeyName: 'sale_items_invoice_id_fkey'
            columns: ['invoice_id']
            isOneToOne: false
            referencedRelation: 'invoice_with_discount_detail'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sale_items_invoice_id_fkey'
            columns: ['invoice_id']
            isOneToOne: false
            referencedRelation: 'invoices'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sale_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'batches_expiring_soon'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'sale_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'batches_warranty_expiring_soon'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'sale_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'product_stock_display'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'sale_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'product_variant_full'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'sale_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'product_with_default_variant'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'sale_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sale_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'batches_expiring_soon'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'sale_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'batches_warranty_expiring_soon'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'sale_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_stock_display'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'sale_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variant_full'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'sale_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sale_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_with_default_variant'
            referencedColumns: ['variant_id']
          }
        ]
      }
      shop_owner_details: {
        Row: {
          created_at: string
          id: string
          owner_address: string
          owner_cnic: string | null
          owner_name: string
          owner_phone: string
          shop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_address: string
          owner_cnic?: string | null
          owner_name: string
          owner_phone: string
          shop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_address?: string
          owner_cnic?: string | null
          owner_name?: string
          owner_phone?: string
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'shop_owner_details_shop_id_fkey'
            columns: ['shop_id']
            isOneToOne: true
            referencedRelation: 'shops'
            referencedColumns: ['id']
          }
        ]
      }
      shops: {
        Row: {
          created_at: string
          default_expiry_alert_days: number
          default_warranty_alert_days: number
          id: string
          owner_user_id: string
          shop_address: string
          shop_name: string
          shop_phone: string
          shop_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_expiry_alert_days?: number
          default_warranty_alert_days?: number
          id?: string
          owner_user_id: string
          shop_address: string
          shop_name: string
          shop_phone: string
          shop_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_expiry_alert_days?: number
          default_warranty_alert_days?: number
          id?: string
          owner_user_id?: string
          shop_address?: string
          shop_name?: string
          shop_phone?: string
          shop_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'shops_owner_user_id_fkey'
            columns: ['owner_user_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_ends_at: string | null
          current_period_starts_at: string | null
          id: string
          last_payment_amount: number | null
          last_payment_date: string | null
          notes: string | null
          status: Database['public']['Enums']['subscription_status']
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_ends_at?: string | null
          current_period_starts_at?: string | null
          id?: string
          last_payment_amount?: number | null
          last_payment_date?: string | null
          notes?: string | null
          status?: Database['public']['Enums']['subscription_status']
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_ends_at?: string | null
          current_period_starts_at?: string | null
          id?: string
          last_payment_amount?: number | null
          last_payment_date?: string | null
          notes?: string | null
          status?: Database['public']['Enums']['subscription_status']
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'subscriptions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          shop_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          shop_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'suppliers_shop_id_fkey'
            columns: ['shop_id']
            isOneToOne: false
            referencedRelation: 'shops'
            referencedColumns: ['id']
          }
        ]
      }
      units_of_measure: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          shop_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          shop_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'units_of_measure_shop_id_fkey'
            columns: ['shop_id']
            isOneToOne: false
            referencedRelation: 'shops'
            referencedColumns: ['id']
          }
        ]
      }
      variant_attribute_values: {
        Row: {
          attribute_id: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          updated_at: string
          value: string
        }
        Insert: {
          attribute_id: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          updated_at?: string
          value: string
        }
        Update: {
          attribute_id?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: 'variant_attribute_values_attribute_id_fkey'
            columns: ['attribute_id']
            isOneToOne: false
            referencedRelation: 'variant_attributes'
            referencedColumns: ['id']
          }
        ]
      }
      variant_attributes: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          shop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          shop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'variant_attributes_shop_id_fkey'
            columns: ['shop_id']
            isOneToOne: false
            referencedRelation: 'shops'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      batches_expiring_soon: {
        Row: {
          alert_window_days: number | null
          batch_id: string | null
          batch_no: string | null
          days_until_expiry: number | null
          expiry_date: string | null
          product_id: string | null
          product_name: string | null
          qty_remaining: number | null
          shop_id: string | null
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'products_shop_id_fkey'
            columns: ['shop_id']
            isOneToOne: false
            referencedRelation: 'shops'
            referencedColumns: ['id']
          }
        ]
      }
      batches_warranty_expiring_soon: {
        Row: {
          alert_window_days: number | null
          batch_id: string | null
          batch_no: string | null
          days_until_warranty_expires: number | null
          product_id: string | null
          product_name: string | null
          qty_remaining: number | null
          shop_id: string | null
          supplier_id: string | null
          supplier_name: string | null
          variant_id: string | null
          warranty_expires_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'inventory_batches_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_shop_id_fkey'
            columns: ['shop_id']
            isOneToOne: false
            referencedRelation: 'shops'
            referencedColumns: ['id']
          }
        ]
      }
      customer_balance_reconciliation: {
        Row: {
          computed_balance: number | null
          customer_id: string | null
          drift: number | null
          shop_id: string | null
          stored_balance: number | null
        }
        Insert: {
          computed_balance?: never
          customer_id?: string | null
          drift?: never
          shop_id?: string | null
          stored_balance?: number | null
        }
        Update: {
          computed_balance?: never
          customer_id?: string | null
          drift?: never
          shop_id?: string | null
          stored_balance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'customers_shop_id_fkey'
            columns: ['shop_id']
            isOneToOne: false
            referencedRelation: 'shops'
            referencedColumns: ['id']
          }
        ]
      }
      customer_outstanding: {
        Row: {
          customer_id: string | null
          last_activity_at: string | null
          name: string | null
          outstanding: number | null
          phone: string | null
          shop_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'customers_shop_id_fkey'
            columns: ['shop_id']
            isOneToOne: false
            referencedRelation: 'shops'
            referencedColumns: ['id']
          }
        ]
      }
      daily_sales_7: {
        Row: {
          day: string | null
          total_sales: number | null
        }
        Relationships: []
      }
      daily_sales_today: {
        Row: {
          cash_sales: number | null
          credit_sales: number | null
          sales_count: number | null
          shop_id: string | null
          total_sales: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'invoices_shop_id_fkey'
            columns: ['shop_id']
            isOneToOne: false
            referencedRelation: 'shops'
            referencedColumns: ['id']
          }
        ]
      }
      expenses_by_category_mtd: {
        Row: {
          category: string | null
          expense_count: number | null
          total_amount: number | null
        }
        Relationships: []
      }
      invoice_financials: {
        Row: {
          amount_paid: number | null
          created_at: string | null
          customer_id: string | null
          gross_margin_percent: number | null
          gross_profit: number | null
          invoice_id: string | null
          items_subtotal: number | null
          outstanding: number | null
          payment_type: string | null
          post_discount_items: number | null
          revenue: number | null
          sale_discount_amount: number | null
          service_charge: number | null
          shop_id: string | null
          stored_total: number | null
          total_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'invoices_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customer_balance_reconciliation'
            referencedColumns: ['customer_id']
          },
          {
            foreignKeyName: 'invoices_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customer_outstanding'
            referencedColumns: ['customer_id']
          },
          {
            foreignKeyName: 'invoices_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_shop_id_fkey'
            columns: ['shop_id']
            isOneToOne: false
            referencedRelation: 'shops'
            referencedColumns: ['id']
          }
        ]
      }
      invoice_with_discount_detail: {
        Row: {
          amount_paid: number | null
          cashier_id: string | null
          created_at: string | null
          customer_id: string | null
          discount_source: string | null
          id: string | null
          items_subtotal_post_line_discounts: number | null
          notes: string | null
          payment_type: string | null
          sale_discount_amount: number | null
          sale_discount_percent_snapshot: number | null
          sale_discount_type: string | null
          sale_discount_value: number | null
          service_charge: number | null
          shop_id: string | null
          tier_id: string | null
          tier_name: string | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'invoices_cashier_id_fkey'
            columns: ['cashier_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customer_balance_reconciliation'
            referencedColumns: ['customer_id']
          },
          {
            foreignKeyName: 'invoices_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customer_outstanding'
            referencedColumns: ['customer_id']
          },
          {
            foreignKeyName: 'invoices_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_shop_id_fkey'
            columns: ['shop_id']
            isOneToOne: false
            referencedRelation: 'shops'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_tier_id_fkey'
            columns: ['tier_id']
            isOneToOne: false
            referencedRelation: 'customer_tiers'
            referencedColumns: ['id']
          }
        ]
      }
      ledger_entries_view: {
        Row: {
          amount: number | null
          created_at: string | null
          customer_id: string | null
          id: string | null
          invoice_amount_paid: number | null
          invoice_id: string | null
          invoice_notes: string | null
          invoice_payment_type: string | null
          invoice_total: number | null
          items_count: number | null
          notes: string | null
          occurred_at: string | null
          products_summary: string | null
          reversed_at: string | null
          reversed_by_entry_id: string | null
          reverses_entry_id: string | null
          shop_id: string | null
          type: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'ledger_entries_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customer_balance_reconciliation'
            referencedColumns: ['customer_id']
          },
          {
            foreignKeyName: 'ledger_entries_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customer_outstanding'
            referencedColumns: ['customer_id']
          },
          {
            foreignKeyName: 'ledger_entries_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ledger_entries_invoice_id_fkey'
            columns: ['invoice_id']
            isOneToOne: false
            referencedRelation: 'invoice_financials'
            referencedColumns: ['invoice_id']
          },
          {
            foreignKeyName: 'ledger_entries_invoice_id_fkey'
            columns: ['invoice_id']
            isOneToOne: false
            referencedRelation: 'invoice_with_discount_detail'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ledger_entries_invoice_id_fkey'
            columns: ['invoice_id']
            isOneToOne: false
            referencedRelation: 'invoices'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ledger_entries_reverses_entry_id_fkey'
            columns: ['reverses_entry_id']
            isOneToOne: false
            referencedRelation: 'ledger_entries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ledger_entries_reverses_entry_id_fkey'
            columns: ['reverses_entry_id']
            isOneToOne: false
            referencedRelation: 'ledger_entries_view'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ledger_entries_shop_id_fkey'
            columns: ['shop_id']
            isOneToOne: false
            referencedRelation: 'shops'
            referencedColumns: ['id']
          }
        ]
      }
      monthly_summary: {
        Row: {
          gross_profit: number | null
          month: string | null
          shop_id: string | null
          total_expenses: number | null
          total_sales: number | null
        }
        Relationships: []
      }
      product_stock_display: {
        Row: {
          base_qty: number | null
          base_unit_code: string | null
          base_unit_name: string | null
          is_scan_only: boolean | null
          pack_breakdown: Json | null
          product_id: string | null
          shop_id: string | null
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'products_shop_id_fkey'
            columns: ['shop_id']
            isOneToOne: false
            referencedRelation: 'shops'
            referencedColumns: ['id']
          }
        ]
      }
      product_variant_full: {
        Row: {
          attributes: Json | null
          avg_cost: number | null
          category_id: string | null
          cost: number | null
          has_variants: boolean | null
          is_default: boolean | null
          last_purchase_cost: number | null
          price: number | null
          product_id: string | null
          product_name: string | null
          shop_id: string | null
          sku: string | null
          stock: number | null
          variant_id: string | null
          variant_is_active: boolean | null
          variant_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'product_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_shop_id_fkey'
            columns: ['shop_id']
            isOneToOne: false
            referencedRelation: 'shops'
            referencedColumns: ['id']
          }
        ]
      }
      product_with_default_variant: {
        Row: {
          avg_cost: number | null
          base_unit_id: string | null
          category_id: string | null
          cost: number | null
          description: string | null
          has_variants: boolean | null
          is_scan_only: boolean | null
          last_purchase_cost: number | null
          legacy_type_column: string | null
          max_price: number | null
          min_price: number | null
          name: string | null
          price: number | null
          product_created_at: string | null
          product_id: string | null
          product_is_active: boolean | null
          product_updated_at: string | null
          shop_id: string | null
          sku: string | null
          stock: number | null
          total_stock_all_variants: number | null
          variant_count: number | null
          variant_id: string | null
          variant_is_active: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: 'products_base_unit_id_fkey'
            columns: ['base_unit_id']
            isOneToOne: false
            referencedRelation: 'units_of_measure'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'product_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_shop_id_fkey'
            columns: ['shop_id']
            isOneToOne: false
            referencedRelation: 'shops'
            referencedColumns: ['id']
          }
        ]
      }
      purchase_item_financials: {
        Row: {
          avg_cost_after: number | null
          avg_cost_before: number | null
          cost_at_purchase: number | null
          cost_delta: number | null
          line_overhead: number | null
          line_overhead_amount: number | null
          line_subtotal: number | null
          line_total: number | null
          overhead_per_unit: number | null
          pack_base_qty_snapshot: number | null
          pack_id: string | null
          pack_qty: number | null
          product_id: string | null
          purchase_id: string | null
          purchase_item_id: string | null
          qty: number | null
          qty_in_base: number | null
          variant_id: string | null
        }
        Insert: {
          avg_cost_after?: number | null
          avg_cost_before?: number | null
          cost_at_purchase?: number | null
          cost_delta?: never
          line_overhead?: never
          line_overhead_amount?: number | null
          line_subtotal?: never
          line_total?: never
          overhead_per_unit?: number | null
          pack_base_qty_snapshot?: number | null
          pack_id?: string | null
          pack_qty?: number | null
          product_id?: string | null
          purchase_id?: string | null
          purchase_item_id?: string | null
          qty?: number | null
          qty_in_base?: number | null
          variant_id?: string | null
        }
        Update: {
          avg_cost_after?: number | null
          avg_cost_before?: number | null
          cost_at_purchase?: number | null
          cost_delta?: never
          line_overhead?: never
          line_overhead_amount?: number | null
          line_subtotal?: never
          line_total?: never
          overhead_per_unit?: number | null
          pack_base_qty_snapshot?: number | null
          pack_id?: string | null
          pack_qty?: number | null
          product_id?: string | null
          purchase_id?: string | null
          purchase_item_id?: string | null
          qty?: number | null
          qty_in_base?: number | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'purchase_items_pack_id_fkey'
            columns: ['pack_id']
            isOneToOne: false
            referencedRelation: 'product_packs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchase_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'batches_expiring_soon'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'purchase_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'batches_warranty_expiring_soon'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'purchase_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'product_stock_display'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'purchase_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'product_variant_full'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'purchase_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'product_with_default_variant'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'purchase_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchase_items_purchase_id_fkey'
            columns: ['purchase_id']
            isOneToOne: false
            referencedRelation: 'purchases'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchase_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'batches_expiring_soon'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'purchase_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'batches_warranty_expiring_soon'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'purchase_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_stock_display'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'purchase_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variant_full'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'purchase_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchase_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_with_default_variant'
            referencedColumns: ['variant_id']
          }
        ]
      }
      sale_item_financials: {
        Row: {
          allocated_sale_discount: number | null
          cost_at_sale: number | null
          invoice_id: string | null
          line_cost: number | null
          line_discount_amount: number | null
          line_profit: number | null
          line_revenue: number | null
          line_value: number | null
          price_at_sale: number | null
          product_id: string | null
          qty: number | null
          sale_item_id: string | null
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'sale_items_invoice_id_fkey'
            columns: ['invoice_id']
            isOneToOne: false
            referencedRelation: 'invoice_financials'
            referencedColumns: ['invoice_id']
          },
          {
            foreignKeyName: 'sale_items_invoice_id_fkey'
            columns: ['invoice_id']
            isOneToOne: false
            referencedRelation: 'invoice_with_discount_detail'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sale_items_invoice_id_fkey'
            columns: ['invoice_id']
            isOneToOne: false
            referencedRelation: 'invoices'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sale_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'batches_expiring_soon'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'sale_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'batches_warranty_expiring_soon'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'sale_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'product_stock_display'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'sale_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'product_variant_full'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'sale_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'product_with_default_variant'
            referencedColumns: ['product_id']
          },
          {
            foreignKeyName: 'sale_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sale_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'batches_expiring_soon'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'sale_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'batches_warranty_expiring_soon'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'sale_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_stock_display'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'sale_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variant_full'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'sale_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sale_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_with_default_variant'
            referencedColumns: ['variant_id']
          }
        ]
      }
      subscription_effective: {
        Row: {
          current_period_ends_at: string | null
          effective_status:
            | Database['public']['Enums']['subscription_status']
            | null
          last_payment_date: string | null
          status: Database['public']['Enums']['subscription_status'] | null
          trial_ends_at: string | null
          user_id: string | null
        }
        Insert: {
          current_period_ends_at?: string | null
          effective_status?: never
          last_payment_date?: string | null
          status?: Database['public']['Enums']['subscription_status'] | null
          trial_ends_at?: string | null
          user_id?: string | null
        }
        Update: {
          current_period_ends_at?: string | null
          effective_status?: never
          last_payment_date?: string | null
          status?: Database['public']['Enums']['subscription_status'] | null
          trial_ends_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'subscriptions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      total_outstanding: {
        Row: {
          customer_count: number | null
          total: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_variant_to_product: {
        Args: {
          p_attribute_value_ids: string[]
          p_opening_cost?: number
          p_opening_stock?: number
          p_price?: number
          p_product_id: string
          p_sku?: string
        }
        Returns: string
      }
      add_variant_value: {
        Args: {
          p_attribute_id: string
          p_display_order?: number
          p_value: string
        }
        Returns: string
      }
      complete_onboarding: {
        Args: {
          p_owner_address: string
          p_owner_cnic: string
          p_owner_name: string
          p_owner_phone: string
          p_shop_address: string
          p_shop_name: string
          p_shop_phone: string
          p_shop_type: string
        }
        Returns: string
      }
      create_category_inline: { Args: { p_name: string }; Returns: string }
      create_product_with_opening_stock: {
        Args: {
          p_base_unit_code?: string
          p_category_id: string
          p_description?: string
          p_is_scan_only?: boolean
          p_name: string
          p_opening_cost?: number
          p_opening_stock?: number
          p_price: number
        }
        Returns: {
          product_id: string
          variant_id: string
        }[]
      }
      create_product_with_variants: {
        Args: {
          p_attribute_ids?: string[]
          p_base_unit_code?: string
          p_category_id: string
          p_default_price: number
          p_description?: string
          p_is_scan_only?: boolean
          p_name: string
          p_variants?: Json
        }
        Returns: {
          product_id: string
          variant_ids: string[]
        }[]
      }
      create_supplier_inline: {
        Args: {
          p_address?: string
          p_contact?: string
          p_name: string
          p_notes?: string
        }
        Returns: string
      }
      create_variant_attribute: {
        Args: { p_display_order?: number; p_name: string }
        Returns: string
      }
      current_shop_id: { Args: never; Returns: string }
      deactivate_batch: {
        Args: { p_batch_id: string; p_reason?: string }
        Returns: undefined
      }
      deactivate_pack: { Args: { p_pack_id: string }; Returns: undefined }
      deactivate_tier: { Args: { p_tier_id: string }; Returns: number }
      deactivate_variant_attribute: {
        Args: { p_id: string }
        Returns: undefined
      }
      deactivate_variant_value: { Args: { p_id: string }; Returns: undefined }
      define_pack_inline: {
        Args: {
          p_base_qty: number
          p_is_default_purchase?: boolean
          p_product_id: string
          p_unit_code: string
          p_unit_name: string
        }
        Returns: string
      }
      define_tier: {
        Args: { p_is_default?: boolean; p_name: string; p_notes?: string }
        Returns: string
      }
      expire_subscriptions: { Args: never; Returns: undefined }
      list_attribute_values: {
        Args: { p_attribute_id: string }
        Returns: {
          display_order: number
          id: string
          value: string
        }[]
      }
      list_customers: {
        Args: { p_limit?: number; p_offset?: number; p_query?: string }
        Returns: {
          address: string
          id: string
          invoice_count: number
          last_activity_at: string
          name: string
          outstanding: number
          phone: string
          total_count: number
        }[]
      }
      normalize_product_text: { Args: { s: string }; Returns: string }
      receive_payment: {
        Args: { p_amount: number; p_customer_id: string; p_notes?: string }
        Returns: string
      }
      recent_customers: {
        Args: { p_limit?: number }
        Returns: {
          address: string
          id: string
          last_activity_at: string
          name: string
          phone: string
        }[]
      }
      recent_purchase_products: {
        Args: { p_limit?: number }
        Returns: {
          avg_cost: number
          id: string
          last_used_at: string
          name: string
          price: number
          stock: number
          type: string
        }[]
      }
      recent_suppliers: {
        Args: { p_limit?: number }
        Returns: {
          contact: string
          id: string
          last_used_at: string
          name: string
        }[]
      }
      record_purchase: {
        Args: {
          p_is_opening?: boolean
          p_items?: Json
          p_note?: string
          p_overhead_items?: Json
          p_purchase_date?: string
          p_supplier_id?: string
        }
        Returns: string
      }
      record_sale: {
        Args: {
          p_amount_paid?: number
          p_customer_id?: string
          p_items?: Json
          p_notes?: string
          p_sale_discount_type?: string
          p_sale_discount_value?: number
          p_service_charge?: number
        }
        Returns: string
      }
      reverse_ledger_entry: {
        Args: { p_entry_id: string; p_notes?: string }
        Returns: string
      }
      search_categories: {
        Args: { p_limit?: number; p_offset?: number; p_query?: string }
        Returns: {
          id: string
          name: string
          product_count: number
        }[]
      }
      search_khata_customers: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_status?: string
        }
        Returns: {
          address: string
          entry_count: number
          id: string
          last_activity_at: string
          name: string
          outstanding_balance: number
          phone: string
        }[]
      }
      search_khata_customers_count: {
        Args: { p_query?: string; p_status?: string }
        Returns: number
      }
      search_products: {
        Args: {
          p_category_id?: string
          p_limit?: number
          p_offset?: number
          p_only_in_stock?: boolean
          p_query?: string
        }
        Returns: {
          avg_cost: number
          category_id: string
          description: string
          has_variants: boolean
          id: string
          is_active: boolean
          last_purchase_cost: number
          max_price: number
          min_price: number
          name: string
          price: number
          relevance: number
          stock: number
          total_stock_all_variants: number
          type: string
          variant_count: number
        }[]
      }
      search_products_count: {
        Args: {
          p_category_id?: string
          p_only_in_stock?: boolean
          p_query?: string
        }
        Returns: number
      }
      search_purchases: {
        Args: {
          p_from?: string
          p_include_opening?: boolean
          p_limit?: number
          p_offset?: number
          p_supplier_id?: string
          p_to?: string
        }
        Returns: {
          id: string
          is_opening: boolean
          items_count: number
          items_subtotal: number
          note: string
          overhead_subtotal: number
          purchase_date: string
          source: string
          supplier_id: string
          supplier_name: string
          total_cost: number
        }[]
      }
      search_purchases_count: {
        Args: {
          p_from?: string
          p_include_opening?: boolean
          p_supplier_id?: string
          p_to?: string
        }
        Returns: number
      }
      search_suppliers: {
        Args: { p_limit?: number; p_offset?: number; p_query?: string }
        Returns: {
          address: string
          contact: string
          id: string
          is_active: boolean
          name: string
          total_count: number
        }[]
      }
      search_variant_attributes: {
        Args: { p_query?: string }
        Returns: {
          display_order: number
          id: string
          name: string
          value_count: number
        }[]
      }
      set_default_tier: { Args: { p_tier_id: string }; Returns: undefined }
      suggest_batch_no: {
        Args: { p_received_at?: string; p_variant_id: string }
        Returns: string
      }
      update_category: {
        Args: { p_id: string; p_is_active?: boolean; p_name?: string }
        Returns: undefined
      }
      update_pack: {
        Args: {
          p_base_qty: number
          p_is_default_purchase: boolean
          p_pack_id: string
        }
        Returns: undefined
      }
      update_tier: {
        Args: {
          p_is_default: boolean
          p_name: string
          p_notes?: string
          p_tier_id: string
        }
        Returns: undefined
      }
      update_variant_attribute: {
        Args: {
          p_display_order?: number
          p_id: string
          p_is_active?: boolean
          p_name?: string
        }
        Returns: undefined
      }
      update_variant_value: {
        Args: {
          p_display_order?: number
          p_id: string
          p_is_active?: boolean
          p_value?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      subscription_status: 'trial' | 'active' | 'expired' | 'suspended'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      subscription_status: ['trial', 'active', 'expired', 'suspended']
    }
  }
} as const
