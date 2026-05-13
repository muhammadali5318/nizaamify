import { useQuery } from '@tanstack/react-query'
import { supabase } from 'src/lib/supabase'
import { useSession } from 'src/features/auth/AuthProvider'
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
  /** v2.10a: cost_at_sale now comes from sale_item_financials (DEFINER +
   *  permission-aware) since the column was revoked at the grant layer
   *  on the raw sale_items table. NULL when the caller lacks
   *  view_sale_cost. */
  cost_at_sale: number | null
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
  /** v2.6b: server-computed line cost (cost_at_sale × qty).
   *  v2.10a: NULL when caller lacks view_sale_cost. */
  line_cost: number | null
  /** v2.6b: server-computed line profit.
   *  v2.10a: NULL when caller lacks view_sale_cost. */
  line_profit: number | null
  product: { id: string; name: string } | null
  /** v2.8: which batch this line drew from. NULL for non-batched products. */
  batch_id: string | null
  batch: { id: string; batch_no: string } | null
  /** v2.8.4: snapshot-true when this line drew from an expired batch.
   *  Immutable per the append-only sale_items_no_modify trigger. */
  sold_expired: boolean
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
  /** v2.6c invoice-level financials, v2.10a-revised: total_cost +
   *  gross_profit are NULL when caller lacks view_sale_cost;
   *  gross_margin_percent is NULL when caller lacks view_profit_margin
   *  or revenue is 0. */
  financials: {
    items_subtotal: number
    post_discount_items: number
    revenue: number
    total_cost: number | null
    gross_profit: number | null
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
  const { user } = useSession()
  return useQuery({
    queryKey: ['sale', id, user?.id],
    enabled: !!id,
    queryFn: async (): Promise<SaleDetail | null> => {
      if (!id) return null
      // v2.9.1 hot-patch — the implicit `cashier:profiles!...` join is gone
      // because v2.9 dropped the team-read policy on profiles (mig 0083).
      // Resolve cashier email separately via get_team_member_profiles
      // (DEFINER, view_team-gated) after the invoice fetch lands, with a
      // self-email fallback for the case where the viewer IS the cashier.
      // v2.10a — `cost_at_sale` was revoked at the column-grant layer
      // (mig 0093). Authenticated callers (even owners) cannot SELECT it
      // from the raw sale_items table. Read it via sale_item_financials
      // below, which is DEFINER + projects cost_at_sale conditionally on
      // view_sale_cost (mig 0092). The nested select here intentionally
      // omits cost_at_sale.
      const { data, error } = await supabase
        .from('invoices')
        .select(
          `
          *,
          customer:customers ( id, name, phone, tier_id ),
          tier:customer_tiers ( name ),
          sale_items (
            id, product_id, qty, price_at_sale,
            line_discount_type, line_discount_value, line_discount_amount,
            batch_id, sold_expired,
            product:products ( id, name ),
            batch:inventory_batches ( id, batch_no )
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
      // v2.10a: cost_at_sale + line_cost + line_profit are NULL'd by the
      // DEFINER view when caller lacks view_sale_cost. total_cost +
      // gross_profit + gross_margin_percent on invoice_financials are
      // also conditionally NULL'd.
      type FinRow = {
        sale_item_id: string
        cost_at_sale: number | string | null
        allocated_sale_discount: number | string
        line_value: number | string
        line_revenue: number | string
        line_cost: number | string | null
        line_profit: number | string | null
      }
      type InvFin = {
        items_subtotal: number | string
        post_discount_items: number | string
        revenue: number | string
        total_cost: number | string | null
        gross_profit: number | string | null
        gross_margin_percent: number | string | null
        outstanding: number | string
      }
      const [finRes, invFinRes] = await Promise.all([
        supabase
          .from('sale_item_financials')
          .select(
            'sale_item_id, cost_at_sale, allocated_sale_discount, line_value, line_revenue, line_cost, line_profit'
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
          cost_at_sale:
            fin?.cost_at_sale == null ? null : Number(fin.cost_at_sale),
          allocated_sale_discount: Number(fin?.allocated_sale_discount ?? 0),
          line_revenue: Number(fin?.line_revenue ?? 0),
          line_cost: fin?.line_cost == null ? null : Number(fin.line_cost),
          line_profit:
            fin?.line_profit == null ? null : Number(fin.line_profit),
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
            total_cost:
              invFin.total_cost == null ? null : Number(invFin.total_cost),
            gross_profit:
              invFin.gross_profit == null ? null : Number(invFin.gross_profit),
            gross_margin_percent:
              invFin.gross_margin_percent == null
                ? null
                : Number(invFin.gross_margin_percent),
            outstanding: Number(invFin.outstanding)
          }
        : null

      // Resolve cashier email via DEFINER helper (with self-fallback)
      const cashierId = (data as { cashier_id: string | null }).cashier_id
      let cashier: SaleDetail['cashier'] = null
      if (cashierId) {
        if (cashierId === user?.id) {
          cashier = { email: user.email ?? '—' }
        } else {
          const { data: profiles } = await supabase.rpc(
            'get_team_member_profiles',
            { p_user_ids: [cashierId] }
          )
          const email = (profiles as Array<{ email: string }> | null)?.[0]
            ?.email
          cashier = email ? { email } : null
        }
      }

      return {
        ...(data as unknown as Invoice),
        customer: (data.customer as SaleDetail['customer']) ?? null,
        cashier,
        tier: (data.tier as SaleDetail['tier']) ?? null,
        items,
        financials,
        ledger
      } as SaleDetail
    }
  })
}

/** v2.8.4: sale_items rows that drew from expired stock, joined to
 *  invoice + product for display. Used by the dashboard widget (top 5)
 *  and the /inventory/expired-sales list page (full table). */
export type ExpiredSaleRow = {
  sale_item_id: string
  invoice_id: string
  invoice_created_at: string
  product_name: string
  qty: number
  /** Days the batch was past expiry at the sale's created_at. NULL when
   *  batch_id is null (shouldn't happen for sold_expired=true but kept
   *  safe). */
  days_expired_at_sale: number | null
}

export function useExpiredSales(limit = 50) {
  return useQuery({
    queryKey: ['sales', 'expired', limit],
    queryFn: async (): Promise<ExpiredSaleRow[]> => {
      // Pull last-30-days of expired-stock sale lines. We over-fetch a bit
      // here to keep the query simple; the widget slices to 5 and the
      // list page paginates client-side.
      const cutoffIso = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString()
      const { data, error } = await supabase
        .from('sale_items')
        .select(
          'id, invoice_id, qty, product:products(name), invoice:invoices!inner(id, created_at), batch:inventory_batches(expiry_date)'
        )
        .eq('sold_expired', true)
        .gte('invoice.created_at', cutoffIso)
        .order('invoice(created_at)', { ascending: false })
        .limit(limit)
      if (error) throw error
      type Row = {
        id: string
        invoice_id: string
        qty: number
        product: { name: string } | null
        invoice: { id: string; created_at: string } | null
        batch: { expiry_date: string | null } | null
      }
      const rows = (data ?? []) as unknown as Row[]
      return rows.map((r) => {
        const invoiceDate = r.invoice?.created_at ?? null
        const expiryDate = r.batch?.expiry_date ?? null
        let daysExpired: number | null = null
        if (invoiceDate && expiryDate) {
          const inv = new Date(invoiceDate).getTime()
          const exp = new Date(expiryDate).getTime()
          daysExpired = Math.max(
            0,
            Math.floor((inv - exp) / (24 * 60 * 60 * 1000))
          )
        }
        return {
          sale_item_id: r.id,
          invoice_id: r.invoice_id,
          invoice_created_at: invoiceDate ?? '',
          product_name: r.product?.name ?? '',
          qty: Number(r.qty),
          days_expired_at_sale: daysExpired
        }
      })
    },
    staleTime: 60_000
  })
}
