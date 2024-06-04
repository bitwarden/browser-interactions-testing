export const authenticatedWebClientViewPaths = new Set([
  "vault",
  "vault?organizationId=unassigned&type=trash",
  "sends",
  "tools/generator",
  "tools/import",
  "tools/export",
  "reports",
  "reports/breach-report",
  "settings/account",
  "settings/security/change-password",
  "settings/security/two-factor",
  "settings/security/security-keys",
  "settings/preferences",
  "settings/subscription/premium",
  "settings/domain-rules",
  "settings/emergency-access",
  "settings/sponsored-families",
  "create-organization",
]);

export const unauthenticatedWebClientViewPaths = new Set([
  "login",
  "register?email=notarealemail@bitwarden.com",
  // @TODO requires stepping through email input
  // "login-with-device",
  "sso?email=notarealemail@bitwarden.com",
  "login-with-passkey",
]);
