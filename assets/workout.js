/* ============================================================
   assets/workout.js — workout detail page (workout.html?w=slug)
   Loads one workout from Sheets (or demo seeds) and renders
   cover hero, details, step-by-step guide, don'ts and notes.
   ============================================================ */
/* global DEMO_WORKOUTS, api, gymNameOf, applyGymName */

const escW = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const linesOf = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);

document.addEventListener("DOMContentLoaded", async () => {
  initMiniNav();
  const slug = new URLSearchParams(window.location.search).get("w") || "";
  const wrap = document.getElementById("woWrap");

  let workouts = (typeof DEMO_WORKOUTS !== "undefined") ? DEMO_WORKOUTS : [];
  try {
    const r = await api.readTab("Workouts");
    if (r && r.ok && r.data && r.data.length) workouts = r.data;
  } catch (e) { /* demo seeds stand */ }

  let gymName = "Arnold's Gym";
  try {
    const sc = await api.getSiteContent();
    if (sc) { gymName = gymNameOf(sc); applyGymName(gymName); }
  } catch (e) { /* branding stays default */ }

  const w = workouts.find((x) => x.slug === slug && x.active !== "no")
    || workouts.find((x) => x.slug === slug);

  if (!w) {
    document.title = `Workout not found — ${gymName}`;
    wrap.innerHTML = `
      <div class="container" style="padding:120px 0 60px;text-align:center">
        <h1 style="margin-bottom:14px">Workout not found</h1>
        <p style="color:var(--muted);margin-bottom:24px">This workout page is not available right now.</p>
        <a href="index.html#programs" class="btn btn-grad"><i class="fas fa-arrow-left"></i> Back to Programs</a>
      </div>`;
    return;
  }

  document.title = `${w.title} — ${gymName}`;
  const chips = linesOf(String(w.details || "").replace(/·/g, "\n"));
  const steps = linesOf(w.steps);
  const donts = linesOf(w.donts);
  const notes = linesOf(w.notes);

  wrap.innerHTML = `
    <header class="wo-hero" ${w.cover ? `style="background-image:url('${escW(w.cover)}')"` : ""}>
      <div class="container">
        <a href="index.html#programs" class="back-link" style="margin:0 0 14px"><i class="fas fa-arrow-left"></i> All programs</a>
        <h1>${escW(w.title)}</h1>
        <p class="lead" style="max-width:640px">${escW(w.intro || "")}</p>
        ${chips.length ? `<div class="chips">${chips.map((c) => `<span class="chip"><i class="fas fa-circle-check"></i>${escW(c)}</span>`).join("")}</div>` : ""}
      </div>
    </header>
    <div class="wo-body">
      <div class="container">
        ${steps.length ? `
        <section class="wo-sec">
          <h2><i class="fas fa-list-ol"></i> Step-by-step guide</h2>
          <ol class="steps-list">
            ${steps.map((s) => `<li class="card"><span>${escW(s)}</span></li>`).join("")}
          </ol>
        </section>` : ""}
        ${donts.length ? `
        <section class="wo-sec">
          <h2><i class="fas fa-triangle-exclamation"></i> What NOT to do</h2>
          <ul class="donts-list">
            ${donts.map((d) => `<li><i class="fas fa-circle-xmark"></i><span>${escW(d)}</span></li>`).join("")}
          </ul>
        </section>` : ""}
        ${notes.length ? `
        <section class="wo-sec">
          <h2><i class="fas fa-lightbulb"></i> Important notes</h2>
          <div class="notes-box">
            <ul>${notes.map((n) => `<li>${escW(n)}</li>`).join("")}</ul>
          </div>
        </section>` : ""}
        <div class="wo-cta">
          <a href="Registration.html" class="btn btn-grad"><i class="fas fa-dumbbell"></i> Join Now — Start This Workout</a>
          <a href="index.html#programs" class="btn btn-ghost"><i class="fas fa-arrow-left"></i> All Programs</a>
        </div>
      </div>
    </div>`;
});

function initMiniNav() {
  const btn = document.getElementById("hamburger");
  const links = document.getElementById("navLinks");
  if (!btn || !links) return;
  btn.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    btn.innerHTML = open ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
  });
  links.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      links.classList.remove("open");
      btn.innerHTML = '<i class="fas fa-bars"></i>';
    })
  );
}
