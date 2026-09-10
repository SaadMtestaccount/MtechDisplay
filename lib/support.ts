/**
 * lib/support.ts — how merchants reach MTech (docs/CONTRACTS.md §23). Isomorphic constants.
 * Set NEXT_PUBLIC_SUPPORT_PHONE in the environment to show a phone number; the email always shows.
 */
export const SUPPORT_EMAIL = 'support@mtechdistributors.com'
export const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? ''

/** `tel:` href for the phone number (digits and + only), or null when no phone is configured. */
export function supportPhoneHref(): string | null {
  const digits = SUPPORT_PHONE.replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : null
}
