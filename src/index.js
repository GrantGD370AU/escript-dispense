/**
 * eScript Training Emulator — Cloudflare Worker
 *
 * Ported from the Flask/SQLite original. Single Worker serves both the JSON API
 * (/api/*) and the static frontend (everything else, via the ASSETS binding).
 *
 * SIMULATION ONLY — NOT A VALID PRESCRIPTION. No connection to Medicare, PBS,
 * the HI Service, NPDS or any real Active Script List.
 */

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function nowIso() {
  return new Date().toISOString();
}

// Token format mirrors the original: ESIM-<12 hex chars, uppercase>
function makeToken() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return "ESIM-" + hex.toUpperCase();
}

// Re-hydrate JSON-encoded text columns, matching the Flask row_json() helper.
function rowJson(row) {
  if (!row) return row;
  const out = { ...row };
  for (const key of ["allergies", "conditions", "current_medicines", "teaching_points"]) {
    if (typeof out[key] === "string") {
      try {
        out[key] = JSON.parse(out[key]);
      } catch {
        /* leave as-is */
      }
    }
  }
  return out;
}

async function audit(env, eventType, entityId, details) {
  await env.DB.prepare(
    "INSERT INTO audit_log(event_type, entity_id, details, created_at) VALUES(?, ?, ?, ?)"
  )
    .bind(eventType, entityId, JSON.stringify(details), nowIso())
    .run();
}

// ---- API handlers ---------------------------------------------------------

async function getPatients(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM patients ORDER BY name"
  ).all();
  return json(results.map(rowJson));
}

async function getMedicines(env, url) {
  const q = (url.searchParams.get("q") || "").trim();
  let stmt;
  if (q) {
    const like = `%${q}%`;
    stmt = env.DB.prepare(
      "SELECT * FROM medicines WHERE generic_name LIKE ? OR brand_name LIKE ? ORDER BY generic_name LIMIT 100"
    ).bind(like, like);
  } else {
    stmt = env.DB.prepare(
      "SELECT * FROM medicines ORDER BY generic_name LIMIT 100"
    );
  }
  const { results } = await stmt.all();
  return json(results);
}

async function getScenarios(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM scenarios ORDER BY id"
  ).all();
  return json(results.map(rowJson));
}

async function createPrescription(env, request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const required = [
    "patient_id",
    "medicine_id",
    "dose",
    "frequency",
    "quantity",
    "prescriber_name",
  ];
  const missing = required.filter((k) => !payload[k]);
  if (missing.length) {
    return json({ error: `Missing: ${missing.join(", ")}` }, 400);
  }

  const token = makeToken();
  const result = await env.DB.prepare(
    `INSERT INTO prescriptions(
       patient_id, medicine_id, dose, route, frequency, duration, quantity, repeats,
       indication, pbs_status, prescriber_name, status, token, created_at
     ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )
    .bind(
      payload.patient_id,
      payload.medicine_id,
      payload.dose,
      payload.route || "",
      payload.frequency,
      payload.duration || "",
      parseInt(payload.quantity, 10),
      parseInt(payload.repeats ?? 0, 10),
      payload.indication || "",
      payload.pbs_status || "Private",
      payload.prescriber_name,
      "active",
      token,
      nowIso()
    )
    .run();

  const rxId = result.meta.last_row_id;
  await audit(env, "prescription_created", rxId, { token });

  return json({ id: rxId, token, qr_url: `/api/token/${token}/qr` }, 201);
}

async function getToken(env, token) {
  const row = await env.DB.prepare(
    `SELECT p.*, pt.name AS patient_name, pt.dob, pt.allergies,
            m.generic_name, m.brand_name, m.strength, m.form
       FROM prescriptions p
       JOIN patients pt ON pt.id = p.patient_id
       JOIN medicines m ON m.id = p.medicine_id
      WHERE p.token = ?`
  )
    .bind(token)
    .first();

  if (!row) return json({ error: "Token not found" }, 404);
  return json(rowJson(row));
}

/**
 * QR endpoint. The original generated a PNG server-side with Pillow, which isn't
 * available on Workers. Instead this returns the QR *payload* as JSON and the
 * frontend renders the QR client-side. The payload string is identical to the
 * original: "ESIM://RX/<token>".
 */
async function getTokenQr(env, token) {
  const exists = await env.DB.prepare(
    "SELECT 1 AS ok FROM prescriptions WHERE token = ?"
  )
    .bind(token)
    .first();
  if (!exists) return json({ error: "Token not found" }, 404);
  return json({ token, qr_payload: `ESIM://RX/${token}` });
}

async function dispense(env, request, token) {
  let payload = {};
  try {
    payload = (await request.json()) || {};
  } catch {
    payload = {};
  }
  const pharmacist = payload.pharmacist_name || "Simulation Pharmacist";

  const rx = await env.DB.prepare(
    "SELECT * FROM prescriptions WHERE token = ?"
  )
    .bind(token)
    .first();

  if (!rx) return json({ error: "Token not found" }, 404);
  if (rx.status !== "active") {
    return json({ error: `Prescription is ${rx.status}` }, 409);
  }

  await env.DB.prepare(
    "UPDATE prescriptions SET status='dispensed', dispensed_at=? WHERE id=?"
  )
    .bind(nowIso(), rx.id)
    .run();
  await audit(env, "dispensed", rx.id, { pharmacist });

  let repeatToken = null;
  if (rx.repeats > 0) {
    repeatToken = makeToken();
    await env.DB.prepare(
      `INSERT INTO prescriptions(
         patient_id, medicine_id, dose, route, frequency, duration, quantity, repeats,
         indication, pbs_status, prescriber_name, status, token, created_at, parent_prescription_id
       ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
      .bind(
        rx.patient_id,
        rx.medicine_id,
        rx.dose,
        rx.route,
        rx.frequency,
        rx.duration,
        rx.quantity,
        rx.repeats - 1,
        rx.indication,
        rx.pbs_status,
        rx.prescriber_name,
        "active",
        repeatToken,
        nowIso(),
        rx.id
      )
      .run();
  }

  return json({
    status: "dispensed",
    repeat_token: repeatToken,
    repeat_qr_url: repeatToken ? `/api/token/${repeatToken}/qr` : null,
  });
}

async function getAudit(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM audit_log ORDER BY id DESC LIMIT 200"
  ).all();
  return json(results);
}

/**
 * Reset clears the working tables. Unlike the original (which deleted the SQLite
 * file), we truncate the mutable tables and leave the seeded reference data —
 * D1 has no file to unlink. Seed data is reinstated only if patients is empty.
 */
async function reset(env) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM prescriptions"),
    env.DB.prepare("DELETE FROM audit_log"),
  ]);
  return json({ status: "reset" });
}

// ---- Router ---------------------------------------------------------------

async function handleApi(request, env, url) {
  const path = url.pathname;
  const method = request.method;

  if (method === "GET" && path === "/api/patients") return getPatients(env);
  if (method === "GET" && path === "/api/medicines") return getMedicines(env, url);
  if (method === "GET" && path === "/api/scenarios") return getScenarios(env);
  if (method === "POST" && path === "/api/prescriptions")
    return createPrescription(env, request);
  if (method === "GET" && path === "/api/audit") return getAudit(env);
  if (method === "POST" && path === "/api/reset") return reset(env);

  // /api/token/<token> and /api/token/<token>/qr
  const tokenMatch = path.match(/^\/api\/token\/([^/]+)(\/qr)?$/);
  if (tokenMatch) {
    const token = decodeURIComponent(tokenMatch[1]);
    if (tokenMatch[2]) {
      if (method === "GET") return getTokenQr(env, token);
    } else if (method === "GET") {
      return getToken(env, token);
    }
  }

  // /api/dispense/<token>
  const dispenseMatch = path.match(/^\/api\/dispense\/([^/]+)$/);
  if (dispenseMatch && method === "POST") {
    return dispense(env, request, decodeURIComponent(dispenseMatch[1]));
  }

  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        return json({ error: "Server error", detail: String(err) }, 500);
      }
    }

    // Everything else → static assets (frontend). Configured via the
    // [assets] binding in wrangler.toml.
    return env.ASSETS.fetch(request);
  },
};
