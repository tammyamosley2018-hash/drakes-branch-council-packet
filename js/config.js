// Backend: Supabase Edge Functions on the Town's existing SmartTown project
// (hplfonvbhfzgaeoemwvn). No server of our own to configure — these three
// functions are already deployed: packet-session, draft-packet-section,
// create-packet-session (the last one is called only by the n8n ingestion
// workflow, never by this app).

export const API_BASE = "https://hplfonvbhfzgaeoemwvn.supabase.co/functions/v1";

// Supabase's publishable ("anon") key — safe to ship in client-side code by
// design. The real access control is the unguessable session code in the
// link, same trust model as a shared Google Doc link. Every request to the
// edge functions below needs this in the apikey/Authorization headers for
// Supabase's own gateway, but it grants no table access on its own — the
// packet_sessions table has zero RLS policies, so only the edge functions
// (using the service-role key internally) can read or write it.
export const SUPABASE_ANON_KEY = "sb_publishable_zFyOUSA9e9ctT6idVt-_8g_BXGahAtU";
