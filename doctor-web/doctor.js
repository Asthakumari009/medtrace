"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const gate = $("gate"), records = $("records"), open = $("open");
  let token = location.hash.slice(1) || location.pathname.split("/").pop();
  let viewer = null, generation = 0, timer = null, watchdog = null, deadline = 0, stripe = false;
  let busy = false;
  function scrub() {
    records.hidden = true;
    records.className = "";
    $("patient").textContent = "";
    $("meta").textContent = "";
    $("reports").replaceChildren();
  }
  function stop(message, terminal = true) {
    generation++;
    clearTimeout(timer); clearTimeout(watchdog);
    scrub(); gate.hidden = false; busy = false;
    $("status").textContent = terminal ? "This view is locked." : "Your view is paused.";
    $("message").textContent = message;
    if (terminal) { viewer = null; token = null; }
    open.hidden = terminal;
    open.disabled = false;
    open.textContent = "Verify access and resume";
  }
  // Production round trips (Vercel function + Supabase) measure 0.5-1s warm and
  // 3s+ cold. The old 650ms timeout / 900ms lease locked every live view within
  // a second or two of opening it -- the "access revokes itself" bug. Revocation
  // still locks on the next check (POLL_MS + one round trip); only a dropped
  // connection waits out the lease.
  const POLL_MS = 1000, CHECK_TIMEOUT_MS = 6000, MAX_LEASE_MS = 15000;
  const LOST = "Connection lost. Records have been cleared. Ask the patient for a new share.";
  async function post(path, body, timeout = CHECK_TIMEOUT_MS) {
    const controller = new AbortController();
    const cancel = setTimeout(() => controller.abort(), timeout);
    let r;
    try {
      r = await fetch(path, { method: "POST", cache: "no-store", credentials: "omit",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
    } catch { throw new Error(LOST); } finally { clearTimeout(cancel); }
    if (!r.ok) throw new Error(r.status === 410 ? "Access was revoked, replaced, used, or has expired. Ask the patient for a new share." : "Access could not be verified. Ask the patient for a new share.");
    return await r.json();
  }
  function text(tag, value, className) {
    const el = document.createElement(tag);
    el.textContent = value == null ? "" : String(value);
    if (className) el.className = className;
    return el;
  }
  function byline(report) {
    const who = [report.doctor_name, report.facility_name].filter(Boolean).join(" · ");
    const when = report.report_date || "Report date not recorded";
    return who ? `${when} · ${who}` : when;
  }
  function display(data) {
    $("patient").textContent = data.patient_name || "Patient records";
    $("meta").textContent = `${data.reports.length} selected report${data.reports.length === 1 ? "" : "s"} · Shared for ${data.recipient_label}`;
    for (const report of data.reports) {
      const article = text("article", "", "report");
      article.append(text("h2", report.title), text("p", byline(report)));
      // Conditions and drugs come before the numbers: it is what a clinician
      // scans for first. Everything goes in via textContent -- this is OCR'd
      // text off a patient's document and is never trusted as markup.
      for (const name of report.diagnoses || []) {
        article.append(text("div", name, "diagnosis"));
      }
      for (const med of report.medications || []) {
        const row = text("div", "", "medication");
        const detail = [med.dose, med.frequency, med.duration].filter(Boolean).join(" · ");
        row.append(text("div", med.name, "name"), text("div", detail || "No dose recorded", "range"));
        article.append(row);
      }
      for (const obs of report.observations) {
        const row = text("div", "", "observation");
        const name = text("div", obs.test_name, "name");
        if (obs.flagged) name.append(text("span", "Flagged in extracted report", "flag"));
        const value = text("div", obs.value, "value");
        value.append(text("span", ` ${obs.unit || ""}`, "unit"));
        row.append(name, value, text("div", `Reference: ${obs.reference_range || "Not provided"}`, "range"));
        article.append(row);
      }
      if (!report.observations.length && !(report.medications || []).length && !(report.diagnoses || []).length)
        article.append(text("p", "No extracted values. Review the original with the patient."));
      $("reports").append(article);
    }
  }
  async function renew(epoch) {
    const start = performance.now();
    const result = await post("/share/session", viewer);
    if (epoch !== generation || document.hidden) return false;
    // Anchor the lease to request START. A delayed pre-revocation response
    // cannot extend access for another full lease after it arrives.
    const lease = Math.min(MAX_LEASE_MS, Number(result.lease_ms));
    const remaining = start + lease - performance.now();
    if (result.active !== true || !Number.isFinite(remaining) || remaining <= 0) throw new Error("The access check took too long. Ask the patient for a new share.");
    deadline = start + lease;
    clearTimeout(watchdog);
    watchdog = setTimeout(() => stop(LOST), remaining);
    stripe = !stripe;
    records.style.animationDuration = `${remaining}ms`;
    records.className = `leased lease-${stripe ? "a" : "b"}`;
    return true;
  }
  async function poll(epoch) {
    try {
      if (await renew(epoch)) timer = setTimeout(() => poll(epoch), POLL_MS);
    } catch (e) {
      if (epoch === generation) stop(e.message);
    }
  }
  open.addEventListener("click", async () => {
    if (busy || document.hidden) return;
    busy = true; open.disabled = true;
    $("message").textContent = "Checking the patient's permission…";
    const epoch = ++generation;
    try {
      if (!viewer) {
        const grant = await post("/share/redeem", { token }, 8000);
        if (epoch !== generation) return;
        viewer = { share_id: grant.share_id, viewer_token: grant.viewer_token };
        token = null;
        history.replaceState(null, "", "/share/view");
      }
      let data = await post("/share/records", viewer, 10000);
      if (epoch !== generation || document.hidden) return;
      if (!await renew(epoch)) return;
      display(data); data = null;
      if (performance.now() >= deadline) throw new Error("Access verification timed out. Ask the patient for a new share.");
      records.hidden = false; gate.hidden = true; busy = false;
      timer = setTimeout(() => poll(epoch), POLL_MS);
    } catch (e) {
      if (epoch === generation) stop(e.message);
    }
  });
  $("close").addEventListener("click", () => stop("You ended this view. Ask the patient for a new share to open it again."));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop("Records were cleared while this page was away. Verify permission again to resume.", !viewer);
  });
  window.addEventListener("pagehide", () => stop("This view was closed. Ask the patient for a new share."));
  window.addEventListener("offline", () => stop("You are offline. Records have been cleared. Ask the patient for a new share."));
})();
