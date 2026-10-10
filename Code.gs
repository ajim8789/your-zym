/* ============================================================
   Code.gs — Arnold's Gym backend (Google Apps Script)  [v2]
   ------------------------------------------------------------
   SETUP: paste this whole file into a standalone Apps Script
   project (script.google.com → New project) OR into
   Extensions → Apps Script inside the Sheet, then
   Deploy → New deployment → Web app (Execute as: Me,
   Who has access: Anyone). Full steps: SETUP-GUIDE.md.

   API contract (matches assets/sheets.js):
     GET  ?action=ping
     GET  ?action=listMembers | listStaff | listAttendance&date=YYYY-MM-DD
     GET  ?action=findMember&mobile=9876543210 (website membership card lookup)
     GET  ?action=readTab&tab=Plans            (generic reader, v2)
     POST {action:"addMember", member:{...}}
     POST {action:"updateMember", id, member:{...}}
     POST {action:"deleteMember", id}
     POST {action:"addStaff"|"updateStaff"|"deleteStaff", ...}
     POST {action:"saveAttendance", date, rows:[{name,status}]}
     POST {action:"register", registration:{...}}
     POST {action:"contact", message:{...}}
     POST {action:"appendTabRow", tab, row:{...}}    (generic, v2)
     POST {action:"updateTabRow", tab, id, patch}    (generic, v2)
     POST {action:"deleteTabRow", tab, id}          (generic, v2)

   Every response: { ok:true, data:... } or { ok:false, error:... }
   ============================================================ */

/* ---------- tab schemas (auto-created with headers) ---------- */
const SCHEMAS = {
  Members:      ["id", "name", "payment", "validity", "email", "mobile", "plan", "created", "photo"],
  Staff:        ["id", "name", "role", "salary"],
  Attendance:   ["id", "date", "name", "status"],
  Registrations:["id", "name", "email", "mobile", "gender", "plan", "password", "created"],
  Contacts:     ["id", "name", "mobile", "subject", "message", "created"],
  /* --- v2: website content tabs (managed from Admin panel) --- */
  SiteContent:  ["id", "key", "value"],
  Plans:        ["id", "name", "price", "duration", "facilities", "popular", "active"],
  Trainers:     ["id", "name", "role", "photo", "bio", "phone", "active"],
  Workouts:     ["id", "slug", "title", "cover", "intro", "details", "steps", "donts", "notes", "active"],
};

/* ---------- spreadsheet binding ----------
   Fill SPREADSHEET_ID when using a STANDALONE script project
   (script.google.com → New project). Leave as "" when the script
   is container-bound (Extensions → Apps Script inside the Sheet). */
const SPREADSHEET_ID = "1Y7Yj1AxowhlVj_40Y_TyJZ2MVk72HfpOLBfKIAJNRR8";

function getSS() {
  return SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

/* ---------- sheet helpers ---------- */
function getSheet(tab) {
  const ss = getSS();
  let sh = ss.getSheetByName(tab);
  if (!sh) {
    sh = ss.insertSheet(tab);
    sh.appendRow(SCHEMAS[tab]);
    sh.setFrozenRows(1);
  } else {
    /* heal: append any schema columns added after the sheet was created
       (e.g. "photo" on Members) so old sheets keep working */
    const lastCol = Math.max(sh.getLastColumn(), 1);
    const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
    const missing = SCHEMAS[tab].filter(function (h) { return headers.indexOf(h) === -1; });
    if (missing.length) {
      sh.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
    }
  }
  return sh;
}

function headerMap(sh) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach((h, i) => { map[String(h).trim()] = i; });
  return map;
}

function rowsToObjects(tab) {
  const sh = getSheet(tab);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const values = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  return values.map((row) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function appendObject(tab, obj) {
  const sh = getSheet(tab);
  const headers = SCHEMAS[tab];
  sh.appendRow(headers.map((h) => (obj[h] !== undefined ? obj[h] : "")));
  return obj;
}

function findRowById(tab, id) {
  const sh = getSheet(tab);
  const map = headerMap(sh);
  const idCol = map["id"];
  if (idCol === undefined) return -1;
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const ids = sh.getRange(2, idCol + 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2; // 1-based row
  }
  return -1;
}

function updateObject(tab, id, patch) {
  const sh = getSheet(tab);
  const row = findRowById(tab, id);
  if (row < 0) throw new Error("Record not found: " + id);
  const map = headerMap(sh);
  Object.keys(patch).forEach((key) => {
    if (key === "id" || map[key] === undefined) return;
    sh.getRange(row, map[key] + 1).setValue(patch[key]);
  });
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const vals = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];
  const obj = {};
  headers.forEach((h, i) => { obj[h] = vals[i]; });
  return obj;
}

function deleteById(tab, id) {
  const sh = getSheet(tab);
  const row = findRowById(tab, id);
  if (row < 0) throw new Error("Record not found: " + id);
  sh.deleteRow(row);
  return { id: id };
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function nowISO() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

/* ============================================================
   GET router — reads + ping
   ============================================================ */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "ping";

    if (action === "ping") {
      return json({ ok: true, data: { service: "gym-api", message: "Gym API running" } });
    }

    if (action === "listMembers") {
      /* photo responses ko halka rakhne ke liye photo field nahi bhejte (speed) */
      const rows = rowsToObjects("Members").map(function (r) {
        return {
          id: r.id, name: r.name, payment: r.payment, validity: r.validity,
          email: r.email, mobile: r.mobile, plan: r.plan, created: r.created,
        };
      });
      return json({ ok: true, data: rows });
    }

    /* website "My Membership Card" lookup — sirf matched member, photo ke bina */
    if (action === "findMember") {
      const mobile = String((e.parameter && e.parameter.mobile) || "").replace(/\D/g, "").slice(-10);
      if (!mobile) return json({ ok: false, error: "Mobile number required" });
      const hits = rowsToObjects("Members").filter(function (r) {
        return String(r.mobile || "").replace(/\D/g, "").slice(-10) === mobile;
      });
      if (!hits.length) return json({ ok: false, error: "Member not found" });
      hits.sort(function (a, b) { return String(b.validity || "").localeCompare(String(a.validity || "")); });
      const m = hits[0];
      return json({
        ok: true,
        data: {
          id: m.id, name: m.name, payment: m.payment, validity: m.validity,
          mobile: m.mobile, plan: m.plan, created: m.created,
        },
      });
    }

    if (action === "listStaff") {
      return json({ ok: true, data: rowsToObjects("Staff") });
    }

    if (action === "listAttendance") {
      const date = e.parameter.date || "";
      const all = rowsToObjects("Attendance");
      const filtered = date ? all.filter((r) => String(r.date).slice(0, 10) === date) : all;
      return json({ ok: true, data: filtered });
    }

    /* --- v2 generic tab reader (website content) --- */
    if (action === "readTab") {
      const tab = (e.parameter && e.parameter.tab) || "";
      if (!SCHEMAS[tab]) return json({ ok: false, error: "Unknown tab: " + tab });
      return json({ ok: true, data: rowsToObjects(tab) });
    }

    return json({ ok: false, error: "Unknown action: " + action });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/* ============================================================
   POST router — writes
   ============================================================ */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const action = body.action || "";

    /* ----- members ----- */
    if (action === "addMember") {
      const m = body.member || {};
      const rec = appendObject("Members", {
        id: Utilities.getUuid(),
        name: m.name || "", payment: m.payment || "",
        validity: m.validity || "", email: m.email || "",
        mobile: m.mobile || "", plan: m.plan || "",
        created: nowISO(), photo: m.photo || "",
      });
      return json({ ok: true, data: rec });
    }
    if (action === "updateMember") {
      return json({ ok: true, data: updateObject("Members", body.id, body.member || {}) });
    }
    if (action === "deleteMember") {
      return json({ ok: true, data: deleteById("Members", body.id) });
    }

    /* ----- staff ----- */
    if (action === "addStaff") {
      const s = body.staff || {};
      const rec = appendObject("Staff", {
        id: Utilities.getUuid(), name: s.name || "",
        role: s.role || "", salary: s.salary || "",
      });
      return json({ ok: true, data: rec });
    }
    if (action === "updateStaff") {
      return json({ ok: true, data: updateObject("Staff", body.id, body.staff || {}) });
    }
    if (action === "deleteStaff") {
      return json({ ok: true, data: deleteById("Staff", body.id) });
    }

    /* ----- attendance (replace all rows for the date) ----- */
    if (action === "saveAttendance") {
      const date = body.date || "";
      const rows = body.rows || [];
      // remove existing rows for this date
      const sh = getSheet("Attendance");
      const map = headerMap(sh);
      const last = sh.getLastRow();
      if (last >= 2 && map["date"] !== undefined) {
        const dates = sh.getRange(2, map["date"] + 1, last - 1, 1).getValues();
        for (let i = dates.length - 1; i >= 0; i--) {
          if (String(dates[i][0]).slice(0, 10) === date) sh.deleteRow(i + 2);
        }
      }
      rows.forEach((r) => appendObject("Attendance", {
        id: Utilities.getUuid(), date: date, name: r.name, status: r.status,
      }));
      return json({ ok: true, data: { date: date, count: rows.length } });
    }

    /* ----- public forms ----- */
    if (action === "register") {
      const r = body.registration || {};
      const rec = appendObject("Registrations", {
        id: Utilities.getUuid(), name: r.name || "", email: r.email || "",
        mobile: r.mobile || "", gender: r.gender || "", plan: r.plan || "",
        password: r.password || "", created: nowISO(),
      });
      return json({ ok: true, data: { id: rec.id } });
    }
    if (action === "contact") {
      const c = body.message || {};
      const rec = appendObject("Contacts", {
        id: Utilities.getUuid(), name: c.name || "", mobile: c.mobile || "",
        subject: c.subject || "", message: c.message || "", created: nowISO(),
      });
      return json({ ok: true, data: { id: rec.id } });
    }

    /* --- v2 generic tab writers (website content) --- */
    if (action === "appendTabRow" || action === "updateTabRow" || action === "deleteTabRow") {
      const tab = body.tab || "";
      if (!SCHEMAS[tab]) return json({ ok: false, error: "Unknown tab: " + tab });
      if (action === "appendTabRow") {
        const rec = appendObject(tab, Object.assign({ id: Utilities.getUuid() }, body.row || {}));
        return json({ ok: true, data: rec });
      }
      if (action === "updateTabRow") {
        return json({ ok: true, data: updateObject(tab, body.id, body.patch || {}) });
      }
      return json({ ok: true, data: deleteById(tab, body.id) });
    }

    return json({ ok: false, error: "Unknown action: " + action });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}
