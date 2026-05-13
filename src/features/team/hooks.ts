// v2.9.1 Phase C — Team feature hooks (active-shop + roster + invitations + audit).
//
// Consumed by:
//  - TopBar shop switcher (Phase D.2) → useUserShopList + useSetActiveShop
//  - useShop replacement (Phase D.2) → useActiveShop
//  - /settings/team page (Phase D.3) → useTeam, useUserPermissions, etc.
//
// Phase C scope: mint the hooks; do NOT wire them into existing pages yet.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'src/features/auth/AuthProvider'
import { getActiveShopId, setActiveShopId } from 'src/lib/activeShop'
import { supabase } from 'src/lib/supabase'

// =====================================================================
// Permissions catalog (read-only, RLS-admitted for any authenticated user)
// =====================================================================

export type CatalogRow = {
  key: string
  name: string
  description: string
  category:
    | 'sales'
    | 'products'
    | 'inventory'
    | 'customers'
    | 'suppliers'
    | 'financial'
    | 'settings'
    | 'team'
  preset_owner_default: boolean
  preset_manager_default: boolean
  preset_salesperson_default: boolean
  requires: string[]
  display_order: number
  is_active: boolean
}

/**
 * Reads the 50-row permissions catalog directly. RLS admits any
 * authenticated user (the catalog is system data, not shop data).
 * Cached infrequently — the catalog only changes on Anthropic-shipped
 * migrations. 30-minute staleTime is generous.
 */
export function usePermissionsCatalog() {
  return useQuery({
    queryKey: ['permissions_catalog'],
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permissions_catalog')
        .select('*')
        .eq('is_active', true)
        .order('display_order')
      if (error) throw error
      return (data ?? []) as CatalogRow[]
    }
  })
}

// =====================================================================
// Active shop + shop list
// =====================================================================

/**
 * Returns the user's full shop list (every shop they have access to).
 * Drives the TopBar switcher (visible only if length >= 2).
 *
 * Cached short (60s) since shop access changes rarely.
 */
export function useUserShopList() {
  const { user } = useSession()
  return useQuery({
    queryKey: ['user_shop_list', user?.id],
    enabled: !!user,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_shop_list')
      if (error) throw error
      return (data ?? []) as Array<{
        shop_id: string
        shop_name: string
        is_owner: boolean
        preset_applied: string | null
      }>
    }
  })
}

/**
 * Returns the active shop (id + name + is_owner). Replaces the legacy
 * `useShop()` hook which filtered by `owner_user_id = auth.uid()` and
 * silently broke for non-owner team members.
 *
 * Server resolves the active shop via the `app-shop-id` header (set
 * by customFetch from localStorage); falls back to the user's sole
 * shop if exactly one.
 */
export function useActiveShop() {
  const { user } = useSession()
  return useQuery({
    queryKey: ['active_shop', user?.id, getActiveShopId()],
    enabled: !!user,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_active_shop')
      if (error) throw error
      const row = (
        data as Array<{
          shop_id: string
          shop_name: string
          is_owner: boolean
        }> | null
      )?.[0]
      return row ?? null
    }
  })
}

/**
 * Switches the active shop. Writes the new ID to localStorage (so
 * customFetch picks it up on subsequent requests), calls the
 * `set_active_shop` RPC for server-side validation, and invalidates
 * the entire query cache (every cached read is scoped to the previous
 * active shop and must refetch).
 *
 * Per Phase B.3: redirect to /dashboard handled by the caller —
 * the resource the user was viewing may not exist in the new shop.
 */
export function useSetActiveShop() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (shopId: string) => {
      const { error } = await supabase.rpc('set_active_shop', {
        p_shop_id: shopId
      })
      if (error) throw error
      setActiveShopId(shopId)
    },
    onSuccess: () => {
      // Drop every cached query — they're all scoped to the previous shop
      queryClient.invalidateQueries()
    }
  })
}

// =====================================================================
// Team roster + permissions (Phase D.3 consumers)
// =====================================================================

/**
 * Active team members for the current shop with their resolved
 * permission counts. Gated server-side on `view_team`.
 */
export function useTeam() {
  return useQuery({
    queryKey: ['team', getActiveShopId()],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_team_for_active_shop')
      if (error) throw error
      return (data ?? []) as Array<{
        user_id: string
        email: string
        is_owner: boolean
        preset_applied: string | null
        joined_at: string
        granted_permission_count: number
      }>
    }
  })
}

/**
 * Full permission map for an arbitrary target user. Caller must be
 * the target or have `view_team`. Used by EditPermissionsDialog.
 */
export function useUserPermissions(targetUserId: string | null) {
  return useQuery({
    queryKey: ['user_permissions', getActiveShopId(), targetUserId],
    enabled: !!targetUserId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (!targetUserId) return null
      const { data, error } = await supabase.rpc('get_user_permissions', {
        p_target_user_id: targetUserId
      })
      if (error) throw error
      return (data ?? []) as Array<{
        permission_key: string
        granted: boolean
        source: string
      }>
    }
  })
}

/**
 * Pending invitations for the active shop (gated `view_team`).
 * Calls the v2.9.1 Phase C list-RPC (mig 0087) which bridges the
 * pending_invitations RLS owner-only constraint.
 */
export function usePendingInvitations() {
  return useQuery({
    queryKey: ['pending_invitations', getActiveShopId()],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'list_pending_invitations_for_shop'
      )
      if (error) throw error
      return (data ?? []) as Array<{
        id: string
        email: string
        preset_applied: string
        invited_by_user_id: string
        invited_by_email: string | null
        status: 'pending' | 'accepted' | 'cancelled' | 'expired'
        failed_attempts: number
        expires_at: string
        created_at: string
      }>
    }
  })
}

/**
 * Permission audit log for the active shop, paginated.
 * Gated `view_user_audit_log`.
 */
export function usePermissionAuditLog(limit = 100, offset = 0) {
  return useQuery({
    queryKey: ['permission_audit', getActiveShopId(), limit, offset],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'list_permission_audit_for_shop',
        { p_limit: limit, p_offset: offset }
      )
      if (error) throw error
      return data ?? []
    }
  })
}

// =====================================================================
// Mutations (Phase D.3 consumers — minted now, wired in D.3)
// =====================================================================

export function useCreateInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    // Signature aligned with migration 0075 create_invitation:
    //   create_invitation(p_email text, p_preset text,
    //                     p_permission_overrides jsonb default '{}'::jsonb,
    //                     p_discount_limit_overrides jsonb default '{}'::jsonb)
    //   returns table(invitation_id uuid, confirmation_code text)
    // The RPC hardcodes 24-hour expiry — there is no p_expires_at param.
    mutationFn: async (args: {
      email: string
      preset: 'manager' | 'salesperson'
      permissions?: Record<string, boolean>
      discount_limits?: Record<string, number>
    }) => {
      const { data, error } = await supabase.rpc('create_invitation', {
        p_email: args.email,
        p_preset: args.preset,
        p_permission_overrides: args.permissions ?? {},
        p_discount_limit_overrides: args.discount_limits ?? {}
      })
      if (error) throw error
      // RPC returns table(...) → Supabase delivers as a single-element array.
      const row = Array.isArray(data) ? data[0] : data
      return row as { invitation_id: string; confirmation_code: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending_invitations'] })
    }
  })
}

export function useCancelInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase.rpc('cancel_invitation', {
        p_invitation_id: invitationId
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending_invitations'] })
    }
  })
}

/**
 * Pre-shop helper called by RequireOnboarded BEFORE the invitee has any
 * shop access. Returns the caller's latest non-expired pending invitation
 * (if any) so the guard can redirect to /invite/accept/<id> instead of
 * /onboarding (which would run the owner wizard for an invitee).
 *
 * v2.9.1 hot-patch — migration 0090. Only fires when the caller hasn't
 * completed onboarding (the `enabled` flag) so onboarded users pay no
 * cost for this check.
 *
 * Shape: returns the latest pending invitation row or null. RLS-bypassing
 * DEFINER read of `pending_invitations` for the caller's email only.
 */
export function useMyPendingInvitation(options?: { enabled?: boolean }) {
  const { user } = useSession()
  return useQuery({
    queryKey: ['my_pending_invitation', user?.id],
    enabled: !!user && (options?.enabled ?? true),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_pending_invitation')
      if (error) throw error
      const row = (
        data as Array<{
          id: string
          shop_id: string
          shop_name: string
          preset_applied: string
          invited_by_email: string
          expires_at: string
        }> | null
      )?.[0]
      return row ?? null
    }
  })
}

/**
 * Reads invitation metadata for the /invite/accept page. Server-side
 * checks caller's auth email matches the invitation email; wrong-email
 * callers get `invitation_email_mismatch` and learn nothing else.
 * Returns metadata regardless of status (pending/accepted/cancelled/
 * expired) so the page can render the appropriate final-state UX.
 */
export function useGetInvitation(invitationId: string | undefined) {
  return useQuery({
    queryKey: ['invitation', invitationId],
    enabled: !!invitationId,
    retry: false,
    staleTime: 30 * 1000,
    queryFn: async () => {
      if (!invitationId) return null
      const { data, error } = await supabase.rpc(
        'get_invitation_for_acceptance',
        { p_invitation_id: invitationId }
      )
      if (error) throw error
      const row = (
        data as Array<{
          shop_name: string
          invited_by_email: string
          preset_applied: string
          invited_email: string
          expires_at: string
          failed_attempts: number
          status: 'pending' | 'accepted' | 'cancelled' | 'expired'
        }> | null
      )?.[0]
      return row ?? null
    }
  })
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      invitation_id: string
      confirmation_code: string
    }) => {
      const { data, error } = await supabase.rpc('accept_invitation', {
        p_invitation_id: args.invitation_id,
        p_confirmation_code: args.confirmation_code
      })
      if (error) throw error
      return data as string // user_shop_access_id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_shop_list'] })
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
      queryClient.invalidateQueries({ queryKey: ['invitation'] })
    }
  })
}

export function useModifyUserPermission() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      target_user_id: string
      permission_key: string
      granted: boolean
    }) => {
      const { error } = await supabase.rpc('modify_user_permission', {
        p_target_user_id: args.target_user_id,
        p_permission_key: args.permission_key,
        p_granted: args.granted
      })
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ['user_permissions', getActiveShopId(), vars.target_user_id]
      })
      queryClient.invalidateQueries({ queryKey: ['team'] })
    }
  })
}

export function useApplyPresetToUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      target_user_id: string
      preset: 'manager' | 'salesperson'
    }) => {
      const { error } = await supabase.rpc('apply_preset_to_user', {
        p_target_user_id: args.target_user_id,
        p_preset: args.preset
      })
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ['user_permissions', getActiveShopId(), vars.target_user_id]
      })
      queryClient.invalidateQueries({ queryKey: ['team'] })
    }
  })
}

export function useUpdateUserDiscountLimits() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      target_user_id: string
      limits: Record<string, number>
    }) => {
      const { error } = await supabase.rpc('update_user_discount_limits', {
        p_target_user_id: args.target_user_id,
        p_discount_limits: args.limits
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] })
    }
  })
}

export function useRevokeUserAccess() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (targetUserId: string) => {
      const { error } = await supabase.rpc('revoke_user_access', {
        p_target_user_id: targetUserId
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] })
      queryClient.invalidateQueries({ queryKey: ['user_permissions'] })
    }
  })
}
