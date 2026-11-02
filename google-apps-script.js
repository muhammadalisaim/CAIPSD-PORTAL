/**
 * =========================================================================
 * CAIPSD Unified Backend - Google Apps Script (v6.0)
 * The Islamia University of Bahawalpur · Centre of AI & PSD
 * 
 * UNIFIED SPREADSHEET LINK:
 * https://docs.google.com/spreadsheets/d/1o9Efz9w0-nt6JZABujOIgtmLQgWHxkj4reOVkGpWtqs/edit
 * 
 * Supports BOTH:
 * 1. CAIPSD Face Attendance System (Attendance check-ins & Admin Portal)
 * 2. CAIPSD Interns & Super Admin Portal (Reports, Leaves, Outings, Roster)
 * =========================================================================
 */

var SPREADSHEET_ID = "1o9Efz9w0-nt6JZABujOIgtmLQgWHxkj4reOVkGpWtqs";

function getTargetSpreadsheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) {}

  try {
    if (SPREADSHEET_ID && SPREADSHEET_ID.length > 5) {
      return SpreadsheetApp.openById(SPREADSHEET_ID);
    }
  } catch (e) {}
  return null;
}

function respond(e, data) {
  var jsonStr = JSON.stringify(data);
  var callback = e && e.parameter ? (e.parameter.callback || e.parameter.jsonp) : null;
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + jsonStr + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(jsonStr)
    .setMimeType(ContentService.MimeType.JSON);
}

function extractPayload(e) {
  if (!e) return {};
  var payload = null;

  // 1. Raw JSON or form encoded in postData
  if (e.postData && e.postData.contents) {
    var raw = e.postData.contents;
    try {
      payload = JSON.parse(raw);
      if (payload && typeof payload === 'object') return payload;
    } catch (err) {}

    try {
      if (typeof raw === 'string' && raw.indexOf('data=') !== -1) {
        var match = raw.match(/(?:^|&)data=([^&]*)/);
        if (match && match[1]) {
          var decoded = decodeURIComponent(match[1].replace(/\+/g, ' '));
          payload = JSON.parse(decoded);
          if (payload && typeof payload === 'object') return payload;
        }
      }
    } catch (err2) {}
  }

  // 2. e.parameter.data
  if (e.parameter && e.parameter.data) {
    try {
      if (typeof e.parameter.data === 'object') return e.parameter.data;
      payload = JSON.parse(e.parameter.data);
      if (payload && typeof payload === 'object') return payload;
    } catch (err3) {}
  }

  // 3. Fallback direct parameter
  if (e.parameter && Object.keys(e.parameter).length > 0) {
    return e.parameter;
  }

  return {};
}

function executeWithLock(fn) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    Logger.log("Lock wait timeout, proceeding: " + err);
  }

  try {
    var result = fn();
    SpreadsheetApp.flush();
    return result;
  } catch (error) {
    return { status: "error", message: error.toString() };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function doGet(e) {
  var ss = getTargetSpreadsheet();
  if (!ss) return respond(e, { status: "error", message: "Google Sheet not found. Check SPREADSHEET_ID." });

  var action = (e && e.parameter && (e.parameter.action || e.parameter.act)) ? (e.parameter.action || e.parameter.act) : "";

  // 0. CAIPSD Face Attendance Data query
  if (action === "data" || action === "attendance_data") {
    return respond(e, {
      ok: true,
      records: getAttendanceRecords(ss),
      roster: []
    });
  }

  // 1. Return intern-specific data
  if (action === "get_user_data" || action === "get_intern_data") {
    var name = (e.parameter.name || "").trim().toLowerCase();
    return respond(e, { status: "success", data: getUserSubmissions(ss, name) });
  }

  // 2. Return all portal data (for Super Admin)
  if (action === "get_all_data" || action === "get_data") {
    return respond(e, { status: "success", data: getAllPortalData(ss) });
  }

  // 2b. Fast action: get registered interns only (reads only 1 sheet)
  if (action === "get_interns" || action === "get_registered_interns") {
    var iSheet = ss.getSheetByName("Registered Interns");
    var internsList = [];
    if (iSheet && iSheet.getLastRow() > 1) {
      var numCols = Math.max(iSheet.getLastColumn(), 6);
      var iData = iSheet.getRange(2, 1, iSheet.getLastRow() - 1, numCols).getValues();
      internsList = iData.map(function(r) {
        var pass = numCols >= 6 ? String(r[4] || "") : "";
        var joinDate = numCols >= 6 ? String(r[5] || "") : String(r[4] || "");
        return {
          id: String(r[0] || ""),
          name: String(r[1] || ""),
          dept: String(r[2] || ""),
          email: String(r[3] || ""),
          password: pass,
          joined: joinDate
        };
      });
    }
    return respond(e, { status: "success", interns: internsList, data: { interns: internsList } });
  }

  // 2c. Fast action: check if email exists in Google Sheet
  if (action === "check_email") {
    var emailToCheck = (e.parameter.email || "").trim().toLowerCase();
    var iSheet = ss.getSheetByName("Registered Interns");
    var found = false;
    var matchedName = "";
    if (emailToCheck && iSheet && iSheet.getLastRow() > 1) {
      var iData = iSheet.getRange(2, 1, iSheet.getLastRow() - 1, 5).getValues();
      for (var k = 0; k < iData.length; k++) {
        var existingEmail = String(iData[k][3] || "").trim().toLowerCase();
        if (existingEmail === emailToCheck) {
          found = true;
          matchedName = String(iData[k][1] || "");
          break;
        }
      }
    }
    return respond(e, { status: "success", exists: found, email: emailToCheck, name: matchedName });
  }

  // 3. Action handling via GET (fallback)
  var payload = extractPayload(e);
  var pAction = payload.action || action || "";

  if (pAction === "update_status" || pAction === "update_submission") {
    return respond(e, executeWithLock(function() { return handleStatusUpdate(ss, payload); }));
  }

  if (pAction === "bulk_sync") {
    return respond(e, executeWithLock(function() { return handleBulkSync(ss, payload); }));
  }

  if (payload.type || pAction === "save_record") {
    return respond(e, executeWithLock(function() { return handleSingleRecordSave(ss, payload); }));
  }

  return respond(e, {
    status: "success",
    message: "CAIPSD Google Apps Script Webhook is LIVE and connected!",
    sheetName: ss.getName(),
    sheetId: SPREADSHEET_ID,
    timestamp: new Date().toLocaleString()
  });
}

function doPost(e) {
  var ss = getTargetSpreadsheet();
  if (!ss) return respond(e, { status: "error", message: "Google Sheet not found." });

  var payload = extractPayload(e);
  var action = payload.action || (e.parameter ? e.parameter.action : "") || "";

  // 1. CAIPSD Face Attendance Check-in Record from app.js
  if (payload.name && !payload.type && !payload.action) {
    return executeWithLock(function() {
      var sheet = getAttendanceSheet(ss);
      var ts = payload.ts || new Date().getTime();
      var date = payload.date || Utilities.formatDate(new Date(), "GMT+5", "yyyy-MM-dd");
      var time = payload.time || Utilities.formatDate(new Date(), "GMT+5", "hh:mm:ss a");
      var name = payload.name || "";
      var section = payload.section || "";
      var status = payload.status || "Present";
      var syncTime = Utilities.formatDate(new Date(), "GMT+5", "yyyy-MM-dd hh:mm:ss a");

      sheet.appendRow([ts, date, time, name, section, status, syncTime]);
      return respond(e, { result: "ok", success: true, ok: true });
    });
  }

  // 2. CAIPSD Face Attendance Admin Actions
  if (action === "login" || action === "logout" || action === "changePasscode") {
    return handleAttendanceAdminAction(ss, payload);
  }
  if (action === "data") {
    return respond(e, {
      ok: true,
      records: getAttendanceRecords(ss),
      roster: []
    });
  }

  // 3. CAIPSD Interns Portal Actions
  return respond(e, executeWithLock(function() {
    if (action === "update_status" || action === "update_submission") {
      return handleStatusUpdate(ss, payload);
    }
    if (action === "bulk_sync") {
      return handleBulkSync(ss, payload);
    }
    return handleSingleRecordSave(ss, payload);
  }));
}

function handleStatusUpdate(ss, payload) {
  var id = String(payload.id || "").trim();
  var type = String(payload.type || "leave").toLowerCase();
  var newStatus = String(payload.status || "Approved").trim();
  var newRemarks = String(payload.adminRemarks || "").trim();
  var name = String(payload.name || "").trim().toLowerCase();
  var dateField = String(payload.dateField || "").trim();

  var sheetName = "Leave Requests";
  if (type === "report") sheetName = "Daily Reports";
  else if (type === "outing") sheetName = "Outing Notices";

  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) {
    return { status: "error", message: "Sheet '" + sheetName + "' has no entries." };
  }

  var data = sheet.getDataRange().getValues();
  var targetRow = -1;

  // 1. Primary: Match strictly by ID in Column A
  if (id) {
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === id) {
        targetRow = i + 1;
        break;
      }
    }
  }

  // 2. Fallback: match by Intern Name & Date
  if (targetRow === -1 && name) {
    for (var j = 1; j < data.length; j++) {
      var rowName = "";
      var rowDate = "";
      if (type === "leave") {
        rowName = String(data[j][1]).trim().toLowerCase();
        rowDate = String(data[j][2]).trim();
      } else if (type === "report") {
        rowDate = String(data[j][1]).trim();
        rowName = String(data[j][2]).trim().toLowerCase();
      } else if (type === "outing") {
        rowDate = String(data[j][1]).trim();
        rowName = String(data[j][2]).trim().toLowerCase();
      }
      if (rowName === name && (!dateField || rowDate === dateField)) {
        targetRow = j + 1;
        break;
      }
    }
  }

  if (targetRow === -1) {
    return { status: "error", message: "Entry not found in " + sheetName + " for ID: " + id };
  }

  // Update Status in Column 5 (E)
  sheet.getRange(targetRow, 5).setValue(newStatus);

  // Update Remarks in Column 6 (F)
  if (type !== "outing") {
    if (!newRemarks) {
      newRemarks = newStatus === "Approved" ? "Leave approved by Admin" : "Leave rejected by Admin";
    }
    sheet.getRange(targetRow, 6).setValue(newRemarks);
  }

  SpreadsheetApp.flush();
  return {
    status: "success",
    message: "Status successfully updated to '" + newStatus + "' in Google Sheet!",
    row: targetRow,
    id: id,
    sheet: sheetName
  };
}

function getUserSubmissions(ss, name) {
  var result = { leaves: [], reports: [], outings: [] };
  if (!name) return result;

  // Leaves
  var lSheet = ss.getSheetByName("Leave Requests");
  if (lSheet && lSheet.getLastRow() > 1) {
    var lData = lSheet.getRange(2, 1, lSheet.getLastRow() - 1, 7).getValues();
    result.leaves = lData
      .filter(function(r) { return String(r[1] || "").trim().toLowerCase() === name; })
      .map(function(r) {
        return {
          id: String(r[0] || ""),
          name: String(r[1] || ""),
          dateField: String(r[2] || ""),
          details: String(r[3] || ""),
          status: String(r[4] || "Pending"),
          adminRemarks: String(r[5] || ""),
          createdAt: r[6] ? new Date(r[6]).getTime() || Date.now() : Date.now(),
          type: "leave"
        };
      });
  }

  // Reports
  var rSheet = ss.getSheetByName("Daily Reports");
  if (rSheet && rSheet.getLastRow() > 1) {
    var rData = rSheet.getRange(2, 1, rSheet.getLastRow() - 1, 7).getValues();
    result.reports = rData
      .filter(function(r) { return String(r[2] || "").trim().toLowerCase() === name; })
      .map(function(r) {
        return {
          id: String(r[0] || ""),
          dateField: String(r[1] || ""),
          name: String(r[2] || ""),
          details: String(r[3] || ""),
          status: String(r[4] || "Pending"),
          adminRemarks: String(r[5] || ""),
          createdAt: r[6] ? new Date(r[6]).getTime() || Date.now() : Date.now(),
          type: "report"
        };
      });
  }

  // Outings
  var oSheet = ss.getSheetByName("Outing Notices");
  if (oSheet && oSheet.getLastRow() > 1) {
    var oData = oSheet.getRange(2, 1, oSheet.getLastRow() - 1, 6).getValues();
    result.outings = oData
      .filter(function(r) { return String(r[2] || "").trim().toLowerCase() === name; })
      .map(function(r) {
        return {
          id: String(r[0] || ""),
          dateField: String(r[1] || ""),
          name: String(r[2] || ""),
          details: String(r[3] || ""),
          status: String(r[4] || "Out"),
          adminRemarks: "",
          createdAt: r[5] ? new Date(r[5]).getTime() || Date.now() : Date.now(),
          type: "outing"
        };
      });
  }

  return result;
}

function getAllPortalData(ss) {
  var result = { leaves: [], reports: [], outings: [], interns: [] };

  var lSheet = ss.getSheetByName("Leave Requests");
  if (lSheet && lSheet.getLastRow() > 1) {
    var lData = lSheet.getRange(2, 1, lSheet.getLastRow() - 1, 7).getValues();
    result.leaves = lData.map(function(r) {
      return {
        id: String(r[0] || ""),
        name: String(r[1] || ""),
        dateField: String(r[2] || ""),
        details: String(r[3] || ""),
        status: String(r[4] || "Pending"),
        adminRemarks: String(r[5] || ""),
        createdAt: r[6] ? new Date(r[6]).getTime() || Date.now() : Date.now(),
        type: "leave"
      };
    });
  }

  var rSheet = ss.getSheetByName("Daily Reports");
  if (rSheet && rSheet.getLastRow() > 1) {
    var rData = rSheet.getRange(2, 1, rSheet.getLastRow() - 1, 7).getValues();
    result.reports = rData.map(function(r) {
      return {
        id: String(r[0] || ""),
        dateField: String(r[1] || ""),
        name: String(r[2] || ""),
        details: String(r[3] || ""),
        status: String(r[4] || "Pending"),
        adminRemarks: String(r[5] || ""),
        createdAt: r[6] ? new Date(r[6]).getTime() || Date.now() : Date.now(),
        type: "report"
      };
    });
  }

  var oSheet = ss.getSheetByName("Outing Notices");
  if (oSheet && oSheet.getLastRow() > 1) {
    var oData = oSheet.getRange(2, 1, oSheet.getLastRow() - 1, 6).getValues();
    result.outings = oData.map(function(r) {
      return {
        id: String(r[0] || ""),
        dateField: String(r[1] || ""),
        name: String(r[2] || ""),
        details: String(r[3] || ""),
        status: String(r[4] || "Out"),
        adminRemarks: "",
        createdAt: r[5] ? new Date(r[5]).getTime() || Date.now() : Date.now(),
        type: "outing"
      };
    });
  }

  var iSheet = ss.getSheetByName("Registered Interns");
  if (iSheet && iSheet.getLastRow() > 1) {
    var numCols = Math.max(iSheet.getLastColumn(), 6);
    var iData = iSheet.getRange(2, 1, iSheet.getLastRow() - 1, numCols).getValues();
    result.interns = iData.map(function(r) {
      var pass = numCols >= 6 ? String(r[4] || "") : "";
      var joinDate = numCols >= 6 ? String(r[5] || "") : String(r[4] || "");
      return {
        id: String(r[0] || ""),
        name: String(r[1] || ""),
        dept: String(r[2] || ""),
        email: String(r[3] || ""),
        password: pass,
        joined: joinDate
      };
    });
  }

  return result;
}

function handleSingleRecordSave(ss, payload) {
  var type = String(payload.type || "report").toLowerCase();
  var id = payload.id || (type.toUpperCase().slice(0, 3) + "-" + Date.now());
  var name = payload.name || "Anonymous";
  var dateField = payload.dateField || "";
  var details = payload.details || "";
  var status = payload.status || (type === "outing" ? "Out" : "Pending");
  var remarks = payload.adminRemarks || "";
  var timestamp = new Date().toLocaleString();

  if (type === "leave") {
    var lSheet = getOrCreateSheet(ss, "Leave Requests", ["Leave ID", "Intern Name", "Leave Period", "Reason", "Status", "Admin Remarks", "Applied Time"]);
    lSheet.appendRow([id, name, dateField, details, status, remarks, timestamp]);
  } else if (type === "report") {
    var rSheet = getOrCreateSheet(ss, "Daily Reports", ["Entry ID", "Date", "Intern Name", "Tasks & Progress", "Status", "Supervisor Remarks", "Logged Time"]);
    rSheet.appendRow([id, dateField, name, details, status, remarks, timestamp]);
  } else if (type === "outing") {
    var oSheet = getOrCreateSheet(ss, "Outing Notices", ["Outing ID", "Date", "Intern Name", "Exit Details", "Status", "Time Recorded"]);
    oSheet.appendRow([id, dateField, name, details, status, timestamp]);
  } else if (type === "intern_register") {
    var iSheet = getOrCreateSheet(ss, "Registered Interns", ["Intern ID", "Intern Name", "Team / Department", "Email Address", "Password", "Date Joined"]);
    var dept = payload.dept || "";
    var email = String(payload.email || "").trim().toLowerCase();
    var password = String(payload.password || "").trim();

    // Enforce email uniqueness: prevent duplicate registration across devices
    if (email && iSheet.getLastRow() > 1) {
      var numCols = Math.max(iSheet.getLastColumn(), 6);
      var existingData = iSheet.getRange(2, 1, iSheet.getLastRow() - 1, numCols).getValues();
      for (var k = 0; k < existingData.length; k++) {
        var existingEmail = String(existingData[k][3] || "").trim().toLowerCase();
        if (existingEmail === email) {
          return {
            status: "error",
            code: "EMAIL_EXISTS",
            message: "This email address is already registered in Google Sheet! Please sign in directly.",
            name: String(existingData[k][1] || "")
          };
        }
      }
    }

    var intId = id || ("INT-" + Date.now());
    iSheet.appendRow([intId, name, dept, payload.email || email, password, new Date().toLocaleDateString()]);
  } else if (type === "test") {
    var tSheet = getOrCreateSheet(ss, "System_Test", ["Test Time", "Sender", "Message"]);
    tSheet.appendRow([timestamp, name, details || "Test entry from CAIPSD portal"]);
  }

  SpreadsheetApp.flush();
  return {
    status: "success",
    message: "Recorded to Google Sheet successfully (" + type + ").",
    id: id
  };
}

function handleBulkSync(ss, payload) {
  syncDailyReportsSheet(ss, payload.reports || []);
  syncLeavesSheet(ss, payload.leaves || []);
  syncOutingsSheet(ss, payload.outings || []);
  syncInternsSheet(ss, payload.interns || []);
  SpreadsheetApp.flush();
  return {
    status: "success",
    message: "All CAIPSD portal data synchronized successfully to Google Sheet!",
    sheetName: ss.getName()
  };
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    formatHeaderRow(sheet, headers.length);
  }
  return sheet;
}

function formatHeaderRow(sheet, colCount) {
  var headerRange = sheet.getRange(1, 1, 1, colCount);
  headerRange
    .setFontWeight("bold")
    .setBackground("#0b1f47")
    .setFontColor("#ffffff")
    .setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
}

function syncDailyReportsSheet(ss, reports) {
  var headers = ["Entry ID", "Date", "Intern Name", "Tasks & Progress", "Status", "Supervisor Remarks", "Logged Time"];
  var sheet = ss.getSheetByName("Daily Reports") || ss.insertSheet("Daily Reports");
  sheet.clear();
  sheet.appendRow(headers);
  formatHeaderRow(sheet, headers.length);

  if (reports && reports.length > 0) {
    var rows = reports.map(function(r) {
      return [
        r.id || "",
        r.dateField || "",
        r.name || "",
        r.details || "",
        r.status || "Pending",
        r.adminRemarks || "",
        r.createdAt ? new Date(r.createdAt).toLocaleString() : ""
      ];
    });
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function syncLeavesSheet(ss, leaves) {
  var headers = ["Leave ID", "Intern Name", "Leave Period", "Reason", "Status", "Admin Remarks", "Applied Time"];
  var sheet = ss.getSheetByName("Leave Requests") || ss.insertSheet("Leave Requests");
  sheet.clear();
  sheet.appendRow(headers);
  formatHeaderRow(sheet, headers.length);

  if (leaves && leaves.length > 0) {
    var rows = leaves.map(function(l) {
      return [
        l.id || "",
        l.name || "",
        l.dateField || "",
        l.details || "",
        l.status || "Pending",
        l.adminRemarks || "",
        l.createdAt ? new Date(l.createdAt).toLocaleString() : ""
      ];
    });
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function syncOutingsSheet(ss, outings) {
  var headers = ["Outing ID", "Date", "Intern Name", "Exit Details", "Status", "Time Recorded"];
  var sheet = ss.getSheetByName("Outing Notices") || ss.insertSheet("Outing Notices");
  sheet.clear();
  sheet.appendRow(headers);
  formatHeaderRow(sheet, headers.length);

  if (outings && outings.length > 0) {
    var rows = outings.map(function(o) {
      return [
        o.id || "",
        o.dateField || "",
        o.name || "",
        o.details || "",
        o.status || "Out",
        o.createdAt ? new Date(o.createdAt).toLocaleString() : ""
      ];
    });
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function syncInternsSheet(ss, interns) {
  var headers = ["Intern ID", "Intern Name", "Team / Department", "Email Address", "Password", "Date Joined"];
  var sheet = ss.getSheetByName("Registered Interns") || ss.insertSheet("Registered Interns");
  sheet.clear();
  sheet.appendRow(headers);
  formatHeaderRow(sheet, headers.length);

  if (interns && interns.length > 0) {
    var rows = interns.map(function(i) {
      return [
        i.id || "",
        i.name || "",
        i.dept || "",
        i.email || "",
        i.password || "",
        i.joined || ""
      ];
    });
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}


// ==================== ATTENDANCE SYSTEM INTEGRATION ====================
function getAttendanceSheet(ss) {
  var targetSs = ss || getTargetSpreadsheet();
  var sheet = targetSs.getSheetByName("Attendance");
  if (!sheet) {
    sheet = targetSs.insertSheet("Attendance");
    sheet.appendRow([
      "Timestamp",
      "Date",
      "Time",
      "Student Name",
      "Section / Dept",
      "Status",
      "Sync Time"
    ]);
    sheet.getRange(1, 1, 1, 7)
      .setFontWeight("bold")
      .setBackground("#0B1F4B")
      .setFontColor("#FFFFFF");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getAttendanceRecords(ss) {
  var sheet = getAttendanceSheet(ss);
  var rows = sheet.getDataRange().getValues();
  var records = [];
  for (var i = 1; i < rows.length; i++) {
    records.push({
      ts: rows[i][0],
      date: String(rows[i][1]),
      time: String(rows[i][2]),
      name: String(rows[i][3]),
      section: String(rows[i][4]),
      status: String(rows[i][5]),
      receivedAt: rows[i][0]
    });
  }
  return records;
}

function handleAttendanceAdminAction(ss, data) {
  var props = PropertiesService.getScriptProperties();
  var defaultPass = "2375";
  var adminPass = props.getProperty("ADMIN_PASSCODE") || defaultPass;

  if (data.action === "login") {
    if (data.passcode === adminPass) {
      var session = Utilities.getUuid();
      props.setProperty("SESSION_" + session, new Date().getTime().toString());
      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        session: session
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        ok: false,
        error: "Invalid admin passcode"
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (data.action === "logout") {
    if (data.session) {
      props.deleteProperty("SESSION_" + data.session);
    }
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (data.action === "changePasscode") {
    if (data.current === adminPass) {
      props.setProperty("ADMIN_PASSCODE", data.next);
      return ContentService.createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        ok: false,
        error: "Current passcode is incorrect"
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function initialSetup() {
  var ss = getTargetSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
  if (!ss) return "Error: Sheet not found";

  var testSheet = getOrCreateSheet(ss, "System_Test", ["Test Time", "Status", "Note"]);
  testSheet.appendRow([new Date().toLocaleString(), "SUCCESS", "Connected to " + ss.getName() + " successfully!"]);
  SpreadsheetApp.flush();

  Logger.log("✅ SUCCESS! Connected to: " + ss.getName());
  return "SUCCESS";
}
