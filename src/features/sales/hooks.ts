import { useQuery } from '@tanstack/react-query'
import { supabase } from 'src/lib/supabase'
import type { Database } from 'src/types/database'

export type Invoice = Database['public']['Tables']['invoices']['Row']

export type SaleListRow = Invoice & {
  customer: { id: string; name: string } | null
  sale_items: { id: string }[]
}

export type SaleDetailItem = {
  id: string
  product_id: string
  qty: number
  price_at_sale: number
  cost_at_sale: number
  /** v2.2 per-line discount snapshot. */
  line_discount_type: 'percent' | 'fixed' | null
  line_discount_value: number | null
  line_discount_amount: number
  /** v2.6b: server-computed allocation of invoice.sale_discount_amount across
   * lines (largest-remainder). Single source of truth = sale_item_financials. */
  allocated_sale_discount: number
  /** v2.6b: server-computed line revenue (price*qty − line_disc − allocated). */
  line_revenue: number
  /** v2.6c: server-computed line value (price*qty − line_disc, BEFORE sale disc). */
  line_value: number
  /** v2.6b: server-computed line cost (cost_at_sale × qty). */
  line_cost: number
  /** v2.6b: server-computed line profit. */
  line_profit: number
  product: { id: string; name: string } | null
}

export type SaleDetail = Invoice & {
  customer: {
    id: string
    name: string
    phone: string
    tier_id: string | null
  } | null
  cashier: { email: string } | null
  items: SaleDetailItem[]
  /** v2.3 invoice-level sale-discount snapshot.
   * Renamed from tier_* in v2.3 — tiers no longer auto-discount; the popup
   * is the only source of an invoice-level discount. */
  sale_discount_type: 'percent' | 'fixed' | null
  sale_discount_value: number | null
  sale_discount_amount: number
  /** Customer's tier at the time of the sale (snapshot — purely for display,
   * does NOT drive discount math). Joined via invoices.tier_id. */
  tier: { name: string } | null
  /** v2.6c: server-computed invoice-level financials. items_subtotal is the
   * Σ line_value (post-line-discount, pre-sale-discount); revenue + gross_profit
   * + outstanding all come from invoice_financials. Frontend reads these
   * directly per no-JS-Number-on-money discipline. */
  financials: {
    items_subtotal: number
    post_discount_items: number
    revenue: number
    total_cost: number
    gross_profit: number
    gross_margin_percent: number | null
    outstanding: number
  } | null
  ledger: {
    id: string
    type: 'debit' | 'credit'
    amount: number
    created_at: string
    paid_at: string | null
    customer_id: string
  }[]
}

export type SalesPaymentFilter = 'all' | 'cash' | 'credit' | 'partial'

export type SalesFilters = {
  start: string // ISO date
  end: string // ISO date
  paymentType: SalesPaymentFilter
  customerId: string | null
  page: number
  pageSize: number
}

export function useSales(filters: SalesFilters) {
  const { start, end, paymentType, customerId, page, pageSize } = filters
  return useQuery({
    queryKey: ['sales', filters],
    queryFn: async () => {
      // start/end are date strings; convert to UTC timestamps for created_at
      const startTs = `${start}T00:00:00.000Z`
      const endTs = `${end}T23:59:59.999Z`
      let q = supabase
        .from('invoices')
        .select(
          `
          *,
          customer:customers ( id, name ),
          sale_items ( id )
          `,
          { count: 'exact' }
        )
        .gte('created_at', startTs)
        .lte('created_at', endTs)
        .order('created_at', { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1)
      if (paymentType !== 'all') q = q.eq('payment_type', paymentType)
      if (customerId) q = q.eq('customer_id', customerId)
      const { data, error, count } = await q
      if (error) throw error
      return {
        rows: (data as unknown as SaleListRow[]) ?? [],
        total: count ?? 0
      }
    }
  })
}

export function useSale(id: string | undefined) {
  return useQuery({
    queryKey: ['sale', id],
    enabled: !!id,
    queryFn: async (): Promise<SaleDetail | null> => {
      if (!id) return null
      const { data, error } = await supabase
        .from('invoices')
        .select(
          `
          *,
          customer:customers ( id, name, phone, tier_id ),
          cashier:profiles!invoices_cashier_id_fkey ( email ),
          tier:customer_tiers ( name ),
          sale_items (
            id, product_id, qty, price_at_sale, cost_at_sale,
            line_discount_type, line_discount_value, line_discount_amount,
            product:products ( id, name )
          )
          `
        )
        .eq('id', id)
        .single()
      if (error) throw error

      const hasCredit =
        (data.payment_type === 'credit' || data.payment_type === 'partial') &&
        !!data.customer_id

      let ledger: SaleDetail['ledger'] = []
      if (hasCredit) {
        // 1) the debit row tied to this invoice. Filter to type='debit'
        // because v1.6 also stores invoice_id on invoice-linked credits;
        // .maybeSingle() would otherwise raise on multiple rows.
        const { data: debitRow, error: derr } = await supabase
          .from('ledger_entries')
          .select('id, type, amount, created_at, paid_at, customer_id')
          .eq('invoice_id', data.id)
          .eq('type', 'debit')
          .maybeSingle()
        if (derr) throw derr

        // 2) any later credits on this customer's khata
        let credits: typeof ledger = []
        if (debitRow) {
          const { data: creditRows, error: cerr } = await supabase
            .from('ledger_entries')
            .select('id, type, amount, created_at, paid_at, customer_id')
            .eq('customer_id', data.customer_id as string)
            .eq('type', 'credit')
            .gte('created_at', debitRow.created_at)
            .order('created_at', { ascending: true })
          if (cerr) throw cerr
          credits = (creditRows ?? []).map((r) => ({
            ...r,
            type: r.type as 'debit' | 'credit'
          }))
        }

        ledger = [
          ...(debitRow
            ? [{ ...debitRow, type: debitRow.type as 'debit' | 'credit' }]
            : []),
          ...credits
        ]
      }

      const rawItems = (data.sale_items as unknown as SaleDetailItem[]) ?? []

      // v2.6b + v2.6c: parallel fetch the per-line financials (allocation +
      // profit) and the invoice-level totals. Both come from the single
      // sources of truth (sale_item_financials + invoice_financials).
      // Frontend reads, never computes.
      type FinRow = {
        sale_item_id: string
        allocated_sale_discount: number | string
        line_value: number | string
        line_revenue: number | string
        line_cost: number | string
        line_profit: number | string
      }
      type InvFin = {
        items_subtotal: number | string
        post_discount_items: number | string
        revenue: number | string
        total_cost: number | string
        gross_profit: number | string
        gross_margin_percent: number | string | null
        outstanding: number | string
      }
      const [finRes, invFinRes] = await Promise.all([
        supabase
          .from('sale_item_financials')
          .select(
            'sale_item_id, allocated_sale_discount, line_value, line_revenue, line_cost, line_profit'
          )
          .eq('invoice_id', data.id),
        supabase
          .from('invoice_financials')
          .select(
            'items_subtotal, post_discount_items, revenue, total_cost, gross_profit, gross_margin_percent, outstanding'
          )
          .eq('invoice_id', data.id)
          .maybeSingle()
      ])
      if (finRes.error) throw finRes.error
      if (invFinRes.error) throw invFinRes.error

      const finById = new Map<string, FinRow>()
      for (const r of (finRes.data ?? []) as FinRow[]) {
        finById.set(r.sale_item_id, r)
      }
      const items: SaleDetailItem[] = rawItems.map((it) => {
        const fin = finById.get(it.id)
        return {
          ...it,
          allocated_sale_discount: Number(fin?.allocated_sale_discount ?? 0),
          line_revenue: Number(fin?.line_revenue ?? 0),
          line_cost: Number(fin?.line_cost ?? 0),
          line_profit: Number(fin?.line_profit ?? 0),
          // line_value = price_at_sale × qty − line_discount_amount, server-computed
          line_value: Number(fin?.line_value ?? 0)
        }
      })

      const invFin = invFinRes.data as InvFin | null
      const financials = invFin
        ? {
            items_subtotal: Number(invFin.items_subtotal),
            post_discount_items: Number(invFin.post_discount_items),
            revenue: Number(invFin.revenue),
            total_cost: Number(invFin.total_cost),
            gross_profit: Number(invFin.gross_profit),
            gross_margin_percent:
              invFin.gross_margin_percent === null
                ? null
                : Number(invFin.gross_margin_percent),
            outstanding: Number(invFin.outstanding)
          }
        : null

      return {
        ...(data as unknown as Invoice),
        customer: (data.customer as SaleDetail['customer']) ?? null,
        cashier: (data.cashier as SaleDetail['cashier']) ?? null,
        tier: (data.tier as SaleDetail['tier']) ?? null,
        items,
        financials,
        ledger
      } as SaleDetail
    }
  })
}
