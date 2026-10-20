import { SCREENS, SECTIONS, GEN_SCREENS } from "./flow.js";
import { loadSession, saveSession, draftSection } from "./api.js";
import { md, compilePacket, downloadWord } from "./packet.js";

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const code = new URLSearchParams(location.search).get("s");
let s = null; // the session's local working state
let busy = null; // { id } while a section is being (re)drafted
let uiError = null; // { id, message }
let panel = null; // "change" | "edit" — open panel on a gen screen
let openDoc = null; // index of an expanded source document on the source screen

// ---------- Navigation ----------
const visible = () => SCREENS;
const indexOf = (id) => visible().findIndex((x) => x.id === id);
const current = () => visible()[Math.max(0, indexOf(s.pos))] || visible()[0];

function firstIncompleteScreen() {
  const incomplete = SCREENS.find((x) => x.type === "gen" && !s.sections[x.task]?.content && s.sections[x.task]?.status !== "approved");
  return incomplete ? incomplete.id : "done";
}

function go(id) {
  const i = indexOf(id);
  if (i < 0) return;
  s.pos = id;
  panel = null;
  uiError = null;
  openDoc = null;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
const next = () => {
  const v = visible();
  go(v[Math.min(v.length - 1, indexOf(s.pos) + 1)].id);
};
const back = () => {
  const v = visible();
  go(v[Math.max(0, indexOf(s.pos) - 1)].id);
};

// ---------- Saving ----------
let saveTimer = null;
let saving = Promise.resolve();
function save(now = false) {
  clearTimeout(saveTimer);
  setSaveStatus("Saving…");
  const run = () => {
    saving = saving.then(
      () => saveSession(code, { sections: s.sections }).then(() => setSaveStatus("Saved"), () => setSaveStatus("Not saved — check your connection", true))
    );
  };
  if (now) run();
  else saveTimer = setTimeout(run, 500);
}
function setSaveStatus(text, bad) {
  const el = $("#save-status");
  if (el) {
    el.textContent = text;
    el.classList.toggle("bad", !!bad);
  }
}

window.addEventListener("beforeunload", (e) => {
  if (busy) {
    e.preventDefault();
    e.returnValue = "";
  }
});

// ---------- AI drafting ----------
function setSection(key, patch) {
  s.sections[key] = { ...(s.sections[key] || {}), ...patch, updatedAt: Date.now() };
}

async function runGen(scr, { feedback } = {}) {
  const previous = s.sections[scr.task]?.content;
  busy = { id: scr.id };
  uiError = null;
  panel = null;
  render();
  try {
    const { text } = await draftSection({ code, section: scr.task, feedback, previous: feedback ? previous : undefined });
    setSection(scr.task, { content: text.trim(), status: "draft" });
    save(true);
  } catch (err) {
    uiError = { id: scr.id, message: err.message };
  } finally {
    busy = null;
    render();
  }
}

// ---------- Rendering ----------
function render() {
  renderSteps();
  const scr = current();
  const main = $("#screen");
  const fn = { welcome: vWelcome, source: vSource, gen: vGen, done: vDone }[scr.type];
  main.innerHTML = fn(scr);
  wire(scr, main);
}

function renderSteps() {
  const scr = current();
  const v = visible();
  $("#steps").innerHTML =
    `<ol>` +
    SECTIONS.map((name, i) => {
      const firstIdx = v.findIndex((x) => x.section === i);
      const state = i < scr.section ? "done" : i === scr.section ? "now" : "todo";
      const reachable = firstIdx > -1 && !busy;
      return `<li class="${state}">${reachable && state !== "now" ? `<button data-jump="${v[firstIdx].id}">${esc(name)}</button>` : `<span>${esc(name)}</span>`}</li>`;
    }).join("") +
    `</ol>`;
  $("#mobile-progress").innerHTML = `<span>Step ${scr.section + 1} of ${SECTIONS.length} · ${esc(SECTIONS[scr.section])}</span><div class="bar"><i style="width:${Math.round(((scr.section + 1) / SECTIONS.length) * 100)}%"></i></div>`;
  document.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => go(b.dataset.jump)));
}

const eyebrow = (scr, extra = "") => `<p class="eyebrow">${esc(SECTIONS[scr.section])}${extra ? ` · ${extra}` : ""}</p>`;
const backBtn = () => `<button class="btn ghost" data-act="back">← Back</button>`;

function vWelcome() {
  const n = (s.source_documents || []).length;
  return `<section class="card welcome">
    <p class="eyebrow">Welcome</p>
    <h1>This month's Council packet</h1>
    <p class="lead">${n} source document${n === 1 ? "" : "s"} ${n === 1 ? "is" : "are"} loaded and ready. I'll help you draft the packet one section at a time — for each one, I'll read the real source material and write a draft, and you review it before moving to the next section.</p>
    <div class="what-you-get">
      <h2>How this works</h2>
      <ul class="checks">
        <li>Each section is drafted on its own, from the source material only</li>
        <li>Nothing is invented — if a section has no real source material, it's left blank for you to fill in</li>
        <li>You approve, edit, or ask for changes before moving on</li>
        <li>At the end, download the approved text to carry into the usual PDF/publish process</li>
      </ul>
    </div>
    <p class="note"><strong>Your progress saves automatically</strong> — you can close this page anytime and come back to this same link to pick up where you left off.</p>
    <div class="actions"><span></span><button class="btn primary" data-act="next">Let's begin →</button></div>
  </section>`;
}

function vSource() {
  const docs = s.source_documents || [];
  return `<section class="card">
    ${eyebrow({ section: 0 })}
    <h1>Source Material</h1>
    <p class="lead">This is everything that was pulled in for this month's packet. Open any document to check what's actually in it before you start reviewing drafts.</p>
    <div class="doc-list">
      ${docs
        .map(
          (d, i) => `<div class="doc-item">
          <button class="doc-head" data-doc-toggle="${i}"><span>${openDoc === i ? "▾" : "▸"}</span> ${esc(d.filename)}</button>
          ${openDoc === i ? `<pre class="doc-text">${esc(d.text)}</pre>` : ""}
        </div>`
        )
        .join("") || `<p class="hint">No source documents were loaded for this session.</p>`}
    </div>
    <div class="actions">${backBtn()}<button class="btn primary" data-act="next">Continue →</button></div>
  </section>`;
}

function errorBox(scr) {
  return uiError && uiError.id === scr.id
    ? `<div class="error"><p>${esc(uiError.message)}</p><button class="btn primary" data-act="retry">Try again</button></div>`
    : "";
}

function reviewPanel(scr, draft) {
  if (panel === "change")
    return `<div class="panel"><label class="field"><span>What would you like changed?</span><small>Be specific — "the second motion was actually made by Council Member Lee", "add the vote count", "shorter"…</small><textarea id="feedback" rows="4"></textarea></label>
      <div class="actions"><button class="btn ghost" data-act="close">Cancel</button><button class="btn primary" data-act="rewrite">Rewrite it</button></div></div>`;
  if (panel === "edit")
    return `<div class="panel"><label class="field"><span>Edit the text directly</span><small>Lines starting with # are headings; words between ** ** are bold.</small><textarea id="edit" rows="16" class="mono">${esc(draft)}</textarea></label>
      <div class="actions"><button class="btn ghost" data-act="close">Cancel</button><button class="btn primary" data-act="save-edit">Save my edits</button></div></div>`;
  return "";
}

function vGen(scr) {
  const entry = s.sections[scr.task];
  const draft = entry?.content;
  const approved = entry?.status === "approved";
  if (busy && busy.id === scr.id) {
    return `<section class="card">${eyebrow(scr)}<h1>${esc(scr.title)}</h1>
      <p class="busy"><span class="dots"></span>Reading the source material and drafting ${esc(scr.title.replace(/^GF |^WS /, ""))}…</p></section>`;
  }
  if (draft === undefined) {
    return `<section class="card">${eyebrow(scr)}<h1>${esc(scr.title)}</h1>${errorBox(scr)}
      ${uiError ? "" : `<p class="busy"><span class="dots"></span>Getting started…</p>`}
      <div class="actions">${backBtn()}</div></section>`;
  }
  const empty = !draft.trim();
  return `<section class="card">
    ${eyebrow(scr)}
    <div class="title-row"><h1>${esc(scr.title)}</h1>${approved ? `<span class="badge">Approved</span>` : ""}</div>
    ${errorBox(scr)}
    ${empty
      ? `<p class="hint">No source material was found for this section. That's expected if this meeting didn't cover it — fill it in by hand if it should be here, or try again if you think it was missed.</p>`
      : `<article class="draft prose">${md(draft)}</article>`}
    <div class="review">
      <p class="check">${esc(scr.check)}</p>
      ${reviewPanel(scr, draft)}
      ${panel ? "" : `<div class="actions">
        ${backBtn()}
        <div class="right">
          ${empty ? `<button class="btn ghost" data-act="retry">Try again</button>` : `<button class="btn ghost" data-act="edit">Edit it myself</button><button class="btn secondary" data-act="change">Ask for changes</button>`}
          <button class="btn primary" data-act="approve">${approved ? "Continue →" : empty ? "Leave blank — continue →" : "Looks right — continue →"}</button>
        </div></div>`}
    </div>
  </section>`;
}

function vDone() {
  const total = SCREENS.filter((x) => x.type === "gen").length;
  const approvedCount = Object.values(s.sections).filter((x) => x.status === "approved").length;
  const draftedCount = Object.values(s.sections).filter((x) => x.content && x.content.trim()).length;
  return `<section class="card done">
    <p class="eyebrow">All done</p>
    <h1>Draft complete</h1>
    <p class="lead">${draftedCount} of ${total} sections have real content; ${approvedCount} are marked approved. Download this and carry it into the usual PDF-build-and-publish process (the Claude Code session, following SOP_Public_Meeting_Packet.md) — this tool only drafts the content, it doesn't build the final PDF or publish anything.</p>
    <div class="actions left">
      <button class="btn primary" data-act="word">Download (Word)</button>
      <button class="btn secondary" data-act="print">Print / Save as PDF</button>
      ${backBtn()}
    </div>
  </section>
  <article class="card prose packet">${md(compilePacket(s))}</article>`;
}

// ---------- Events ----------
function wire(scr, root) {
  root.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); act(b.dataset.act, scr); }));
  root.querySelectorAll("[data-doc-toggle]").forEach((b) =>
    b.addEventListener("click", () => {
      const i = Number(b.dataset.docToggle);
      openDoc = openDoc === i ? null : i;
      render();
    })
  );

  // Kick off drafting automatically when arriving at a section with nothing yet.
  if (scr.type === "gen" && s.sections[scr.task]?.content === undefined && !busy && !uiError) runGen(scr);
}

function act(name, scr) {
  switch (name) {
    case "next":
      return next();
    case "back":
      return back();
    case "retry":
      uiError = null;
      return runGen(scr);
    case "approve":
      setSection(scr.task, { status: "approved" });
      save(true);
      return next();
    case "change":
    case "edit":
      panel = name;
      return render();
    case "close":
      panel = null;
      return render();
    case "rewrite": {
      const fb = $("#feedback").value.trim();
      if (!fb) return;
      return runGen(scr, { feedback: fb });
    }
    case "save-edit": {
      const t = $("#edit").value.trim();
      setSection(scr.task, { content: t, status: "draft" });
      save(true);
      panel = null;
      return render();
    }
    case "word":
      return downloadWord(s);
    case "print":
      return window.print();
  }
}

// ---------- Start ----------
async function start() {
  const main = $("#screen");
  if (!code) {
    main.innerHTML = `<section class="card"><h1>Missing link</h1><p class="lead">This page needs your session link. Please use the link emailed when the packet source material was ready.</p></section>`;
    return;
  }
  try {
    const data = await loadSession(code);
    s = { ...data, sections: data.sections || {} };
  } catch (err) {
    main.innerHTML = `<section class="card"><h1>Hmm, that link didn't work</h1><p class="lead">${esc(err.message)}</p></section>`;
    return;
  }
  s.pos = "welcome";
  document.title = `Council Packet · ${s.meeting_date || "Draft"}`;
  document.body.classList.add("ready");
  render();
}

start();
