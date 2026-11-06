import type { PermissionType } from "./permission";

/**
 * A per-origin permission record created when a dApp calls `connect()`.
 * A Wallet has zero or more Grants, one per connected origin. Revoking a
 * Grant ends all access it covered.
 *
 * `budget` is reserved for future budgeted grants — modeled now so the
 * field is stable, never populated by current logic.
 */
export interface Grant {
  origin: string;
  walletId: string;
  permissions: PermissionType[];
  createdAt: number;
  expiresAt: number | null;
  budget: null;
  /**
   * The site's icon as an https or inline image URL, saved when the grant
   * was made. Absent on grants from before icons were kept.
   */
  icon?: string | null;
  /**
   * The name the dApp gave for itself at connect. Its own claim, so it is
   * always shown with the origin, never in place of it.
   */
  name?: string | null;
}
