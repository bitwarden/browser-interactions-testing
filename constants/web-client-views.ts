export const authenticatedWebClientViewPaths = new Set([
  "vault",
  "vault?organizationId=unassigned&type=trash",
  "sends",
  "tools/generator",
  "tools/import",
  "tools/export",
  "reports",
  "reports/breach-report",
  "reports/exposed-passwords-report",
  "reports/reused-passwords-report",
  "reports/weak-passwords-report",
  "reports/unsecured-websites-report",
  "reports/inactive-two-factor-report",
  "settings/account",
  "settings/security/change-password",
  "settings/security/two-factor",
  "settings/security/device-management",
  "settings/security/security-keys",
  "settings/preferences",
  "settings/subscription/premium", // # non-premium accounts only
  "settings/domain-rules",
  "settings/emergency-access",
  "settings/sponsored-families",
  "create-organization",
  // @TODO secrets manager & admin console
]);

export const unauthenticatedWebClientViewPaths = new Set([
  "login",
  "register?email=notarealemail@bitwarden.com",
  // @TODO requires stepping through email input (with a passing check)
  // "login-with-device",
  "sso?email=notarealemail@bitwarden.com",
  "login-with-passkey",
]);
