// v2.9.1 feature flags.
//
// `RBAC_TEAM_UI_ENABLED` gates the /settings/team page + sidebar entry.
// Per Phase B.9: per-shop manual flip for first 1-2 pilot shops;
// flag removed entirely after 30 days of stable pilot.
//
// Default OFF — production owners outside the pilot whitelist will
// neither see the Team menu item nor the /settings/team route.
// Pilot deploys set VITE_RBAC_TEAM_UI_ENABLED=true in their env.

export const RBAC_TEAM_UI_ENABLED =
  import.meta.env.VITE_RBAC_TEAM_UI_ENABLED === 'true'
