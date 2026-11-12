/** Marks an error text that stays English by design (dApp-facing, or an invariant no person reaches), so the literal-throw lint lets it through. */
export function dappError(message: string): string {
  return message;
}
