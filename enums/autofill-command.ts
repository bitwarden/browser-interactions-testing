/**
  Which cipher type autofill fills for a page.
*/
export const AutofillCommand = {
  /** Fill the matching login cipher. */
  Login: "login",
  /** Fill the matching card cipher. */
  Card: "card",
  /** Fill the matching identity cipher. */
  Identity: "identity",
} as const;

export type AutofillCommand =
  (typeof AutofillCommand)[keyof typeof AutofillCommand];
