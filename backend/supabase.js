const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const { createClient } = require('@supabase/supabase-js');
for (const name of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY']) {
  if (!process.env[name] || /YOUR_/.test(process.env[name])) {
    throw new Error(`Configure ${name} in backend/.env before starting.`);
  }
}
const options = { auth: { persistSession: false, autoRefreshToken: false,
  detectSessionInUrl: false } };
// Never sign a user into this privileged client.
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, options);
// Each login/registration gets its own client to avoid sharing users' sessions.
function authClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, options);
}
module.exports = { db, authClient };
