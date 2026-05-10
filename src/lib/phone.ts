/**
 * Pakistani phone number — local-format only.
 *
 * 11 digits, must start with 0. Example: 03484248371.
 *
 * The `+92` prefix is intentionally rejected: storage and display stay in a
 * single canonical form, and SMS/operator features (when added later) will
 * normalize from this shape if international dialing is required. If a user
 * supports two formats it doubles the surface area for de-duplication and
 * fuzzy lookup; we picked one and stuck with it.
 */
export const PK_PHONE_RE = /^0[0-9]{10}$/

/** Hint shown next to phone inputs (placeholder + error suffix). */
export const PK_PHONE_HINT = '03XXXXXXXXX'
