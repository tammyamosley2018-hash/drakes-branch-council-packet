import { API_BASE, SUPABASE_ANON_KEY } from "./config.js";

async function call(path, opts = {}) {
  const res = await fetch(API_BASE + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const loadSession = (code) => call(`/packet-session/${encodeURIComponent(code)}`);
export const saveSession = (code, patch) =>
  call(`/packet-session/${encodeURIComponent(code)}`, { method: "PUT", body: JSON.stringify(patch) });

// Drafts one section. Not streamed — this is an occasional monthly tool, not
// a high-traffic chat UI, so a short wait with a spinner is a fine tradeoff
// for a much simpler backend/frontend than parsing an SSE event stream.
export const draftSection = ({ code, section, feedback, previous }) =>
  call(`/draft-packet-section`, { method: "POST", body: JSON.stringify({ code, section, feedback, previous }) });
