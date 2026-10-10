/* ============================================================
   assets/sheets.js — Data API layer  [v2]
   ------------------------------------------------------------
   Every data operation in the site goes through this file.

   SHEETS MODE  : if WEB_APP_URL is set in config.js, calls the
                  Google Apps Script Web App (Code.gs router).
   DEMO MODE    : if WEB_APP_URL is empty, uses a localStorage
                  backed store with the same function signatures,
                  so the UI works identically from file:// too.

   Convention: every API function resolves to { ok, data, error }.
   Actions are matched 1:1 by Code.gs doGet/doPost router.
   ============================================================ */

/* global WEB_APP_URL */

const ApiMode = { sheets: !!WEB_APP_URL, demo: !WEB_APP_URL };
const SYNC = { online: false, checkedAt: null }; // filled by ping()

/* ------------------ HTTP helpers (Sheets mode) ------------------ */
/* We POST with Content-Type: text/plain so Apps Script answers
   without triggering a CORS preflight (simple request). */

async function apiGet(action, params = {}) {
  if (ApiMode.demo) return demoGet(action, params);
  const qs = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${WEB_APP_URL}?${qs}`, { method: "GET" });
  return res.json();
}

async function apiPost(action, payload = {}) {
  if (ApiMode.demo) return demoPost(action, payload);
  const res = await fetch(WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload }),
  });
  return res.json();
}

/* ============================================================
   DEFAULT WEBSITE CONTENT (also used as demo seeds)
   Shared by index.html (app.js) and admin panel (admin.js).
   ============================================================ */
const SITE_DEFAULTS = {
  hero_line1: "Win That Battle",
  hero_line2: "In Your Mind",
  hero_typed: "Build Muscle.,Burn Fat.,Stay Disciplined.,Win The Battle In Your Mind.",
  whatsapp_msg: "*New Enquiry — Arnold's Gym*\n\nName: {name}\nMobile: {mobile}\nSubject: {subject}\nMessage: {message}",
  announcement: "New batches start every Monday — first trial session FREE!",
  gym_name: "Arnold's Gym",
};

/* ============================================================
   GYM NAME — single branding source (Settings → Gym Name)
   ------------------------------------------------------------
   gymNameOf(content)  → effective gym name from site content
   applyGymName(name)  → rewrites every "Arnold's Gym" occurrence
                         in title, text nodes and meta tags.
   Call it after dynamic content has rendered on each page.
   ============================================================ */
const DEFAULT_GYM_NAME = "Arnold's Gym";

const escBr = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function gymNameOf(content) {
  const n = String((content && content.gym_name) || "").trim();
  return n || DEFAULT_GYM_NAME;
}

function applyGymName(name) {
  name = String(name || "").trim();
  if (!name || name === DEFAULT_GYM_NAME) return;
  if (document.title) document.title = document.title.split(DEFAULT_GYM_NAME).join(name);
  if (document.body) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        const tag = p.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA" || tag === "INPUT") return NodeFilter.FILTER_REJECT;
        return node.nodeValue.indexOf(DEFAULT_GYM_NAME) !== -1 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => { node.nodeValue = node.nodeValue.split(DEFAULT_GYM_NAME).join(name); });
  }
  document.querySelectorAll('meta[name="description"], meta[property="og:description"]').forEach((m) => {
    const c = m.getAttribute("content") || "";
    if (c.indexOf(DEFAULT_GYM_NAME) !== -1) m.setAttribute("content", c.split(DEFAULT_GYM_NAME).join(name));
  });
  /* logos split the name across nodes: "Arnold's " + accented "Gym" */
  document.querySelectorAll(".logo").forEach((logo) => {
    const norm = logo.textContent.replace(/\s+/g, " ").trim();
    if (norm !== DEFAULT_GYM_NAME && norm !== name) return;
    const words = String(name).split(/\s+/).filter(Boolean);
    const last = words.pop() || name;
    const first = words.join(" ");
    const span = logo.querySelector("span");
    const cls = span && span.getAttribute("class") ? ` class="${span.getAttribute("class")}"` : "";
    const style = span && span.getAttribute("style") ? ` style="${span.getAttribute("style")}"` : "";
    logo.innerHTML = `${escBr(first + (first ? " " : ""))}<span${cls}${style}>${escBr(last)}</span>`;
  });
}

const DEMO_PLANS = [
  { id: "plan-seed-1", name: "Monthly", price: "800", duration: "/month", facilities: "Full gym access\nGroup workout batches\nDiet chart guidance", popular: "no", active: "yes" },
  { id: "plan-seed-2", name: "Quarterly", price: "2000", duration: "/3 months", facilities: "Full gym access\nGroup workout batches\nPersonal diet chart\nMonthly body assessment", popular: "yes", active: "yes" },
  { id: "plan-seed-3", name: "Yearly", price: "7000", duration: "/year", facilities: "Everything in Quarterly\n2 personal training sessions\nPriority equipment access\nGym T-shirt free", popular: "no", active: "yes" },
];

const DEMO_TRAINERS = [
  { id: "tr-seed-1", name: "Md Ajim", role: "Head Trainer · Owner", photo: "assets/trainer-ajim.jpg", bio: "Muscle building, fat loss and strength coaching with daily motivation.", phone: "918789537734", active: "yes" },
  { id: "tr-seed-2", name: "Ahshan", role: "Fitness Trainer", photo: "assets/trainer-ahshan.jpeg", bio: "Disciplined workouts, nutrition guidance and body transformation coaching.", phone: "918789537734", active: "yes" },
  { id: "tr-seed-3", name: "Suryansh Pandey", role: "Strength Coach", photo: "", bio: "Powerlifting basics, conditioning and beginner-friendly strength programs.", phone: "918789537734", active: "yes" },
];

const DEMO_WORKOUTS = [
  {
    "slug": "chest",
    "title": "Chest Exercises",
    "cover": "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=1200&auto=format&fit=crop",
    "intro": "Bench Press, Incline Press and Chest Fly — build a wider, thicker chest with serious pushing power.",
    "details": "Bench Press\nIncline Dumbbell Press\nChest Fly\n45 min · All levels",
    "steps": "Warm up 5 minutes — arm circles, band pull-aparts and 10 easy push-ups\nFlat barbell bench press — 4 sets x 6–8 reps, rest 90 seconds\nIncline dumbbell press (30°) — 3 sets x 8–10 reps\nDumbbell chest fly — 3 sets x 12 reps, slow and controlled\nPush-ups to near failure — 2 sets to finish the chest\nCool down — doorway chest stretch, 30 seconds per side",
    "donts": "Don't bounce the bar off your chest — control every rep\nDon't flare elbows to 90° — keep them near 45° to protect shoulders\nDon't lift heavy bench without a spotter\nDon't arch your lower back excessively off the bench",
    "notes": "Squeeze the chest hard at the top of every rep.\nKeep feet flat on the floor and shoulder blades pinched back.\nAdd weight only when all sets feel clean.",
    "active": "yes",
    "id": "wo-seed-chest"
  },
  {
    "slug": "biceps",
    "title": "Biceps Exercises",
    "cover": "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=1200&auto=format&fit=crop",
    "intro": "Dumbbell Curl, Barbell Curl and Hammer Curl — build peaked, stronger biceps.",
    "details": "Dumbbell Curl\nBarbell Curl\nHammer Curl\n35 min · All levels",
    "steps": "Warm up — 2 minutes of light arm circles and band curls\nStanding barbell curl — 4 sets x 8–10 reps\nSeated dumbbell curl — 3 sets x 10–12 reps per arm\nHammer curl — 3 sets x 12 reps for forearms and brachialis\nConcentration curl — 2 sets x 12 reps, slow negatives\nStretch biceps — wall stretch 30 seconds per arm",
    "donts": "Don't swing your torso to lift the weight — no momentum\nDon't let elbows drift forward past your ribs\nDon't use a weight you can't curl for at least 8 clean reps\nDon't train biceps the day before heavy back day",
    "notes": "Lower the weight slowly — 2–3 seconds down builds more muscle.\nKeep elbows pinned to your sides through every rep.\nFull range of motion beats heavy half-reps.",
    "active": "yes",
    "id": "wo-seed-biceps"
  },
  {
    "slug": "triceps",
    "title": "Triceps Exercises",
    "cover": "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?q=80&w=1200&auto=format&fit=crop",
    "intro": "Triceps Pushdown, Skull Crusher and Dips — triceps are two-thirds of your arm size. Build them.",
    "details": "Triceps Pushdown\nSkull Crusher\nDips\n35 min · All levels",
    "steps": "Warm up — push-up negatives and light pushdowns, 3 minutes\nRope triceps pushdown — 4 sets x 10–12 reps\nEZ-bar skull crusher — 3 sets x 10 reps, elbows fixed\nBench dips — 3 sets x 12–15 reps\nOverhead dumbbell extension — 2 sets x 12 reps for the long head\nStretch triceps overhead — 30 seconds per arm",
    "donts": "Don't let elbows flare out on pushdowns — tuck them in\nDon't go too heavy on skull crushers — the name is a warning\nDon't shrug your shoulders up; keep them down and back\nDon't lock out violently — control the top of every rep",
    "notes": "Pause 1 second at full extension and squeeze.\nTriceps recover fast — 60 seconds rest is enough.\nDips also hit the chest — lean slightly forward for triceps focus.",
    "active": "yes",
    "id": "wo-seed-triceps"
  },
  {
    "slug": "legs",
    "title": "Leg Exercises",
    "cover": "https://images.unsplash.com/photo-1434608519344-49d77a699e1d?q=80&w=1200&auto=format&fit=crop",
    "intro": "Squat, Leg Press, Lunges and Leg Extension — build powerful legs. Never skip leg day.",
    "details": "Squat\nLeg Press\nLunges\nLeg Extension\n50 min · All levels",
    "steps": "Warm up 5 minutes — brisk walk, leg swings, bodyweight squats\nBarbell back squat — 4 sets x 6–8 reps\nLeg press — 3 sets x 10–12 reps\nWalking lunges — 3 sets x 12 steps per leg\nLeg extension — 3 sets x 15 reps, squeeze at the top\nCool down — quad, hamstring and calf stretches, 5 minutes",
    "donts": "Don't let knees cave inward — push them out over your toes\nDon't round your lower back in the squat\nDon't lock knees fully on the leg press\nDon't skip warm-up sets before heavy squats",
    "notes": "Breathe in going down, brace hard and drive up.\nDepth matters — thighs at least parallel before adding weight.\nEat well after leg day — it's the most demanding session.",
    "active": "yes",
    "id": "wo-seed-legs"
  },
  {
    "slug": "shoulder",
    "title": "Shoulder Exercises",
    "cover": "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=1200&auto=format&fit=crop",
    "intro": "Shoulder Press, Lateral Raise and Front Raise — 3D delts, better posture, stronger press.",
    "details": "Shoulder Press\nLateral Raise\nFront Raise\n40 min · All levels",
    "steps": "Warm up 5 minutes — arm circles + band pull-aparts\nSeated dumbbell overhead press — 4 sets x 10 reps\nLateral raises — 3 sets x 12 reps\nFront raises — 3 sets x 12 reps\nFace pulls — 3 sets x 15 reps\nCool down — shoulder cross-body stretch for 5 minutes",
    "donts": "Don't shrug your traps up during lateral raises\nDon't go behind the neck on overhead press\nDon't use momentum — lift slow and controlled\nDon't train shoulders the day after heavy chest",
    "notes": "Rest 60–90 seconds between sets.\nShoulders are small muscles — lighter weights with perfect form win.\nStop immediately if you feel sharp joint pain.",
    "active": "yes",
    "id": "wo-seed-shoulder"
  },
  {
    "slug": "back",
    "title": "Back Exercises",
    "cover": "https://images.unsplash.com/photo-1605296867304-46d5465a13f1?q=80&w=1200&auto=format&fit=crop",
    "intro": "Lat Pulldown, Pull-up, Seated Row and Deadlift — build a wide, thick, strong back.",
    "details": "Lat Pulldown\nPull-up\nSeated Row\nDeadlift\n50 min · Intermediate",
    "steps": "Warm up — band pull-aparts and dead hangs, 5 minutes\nLat pulldown — 4 sets x 10 reps, chest up\nPull-ups (assisted if needed) — 3 sets x max reps\nSeated cable row — 3 sets x 12 reps, squeeze shoulder blades\nRomanian deadlift — 3 sets x 8 reps, hips back\nCool down — child's pose and lat stretch, 5 minutes",
    "donts": "Don't pull the bar behind your neck on pulldowns\nDon't round your back on deadlifts — ever\nDon't shrug with your traps; pull with your lats\nDon't use momentum — no swinging on rows",
    "notes": "Think 'elbows to ribs' to feel the lats working.\nDeadlift is king — but form first, weight second.\nA strong back fixes posture and protects your spine.",
    "active": "yes",
    "id": "wo-seed-back"
  },
  {
    "slug": "abs",
    "title": "Abs & Core Exercises",
    "cover": "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?q=80&w=1200&auto=format&fit=crop",
    "intro": "Crunches, Leg Raises, Plank and Russian Twists — build a strong, stable core.",
    "details": "Crunches\nLeg Raise\nPlank\nRussian Twist\n25 min · All levels",
    "steps": "Warm up — 2 minutes of marching in place + torso twists\nCrunches — 3 sets x 20 reps, slow and controlled\nLying leg raises — 3 sets x 15 reps, don't let heels touch the floor\nPlank hold — 3 sets x 45–60 seconds\nRussian twists — 3 sets x 20 total reps\nCool down — cobra stretch and child's pose",
    "donts": "Don't pull your neck on crunches — hands lightly behind ears\nDon't hold your breath — exhale on every crunch\nDon't sag your hips in the plank — squeeze glutes\nDon't train abs with heavy weights daily — they need rest too",
    "notes": "Quality over quantity — 15 perfect reps beat 50 sloppy ones.\nVisible abs are made in the kitchen — pair this with clean eating.\nTrain core 3–4 times a week, not every day.",
    "active": "yes",
    "id": "wo-seed-abs"
  },
  {
    "slug": "cardio",
    "title": "Cardio Exercises",
    "cover": "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?q=80&w=1200&auto=format&fit=crop",
    "intro": "Running, Cycling, Treadmill and Jump Rope — burn fat, boost stamina, strengthen your heart.",
    "details": "Running\nCycling\nTreadmill\nJump Rope\n30 min · All levels",
    "steps": "Warm up — 5 minutes easy walk or slow pedalling\nTreadmill run — 10 minutes, conversational pace\nStationary cycling — 8 minutes, moderate resistance\nJump rope intervals — 6 rounds of 45 seconds on / 15 off\nCool down — 5 minutes slow walk + deep breathing\nStretch calves, quads and hamstrings",
    "donts": "Don't sprint on day one — build base fitness first\nDon't do hard cardio right before heavy lifting\nDon't skip the cool-down — dizziness is common otherwise\nDon't wear flat unsupportive shoes for running",
    "notes": "You should be able to speak short sentences — that's the right intensity.\n2–3 cardio sessions a week is the sweet spot for fat loss.\nHydrate before, during and after.",
    "active": "yes",
    "id": "wo-seed-cardio"
  },
  {
    "slug": "fullbody",
    "title": "Full Body Exercises",
    "cover": "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1200&auto=format&fit=crop",
    "intro": "Burpees, Mountain Climbers and Kettlebell Swings — maximum calories, minimum time.",
    "details": "Burpees\nMountain Climbers\nKettlebell Swing\n30 min · Intermediate",
    "steps": "Warm up — jumping jacks and arm circles, 4 minutes\nBurpees — 4 rounds x 10 reps, rest 60 seconds\nMountain climbers — 3 rounds x 40 seconds\nKettlebell swings — 4 sets x 15 reps, hips explosive\nBodyweight squat to press — 3 sets x 12 reps\nCool down — full-body stretch, 5 minutes",
    "donts": "Don't round your back on kettlebell swings — hinge at hips\nDon't skip rest between rounds — form breaks down fast\nDon't do full-body HIIT on consecutive days\nDon't hold your breath during burpees",
    "notes": "Keep a water bottle nearby — this is intense.\nScale down (no-push-up burpees) if you're a beginner.\nGreat for fat loss — pair with a calorie-aware diet.",
    "active": "yes",
    "id": "wo-seed-fullbody"
  },
  {
    "slug": "flexibility",
    "title": "Flexibility & Mobility",
    "cover": "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=1200&auto=format&fit=crop",
    "intro": "Stretching, Hip Mobility and Shoulder Mobility — move better, recover faster, avoid injury.",
    "details": "Full-body Stretching\nHip Mobility\nShoulder Mobility\n20 min · All levels",
    "steps": "Start with 2 minutes of gentle marching to warm joints\nHip flexor stretch — 60 seconds per side\nDeep squat hold — 60 seconds, heels down\nShoulder dislocates with band/towel — 15 slow reps\nCat-cow + thoracic rotations — 10 reps each\nFinish with 2 minutes of deep breathing in child's pose",
    "donts": "Don't bounce into stretches — ease in and hold\nDon't stretch cold muscles aggressively\nDon't force a joint past sharp pain — mild pull only\nDon't rush — 10 focused minutes beats 30 distracted ones",
    "notes": "Do this after workouts or on rest days.\nConsistency beats intensity — daily 10 minutes transforms mobility.\nBreathe deeply into every stretch.",
    "active": "yes",
    "id": "wo-seed-flexibility"
  },
  {
    "slug": "functional",
    "title": "Functional Training",
    "cover": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1200&auto=format&fit=crop",
    "intro": "Battle Ropes, Sled Push and Farmer Walk — real-world strength that carries into daily life.",
    "details": "Battle Rope\nSled Push\nFarmer Walk\n35 min · Intermediate",
    "steps": "Warm up — 5 minutes: jog, arm circles, hip openers\nBattle rope waves — 6 rounds x 30 seconds, rest 30\nSled push — 5 rounds x 20 meters, heavy\nFarmer walk — 4 rounds x 40 meters, heavy dumbbells\nBox step-ups with weight — 3 sets x 10 per leg\nCool down — walk + stretch, 5 minutes",
    "donts": "Don't round your back on sled pushes or farmer walks\nDon't use ropes too heavy to keep waves going\nDon't look down during farmer walks — eyes forward\nDon't skip grip training — it's the point of farmer walks",
    "notes": "Functional training builds strength you actually use.\nKeep rest short — this doubles as cardio.\nStart light on the sled; heavy comes with practice.",
    "active": "yes",
    "id": "wo-seed-functional"
  },
  {
    "slug": "strength",
    "title": "Strength & Power Training",
    "cover": "https://images.unsplash.com/photo-1599058917212-d750089bc07e?q=80&w=1200&auto=format&fit=crop",
    "intro": "Deadlift, Olympic Squat and Clean & Press — build raw, total-body power.",
    "details": "Deadlift\nOlympic Squat\nClean & Press\n55 min · Advanced",
    "steps": "Warm up — 5 min cardio + empty-bar sets of each lift\nDeadlift — 5 sets x 5 reps, heavy, rest 3 minutes\nOlympic back squat — 4 sets x 5 reps, deep\nClean & press — 4 sets x 5 reps, explosive\nAccessory: pull-ups — 3 sets x max reps\nCool down — stretch hips, hamstrings, shoulders",
    "donts": "Don't max out every session — follow the sets and reps\nDon't deadlift with a rounded back — non-negotiable\nDon't skip warm-up sets on heavy compounds\nDon't train to failure on power lifts — leave 1–2 reps in reserve",
    "notes": "Rest 2–3 minutes between heavy sets — strength needs recovery.\nAdd a little weight each week — progressive overload is everything.\nSleep 7–8 hours — strength is built during recovery.",
    "active": "yes",
    "id": "wo-seed-strength"
  }
];

/* ------------------ Public API (same in both modes) ------------------ */
const api = {
  /* connection check */
  ping: () => apiGet("ping"),

  /* members */
  listMembers: () => apiGet("listMembers"),
  addMember: (m) => apiPost("addMember", { member: m }),
  updateMember: (id, m) => apiPost("updateMember", { id, member: m }),
  deleteMember: (id) => apiPost("deleteMember", { id }),
  findMember: (mobile) => apiGet("findMember", { mobile }),

  /* staff */
  listStaff: () => apiGet("listStaff"),
  addStaff: (s) => apiPost("addStaff", { staff: s }),
  updateStaff: (id, s) => apiPost("updateStaff", { id, staff: s }),
  deleteStaff: (id) => apiPost("deleteStaff", { id }),

  /* attendance */
  listAttendance: (date) => apiGet("listAttendance", { date }),
  saveAttendance: (date, rows) => apiPost("saveAttendance", { date, rows }),

  /* public forms */
  register: (r) => apiPost("register", { registration: r }),
  contact: (c) => apiPost("contact", { message: c }),

  /* ---- v2: generic website-content tabs ---- */
  readTab: (tab) => apiGet("readTab", { tab }),
  appendTabRow: (tab, row) => apiPost("appendTabRow", { tab, row }),
  updateTabRow: (tab, id, patch) => apiPost("updateTabRow", { tab, id, patch }),
  deleteTabRow: (tab, id) => apiPost("deleteTabRow", { tab, id }),

  /* site content (key/value) with defaults merged in */
  getSiteContent: async () => {
    const map = { ...SITE_DEFAULTS };
    try {
      const r = await api.readTab("SiteContent");
      ((r && r.ok && r.data) || []).forEach((x) => {
        if (x && x.key) map[x.key] = x.value ?? "";
      });
    } catch (e) { /* defaults stand */ }
    return map;
  },
  /* insert or update one content key */
  upsertSiteContent: async (key, value) => {
    const r = await api.readTab("SiteContent");
    const rows = (r && r.ok && r.data) || [];
    const ex = rows.find((x) => x.key === key);
    if (ex) return api.updateTabRow("SiteContent", ex.id, { value });
    return api.appendTabRow("SiteContent", { key, value });
  },
};

/* ------------------ Sync badge helper ------------------ */
/* Returns true if the Sheets backend answered. Safe to call
   anywhere; never throws. */
async function checkConnection() {
  try {
    const r = await api.ping();
    SYNC.online = !!(r && r.ok && r.data && r.data.service === "gym-api");
  } catch (e) {
    SYNC.online = false;
  }
  SYNC.checkedAt = new Date();
  document.dispatchEvent(new CustomEvent("gym:sync", { detail: { ...SYNC } }));
  return SYNC.online;
}

/* ============================================================
   DEMO MODE STORE (localStorage)
   ============================================================ */
const LS_KEY = "gym_v2_demo_db_v2";

/* tab name → demo-db collection key */
const DEMO_TABS = { SiteContent: "siteContent", Plans: "plans", Trainers: "trainers", Workouts: "workouts" };

function demoSeed() {
  return {
    members: [
      { id: "m-seed-1", name: "Ravi Verma", email: "ravi@example.com", mobile: "9876543210", plan: "Monthly", payment: 800, validity: "2026-11-05", created: "2026-10-06T08:00:00" },
      { id: "m-seed-2", name: "Suresh Yadav", email: "suresh@example.com", mobile: "9876543211", plan: "Quarterly", payment: 2000, validity: "2027-01-06", created: "2026-10-06T08:00:00" },
      { id: "m-seed-3", name: "Pooja Kumari", email: "pooja@example.com", mobile: "9876543212", plan: "Yearly", payment: 7000, validity: "2026-10-12", created: "2026-10-06T08:00:00" },
    ],
    staff: [
      { id: "s-seed-1", name: "Rahul Sharma", role: "Trainer", salary: 25000 },
      { id: "s-seed-2", name: "Amit Kumar", role: "Manager", salary: 35000 },
      { id: "s-seed-3", name: "Rohit Singh", role: "Trainer", salary: 24000 },
    ],
    attendance: {}, // { "2026-10-06": [ {name, status}, ... ] }
    registrations: [],
    contacts: [],
    /* --- v2 website content seeds --- */
    siteContent: Object.entries(SITE_DEFAULTS).map(([key, value], i) => ({ id: "sc-seed-" + i, key, value })),
    plans: DEMO_PLANS.map((p) => ({ ...p })),
    trainers: DEMO_TRAINERS.map((t) => ({ ...t })),
    workouts: DEMO_WORKOUTS.map((w) => ({ ...w })),
  };
}

function demoDb() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* fall through to seed */ }
  const seed = demoSeed();
  localStorage.setItem(LS_KEY, JSON.stringify(seed));
  return seed;
}

function demoSave(db) {
  localStorage.setItem(LS_KEY, JSON.stringify(db));
}

const uid = () => "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);

function demoGet(action, params = {}) {
  const db = demoDb();
  switch (action) {
    case "ping": return Promise.resolve({ ok: true, data: { service: "gym-api-demo", message: "Demo mode (localStorage)" } });
    case "listMembers": return Promise.resolve({ ok: true, data: db.members });
    case "findMember": {
      const digits = String(params.mobile || "").replace(/\D/g, "").slice(-10);
      const hits = db.members.filter((m) => String(m.mobile || "").replace(/\D/g, "").slice(-10) === digits);
      hits.sort((a, b) => String(b.validity || "").localeCompare(String(a.validity || "")));
      const hit = hits[0];
      if (!hit) return Promise.resolve({ ok: false, error: "Member not found" });
      const { photo, ...rest } = hit;
      return Promise.resolve({ ok: true, data: rest });
    }
    case "listStaff": return Promise.resolve({ ok: true, data: db.staff });
    case "listAttendance":
      return Promise.resolve({ ok: true, data: db.attendance[params.date] || [] });
    case "readTab": {
      const col = DEMO_TABS[params.tab];
      if (!col) return Promise.resolve({ ok: false, error: "Unknown tab: " + params.tab });
      return Promise.resolve({ ok: true, data: db[col] || [] });
    }
    default: return Promise.resolve({ ok: false, error: "Unknown action: " + action });
  }
}

function demoPost(action, payload = {}) {
  const db = demoDb();
  const tabCol = (tab) => {
    const col = DEMO_TABS[tab];
    if (!col) return null;
    if (!db[col]) db[col] = [];
    return db[col];
  };
  switch (action) {
    case "addMember": {
      const member = { id: uid(), created: new Date().toISOString(), ...payload.member };
      db.members.push(member); demoSave(db);
      return Promise.resolve({ ok: true, data: member });
    }
    case "updateMember": {
      const i = db.members.findIndex((m) => m.id === payload.id);
      if (i < 0) return Promise.resolve({ ok: false, error: "Member not found" });
      db.members[i] = { ...db.members[i], ...payload.member }; demoSave(db);
      return Promise.resolve({ ok: true, data: db.members[i] });
    }
    case "deleteMember": {
      db.members = db.members.filter((m) => m.id !== payload.id); demoSave(db);
      return Promise.resolve({ ok: true, data: { id: payload.id } });
    }
    case "addStaff": {
      const staff = { id: uid(), ...payload.staff };
      db.staff.push(staff); demoSave(db);
      return Promise.resolve({ ok: true, data: staff });
    }
    case "updateStaff": {
      const i = db.staff.findIndex((s) => s.id === payload.id);
      if (i < 0) return Promise.resolve({ ok: false, error: "Staff not found" });
      db.staff[i] = { ...db.staff[i], ...payload.staff }; demoSave(db);
      return Promise.resolve({ ok: true, data: db.staff[i] });
    }
    case "deleteStaff": {
      db.staff = db.staff.filter((s) => s.id !== payload.id); demoSave(db);
      return Promise.resolve({ ok: true, data: { id: payload.id } });
    }
    case "saveAttendance": {
      db.attendance[payload.date] = payload.rows; demoSave(db);
      return Promise.resolve({ ok: true, data: { date: payload.date, count: payload.rows.length } });
    }
    case "register": {
      const r = { id: uid(), created: new Date().toISOString(), ...payload.registration };
      db.registrations.push(r); demoSave(db);
      return Promise.resolve({ ok: true, data: r });
    }
    case "contact": {
      const c = { id: uid(), created: new Date().toISOString(), ...payload.message };
      db.contacts.push(c); demoSave(db);
      return Promise.resolve({ ok: true, data: c });
    }
    /* --- v2 generic tab writers --- */
    case "appendTabRow": {
      const col = tabCol(payload.tab);
      if (!col) return Promise.resolve({ ok: false, error: "Unknown tab: " + payload.tab });
      const row = { id: uid(), ...(payload.row || {}) };
      col.push(row); demoSave(db);
      return Promise.resolve({ ok: true, data: row });
    }
    case "updateTabRow": {
      const col = tabCol(payload.tab);
      if (!col) return Promise.resolve({ ok: false, error: "Unknown tab: " + payload.tab });
      const i = col.findIndex((x) => String(x.id) === String(payload.id));
      if (i < 0) return Promise.resolve({ ok: false, error: "Record not found" });
      col[i] = { ...col[i], ...(payload.patch || {}) }; demoSave(db);
      return Promise.resolve({ ok: true, data: col[i] });
    }
    case "deleteTabRow": {
      const col = tabCol(payload.tab);
      if (!col) return Promise.resolve({ ok: false, error: "Unknown tab: " + payload.tab });
      db[DEMO_TABS[payload.tab]] = col.filter((x) => String(x.id) !== String(payload.id));
      demoSave(db);
      return Promise.resolve({ ok: true, data: { id: payload.id } });
    }
    default: return Promise.resolve({ ok: false, error: "Unknown action: " + action });
  }
}
