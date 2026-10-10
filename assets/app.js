/* ============================================================
   assets/app.js — public site interactions (vanilla JS)  [v2]
   Navbar · dynamic content (Sheets) · typed hero · counters ·
   reveal · BMI · testimonials · contact form → sheet + WhatsApp
   ============================================================ */
/* global SITE, SITE_DEFAULTS, DEMO_PLANS, DEMO_TRAINERS, DEMO_WORKOUTS, api, checkConnection, gymNameOf, applyGymName, DEFAULT_GYM_NAME */

let WA_TEMPLATE = (typeof SITE_DEFAULTS !== "undefined") ? SITE_DEFAULTS.whatsapp_msg : "";
let GYM_NAME = (typeof DEFAULT_GYM_NAME !== "undefined") ? DEFAULT_GYM_NAME : "Arnold's Gym";

const escH = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const inrH = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

document.addEventListener("DOMContentLoaded", async () => {
  initNavbar();
  await initDynamicContent();   // hero, plans, trainers, programs + WA template
  initCounters();
  initReveal();
  initMemberCard();
  initTestimonials();
  initContactForm();
  // warm the backend link; failures are silent in demo mode
  if (typeof checkConnection === "function") checkConnection().catch(() => {});
});

/* ---------------- dynamic website content ---------------- */
async function initDynamicContent() {
  let content = { ...(typeof SITE_DEFAULTS !== "undefined" ? SITE_DEFAULTS : {}) };
  let plans = (typeof DEMO_PLANS !== "undefined") ? DEMO_PLANS : [];
  let trainers = (typeof DEMO_TRAINERS !== "undefined") ? DEMO_TRAINERS : [];
  let workouts = (typeof DEMO_WORKOUTS !== "undefined") ? DEMO_WORKOUTS : [];

  try {
    const [sc, pl, tr, wo] = await Promise.all([
      api.getSiteContent(), api.readTab("Plans"), api.readTab("Trainers"), api.readTab("Workouts"),
    ]);
    if (sc) content = sc;
    if (pl && pl.ok && pl.data && pl.data.length) plans = pl.data;
    if (tr && tr.ok && tr.data && tr.data.length) trainers = tr.data;
    if (wo && wo.ok && wo.data && wo.data.length) workouts = wo.data;
  } catch (e) { /* fall back to defaults above */ }

  GYM_NAME = gymNameOf(content);
  WA_TEMPLATE = String(content.whatsapp_msg || WA_TEMPLATE).split(DEFAULT_GYM_NAME).join(GYM_NAME);

  // announcement bar
  const bar = document.getElementById("announceBar");
  const barText = document.getElementById("announceText");
  if (bar && barText && (content.announcement || "").trim()) {
    barText.textContent = content.announcement.trim();
    bar.hidden = false;
  }

  // hero
  const l1 = document.getElementById("heroLine1");
  const l2 = document.getElementById("heroLine2");
  if (l1 && content.hero_line1) l1.textContent = content.hero_line1;
  if (l2 && content.hero_line2) l2.textContent = content.hero_line2;
  const phrases = String(content.hero_typed || "").split(",").map((s) => s.trim()).filter(Boolean);
  initTyped(phrases.length ? phrases : ["Train Hard."]);

  renderPlans(plans.filter((p) => p.active !== "no"));
  renderTrainers(trainers.filter((t) => t.active !== "no"));
  renderPrograms(workouts.filter((w) => w.active !== "no"));
  applyGymName(GYM_NAME);
}

const REVEAL_D = ["", "reveal-d1", "reveal-d2", "reveal-d3"];

function renderPlans(plans) {
  const grid = document.getElementById("pricingGrid");
  if (!grid) return;
  if (!plans.length) {
    grid.innerHTML = '<p class="empty" style="grid-column:1/-1">Plans coming soon — contact us on WhatsApp.</p>';
    return;
  }
  grid.innerHTML = plans.map((p, i) => {
    const popular = p.popular === "yes";
    const facs = String(p.facilities || "").split("\n").map((x) => x.trim()).filter(Boolean);
    return `<div class="card price-card reveal ${REVEAL_D[i % 4]}${popular ? " popular" : ""}">
      ${popular ? '<span class="plan-tag">Most Popular</span>' : ""}
      <h3>${escH(p.name)}</h3>
      <div class="price">${inrH(p.price)}<small> ${escH(p.duration || "")}</small></div>
      <ul>${facs.map((f) => `<li><i class="fas fa-check"></i>${escH(f)}</li>`).join("")}</ul>
      <a href="Registration.html?plan=${encodeURIComponent(p.name)}" class="btn ${popular ? "btn-grad" : "btn-ghost"}">Choose ${escH(p.name)}</a>
    </div>`;
  }).join("");
}

const initialsOf = (name) => String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

function renderTrainers(trainers) {
  const grid = document.getElementById("trainersGrid");
  if (!grid) return;
  if (!trainers.length) {
    grid.innerHTML = '<p class="empty" style="grid-column:1/-1">Trainers coming soon.</p>';
    return;
  }
  grid.innerHTML = trainers.map((t, i) => {
    const phone = String(t.phone || "").replace(/\D/g, "") || SITE.phone;
    const waText = encodeURIComponent(`Hi ${t.name}, I want training details at ${GYM_NAME}.`);
    const media = t.photo
      ? `<img class="trainer-photo" src="${escH(t.photo)}" alt="${escH(t.name)}" loading="lazy" onerror="this.style.display='none'" />`
      : `<div class="trainer-avatar">${escH(initialsOf(t.name))}</div>`;
    return `<div class="card trainer-card reveal ${REVEAL_D[i % 4]}">
      ${media}
      <h3>${escH(t.name)}</h3>
      <div class="trainer-role">${escH(t.role || "")}</div>
      <p style="color:var(--muted);font-size:.9rem">${escH(t.bio || "")}</p>
      <div class="trainer-actions">
        <a class="btn btn-whatsapp btn-sm" href="https://wa.me/${phone}?text=${waText}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> WhatsApp</a>
        <a class="btn btn-ghost btn-sm" href="tel:${phone}"><i class="fas fa-phone"></i> Call</a>
      </div>
    </div>`;
  }).join("");
}

const WORKOUT_ICONS = { chest: "fa-fire", biceps: "fa-dumbbell", triceps: "fa-hand-fist", legs: "fa-running", shoulder: "fa-bolt", back: "fa-weight-hanging", abs: "fa-circle-dot", cardio: "fa-heart-pulse", fullbody: "fa-person-running", flexibility: "fa-person-walking", functional: "fa-hammer", strength: "fa-trophy" };

function renderPrograms(workouts) {
  const grid = document.getElementById("programsGrid");
  if (!grid) return;
  if (!workouts.length) {
    grid.innerHTML = '<p class="empty" style="grid-column:1/-1">Workouts coming soon.</p>';
    return;
  }
  grid.innerHTML = workouts.map((w, i) => `
    <div class="card program-card reveal ${REVEAL_D[i % 4]}">
      ${w.cover ? `<div class="bg" style="background-image:url('${escH(w.cover)}')"></div>` : ""}
      <div class="info">
        <div class="icon-ring"><i class="fas ${WORKOUT_ICONS[w.slug] || "fa-dumbbell"}"></i></div>
        <h3>${escH(w.title)}</h3>
        <p>${escH(w.intro || "")}</p>
        <a class="go" href="workout.html?w=${encodeURIComponent(w.slug)}">View full workout <i class="fas fa-arrow-right"></i></a>
      </div>
    </div>`).join("");
}

/* ---------------- mobile navbar ---------------- */
function initNavbar() {
  const nav = document.getElementById("navbar");
  const btn = document.getElementById("hamburger");
  const links = document.getElementById("navLinks");
  if (!nav || !btn || !links) return;

  window.addEventListener("scroll", () => {
    nav.classList.toggle("scrolled", window.scrollY > 30);
  }, { passive: true });

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

  // scroll-spy: highlight current section link
  const secs = [...document.querySelectorAll("section[id]")];
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        links.querySelectorAll("a").forEach((a) =>
          a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id)
        );
      }
    });
  }, { rootMargin: "-40% 0px -55% 0px" });
  secs.forEach((s) => spy.observe(s));
}

/* ---------------- typed hero effect ---------------- */
function initTyped(phrases) {
  const el = document.getElementById("typed");
  if (!el || !phrases || !phrases.length) return;
  let pi = 0, ci = 0, deleting = false;

  function tick() {
    const word = phrases[pi];
    ci += deleting ? -1 : 1;
    el.textContent = word.slice(0, ci);

    let delay = deleting ? 45 : 95;
    if (!deleting && ci === word.length) { delay = 1400; deleting = true; }
    else if (deleting && ci === 0) { deleting = false; pi = (pi + 1) % phrases.length; delay = 350; }

    setTimeout(tick, delay);
  }
  tick();
}

/* ---------------- animated counters ---------------- */
function initCounters() {
  const els = document.querySelectorAll("[data-count]");
  if (!els.length) return;

  const run = (el) => {
    const target = parseFloat(el.dataset.count);
    const dur = 1600, t0 = performance.now();
    function frame(t) {
      const p = Math.min((t - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString("en-IN");
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
    });
  }, { threshold: 0.5 });
  els.forEach((el) => io.observe(el));
}

/* ---------------- reveal on scroll ---------------- */
function initReveal() {
  const els = document.querySelectorAll(".reveal:not(.visible)");
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  els.forEach((el) => io.observe(el));
}

/* ---------------- Membership card (mobile number lookup) ---------------- */
function cardParseDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T00:00:00") : new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function cardFmtDate(v) {
  const d = cardParseDate(v);
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
/* joining month se 12 mahine tak ke chips: Paid / Due / Done */
function cardMonthChips(created, validity) {
  const s = cardParseDate(created);
  if (!s) return [];
  const e = cardParseDate(validity);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const out = [];
  const d = new Date(s.getFullYear(), s.getMonth(), 1);
  for (let i = 0; i < 12; i++) {
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    let cls = "due", label = "Due";
    if (e && mStart <= e) {
      if (mEnd < today) { cls = "done"; label = "Done"; }
      else { cls = "paid"; label = "Paid"; }
    }
    out.push({ name: d.toLocaleDateString("en-IN", { month: "short", year: "numeric" }), cls, label });
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

function initMemberCard() {
  const form = document.getElementById("cardForm");
  if (!form) return;
  const out = document.getElementById("cardResult");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const mobile = document.getElementById("cardMobile").value.replace(/\D/g, "").slice(-10);
    if (mobile.length < 10) {
      out.innerHTML = '<p style="color:#ff8080">Sahi 10-digit mobile number dalo.</p>';
      return;
    }
    out.innerHTML = '<p style="color:var(--muted)"><i class="fas fa-spinner fa-spin"></i> Card load ho raha hai…</p>';
    try {
      const r = await api.findMember(mobile);
      if (r && r.ok && r.data) {
        out.innerHTML = memberCardHTML(r.data);
      } else {
        out.innerHTML = '<p style="color:#ff8080">Is mobile number par koi member nahi mila. Number check karke phir try karo.</p>';
      }
    } catch (err) {
      out.innerHTML = '<p style="color:#ff8080">Abhi card load nahi ho paya. Thodi der baad try karo.</p>';
    }
  });
}

function memberCardHTML(m) {
  const chips = cardMonthChips(m.created, m.validity);
  const vd = cardParseDate(m.validity);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const active = vd && vd >= today;
  return `
  <div class="mcard">
    <div class="mcard-top">
      <div>
        <div class="mcard-gym">${escH(GYM_NAME)}</div>
        <div class="mcard-tag">MEMBERSHIP CARD</div>
      </div>
      <span class="badge ${active ? "active" : "expired"}" style="align-self:flex-start">${active ? "Active" : "Expired"}</span>
    </div>
    <div class="mcard-name">${escH(m.name)}</div>
    <div class="mcard-meta">
      <span><i class="fas fa-phone"></i> ${escH(m.mobile || "—")}</span>
      <span><i class="fas fa-tag"></i> ${escH(m.plan || "—")}</span>
    </div>
    <div class="mcard-dates">
      <div><span>Joining</span><b>${cardFmtDate(m.created)}</b></div>
      <div><span>Valid Till</span><b>${cardFmtDate(m.validity)}</b></div>
      <div><span>Amount</span><b>${inrH(m.payment)}</b></div>
    </div>
    <div class="mcard-months">
      ${chips.map((c) => `<div class="mchip ${c.cls}"><b>${escH(c.name)}</b><span>${c.label}</span></div>`).join("")}
    </div>
  </div>`;
}


/* ---------------- testimonial slider ---------------- */
function initTestimonials() {
  const slides = document.querySelectorAll(".testi");
  const dotsBox = document.getElementById("testiDots");
  if (!slides.length || !dotsBox) return;

  let i = 0, timer;
  slides.forEach((_, n) => {
    const d = document.createElement("button");
    d.setAttribute("aria-label", "Show testimonial " + (n + 1));
    d.addEventListener("click", () => { show(n); restart(); });
    dotsBox.appendChild(d);
  });
  const dots = dotsBox.querySelectorAll("button");

  function show(n) {
    i = (n + slides.length) % slides.length;
    slides.forEach((s, k) => s.classList.toggle("active", k === i));
    dots.forEach((d, k) => d.classList.toggle("active", k === i));
  }
  function restart() { clearInterval(timer); timer = setInterval(() => show(i + 1), 5000); }
  show(0); restart();
}

/* ---------------- contact form → sheet + WhatsApp ---------------- */
function initContactForm() {
  const form = document.getElementById("contactForm");
  if (!form) return;
  const btn = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.value.trim(),
      mobile: form.mobile.value.trim(),
      subject: form.subject.value.trim(),
      message: form.message.value.trim(),
    };
    if (!payload.name || !payload.mobile || !payload.message) {
      toast("Please fill name, mobile and message.", "error");
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    try {
      const r = await api.contact(payload);
      if (r && r.ok) {
        toast("Message saved. Opening WhatsApp to send it instantly.");
        // also open WhatsApp so the gym owner gets it immediately
        openWhatsApp(payload);
        form.reset();
      } else {
        throw new Error((r && r.error) || "save failed");
      }
    } catch (err) {
      // graceful fallback: WhatsApp only
      toast("Could not save online — sending via WhatsApp instead.", "error");
      openWhatsApp(payload);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message';
    }
  });

  const waBtn = document.getElementById("waDirectBtn");
  if (waBtn) waBtn.addEventListener("click", () => {
    window.open(`https://wa.me/${SITE.phone}?text=${encodeURIComponent(`Hi ${GYM_NAME}! I want membership details.`)}`, "_blank");
  });
}

function fillTemplate(tpl, data) {
  return String(tpl || "").replace("{name}", data.name || "-")
    .replace("{mobile}", data.mobile || "-")
    .replace("{subject}", data.subject || "-")
    .replace("{message}", data.message || "-");
}

function openWhatsApp({ name, mobile, subject, message }) {
  const text = fillTemplate(WA_TEMPLATE, { name, mobile, subject, message });
  window.open(`https://wa.me/${SITE.phone}?text=${encodeURIComponent(text)}`, "_blank");
}

/* ---------------- toast ---------------- */
function toast(msg, type = "ok") {
  let t = document.querySelector(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.className = "toast " + type;
  t.innerHTML = `<i class="fas ${type === "ok" ? "fa-check-circle" : "fa-exclamation-circle"}"></i>${escH(msg)}`;
  requestAnimationFrame(() => t.classList.add("show"));
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 4200);
}
