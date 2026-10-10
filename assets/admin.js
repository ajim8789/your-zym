/* ============================================================
   assets/admin.js — Arnold's Gym admin dashboard logic
   All data flows through api.* from assets/sheets.js
   (Google Sheets Web App, or localStorage demo mode).
   ============================================================ */
/* global WEB_APP_URL, SITE, api, checkConnection */

document.addEventListener("DOMContentLoaded", () => {
  // ---- auth guard (set by login.js) ----
  if (sessionStorage.getItem("gym_admin") !== "1") {
    window.location.href = "login.html";
    return;
  }

  initSidebar();
  initSyncBadge();
  initMembers();
  initStaff();
  initAttendance();
  initSiteContent();
  initPlans();
  initTrainers();
  initWorkouts();
  initSettings();
  refreshAll();

  document.getElementById("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("gym_admin");
    window.location.href = "index.html";
  });
  document.getElementById("viewSiteBtn").addEventListener("click", () => {
    window.location.href = "index.html";
  });
});

/* ---------------- state ---------------- */
const state = { members: [], staff: [], attendance: {}, attDate: todayISO(), siteContent: {}, plans: [], trainers: [], workouts: [] };
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ---------------- sidebar ---------------- */
function initSidebar() {
  const links = document.querySelectorAll(".side-link[data-view]");
  const title = document.getElementById("viewTitle");
  const names = { overview: "Overview", members: "Members", staff: "Staff", attendance: "Attendance", content: "Website Content", plans: "Membership Plans", trainers: "Trainers", workouts: "Workouts", settings: "Settings" };
  links.forEach((b) => b.addEventListener("click", () => {
    links.forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    document.getElementById("view-" + b.dataset.view).classList.add("active");
    title.textContent = names[b.dataset.view];
    document.getElementById("sidebar").classList.remove("open");
    if (b.dataset.view === "attendance") renderAttendance();
    if (b.dataset.view === "overview") renderOverview();
    if (b.dataset.view === "content") fillSiteContentForm();
  }));
  document.getElementById("sideToggle").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });
}

/* ---------------- sync badge ---------------- */
function initSyncBadge() {
  const badge = document.getElementById("syncBadge");
  const text = document.getElementById("syncText");
  const paint = (online) => {
    badge.classList.toggle("online", online);
    badge.classList.toggle("offline", !online);
    text.textContent = online ? "Google Sheets connected" : "Demo mode (local data)";
  };
  document.addEventListener("gym:sync", (e) => paint(e.detail.online));
  checkConnection().then(paint).catch(() => paint(false));
}

/* ---------------- data load ---------------- */
async function refreshAll() {
  try {
    const [m, s, sc, pl, tr, wo] = await Promise.all([
      api.listMembers(), api.listStaff(),
      api.readTab("SiteContent"), api.readTab("Plans"),
      api.readTab("Trainers"), api.readTab("Workouts"),
    ]);
    state.members = (m && m.ok && m.data) || [];
    state.staff = (s && s.ok && s.data) || [];
    state.siteContent = { ...(typeof SITE_DEFAULTS !== "undefined" ? SITE_DEFAULTS : {}) };
    ((sc && sc.ok && sc.data) || []).forEach((x) => { if (x && x.key) state.siteContent[x.key] = x.value ?? ""; });
    state.plans = (pl && pl.ok && pl.data) || [];
    state.trainers = (tr && tr.ok && tr.data) || [];
    state.workouts = (wo && wo.ok && wo.data) || [];
  } catch (e) {
    state.members = []; state.staff = [];
    state.plans = []; state.trainers = []; state.workouts = [];
    toast("Could not load data. Check connection.", "error");
  }
  renderOverview();
  renderMembers();
  renderStaff();
  renderAttendance();
  renderPlans();
  renderTrainers();
  renderWorkouts();
  applyGymName(gymNameOf(state.siteContent));
  const gymInput = document.getElementById("gymNameInput");
  if (gymInput && document.activeElement !== gymInput) gymInput.value = gymNameOf(state.siteContent);
}

/* ---------------- helpers ---------------- */
function parseDate(v) {
  if (!v) return null;
  let d;
  if (v instanceof Date) { d = new Date(v.getTime()); }
  else {
    const s = String(v).trim();
    // Sheets may return full ISO "2026-11-05T18:30:00.000Z" or plain "2026-11-05"
    d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T00:00:00") : new Date(s);
  }
  return isNaN(d.getTime()) ? null : d;
}
function daysLeft(validity) {
  const v = parseDate(validity);
  if (!v) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  v.setHours(0, 0, 0, 0);
  return Math.round((v - t) / 86400000);
}
/* pretty date for tables: 05 Nov 2026 */
function fmtDate(v) {
  const d = parseDate(v);
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
/* YYYY-MM-DD for <input type="date"> */
function inputDate(v) {
  const d = parseDate(v);
  if (!d) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function statusOf(m) {
  const d = daysLeft(m.validity);
  if (d === null) return { cls: "expired", label: "No date" };
  if (d < 0) return { cls: "expired", label: "Expired" };
  if (d <= 7) return { cls: "expiring", label: "Expiring" };
  return { cls: "active", label: "Active" };
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

/* ---------------- receipt helpers ---------------- */
/* joining month se validity month tak, max 12 chips */
function membershipMonths(startV, endV) {
  const s = parseDate(startV), e = parseDate(endV);
  if (!s || !e) return [];
  const out = [];
  const d = new Date(s.getFullYear(), s.getMonth(), 1);
  const last = new Date(e.getFullYear(), e.getMonth(), 1);
  while (d <= last && out.length < 12) {
    out.push(d.toLocaleDateString("en-IN", { month: "short", year: "numeric" }));
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

/* ---------------- overview ---------------- */
function renderOverview() {
  const ms = state.members;
  const active = ms.filter((m) => statusOf(m).cls === "active").length;
  // renewal chahiye: 7 din me expire hone wale + pehle se expired (list se match)
  const expiring = ms.filter((m) => { const d = daysLeft(m.validity); return d !== null && d <= 7; }).length;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
  const revenue = ms
    .filter((m) => m.created && new Date(m.created) >= cutoff)
    .reduce((sum, m) => sum + Number(m.payment || 0), 0);

  document.getElementById("stTotal").textContent = ms.length;
  document.getElementById("stActive").textContent = active;
  document.getElementById("stExpiring").textContent = expiring;
  document.getElementById("stRevenue").textContent = inr(revenue);

  const box = document.getElementById("expiryAlerts");
  const soon = ms
    .map((m) => ({ m, d: daysLeft(m.validity) }))
    .filter((x) => x.d !== null && x.d <= 7)
    .sort((a, b) => a.d - b.d);

  if (!soon.length) {
    box.innerHTML = '<p class="empty"><i class="fas fa-circle-check" style="color:var(--green)"></i> All memberships are healthy. No renewals due.</p>';
    return;
  }
  box.innerHTML = soon.map(({ m, d }) => `
    <div class="alert-item ${d < 0 ? "red" : ""}">
      <span><b>${esc(m.name)}</b> <span style="color:var(--muted)">· ${esc(m.mobile || "no mobile")}</span></span>
      <span class="badge ${d < 0 ? "expired" : "expiring"}">${d < 0 ? "Expired " + Math.abs(d) + "d ago" : d === 0 ? "Expires today" : d + " days left"}</span>
    </div>`).join("");
}

/* ---------------- members ---------------- */
function initMembers() {
  document.getElementById("memberSearch").addEventListener("input", renderMembers);
  document.getElementById("addMemberBtn").addEventListener("click", () => openMemberModal());
  document.getElementById("exportCsvBtn").addEventListener("click", exportMembersCsv);
  document.getElementById("memberForm").addEventListener("submit", saveMemberForm);
  document.querySelectorAll("[data-close]").forEach((b) =>
    b.addEventListener("click", () => b.closest(".modal-backdrop").classList.remove("open")));
}

/* ---------------- printable membership receipt (fancy gym theme) ---------------- */
let receiptFileName = "receipt";
let receiptMember = null;

function receiptMonthChips(startV, endV) {
  const s = parseDate(startV), e = parseDate(endV);
  if (!s || !e) return [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const curM = new Date(today.getFullYear(), today.getMonth(), 1);
  const out = [];
  const d = new Date(s.getFullYear(), s.getMonth(), 1);
  const last = new Date(e.getFullYear(), e.getMonth(), 1);
  while (d <= last && out.length < 12) {
    out.push({
      name: d.toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
      paid: d <= curM,
    });
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

function openReceipt(id) {
  const m = state.members.find((x) => x.id === id);
  if (!m) return;
  const gym = gymNameOf(state.siteContent);
  const rid = "RCP-" + String(m.id).replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  receiptFileName = rid;
  receiptMember = m;
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const chips = receiptMonthChips(m.created, m.validity);

  const ic = (e) => `<span style="width:42px;height:42px;flex-shrink:0;border-radius:50%;background:#fff4d6;display:inline-flex;align-items:center;justify-content:center;font-size:1.25rem">${e}</span>`;
  const drow = (e, k, v) => `
    <div style="display:flex;align-items:center;gap:14px;padding:9px 20px;border-bottom:1px solid #f3ecd9">
      ${ic(e)}
      <span style="flex:1;color:#3d3d3d;font-size:.95rem">${k}</span>
      <b style="font-size:1.02rem;color:#14141c">${v}</b>
    </div>`;

  document.getElementById("receiptPrint").innerHTML = `
  <div id="receiptPaper" style="width:560px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;color:#14141c;font-family:Poppins,sans-serif">
    <!-- top banner -->
    <div style="background:linear-gradient(135deg,#0c1425 0%,#16224a 60%,#0c1425 100%);padding:26px 22px 34px;position:relative">
      <div style="position:absolute;left:-30px;top:-30px;width:130px;height:130px;background:#ffc107;opacity:.14;border-radius:50%"></div>
      <div style="position:absolute;right:-24px;bottom:-40px;width:150px;height:150px;background:#ffc107;opacity:.10;border-radius:50%"></div>
      <div style="display:flex;align-items:center;gap:14px;position:relative">
        <span style="font-size:2.6rem">🏋️</span>
        <div>
          <div style="font-family:Oswald,sans-serif;font-size:2.3rem;font-weight:700;font-style:italic;color:#ffc107;letter-spacing:2px;line-height:1">${esc(gym)}</div>
          <div style="color:#ffffff;letter-spacing:6px;font-size:.78rem;margin-top:4px">FITNESS &amp; GYM</div>
          <div style="color:#ffc107;font-size:.66rem;letter-spacing:2px;margin-top:5px;font-weight:600">STRONGER &nbsp;•&nbsp; HEALTHIER &nbsp;•&nbsp; HAPPIER</div>
        </div>
      </div>
      <div style="position:absolute;right:20px;top:22px;text-align:right">
        <div style="color:#ffc107;font-size:1.02rem;font-weight:600">Your Fitness</div>
        <div style="color:#ffffff;font-size:1.02rem;font-weight:600">Our Priority</div>
        <div style="height:3px;background:#ffc107;border-radius:2px;margin-top:5px"></div>
      </div>
    </div>
    <!-- ribbon -->
    <div style="text-align:center;margin-top:-19px;position:relative;z-index:2">
      <span style="display:inline-block;background:linear-gradient(90deg,#ffb300,#ffd54f,#ffb300);color:#14141c;font-family:Oswald,sans-serif;font-weight:700;font-size:1.15rem;letter-spacing:2px;padding:9px 40px;border-radius:8px;box-shadow:0 6px 16px rgba(0,0,0,.25)">🏋️ MEMBERSHIP RECEIPT 🏋️</span>
    </div>
    <!-- receipt no / date -->
    <div style="display:flex;justify-content:space-between;align-items:center;padding:18px 22px 6px;gap:10px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:1.7rem">🧾</span>
        <div><div style="font-size:.75rem;color:#666">Receipt No:</div><b style="color:#d32f2f;font-size:1.05rem">${esc(rid)}</b></div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:1.7rem">📅</span>
        <div><div style="font-size:.75rem;color:#666">Date:</div><b style="font-size:1.05rem">${esc(today)}</b></div>
      </div>
    </div>
    <!-- details -->
    <div style="margin:10px 18px 0;border:1px solid #f3ecd9;border-radius:14px;overflow:hidden;background:#fffdf7">
      ${drow("👤", "Member Name", esc(m.name))}
      ${drow("📱", "Mobile", esc(m.mobile || "—"))}
      ${drow("🗓️", "Plan", esc(m.plan || "—"))}
      ${drow("💰", "Amount Paid", inr(m.payment))}
      ${drow("📅", "Starting Date", fmtDate(m.created))}
      ${drow("⏳", "Expire Date", fmtDate(m.validity))}
    </div>
    <!-- month wise -->
    ${chips.length ? `
    <div style="padding:16px 22px 0">
      <span style="display:inline-block;background:#ffc107;color:#14141c;font-weight:800;font-size:.85rem;letter-spacing:1px;padding:7px 20px;border-radius:6px">📅 MONTH-WISE</span>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
        ${chips.map((c) => c.paid
          ? `<span style="background:#22c55e;color:#fff;font-weight:600;font-size:.9rem;padding:9px 22px;border-radius:999px">✅ ${esc(c.name)}</span>`
          : `<span style="background:#e9e9ef;color:#555;font-weight:600;font-size:.9rem;padding:9px 22px;border-radius:999px">🕐 ${esc(c.name)}</span>`).join("")}
      </div>
      <div style="text-align:right;margin-top:10px;color:#e6a200;font-weight:800;font-size:1.05rem;letter-spacing:1px">SMALL STEPS<br><span style="font-size:1.5rem">BIG RESULTS</span> 💪</div>
    </div>` : ""}
    <!-- about -->
    <div style="margin:14px 22px 0;background:#fff8e6;border-radius:14px;padding:16px;display:flex;gap:12px">
      <span style="font-size:2rem">👨‍💼</span>
      <div>
        <b style="font-size:1rem;border-bottom:3px solid #ffc107">About ${esc(gym)}:</b>
        <p style="font-size:.85rem;color:#444;margin:8px 0 0;line-height:1.55">${esc(SITE.address)} me sthit humara gym strength training, fat loss aur personal coaching ke liye jana jata hai. Certified trainers, modern equipment aur har pocket ke liye plans.</p>
      </div>
    </div>
    <!-- thank you -->
    <div style="margin:14px 22px 0;background:#14141c;color:#fff;text-align:center;border-radius:12px;padding:13px;font-size:1rem;font-style:italic">Thank you for training with us! 💪</div>
    <div style="margin:12px 22px 0;background:#14141c;color:#fff;border-radius:999px;padding:11px 18px;display:flex;justify-content:center;gap:16px;flex-wrap:wrap;font-size:.85rem">
      <span>📞 Contact: <b>${esc(SITE.displayPhone)}</b></span>
      <span style="color:#ffc107">|</span>
      <span>✉️ <b>${esc(SITE.email)}</b></span>
    </div>
    <div style="text-align:center;padding:12px 0 16px;color:#b98a00;font-weight:800;letter-spacing:2px;font-size:.75rem">NO PAIN &nbsp;NO GAIN &nbsp;•&nbsp; FITNESS LIFE</div>
    <div style="height:8px;background:linear-gradient(90deg,#ffb300,#ffd54f,#ffb300)"></div>
  </div>`;
  document.getElementById("receiptModal").classList.add("open");
}

function printReceipt() {
  window.print();
}

async function receiptImageBlob() {
  if (typeof html2canvas === "undefined") {
    toast("JPG library load nahi hui — internet check karo.", "error");
    return null;
  }
  const canvas = await html2canvas(document.getElementById("receiptPaper"), { scale: 3, useCORS: true, backgroundColor: "#ffffff" });
  const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.95));
  if (!blob) throw new Error("image nahi bani");
  return blob;
}

async function saveReceiptJPG() {
  try {
    toast("High-resolution JPG ban rahi hai…");
    const blob = await receiptImageBlob();
    if (!blob) return;
    const a = document.createElement("a");
    a.download = receiptFileName + ".jpg";
    a.href = URL.createObjectURL(blob);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast("JPG save ho gayi: " + receiptFileName + ".jpg");
  } catch (err) {
    toast("JPG nahi ban payi: " + err.message, "error");
  }
}

// Receipt image seedha WhatsApp par share karo (phone ka share sheet khulega)
async function shareReceipt() {
  const m = receiptMember;
  if (!m) return;
  let blob = null;
  try {
    toast("Receipt image ban rahi hai…");
    blob = await receiptImageBlob();
    if (!blob) return;
    const file = new File([blob], receiptFileName + ".jpg", { type: "image/jpeg" });
    const gym = gymNameOf(state.siteContent);
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `${gym} — Payment Receipt`,
        text: `${m.name} — payment receipt (${receiptFileName})`,
      });
      return;
    }
  } catch (err) {
    if (err && err.name === "AbortError") return; // user ne share cancel kiya
  }
  // fallback: JPG download kar do, WhatsApp par manually bhej dein
  if (blob) {
    const a = document.createElement("a");
    a.download = receiptFileName + ".jpg";
    a.href = URL.createObjectURL(blob);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  toast("Share support nahi hai — JPG download kar di, WhatsApp par manually bhej dein.");
}

function renderMembers() {
  const q = document.getElementById("memberSearch").value.trim().toLowerCase();
  const rows = document.getElementById("memberRows");
  const list = state.members.filter((m) =>
    !q || (m.name || "").toLowerCase().includes(q) || (m.mobile || "").includes(q));

  if (!list.length) {
    rows.innerHTML = '<tr><td colspan="8" class="empty">No members found. Click "Add Member" to add one.</td></tr>';
    return;
  }
  rows.innerHTML = list.map((m) => {
    const d = daysLeft(m.validity);
    const st = statusOf(m);
    return `<tr>
      <td class="cell-main" data-label="Name"><b>${esc(m.name)}</b></td>
      <td data-label="Mobile">${esc(m.mobile || "—")}</td>
      <td data-label="Plan">${esc(m.plan || "—")}</td>
      <td data-label="Payment">${inr(m.payment)}</td>
      <td data-label="Valid Till">${fmtDate(m.validity)}</td>
      <td data-label="Days Left"><b>${d === null ? "—" : d < 0 ? "Expired" : d + " days"}</b></td>
      <td data-label="Status"><span class="badge ${st.cls}">${st.label}</span></td>
      <td class="cell-act" data-label="Actions"><div class="row-actions">
        <button class="icon-btn info" title="Generate receipt" onclick="openReceipt('${m.id}')"><i class="fas fa-receipt"></i></button>
        <button class="icon-btn wa" title="Send receipt on WhatsApp" onclick="receiptWhatsApp('${m.id}')"><i class="fab fa-whatsapp"></i></button>
        <button class="icon-btn edit" title="Edit" onclick="openMemberModal('${m.id}')"><i class="fas fa-pen"></i></button>
        <button class="icon-btn del" title="Delete" onclick="deleteMember('${m.id}')"><i class="fas fa-trash"></i></button>
      </div></td>
    </tr>`;
  }).join("");
}

function openMemberModal(id) {
  const modal = document.getElementById("memberModal");
  const m = id ? state.members.find((x) => x.id === id) : null;
  document.getElementById("memberModalTitle").textContent = m ? "Edit Member" : "Add Member";
  document.getElementById("mId").value = m ? m.id : "";
  document.getElementById("mName").value = m ? m.name : "";
  document.getElementById("mMobile").value = (m && m.mobile) || "";
  document.getElementById("mEmail").value = (m && m.email) || "";
  document.getElementById("mPlan").value = (m && m.plan) || "Monthly";
  document.getElementById("mPayment").value = (m && m.payment) || "";
  document.getElementById("mValidity").value = inputDate(m && m.validity);
  modal.classList.add("open");
}

async function saveMemberForm(e) {
  e.preventDefault();
  const id = document.getElementById("mId").value;
  const data = {
    name: document.getElementById("mName").value.trim(),
    mobile: document.getElementById("mMobile").value.trim(),
    email: document.getElementById("mEmail").value.trim(),
    plan: document.getElementById("mPlan").value,
    payment: Number(document.getElementById("mPayment").value),
    validity: document.getElementById("mValidity").value,
  };
  await withLoader(async () => {
    try {
      const r = id ? await api.updateMember(id, data) : await api.addMember(data);
      if (r && r.ok) {
        document.getElementById("memberModal").classList.remove("open");
        toast(id ? "Member updated." : `Member added: ${data.name}`);
        await refreshAll();
      } else throw new Error((r && r.error) || "save failed");
    } catch (err) { toast("Save failed: " + err.message, "error"); }
  });
}

async function deleteMember(id) {
  const m = state.members.find((x) => x.id === id);
  if (!m || !confirm(`Delete member "${m.name}"?`)) return;
  await withLoader(async () => {
    try {
      const r = await api.deleteMember(id);
      if (r && r.ok) { toast(`Deleted: ${m.name}`); await refreshAll(); }
      else throw new Error((r && r.error) || "delete failed");
    } catch (err) { toast("Delete failed: " + err.message, "error"); }
  });
}

// Member ka WhatsApp number — Add Member form me dala gaya number, bilkul wahi.
// Number phone me save ho ya na ho, wa.me link bina save kiye chat khol deta hai.
function memberWaNumber(mobile) {
  const d = String(mobile || "").replace(/\D/g, "");
  if (d.length < 10) return null;                    // invalid number
  if (d.length === 10) return "91" + d;              // India default
  if (d.length === 12 && d.startsWith("91")) return d; // 91 pehle se included
  return d;
}

function receiptMsg(m) {
  const d = daysLeft(m.validity);
  const gym = gymNameOf(state.siteContent);
  const rid = "RCP-" + String(m.id).replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  return `*${gym} — Payment Receipt*\nReceipt No: ${rid}\nDate: ${today}\n\nName: ${m.name}\nPlan: ${m.plan || "-"}\nAmount: ${inr(m.payment)}\nValid till: ${fmtDate(m.validity)}\nDays left: ${d === null ? "-" : d < 0 ? "Expired" : d}\n\nThank you for training with us! 💪`;
}

function receiptWhatsApp(id) {
  const m = state.members.find((x) => x.id === id);
  if (!m) return;
  const wa = memberWaNumber(m.mobile);
  if (!wa) { toast("Is member ka valid mobile number nahi hai.", "error"); return; }
  toast(`WhatsApp khul raha hai — ${m.name} (${m.mobile})`);
  window.open(`https://wa.me/${wa}?text=${encodeURIComponent(receiptMsg(m))}`, "_blank");
}

function exportMembersCsv() {
  const head = ["name", "mobile", "email", "plan", "payment", "validity", "status"];
  const lines = [head.join(",")];
  state.members.forEach((m) => {
    lines.push(head.map((h) => `"${String(h === "status" ? statusOf(m).label : (m[h] ?? "")).replace(/"/g, '""')}"`).join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `arnolds-gym-members-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Members exported as CSV.");
}

/* ---------------- staff ---------------- */
function initStaff() {
  document.getElementById("addStaffBtn").addEventListener("click", () => openStaffModal());
  document.getElementById("staffForm").addEventListener("submit", saveStaffForm);
}

function renderStaff() {
  const rows = document.getElementById("staffRows");
  if (!state.staff.length) {
    rows.innerHTML = '<tr><td colspan="4" class="empty">No staff yet. Click "Add Staff".</td></tr>';
    return;
  }
  rows.innerHTML = state.staff.map((s) => `<tr>
    <td class="cell-main" data-label="Name"><b>${esc(s.name)}</b></td>
    <td data-label="Role">${esc(s.role)}</td>
    <td data-label="Salary">${inr(s.salary)}</td>
    <td class="cell-act" data-label="Actions"><div class="row-actions">
      <button class="icon-btn edit" onclick="openStaffModal('${s.id}')"><i class="fas fa-pen"></i></button>
      <button class="icon-btn del" onclick="deleteStaff('${s.id}')"><i class="fas fa-trash"></i></button>
    </div></td>
  </tr>`).join("");
}

function openStaffModal(id) {
  const modal = document.getElementById("staffModal");
  const s = id ? state.staff.find((x) => x.id === id) : null;
  document.getElementById("staffModalTitle").textContent = s ? "Edit Staff" : "Add Staff";
  document.getElementById("sId").value = s ? s.id : "";
  document.getElementById("sName").value = s ? s.name : "";
  document.getElementById("sRole").value = s ? s.role : "";
  document.getElementById("sSalary").value = s ? s.salary : "";
  modal.classList.add("open");
}

async function saveStaffForm(e) {
  e.preventDefault();
  const id = document.getElementById("sId").value;
  const data = {
    name: document.getElementById("sName").value.trim(),
    role: document.getElementById("sRole").value.trim(),
    salary: Number(document.getElementById("sSalary").value),
  };
  await withLoader(async () => {
    try {
      const r = id ? await api.updateStaff(id, data) : await api.addStaff(data);
      if (r && r.ok) {
        document.getElementById("staffModal").classList.remove("open");
        toast(id ? "Staff updated." : `Staff added: ${data.name}`);
        await refreshAll();
      } else throw new Error((r && r.error) || "save failed");
    } catch (err) { toast("Save failed: " + err.message, "error"); }
  });
}

async function deleteStaff(id) {
  const s = state.staff.find((x) => x.id === id);
  if (!s || !confirm(`Delete staff "${s.name}"?`)) return;
  await withLoader(async () => {
    try {
      const r = await api.deleteStaff(id);
      if (r && r.ok) { toast(`Deleted: ${s.name}`); await refreshAll(); }
      else throw new Error((r && r.error) || "delete failed");
    } catch (err) { toast("Delete failed: " + err.message, "error"); }
  });
}

/* ---------------- attendance ---------------- */
function initAttendance() {
  const dateInput = document.getElementById("attDate");
  dateInput.value = state.attDate;
  dateInput.addEventListener("change", () => {
    state.attDate = dateInput.value || todayISO();
    loadAttendance();
  });
  document.getElementById("saveAttBtn").addEventListener("click", saveAttendance);
  document.getElementById("attWaBtn").addEventListener("click", sendAttendanceWhatsApp);
  loadAttendance();
}

async function loadAttendance() {
  try {
    const r = await api.listAttendance(state.attDate);
    const rows = (r && r.ok && r.data) || [];
    state.attendance = {};
    rows.forEach((x) => { state.attendance[x.name] = x.status; });
  } catch (e) { state.attendance = {}; }
  renderAttendance();
}

function renderAttendance() {
  const rows = document.getElementById("attRows");
  if (!state.staff.length) {
    rows.innerHTML = '<tr><td colspan="4" class="empty">Add staff first to mark attendance.</td></tr>';
    return;
  }
  rows.innerHTML = state.staff.map((s, i) => {
    const st = state.attendance[s.name] || "Present";
    return `<tr>
      <td class="cell-no" data-label="No">${i + 1}</td><td class="cell-main" data-label="Name"><b>${esc(s.name)}</b></td><td data-label="Role">${esc(s.role)}</td>
      <td class="cell-act" data-label="Attendance"><div class="att-toggle">
        <button class="p ${st === "Present" ? "on" : ""}" onclick="setAtt('${esc(s.name)}','Present')">Present</button>
        <button class="a ${st === "Absent" ? "on" : ""}" onclick="setAtt('${esc(s.name)}','Absent')">Absent</button>
      </div></td>
    </tr>`;
  }).join("");
}

function setAtt(name, status) {
  state.attendance[name] = status;
  renderAttendance();
}

async function saveAttendance() {
  const rows = state.staff.map((s) => ({ name: s.name, status: state.attendance[s.name] || "Present" }));
  await withLoader(async () => {
    try {
      const r = await api.saveAttendance(state.attDate, rows);
      if (r && r.ok) toast(`Attendance saved for ${state.attDate} (${rows.length} staff).`);
      else throw new Error((r && r.error) || "save failed");
    } catch (err) { toast("Save failed: " + err.message, "error"); }
  });
}

function sendAttendanceWhatsApp() {
  let msg = `*${gymNameOf(state.siteContent)} — Staff Attendance*\nDate: ${state.attDate}\n\n`;
  state.staff.forEach((s, i) => {
    msg += `${i + 1}. ${s.name} — ${state.attendance[s.name] || "Present"}\n`;
  });
  window.open(`https://wa.me/${SITE.phone}?text=${encodeURIComponent(msg)}`, "_blank");
  toast("Opening WhatsApp with attendance summary.");
}

/* ---------------- website content ---------------- */
const SC_FIELDS = [
  ["scHero1", "hero_line1"], ["scHero2", "hero_line2"], ["scTyped", "hero_typed"],
  ["scAnnounce", "announcement"], ["scWaMsg", "whatsapp_msg"],
];

function initSiteContent() {
  document.getElementById("siteContentForm").addEventListener("submit", saveSiteContentForm);
  fillSiteContentForm();
}

function fillSiteContentForm() {
  const d = (typeof SITE_DEFAULTS !== "undefined") ? SITE_DEFAULTS : {};
  SC_FIELDS.forEach(([elId, key]) => {
    const el = document.getElementById(elId);
    if (el) el.value = state.siteContent[key] ?? d[key] ?? "";
  });
}

async function saveSiteContentForm(e) {
  e.preventDefault();
  await withLoader(async () => {
    try {
      for (const [elId, key] of SC_FIELDS) {
        await api.upsertSiteContent(key, document.getElementById(elId).value);
      }
      await refreshAll();
      toast("Website content saved — live on the site now.");
    } catch (err) { toast("Save failed: " + err.message, "error"); }
  });
}

/* ---------------- membership plans ---------------- */
function initPlans() {
  document.getElementById("addPlanBtn").addEventListener("click", () => openPlanModal());
  document.getElementById("planForm").addEventListener("submit", savePlanForm);
}

const ynBadge = (v) => `<span class="badge ${v === "yes" ? "active" : "expired"}">${v === "yes" ? "Yes" : "No"}</span>`;

function renderPlans() {
  const rows = document.getElementById("planRows");
  if (!state.plans.length) {
    rows.innerHTML = '<tr><td colspan="7" class="empty">No plans yet. Click "Add Plan".</td></tr>';
    return;
  }
  rows.innerHTML = state.plans.map((p) => {
    const fac = String(p.facilities || "").split("\n").filter((x) => x.trim()).length;
    return `<tr>
      <td><b>${esc(p.name)}</b></td>
      <td>${inr(p.price)}</td>
      <td>${esc(p.duration || "—")}</td>
      <td>${fac} item${fac === 1 ? "" : "s"}</td>
      <td>${ynBadge(p.popular)}</td>
      <td>${ynBadge(p.active)}</td>
      <td><div class="row-actions">
        <button class="icon-btn edit" onclick="openPlanModal('${p.id}')"><i class="fas fa-pen"></i></button>
        <button class="icon-btn del" onclick="deletePlan('${p.id}')"><i class="fas fa-trash"></i></button>
      </div></td>
    </tr>`;
  }).join("");
}

function openPlanModal(id) {
  const modal = document.getElementById("planModal");
  const p = id ? state.plans.find((x) => String(x.id) === String(id)) : null;
  document.getElementById("planModalTitle").textContent = p ? "Edit Plan" : "Add Plan";
  document.getElementById("pId").value = p ? p.id : "";
  document.getElementById("pName").value = p ? p.name : "";
  document.getElementById("pPrice").value = (p && p.price) || "";
  document.getElementById("pDuration").value = (p && p.duration) || "";
  document.getElementById("pFacilities").value = (p && p.facilities) || "";
  document.getElementById("pPopular").checked = p ? p.popular === "yes" : false;
  document.getElementById("pActive").checked = p ? p.active !== "no" : true;
  modal.classList.add("open");
}

async function savePlanForm(e) {
  e.preventDefault();
  const id = document.getElementById("pId").value;
  const data = {
    name: document.getElementById("pName").value.trim(),
    price: String(document.getElementById("pPrice").value).trim(),
    duration: document.getElementById("pDuration").value.trim(),
    facilities: document.getElementById("pFacilities").value.trim(),
    popular: document.getElementById("pPopular").checked ? "yes" : "no",
    active: document.getElementById("pActive").checked ? "yes" : "no",
  };
  await withLoader(async () => {
    try {
      const r = id ? await api.updateTabRow("Plans", id, data) : await api.appendTabRow("Plans", data);
      if (r && r.ok) {
        document.getElementById("planModal").classList.remove("open");
        toast(id ? "Plan updated." : `Plan added: ${data.name}`);
        await refreshAll();
      } else throw new Error((r && r.error) || "save failed");
    } catch (err) { toast("Save failed: " + err.message, "error"); }
  });
}

async function deletePlan(id) {
  const p = state.plans.find((x) => String(x.id) === String(id));
  if (!p || !confirm(`Delete plan "${p.name}"?`)) return;
  await withLoader(async () => {
    try {
      const r = await api.deleteTabRow("Plans", id);
      if (r && r.ok) { toast(`Deleted plan: ${p.name}`); await refreshAll(); }
      else throw new Error((r && r.error) || "delete failed");
    } catch (err) { toast("Delete failed: " + err.message, "error"); }
  });
}

/* ---------------- trainers ---------------- */
function initTrainers() {
  document.getElementById("addTrainerBtn").addEventListener("click", () => openTrainerModal());
  document.getElementById("trainerForm").addEventListener("submit", saveTrainerForm);
  document.getElementById("tPhoto").addEventListener("input", (e) => {
    const img = document.getElementById("tPhotoPreview");
    img.style.display = e.target.value.trim() ? "block" : "none";
    img.src = e.target.value.trim();
  });
}

const initialsOf = (name) => String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

function renderTrainers() {
  const rows = document.getElementById("trainerRows");
  if (!state.trainers.length) {
    rows.innerHTML = '<tr><td colspan="6" class="empty">No trainers yet. Click "Add Trainer".</td></tr>';
    return;
  }
  rows.innerHTML = state.trainers.map((t) => `
    <tr>
      <td>${t.photo
        ? `<img src="${esc(t.photo)}" alt="" style="width:44px;height:44px;border-radius:50%;object-fit:cover" onerror="this.style.display='none'" />`
        : `<span class="trainer-avatar" style="width:44px;height:44px;font-size:.9rem;margin:0">${esc(initialsOf(t.name))}</span>`}</td>
      <td><b>${esc(t.name)}</b></td>
      <td>${esc(t.role || "—")}</td>
      <td>${esc(t.phone || "—")}</td>
      <td>${ynBadge(t.active)}</td>
      <td><div class="row-actions">
        <button class="icon-btn edit" onclick="openTrainerModal('${t.id}')"><i class="fas fa-pen"></i></button>
        <button class="icon-btn del" onclick="deleteTrainer('${t.id}')"><i class="fas fa-trash"></i></button>
      </div></td>
    </tr>`).join("");
}

function openTrainerModal(id) {
  const modal = document.getElementById("trainerModal");
  const t = id ? state.trainers.find((x) => String(x.id) === String(id)) : null;
  document.getElementById("trainerModalTitle").textContent = t ? "Edit Trainer" : "Add Trainer";
  document.getElementById("tId").value = t ? t.id : "";
  document.getElementById("tName").value = t ? t.name : "";
  document.getElementById("tRole").value = (t && t.role) || "";
  document.getElementById("tPhoto").value = (t && t.photo) || "";
  document.getElementById("tBio").value = (t && t.bio) || "";
  document.getElementById("tPhone").value = (t && t.phone) || "";
  document.getElementById("tActive").checked = t ? t.active !== "no" : true;
  const img = document.getElementById("tPhotoPreview");
  img.style.display = (t && t.photo) ? "block" : "none";
  if (t && t.photo) img.src = t.photo;
  modal.classList.add("open");
}

async function saveTrainerForm(e) {
  e.preventDefault();
  const id = document.getElementById("tId").value;
  const data = {
    name: document.getElementById("tName").value.trim(),
    role: document.getElementById("tRole").value.trim(),
    photo: document.getElementById("tPhoto").value.trim(),
    bio: document.getElementById("tBio").value.trim(),
    phone: document.getElementById("tPhone").value.replace(/\D/g, ""),
    active: document.getElementById("tActive").checked ? "yes" : "no",
  };
  await withLoader(async () => {
    try {
      const r = id ? await api.updateTabRow("Trainers", id, data) : await api.appendTabRow("Trainers", data);
      if (r && r.ok) {
        document.getElementById("trainerModal").classList.remove("open");
        toast(id ? "Trainer updated." : `Trainer added: ${data.name}`);
        await refreshAll();
      } else throw new Error((r && r.error) || "save failed");
    } catch (err) { toast("Save failed: " + err.message, "error"); }
  });
}

async function deleteTrainer(id) {
  const t = state.trainers.find((x) => String(x.id) === String(id));
  if (!t || !confirm(`Delete trainer "${t.name}"?`)) return;
  await withLoader(async () => {
    try {
      const r = await api.deleteTabRow("Trainers", id);
      if (r && r.ok) { toast(`Deleted trainer: ${t.name}`); await refreshAll(); }
      else throw new Error((r && r.error) || "delete failed");
    } catch (err) { toast("Delete failed: " + err.message, "error"); }
  });
}

/* ---------------- workouts ---------------- */
function initWorkouts() {
  document.getElementById("workoutForm").addEventListener("submit", saveWorkoutForm);
  document.getElementById("wCover").addEventListener("input", (e) => {
    const img = document.getElementById("wCoverPreview");
    img.style.display = e.target.value.trim() ? "block" : "none";
    img.src = e.target.value.trim();
  });
}

function renderWorkouts() {
  const rows = document.getElementById("workoutRows");
  if (!state.workouts.length) {
    rows.innerHTML = '<tr><td colspan="5" class="empty">No workouts yet.</td></tr>';
    return;
  }
  rows.innerHTML = state.workouts.map((w) => `
    <tr>
      <td>${w.cover
        ? `<img src="${esc(w.cover)}" alt="" style="width:74px;height:44px;border-radius:8px;object-fit:cover" onerror="this.style.display='none'" />`
        : '<span style="color:var(--muted)">—</span>'}</td>
      <td><b>${esc(w.title)}</b></td>
      <td><span style="font-family:monospace;font-size:.8rem;color:var(--muted)">workout.html?w=${esc(w.slug)}</span></td>
      <td>${ynBadge(w.active)}</td>
      <td><div class="row-actions">
        <button class="icon-btn edit" onclick="openWorkoutModal('${w.id}')"><i class="fas fa-pen"></i></button>
      </div></td>
    </tr>`).join("");
}

function openWorkoutModal(id) {
  const modal = document.getElementById("workoutModal");
  const w = state.workouts.find((x) => String(x.id) === String(id));
  if (!w) return;
  document.getElementById("workoutModalTitle").textContent = "Edit: " + w.title;
  document.getElementById("wId").value = w.id;
  document.getElementById("wTitle").value = w.title || "";
  document.getElementById("wSlug").value = w.slug || "";
  document.getElementById("wCover").value = w.cover || "";
  document.getElementById("wIntro").value = w.intro || "";
  document.getElementById("wDetails").value = w.details || "";
  document.getElementById("wSteps").value = w.steps || "";
  document.getElementById("wDonts").value = w.donts || "";
  document.getElementById("wNotes").value = w.notes || "";
  document.getElementById("wActive").checked = w.active !== "no";
  const img = document.getElementById("wCoverPreview");
  img.style.display = w.cover ? "block" : "none";
  if (w.cover) img.src = w.cover;
  modal.classList.add("open");
}

async function saveWorkoutForm(e) {
  e.preventDefault();
  const id = document.getElementById("wId").value;
  const data = {
    title: document.getElementById("wTitle").value.trim(),
    slug: document.getElementById("wSlug").value.trim().toLowerCase().replace(/[^a-z0-9-]/g, ""),
    cover: document.getElementById("wCover").value.trim(),
    intro: document.getElementById("wIntro").value.trim(),
    details: document.getElementById("wDetails").value.trim(),
    steps: document.getElementById("wSteps").value.trim(),
    donts: document.getElementById("wDonts").value.trim(),
    notes: document.getElementById("wNotes").value.trim(),
    active: document.getElementById("wActive").checked ? "yes" : "no",
  };
  await withLoader(async () => {
    try {
      const r = await api.updateTabRow("Workouts", id, data);
      if (r && r.ok) {
        document.getElementById("workoutModal").classList.remove("open");
        toast(`Workout updated: ${data.title}`);
        await refreshAll();
      } else throw new Error((r && r.error) || "save failed");
    } catch (err) { toast("Save failed: " + err.message, "error"); }
  });
}

/* ---------------- settings ---------------- */
function initSettings() {
  const box = document.getElementById("cfgUrl");
  box.textContent = WEB_APP_URL ? WEB_APP_URL : "(not set — running in Demo Mode)";
  document.getElementById("gymNameInput").value = gymNameOf(state.siteContent);
  document.getElementById("saveGymNameBtn").addEventListener("click", saveGymName);
}

async function saveGymName() {
  const val = document.getElementById("gymNameInput").value.trim();
  if (!val) { toast("Gym ka naam khaali nahi ho sakta.", "error"); return; }
  await withLoader(async () => {
    try {
      const r = await api.upsertSiteContent("gym_name", val);
      if (r && r.ok) {
        state.siteContent.gym_name = val;
        applyGymName(val);
        toast(`Gym ka naam badal gaya: ${val}`);
      } else throw new Error((r && r.error) || "save failed");
    } catch (err) { toast("Save failed: " + err.message, "error"); }
  });
}

/* ---------------- 5-sec loading popup ---------------- */
let loaderSeq = 0;
function showLoader() {
  const pop = document.getElementById("loaderPop");
  const fill = document.getElementById("loaderFill");
  pop.hidden = false;
  fill.style.transition = "none";
  fill.style.width = "0%";
  void fill.offsetWidth; /* reflow taaki animation phir se chale */
  fill.style.transition = "width 5s linear";
  fill.style.width = "100%";
  return ++loaderSeq;
}
function hideLoader() {
  document.getElementById("loaderPop").hidden = true;
}
/* fn ko loading popup ke saath chalao — popup kam se kam 5 sec dikhega */
async function withLoader(fn) {
  const t0 = Date.now();
  const my = showLoader();
  try { return await fn(); }
  finally {
    const wait = Math.max(0, 5000 - (Date.now() - t0));
    setTimeout(() => { if (my === loaderSeq) hideLoader(); }, wait);
  }
}

/* ---------------- toast ---------------- */
function toast(msg, type = "ok") {
  let t = document.querySelector(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.className = "toast " + type;
  t.innerHTML = `<i class="fas ${type === "ok" ? "fa-check-circle" : "fa-exclamation-circle"}"></i>${esc(msg)}`;
  requestAnimationFrame(() => t.classList.add("show"));
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 4200);
}

/* functions called from inline onclick need global scope */
window.openMemberModal = openMemberModal;
window.deleteMember = deleteMember;
window.receiptWhatsApp = receiptWhatsApp;
window.openReceipt = openReceipt;
window.printReceipt = printReceipt;
window.saveReceiptJPG = saveReceiptJPG;
window.shareReceipt = shareReceipt;
window.openStaffModal = openStaffModal;
window.deleteStaff = deleteStaff;
window.setAtt = setAtt;
window.openPlanModal = openPlanModal;
window.deletePlan = deletePlan;
window.openTrainerModal = openTrainerModal;
window.deleteTrainer = deleteTrainer;
window.openWorkoutModal = openWorkoutModal;
