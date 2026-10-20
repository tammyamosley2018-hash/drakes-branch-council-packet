// Compiles approved section drafts into one document, in the Council
// packet's own order (not the order sections were drafted in — the Clerk
// can approve them in any order), and handles the Word/print export.
/* global marked, DOMPurify */

import { SECTIONS } from "./flow.js";

export function md(text) {
  return DOMPurify.sanitize(marked.parse(text || "", { gfm: true, breaks: false }), { ADD_ATTR: ["target"] });
}

// Push every markdown heading down `by` levels so a section nests under its
// own title heading.
const demote = (text, by = 2) => (text || "").replace(/^(#{1,4}) /gm, (_, h) => "#".repeat(Math.min(6, h.length + by)) + " ");

// Section order for the compiled document — matches SOPs/SOP_Public_Meeting_Packet.md §3.
const COMPILE_ORDER = [
  "AGENDA",
  "MINUTES",
  "OLD_BUSINESS_RECAP",
  "NEW_BUSINESS_INTRO",
  "FINANCIAL_REPORT",
  "GF_BILLS_TO_BE_PAID",
  "WS_BILLS_TO_BE_PAID",
  "GF_BILLS_PAID",
  "WS_BILLS_PAID",
  "POLICE_REPORT",
  "EXHIBITS",
  "COMMITTEE_REPORTS",
];

const TITLES = {
  AGENDA: "Agenda",
  MINUTES: "Minutes",
  OLD_BUSINESS_RECAP: "Old Business Recap",
  NEW_BUSINESS_INTRO: "New Business Introduction",
  FINANCIAL_REPORT: "Financial Report (internal only — not for the public packet)",
  GF_BILLS_TO_BE_PAID: "General Fund Bills To Be Paid",
  WS_BILLS_TO_BE_PAID: "Water/Sewer Bills To Be Paid",
  GF_BILLS_PAID: "General Fund Bills Paid",
  WS_BILLS_PAID: "Water/Sewer Bills Paid",
  POLICE_REPORT: "Police Report",
  EXHIBITS: "Exhibits",
  COMMITTEE_REPORTS: "Committee Reports",
};

export function compilePacket(session) {
  const sections = session.sections || {};
  const title = session.meeting_date ? `Council Packet Draft — ${session.meeting_date}` : "Council Packet Draft";
  const parts = [`# ${title}`];
  const missing = [];

  for (const key of COMPILE_ORDER) {
    const body = sections[key]?.content?.trim();
    if (body) parts.push(`## ${TITLES[key]}\n\n${demote(body)}`);
    else missing.push(TITLES[key]);
  }

  if (missing.length) {
    parts.push(`## Not Drafted\n\nNo source material was found for: ${missing.join(", ")}. Fill these in by hand if they apply to this meeting.`);
  }

  return parts.join("\n\n---\n\n");
}

const fileName = (session, ext) => {
  const stamp = session.meeting_date || new Date().toISOString().slice(0, 10);
  return `Council Packet Draft - ${stamp}.${ext}`;
};

function download(name, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

export function downloadWord(session) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${fileName(session, "")}</title>
<style>body{font-family:Georgia,serif;font-size:12pt;line-height:1.5;color:#16265e}h1,h2,h3,h4{font-family:Georgia,serif;color:#16265e}h1{font-size:22pt}h2{font-size:16pt;margin-top:22pt}h3{font-size:13pt}hr{border:none;border-top:1px solid #ccc}</style>
</head><body>${md(compilePacket(session))}</body></html>`;
  download(fileName(session, "doc"), new Blob(["﻿", html], { type: "application/msword" }));
}
