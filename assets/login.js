/* ============================================================
   assets/login.js — admin login (client-side demo auth)
   Same credentials as the original site.
   On success: sets a session flag + redirects to admin.html.
   ============================================================ */

/* Demo credentials (same as the original Arnold's Gym site) */
const ADMIN_EMAIL = "ajimm4416@gmail.com";
const ADMIN_PASSWORD = "Ajim123";

document.addEventListener("DOMContentLoaded", () => {
  // Already logged in? skip straight to dashboard
  if (sessionStorage.getItem("gym_admin") === "1") {
    window.location.href = "admin.html";
    return;
  }

  const form = document.getElementById("loginForm");
  const err = document.getElementById("loginErr");
  const pw = document.getElementById("password");
  const pwToggle = document.getElementById("pwToggle");

  pwToggle.addEventListener("click", () => {
    const show = pw.type === "password";
    pw.type = show ? "text" : "password";
    pwToggle.innerHTML = show ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const pass = pw.value.trim();

    if (email === ADMIN_EMAIL && pass === ADMIN_PASSWORD) {
      sessionStorage.setItem("gym_admin", "1");
      window.location.href = "admin.html";
    } else {
      err.classList.add("show");
      setTimeout(() => err.classList.remove("show"), 3500);
    }
  });
});
