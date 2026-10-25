import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

// One shared database client for the whole app (loaded only when first needed)
let clientPromise = null;
export function getClient() {
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
    );
  }
  return clientPromise;
}
