// The wizard, screen by screen. Unlike the Marketing Playbook (which builds
// up answers through questions, then drafts from them), the source material
// here all arrives up front from n8n's Drive-folder ingestion — so there's
// no Q&A collection step. Each of the 12 packet sections gets its own
// screen, its own narrow AI call scoped to just that section, and its own
// approve/edit/regenerate checkpoint before moving to the next one.

export const SECTIONS = [
  "Source Material",
  "Agenda",
  "Minutes",
  "Old Business Recap",
  "New Business Introduction",
  "Financial Report",
  "GF Bills To Be Paid",
  "WS Bills To Be Paid",
  "GF Bills Paid",
  "WS Bills Paid",
  "Police Report",
  "Fire Department Report",
  "Exhibits",
  "Committee Reports",
  "Your Packet",
];

// Keys match the edge function's SECTION_DEFS exactly.
const SECTION_DEFS = [
  { key: "AGENDA", title: "Agenda", check: "Does this match the agenda for this meeting?" },
  { key: "MINUTES", title: "Minutes", check: "Do the motions, votes, and figures look right? Check every name and number against the source material." },
  { key: "OLD_BUSINESS_RECAP", title: "Old Business Recap", check: "Does this capture the old-business follow-up correctly?" },
  { key: "NEW_BUSINESS_INTRO", title: "New Business Introduction", check: "Does this capture the new business correctly?" },
  { key: "FINANCIAL_REPORT", title: "Financial Report", check: "Internal packet only — does this match the real figures?" },
  { key: "GF_BILLS_TO_BE_PAID", title: "General Fund Bills To Be Paid", check: "Do these vendor names and amounts look right?" },
  { key: "WS_BILLS_TO_BE_PAID", title: "Water/Sewer Bills To Be Paid", check: "Do these vendor names and amounts look right?" },
  { key: "GF_BILLS_PAID", title: "General Fund Bills Paid", check: "This one's easy to forget — confirm it's not empty if bills were actually paid this period." },
  { key: "WS_BILLS_PAID", title: "Water/Sewer Bills Paid", check: "This one's easy to forget — confirm it's not empty if bills were actually paid this period." },
  { key: "POLICE_REPORT", title: "Police Report", check: "Does this match the police report for this period?" },
  { key: "FIRE_REPORT", title: "Fire Department Report", check: "Does this match the Fire/911 report for this period? Permanent staple as of November 2026 — should never be skipped." },
  { key: "EXHIBITS", title: "Exhibits", check: "Are the right exhibits listed, with personnel items left out?" },
  { key: "COMMITTEE_REPORTS", title: "Committee Reports", check: "All eight standing committees should be listed, every month, even if most just say \"No report.\" — confirm none are missing." },
];

export const SCREENS = [
  { id: "welcome", type: "welcome", section: 0 },
  { id: "source", type: "source", section: 0 },
  ...SECTION_DEFS.map((def, i) => ({
    id: def.key.toLowerCase(),
    type: "gen",
    section: i + 1,
    task: def.key,
    title: def.title,
    check: def.check,
  })),
  { id: "done", type: "done", section: SECTIONS.length - 1 },
];

export const GEN_SCREENS = SCREENS.filter((x) => x.type === "gen").map((x) => x.id);
