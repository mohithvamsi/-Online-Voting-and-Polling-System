const { createClient } = require('@supabase/supabase-js');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key || url.includes('YOUR_') || key.includes('YOUR_')) {
  throw new Error('Configure backend/.env, or run npm start from the project root for guided setup.');
}
if (!url.startsWith('https://') || !key.startsWith('sb_publishable_')) {
  throw new Error('Use an HTTPS Supabase project URL and an sb_publishable_ key.');
}
function createSupabase(token) {
  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  };
  if (token) options.global = { headers: { Authorization: `Bearer ${token}` } };
  return createClient(url, key, options);
}
module.exports = { createSupabase };
