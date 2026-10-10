# Arnold's Gym v2 — Google Sheets Backend Setup Guide

**Time lagega:** ~10 minute | **Paise:** 0 (sab free)

Is guide ko follow karke aapki website ka data Google Sheet me save hoga —
members, staff, attendance, registrations, contact messages — sab kuch.

> **Note:** Bina setup ke bhi website chalegi — "Demo Mode" me data browser me
> save hota hai. Lekin asli backend ke liye neeche wale 5 steps karo.

---

## Step 1 — Google Sheet banao

1. [sheets.google.com](https://sheets.google.com) kholo (apne Google account se login karo).
2. **Blank spreadsheet** banao.
3. Naam rakho: `Arnold's Gym Database` (koi bhi naam chalega).
4. Tabs khud banane ki zaroorat **nahi** — pehli baar data aate hi Code.gs
   saare tabs aur headers **automatically** bana dega.

**Expected tabs (auto-created):**

| Tab | Columns (headers) |
|---|---|
| `Members` | id, name, payment, validity, email, mobile, plan, created |
| `Staff` | id, name, role, salary |
| `Attendance` | id, date, name, status |
| `Registrations` | id, name, email, mobile, gender, plan, password, created |
| `Contacts` | id, name, mobile, subject, message, created |

**v2 — Website content tabs (Admin panel se manage hote hain, auto-created):**

| Tab | Columns (headers) |
|---|---|
| `SiteContent` | id, key, value (hero text, WhatsApp template, announcement) |
| `Plans` | id, name, price, duration, facilities, popular, active |
| `Trainers` | id, name, role, photo, bio, phone, active |
| `Workouts` | id, slug, title, cover, intro, details, steps, donts, notes, active |

---

## Step 2 — Apps Script me Code.gs paste karo

1. Sheet ke andar upar menu me **Extensions → Apps Script** par click karo.
2. Ek naya tab khulega jisme `Code.gs` file hogi (kuch sample code ke saath).
3. Sample code **select karke delete** karo.
4. Project folder se **`Code.gs`** file kholo, poora code **copy** karo,
   aur Apps Script editor me **paste** karo.
5. Uppar **Save** (floppy disk icon) dabao. Project ka naam maange to
   `Arnold's Gym API` likh do.

---

## Step 3 — Web App ke roop me Deploy karo

1. Apps Script editor me upar-right **Deploy → New deployment** par click karo.
2. Gear icon (⚙) par click karke **"Web app"** select karo.
3. Settings:
   - **Description:** `Gym backend v1` (kuch bhi)
   - **Execute as:** `Me` (aapka Google account)
   - **Who has access:** **`Anyone`** ← ye sabse important hai!
4. **Deploy** dabao.
5. Google permission maangega → **Authorize access** → apna account chuno →
   "Google hasn't verified this app" dikhe to **Advanced → Go to Arnold's Gym API (unsafe)**
   → **Allow**. (Ye aapka khud ka script hai, isliye safe hai.)
6. Deploy hone ke baad ek **Web app URL** milega, kuch is tarah:
   `https://script.google.com/macros/s/AKfycbXXXXXXXXXXXX/exec`
7. **URL ko copy kar lo** — ye agle step me chahiye.

> **Important:** Baad me Code.gs me kuch change karo to dobara
> **Deploy → Manage deployments → Edit → New version** karke deploy karna padega.

---

## Step 4 — URL ko website me dalo

1. Project folder me **`assets/config.js`** file kholo.
2. Ye line milegi:

   ```js
   const WEB_APP_URL = ""; // <-- paste your Apps Script Web App URL here
   ```

3. Copy kiya hua URL quotes ke andar paste karo:

   ```js
   const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbXXXXXXXXXXXX/exec";
   ```

4. File **save** karo.

---

## Step 5 — Test karo

1. Website kholo (hosting par ya `index.html` double-click karke).
2. **Admin login** karo → email `ajimm4416@gmail.com`, password `Ajim123`.
3. Dashboard ke top-right me badge dekho:
   - **Green "Google Sheets connected"** = sab sahi hai! ✅
   - **Yellow "Demo mode"** = URL galat hai ya deploy me "Anyone" access nahi diya.
4. **Members → Add Member** se ek test member add karo.
5. Apni Google Sheet kholo — **`Members` tab** me nayi row dikhni chahiye.
6. Website par **Contact form** bharke bhejo — **`Contacts` tab** me row aani chahiye.

Sab green? Mubarak ho — aapka gym ab Google Sheets par chal raha hai!

---

## Common problems

| Problem | Solution |
|---|---|
| Badge yellow hi rehta hai | `config.js` me URL sahi paste hua? Deploy me "Who has access: Anyone" tha? URL `/exec` par end hota hai (not `/dev`)? |
| Permission error deploy me | Advanced → "Go to ... (unsafe)" → Allow (ye aapka khud ka script hai) |
| Code change ke baad kaam nahi karta | Manage deployments → Edit → **New version** select karke dobara Deploy |
| Sheet me duplicate tabs | Ek hi tab naam ke do sheet mat banao; extra tab delete kar do |
| `file://` se kholne par CORS error | Ye normal hai — file ko kisi hosting (GitHub Pages/Netlify) par daalo ya demo mode me test karo |

---

## Admin login (yaad rakho)

- **URL:** `login.html`
- **Email:** `ajimm4416@gmail.com`
- **Password:** `Ajim123`
