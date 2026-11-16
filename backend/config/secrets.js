/* secrets.js
   Login credentials and the JWT secret, read from the environment.
   In production (NODE_ENV=production) there are NO defaults: if
   ADMIN_PASSWORD or JWT_SECRET is missing, login is refused, so the CRM can
   never run with a guessable password. In development the old defaults
   (admin / admin123) still work so you can start quickly. */
const isProd = () => process.env.NODE_ENV === 'production';

function jwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  return isProd() ? null : 'dev_secret_change_me';
}

function adminCreds() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || (isProd() ? null : 'admin123');
  return { username, password };
}

const configured = () => !!(jwtSecret() && adminCreds().password);

module.exports = { jwtSecret, adminCreds, configured, isProd };
