// eScript Dispensing — frontend logic.
// Pharmacist login gate → dispense screen. Same-origin Worker API, shared D1.

const $ = (id) => document.getElementById(id);

// Session token from the access-code gate. In-memory only — refresh clears it.
let sessionToken = null;

const api = (path, opts = {}) => {
  const headers = { ...(opts.headers || {}) };
  if (sessionToken) headers["Authorization"] = "Bearer " + sessionToken;
  return fetch(path, { ...opts, headers }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && sessionToken) forceReauth();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  });
};

function forceReauth() {
  sessionToken = null;
  pharmacist = null;
  $("appScreen").style.display = "none";
  $("loginScreen").style.display = "none";
  $("codeScreen").style.display = "block";
}

let pharmacist = null;
let currentRx = null;

// ---- Access-code gate (first) ---------------------------------------------

async function submitCode() {
  const code = $("accessCode").value;
  if (!code) { setMsg("codeMsg", "error", "Enter the access code."); return; }
  setMsg("codeMsg", "ok", "Checking…");
  try {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg("codeMsg", "error", data.error || "Incorrect access code"); return; }
    sessionToken = data.token;
    $("accessCode").value = "";
    setMsg("codeMsg", "ok", "");
    $("codeScreen").style.display = "none";
    $("loginScreen").style.display = "block";
    $("loginName").focus();
  } catch (e) {
    setMsg("codeMsg", "error", "Could not verify: " + e.message);
  }
}

// ---- Name login (second) --------------------------------------------------

function showApp() {
  $("loginScreen").style.display = "none";
  $("appScreen").style.display = "block";
  $("whoName").textContent = pharmacist;
  $("dispToken").focus();
}

function signIn() {
  const name = $("loginName").value.trim();
  if (!name) { setMsg("loginMsg", "error", "Enter your pharmacist name."); return; }
  pharmacist = name;
  showApp();
}

function signOut() {
  forceReauth();
  $("loginName").value = "";
  $("rxCard").style.display = "none";
  setMsg("loginMsg", "ok", "");
}

function setMsg(id, kind, text) {
  const el = $(id); el.className = "msg " + kind; el.textContent = text;
}

// ---- Lookup ---------------------------------------------------------------

function tokenValue() {
  return $("dispToken").value.trim().toUpperCase();
}

async function lookup() {
  const token = tokenValue();
  if (!token) return;
  try {
    currentRx = await api(`/api/token/${token}`);
    renderRx(currentRx);
    setMsg("dispenseMsg", "ok", "");
  } catch (e) {
    $("rxCard").style.display = "none";
    currentRx = null;
    setMsg("dispenseMsg", "error", e.message);
  }
}

function renderRx(rx) {
  const pill = rx.status === "dispensed" ? "status-dispensed" : "status-active";
  const allergies = rx.allergies?.length
    ? `<div class="line allergy">Allergies: ${rx.allergies.join(", ")}</div>` : "";
  $("rxToken").textContent = rx.token;
  $("rxBody").innerHTML =
    `<div class="line"><span class="status-pill ${pill}">${rx.status}</span></div>` +
    `<div class="line big">${rx.patient_name} <span style="font-weight:400;color:var(--muted)">DOB ${rx.dob}</span></div>` +
    allergies +
    `<div class="line">${rx.generic_name} ${rx.strength} ${rx.form}` +
      `${rx.brand_name ? ` (${rx.brand_name})` : ""}</div>` +
    `<div class="line">${rx.dose || ""} ${rx.frequency || ""}` +
      `${rx.duration ? " · " + rx.duration : ""} · Qty ${rx.quantity} · Repeats ${rx.repeats}</div>` +
    `${rx.indication ? `<div class="line" style="color:var(--muted)">Indication: ${rx.indication}</div>` : ""}` +
    `<div class="line" style="color:var(--muted)">Prescriber: ${rx.prescriber_name}</div>`;
  $("rxCard").style.display = "block";
}

// ---- Dispense -------------------------------------------------------------

async function dispense() {
  const token = tokenValue();
  if (!token) { setMsg("dispenseMsg", "error", "Enter a token first."); return; }
  try {
    const res = await api(`/api/dispense/${token}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pharmacist_name: pharmacist }),
    });
    setMsg("dispenseMsg", "ok", "Dispensed.");
    await lookup(); // refresh the card to show 'dispensed' status
    if (res.repeat_token) {
      const note = document.createElement("div");
      note.className = "repeat-note";
      note.innerHTML =
        `A repeat was generated. New token: <span class="rt">${res.repeat_token}</span><br>` +
        `<span style="color:var(--muted)">The patient keeps this for their next supply.</span>`;
      $("rxBody").appendChild(note);
    }
  } catch (e) {
    setMsg("dispenseMsg", "error", e.message);
  }
}

// ---- Wiring ---------------------------------------------------------------

$("codeBtn").onclick = submitCode;
$("loginBtn").onclick = signIn;
$("signoutBtn").onclick = signOut;
$("lookupBtn").onclick = lookup;
$("dispenseBtn").onclick = dispense;
$("accessCode").addEventListener("keydown", (e) => { if (e.key === "Enter") submitCode(); });
$("loginName").addEventListener("keydown", (e) => { if (e.key === "Enter") signIn(); });
$("dispToken").addEventListener("keydown", (e) => { if (e.key === "Enter") lookup(); });

// Always start at the access-code screen (no persistence across refresh).
