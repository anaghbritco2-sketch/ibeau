/**
 * IBEAU marklist cloud - Google Apps Script
 * Deploy as a Web app from the Google account whose Drive should keep the marklists.
 *
 * What it does
 *  - LOGIN   : checks e-mail + password against the "Users" tab of YOUR Google Sheet.
 *              Passwords are checked here on the server and never sent to the browser.
 *              A successful login returns a temporary session code plus the batches
 *              that user may open (the "Batch" cell of the Users row, checked against the
 *              "Batches" tab).
 *  - STUDENTS: lists the students of one batch ("Students" tab + students already saved).
 *  - SAVE    : stores each student in Drive  IBEAU Marklists / <Batch> / <RegNo> - <Name>.pdf + .json
 *              and adds / updates a row in the separate sheet "IBEAU Marklist Log".
 *  - SHARE   : makes a view-only PDF link of a report, used by the WhatsApp buttons.
 *  - FIND    : returns the saved marks for a register number inside the chosen batch.
 *
 * Every action except login needs a valid session, and works only on a batch the
 * logged-in user is allowed to open.
 */

/* ============ SETTINGS ============ */
// The ID of YOUR Google Sheet (the long text between /d/ and /edit in its address)
// It must have the tabs  Users (Email, Password, Batch)  and  Batches (Batch Name).
// Optional tab  Students  (Reg No, Name, Batch, Student Phone, Parent Phone, Place).
const SPREADSHEET_ID = "1i_5ETwHiNXf547vVW-izes_xMvOAPcZJjB3RVLm_VLs";

const FOLDER_NAME   = "IBEAU Marklists";
const SHEET_NAME    = "IBEAU Marklist Log";   // separate file made by this script (never holds passwords)
const SESSION_HOURS = 6;                      // 6 is the maximum Google allows
const MAX_FAILS     = 5;                      // wrong passwords before a 10-minute lock

/* ============ ENTRY POINTS ============ */
function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    const action = String(d.action || "");

    if (action === "login") return login_(d);

    const s = session_(d);
    if (!s) return out({ ok: false, error: "session" });

    if (action === "logout") {
      CacheService.getScriptCache().remove("s_" + d.session);
      return out({ ok: true });
    }

    const batch = String(d.batch || "");
    if (!batch || s.batches.indexOf(batch) < 0) {
      return out({ ok: false, error: "You are not allowed to use this batch." });
    }

    switch (action) {
      case "students": return students_(batch);
      case "lookup":   return lookup_(d, batch);
      case "save":     return saveStudent_(d, s, batch);
      case "share":    return share_(d, batch);
    }
    return out({ ok: false, error: "unknown action" });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function doGet() {
  // nothing is readable without logging in
  return out({ ok: true, message: "IBEAU marklist cloud is running" });
}

/* ============ LOGIN ============ */
function login_(d) {
  const email = String(d.email || "").trim().toLowerCase();
  const pw = String(d.password || "");
  if (!email || !pw) return out({ ok: false, error: "Enter your e-mail and password." });

  const cache = CacheService.getScriptCache();
  const failKey = "fail_" + email;
  if (Number(cache.get(failKey) || 0) >= MAX_FAILS) {
    return out({ ok: false, error: "Too many wrong attempts. Please try again in 10 minutes." });
  }

  const users = readTable_("Users");
  if (users === null) return out({ ok: false, error: "The 'Users' sheet was not found." });

  const u = users.find(o => String(o["email"] || "").trim().toLowerCase() === email);
  const stored = u ? String(u["password"] === undefined ? "" : u["password"]).trim() : "";
  if (!u || !stored || !passwordOk_(pw, stored)) {
    cache.put(failKey, String(Number(cache.get(failKey) || 0) + 1), 600);
    return out({ ok: false, error: "Wrong e-mail or password." });
  }
  cache.remove(failKey);

  const all = batchNames_();
  if (all === null) return out({ ok: false, error: "The 'Batches' sheet was not found." });
  const allowed = authorize_(pick_(u, ["batch", "batches"]), all);
  if (!allowed.length) return out({ ok: false, error: "No batch is assigned to this account." });

  const session = Utilities.getUuid() + Utilities.getUuid();
  cache.put("s_" + session, JSON.stringify({ email: email, batches: allowed }),
            Math.min(SESSION_HOURS, 6) * 3600);
  return out({ ok: true, session: session, email: email, batches: allowed });
}

function session_(d) {
  const key = String(d.session || "");
  if (key.length < 20) return null;
  const raw = CacheService.getScriptCache().get("s_" + key);
  return raw ? JSON.parse(raw) : null;
}

// password may be stored as plain text or as a SHA-256 hash (64 hex characters)
function passwordOk_(input, stored) {
  if (/^[a-f0-9]{64}$/i.test(stored)) return sha256_(input) === stored.toLowerCase();
  return input === stored;
}

function sha256_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ("0" + (b & 0xff).toString(16)).slice(-2); }).join("");
}

// Run this once from the editor to get the hash of a password, then paste the hash
// into the Password column instead of the real password.
function hashPassword() {
  Logger.log(sha256_("TYPE-THE-PASSWORD-HERE"));
}

// Users.Batch can hold one batch, several separated by comma / semicolon / new line, or ALL
function authorize_(cell, all) {
  const tokens = String(cell || "").split(/[,;\n]/)
    .map(function (t) { return t.trim().toLowerCase(); }).filter(Boolean);
  if (tokens.indexOf("all") >= 0 || tokens.indexOf("*") >= 0) return all.slice();
  return all.filter(function (b) { return tokens.indexOf(b.toLowerCase()) >= 0; });
}

function batchNames_() {
  const rows = readTable_("Batches");
  if (rows === null) return null;
  return rows.map(function (o) { return pick_(o, ["batch name", "batchname", "batch", "name"]); })
             .filter(Boolean);
}

/* ============ STUDENTS OF A BATCH ============ */
function students_(batch) {
  const list = [];
  const index = {};
  const key = function (reg, name) { return (reg || name).toLowerCase(); };
  const same = function (a) { return String(a).toLowerCase() === batch.toLowerCase(); };

  // 1) roster tab (optional)
  (readTable_("Students") || []).forEach(function (o) {
    if (!same(pick_(o, ["batch", "batch name", "batchname"]))) return;
    const reg = pick_(o, ["reg no", "reg no.", "register no", "register number", "registration number",
                          "registration no", "reg", "regno"]);
    const name = pick_(o, ["student name", "name", "student"]);
    if (!reg && !name) return;
    if (index[key(reg, name)] !== undefined) return;
    index[key(reg, name)] = list.length;
    list.push({
      reg: reg, name: name, place: pick_(o, ["place"]),
      sph: pick_(o, ["student phone", "student mobile", "student number", "phone", "mobile"]),
      pph: pick_(o, ["parent phone", "parent mobile", "parent number", "guardian phone", "parent / guardian phone"]),
      saved: false, result: ""
    });
  });

  // 2) students already saved in this batch (marklist log)
  const sh = logSheet_();
  const v = sh.getDataRange().getValues();
  if (v.length > 1) {
    const h = v[0].map(function (x) { return String(x).trim().toLowerCase(); });
    const c = function (n) { return h.indexOf(n); };
    const ib = c("batch");
    for (let i = 1; i < v.length; i++) {
      const r = v[i];
      if (ib < 0 || !same(r[ib])) continue;
      const reg = String(r[c("register no")] || ""), name = String(r[c("student name")] || "");
      const k = key(reg, name);
      const item = {
        reg: reg, name: name, place: String(r[c("place")] || ""),
        sph: String(r[c("student phone")] || ""), pph: String(r[c("parent phone")] || ""),
        saved: true,
        result: [r[c("final %")], r[c("final grade")]].filter(Boolean).join(" ")
      };
      if (index[k] !== undefined) {
        const t = list[index[k]];
        t.saved = true; t.result = item.result;
        t.place = t.place || item.place; t.sph = t.sph || item.sph; t.pph = t.pph || item.pph;
      } else {
        index[k] = list.length; list.push(item);
      }
    }
  }
  list.sort(function (a, b) { return a.name.localeCompare(b.name); });
  return out({ ok: true, batch: batch, students: list });
}

/* ============ FIND BY REGISTER NUMBER (inside the batch) ============ */
function lookup_(d, batch) {
  const folder = batchFolder_(batch, false);
  if (!folder) return out({ ok: true, found: false });
  const prefix = (safe_(d.reg) + " - ").toLowerCase();
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    const n = f.getName().toLowerCase();
    if (n.indexOf(prefix) === 0 && n.slice(-5) === ".json") {
      return out({
        ok: true, found: true,
        data: JSON.parse(f.getBlob().getDataAsString()),
        savedAt: f.getLastUpdated()
      });
    }
  }
  return out({ ok: true, found: false });
}

/* ============ SAVE ============ */
function saveStudent_(d, s, batch) {
  if (!d.name) return out({ ok: false, error: "no student name" });
  const folder = batchFolder_(batch, true);
  const base = baseName_(d.reg, d.name);

  let pdfBlob = null;
  if (d.pdf) {
    pdfBlob = Utilities.newBlob(Utilities.base64Decode(d.pdf), "application/pdf", base + ".pdf");
    putFile_(folder, base + ".pdf", pdfBlob);
  }
  putFile_(folder, base + ".json", Utilities.newBlob(
    JSON.stringify({ state: d.state, batch: batch, savedBy: s.email, savedAt: new Date().toISOString() }, null, 2),
    "application/json", base + ".json"));

  logRow_(d, s.email, batch);

  return out({ ok: true });
}

/* ============ SHARE A PDF LINK (for WhatsApp) ============ */
// Saves the PDF in  <Batch> / Shared  and returns a link that opens it.
// Anyone who has the link can view that one report (the link cannot be guessed).
function share_(d, batch) {
  if (!d.name || !d.pdf) return out({ ok: false, error: "no report to share" });
  const root = batchFolder_(batch, true);
  const it = root.getFoldersByName("Shared");
  const folder = it.hasNext() ? it.next() : root.createFolder("Shared");
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HHmm");
  const fname = baseName_(d.reg, d.name) + " - report " + stamp + ".pdf";
  const file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(d.pdf), "application/pdf", fname));
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {
    file.setTrashed(true);
    return out({ ok: false, error: "your Google account does not allow link sharing" });
  }
  return out({ ok: true, url: file.getUrl() });
}

/* ============ MARKLIST LOG (separate file, one row per student) ============ */
const LOG_HEAD = ["Last saved", "Register No", "Student name", "Place", "Final %", "Final grade",
                  "Marks earned", "Total marks", "Attendance %", "Sessions attended", "Total sessions",
                  "Student phone", "Parent phone", "Saved by (staff)", "Batch"];

function logRow_(d, who, batch) {
  const sh = logSheet_();
  const s = d.summary || {};
  const f = (d.state && d.state.fields) || {};
  const row = [
    new Date(), d.reg || "", d.name, f.place || "",
    s.done ? s.P + "%" : "", s.done ? s.g : "", s.done ? s.G : "", s.T || "",
    s.ap !== undefined ? Number(s.ap).toFixed(1) + "%" : "", s.oa || 0, s.ot || 0,
    f.sph || "", f.pph || "", who, batch
  ];
  const last = sh.getLastRow();
  let r = -1;
  if (d.reg && last > 1) {
    const vals = sh.getRange(2, 1, last - 1, LOG_HEAD.length).getValues();
    for (let i = 0; i < vals.length; i++) {
      if (String(vals[i][1]).toLowerCase() === String(d.reg).toLowerCase() &&
          String(vals[i][14]).toLowerCase() === batch.toLowerCase()) { r = i + 2; break; }
    }
  }
  if (r > 0) sh.getRange(r, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
}

function logSheet_() {
  const folder = getFolder_();
  const it = folder.getFilesByName(SHEET_NAME);
  if (it.hasNext()) {
    const sh = SpreadsheetApp.open(it.next()).getSheets()[0];
    if (sh.getLastColumn() < LOG_HEAD.length) sh.getRange(1, LOG_HEAD.length).setValue("Batch");  // older file
    return sh;
  }
  const ss = SpreadsheetApp.create(SHEET_NAME);
  const file = DriveApp.getFileById(ss.getId());
  folder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);
  const sh = ss.getSheets()[0];
  sh.appendRow(LOG_HEAD);
  sh.setFrozenRows(1);
  return sh;
}

/* ============ helpers ============ */
function db_() {
  if (!SPREADSHEET_ID) throw new Error("SPREADSHEET_ID is not set in Code.gs");
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// a tab as a list of {lower-case header: value}; null if the tab does not exist
function readTable_(tab) {
  const sh = db_().getSheetByName(tab);
  if (!sh) return null;
  const v = sh.getDataRange().getValues();
  if (v.length < 1) return [];
  const head = v[0].map(function (h) { return String(h).trim().toLowerCase(); });
  return v.slice(1)
    .filter(function (r) { return r.some(function (c) { return String(c).trim() !== ""; }); })
    .map(function (r) { const o = {}; head.forEach(function (h, i) { o[h] = r[i]; }); return o; });
}

function pick_(o, names) {
  for (let i = 0; i < names.length; i++) {
    const x = o[names[i]];
    if (x !== undefined && String(x).trim() !== "") return String(x).trim();
  }
  return "";
}

function getFolder_() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

// one sub-folder per batch inside "IBEAU Marklists"
function batchFolder_(batch, create) {
  const root = getFolder_();
  const it = root.getFoldersByName(safe_(batch));
  if (it.hasNext()) return it.next();
  return create ? root.createFolder(safe_(batch)) : null;
}

function safe_(s) { return String(s || "").replace(/[\\/:*?"<>|]/g, "-").trim(); }

function baseName_(reg, name) {
  return reg ? safe_(reg) + " - " + safe_(name) : safe_(name);
}

// keeps only the latest copy for each student
function putFile_(folder, filename, blob) {
  const old = folder.getFilesByName(filename);
  while (old.hasNext()) old.next().setTrashed(true);
  folder.createFile(blob);
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
