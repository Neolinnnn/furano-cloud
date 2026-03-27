/**
 * Google Apps Script 後端 — 北海道拆帳 API
 * 
 * 使用方式：
 * 1. 開一個新的 Google Sheet
 * 2. 擴充功能 → Apps Script
 * 3. 把這整份程式碼貼上去
 * 4. 部署 → 新增部署 → Web 應用程式 → 存取權限：所有人
 * 5. 複製部署的 URL，填入前端 app.js 的 API_URL
 */

// ===== 設定 =====
const SHEET_EXPENSES = "花費明細";
const SHEET_MEMBERS = "成員";
const SHEET_MESSAGES = "留言板";
const JPY_TO_TWD = 0.2038;

// ===== Web App 入口 =====

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const action = (e.parameter && e.parameter.action) || "";
  let result;

  try {
    switch (action) {
      case "getMembers":
        result = getMembers();
        break;
      case "getExpenses":
        result = getExpenses();
        break;
      case "addExpense":
        result = addExpense(JSON.parse(e.postData.contents));
        break;
      case "updateExpense":
        result = updateExpense(JSON.parse(e.postData.contents));
        break;
      case "deleteExpense":
        result = deleteExpense(JSON.parse(e.postData.contents));
        break;
      case "getSummary":
        result = getSummary();
        break;
      case "getSettlement":
        result = getSettlement();
        break;
      case "getBankAccounts":
        result = getBankAccounts();
        break;
      case "saveBankAccount":
        result = saveBankAccount(JSON.parse(e.postData.contents));
        break;
      case "deleteBankAccount":
        result = deleteBankAccount(JSON.parse(e.postData.contents));
        break;
      case "initSheet":
        result = initSheet();
        break;
      case "getMessages":
        result = getMessages();
        break;
      case "addMessage":
        result = addMessage(JSON.parse(e.postData.contents));
        break;
      default:
        result = { error: "Unknown action: " + action };
    }
  } catch (err) {
    result = { error: err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== 初始化 =====

function initSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 建立「花費明細」
  let expSheet = ss.getSheetByName(SHEET_EXPENSES);
  if (!expSheet) {
    expSheet = ss.insertSheet(SHEET_EXPENSES);
    expSheet.appendRow(["id", "日期", "項目", "備註", "代墊人", "應付人員", "金額-台幣", "金額-日幣", "類別", "狀態"]);
    expSheet.getRange(1, 1, 1, 10).setFontWeight("bold");
  }

  // 建立「成員」
  let memSheet = ss.getSheetByName(SHEET_MEMBERS);
  if (!memSheet) {
    memSheet = ss.insertSheet(SHEET_MEMBERS);
    memSheet.appendRow(["姓名", "銀行名稱", "銀行帳號"]);
    memSheet.getRange(1, 1, 1, 3).setFontWeight("bold");

    // 預填成員
    const defaultMembers = ["林廷翰", "林君翰", "定定", "李鴻祥", "張銘智", "黃珮儒", "王巧衣", "林大為", "張雨玄", "辣椒"];
    defaultMembers.forEach(m => memSheet.appendRow([m, "", ""]));
  }

  // 建立「留言板」
  let msgSheet = ss.getSheetByName(SHEET_MESSAGES);
  if (!msgSheet) {
    msgSheet = ss.insertSheet(SHEET_MESSAGES);
    msgSheet.appendRow(["時間", "留言人", "內容"]);
    msgSheet.getRange(1, 1, 1, 3).setFontWeight("bold");
    msgSheet.setFrozenRows(1);
  }

  return { ok: true, message: "工作表已初始化" };
}

// ===== 暱稱對應 =====

const NICKNAME_MAP = {
  "翰": "林廷翰", "林廷翰": "林廷翰", "廷翰": "林廷翰",
  "君翰": "林君翰", "君": "林君翰", "林君翰": "林君翰",
  "定": "定定", "定定": "定定",
  "祥": "李鴻祥", "祥哥": "李鴻祥", "李鴻祥": "李鴻祥",
  "智": "張銘智", "阿智": "張銘智", "張銘智": "張銘智",
  "儒": "黃珮儒", "黃珮儒": "黃珮儒",
  "巧衣": "王巧衣", "王巧衣": "王巧衣",
  "大為": "林大為", "林大為": "林大為", "大維": "林大為",
  "雨玄": "張雨玄", "張雨玄": "張雨玄", "王雨玄": "張雨玄",
  "辣椒": "辣椒", "椒": "辣椒",
};

function resolveName(n) {
  return NICKNAME_MAP[n.trim()] || n.trim();
}

function parsePayers(str) {
  if (!str || str.trim() === "各自負擔") return [];
  return str.split(/[&＆、]/).map(s => resolveName(s)).filter(Boolean);
}

function parseDebtors(str, allMembers) {
  if (!str || !str.trim()) return allMembers.slice();
  return str.split(/[\s,，、]+/).map(s => resolveName(s)).filter(Boolean);
}

// ===== Members =====

function getMembers() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MEMBERS);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  return data.slice(1).map(r => r[0]).filter(Boolean);
}

function getBankAccounts() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MEMBERS);
  if (!sheet) return {};
  const data = sheet.getDataRange().getValues();
  const result = {};
  data.slice(1).forEach(r => {
    if (r[0] && (r[1] || r[2])) {
      result[r[0]] = { bank: r[1] || "", account: r[2] || "" };
    }
  });
  return result;
}

function saveBankAccount(payload) {
  const { name, bank, account } = payload;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MEMBERS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === name) {
      sheet.getRange(i + 1, 2).setValue(bank);
      sheet.getRange(i + 1, 3).setValue(account);
      return { ok: true };
    }
  }
  return { error: "找不到成員" };
}

function deleteBankAccount(payload) {
  const { name } = payload;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MEMBERS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === name) {
      sheet.getRange(i + 1, 2).setValue("");
      sheet.getRange(i + 1, 3).setValue("");
      return { ok: true };
    }
  }
  return { error: "找不到成員" };
}

// ===== Expenses CRUD =====

function getExpenses() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_EXPENSES);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const allMembers = getMembers();
  const expenses = [];

  for (let i = 1; i < data.length; i++) {
    const row = {};
    headers.forEach((h, j) => row[h] = data[i][j]);

    const id = row["id"];
    const payerStr = String(row["代墊人"] || "").trim();
    const debtorStr = String(row["應付人員"] || "").trim();

    if (payerStr === "各自負擔") {
      expenses.push({
        id, date: String(row["日期"] || ""), item: String(row["項目"] || ""),
        payer: "各自負擔", payers: [], note: String(row["備註"] || ""),
        debtors: [], debtor_str: debtorStr,
        amount_twd: null, amount_jpy: null, amount_twd_total: null,
        category: String(row["類別"] || ""), status: "各自負擔",
      });
      continue;
    }

    const payers = parsePayers(payerStr);
    const debtors = parseDebtors(debtorStr, allMembers);

    let amtTwd = row["金額-台幣"] !== "" && row["金額-台幣"] !== null ? Number(row["金額-台幣"]) : null;
    let amtJpy = row["金額-日幣"] !== "" && row["金額-日幣"] !== null ? Number(row["金額-日幣"]) : null;
    if (isNaN(amtTwd)) amtTwd = null;
    if (isNaN(amtJpy)) amtJpy = null;

    let total = null;
    let status = String(row["狀態"] || "ok");
    if (status !== "各自負擔" && status !== "待確認") {
      if (amtTwd != null && amtJpy != null) total = amtTwd + amtJpy * JPY_TO_TWD;
      else if (amtTwd != null) total = amtTwd;
      else if (amtJpy != null) total = amtJpy * JPY_TO_TWD;
      else status = "待確認";
    }

    expenses.push({
      id, date: String(row["日期"] || ""), item: String(row["項目"] || ""),
      payer: payerStr, payers, note: String(row["備註"] || ""),
      debtors, debtor_str: debtorStr,
      amount_twd: amtTwd, amount_jpy: amtJpy, amount_twd_total: total,
      category: String(row["類別"] || ""), status,
    });
  }
  return expenses;
}

function addExpense(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_EXPENSES);
  const lastRow = sheet.getLastRow();
  const nextId = lastRow < 2 ? 1 : sheet.getRange(lastRow, 1).getValue() + 1;

  sheet.appendRow([
    nextId,
    payload["日期"] || "",
    payload["項目"] || "",
    payload["備註"] || "",
    payload["代墊人"] || "",
    payload["應付人員"] || "",
    payload["金額-台幣"] || "",
    payload["金額-日幣"] || "",
    payload["類別"] || "",
    "ok",
  ]);

  return { ok: true, id: nextId };
}

function updateExpense(payload) {
  const { id, field, value } = payload;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_EXPENSES);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colIdx = headers.indexOf(field);
  if (colIdx === -1) return { error: "無效欄位: " + field };

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == id) {
      sheet.getRange(i + 1, colIdx + 1).setValue(value);
      return { ok: true };
    }
  }
  return { error: "找不到 ID: " + id };
}

function deleteExpense(payload) {
  const { id } = payload;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_EXPENSES);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == id) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { error: "找不到 ID: " + id };
}

// ===== Summary & Settlement =====

function getSummary() {
  const expenses = getExpenses();
  let totalTwd = 0, totalJpy = 0, calcTwd = 0, count = 0;
  expenses.forEach(e => {
    if (e.status !== "各自負擔") {
      count++;
      if (e.amount_twd != null) totalTwd += e.amount_twd;
      if (e.amount_jpy != null) totalJpy += e.amount_jpy;
      if (e.amount_twd_total != null) calcTwd += e.amount_twd_total;
    }
  });
  return { count, total_twd: Math.round(totalTwd), total_jpy: Math.round(totalJpy), calculated_twd: Math.round(calcTwd) };
}

function getSettlement() {
  const expenses = getExpenses();
  const allMembers = getMembers();

  const balance = {};
  const userDetails = {};
  allMembers.forEach(m => { balance[m] = 0; userDetails[m] = []; });

  expenses.forEach(exp => {
    if (exp.status === "各自負擔" || exp.status === "待確認") return;
    if (!exp.payers.length || exp.amount_twd_total == null) return;

    const total = exp.amount_twd_total;
    const payers = exp.payers;
    let debtors = exp.debtors;
    if (!debtors.length) debtors = allMembers.slice();

    const perPerson = total / debtors.length;
    const perPayer = total / payers.length;

    payers.forEach(p => {
      if (balance[p] !== undefined) {
        balance[p] += perPayer;
        userDetails[p].push({
          id: exp.id, date: exp.date, item: exp.item, note: exp.note,
          category: exp.category, type: "pay", amount: perPayer,
          payers: payers, debtors: debtors,
          desc: payers.length > 1 ? `代墊 (${payers.length}人平分)` : "代墊全額"
        });
      }
    });

    debtors.forEach(d => {
      if (balance[d] !== undefined) {
        balance[d] -= perPerson;
        userDetails[d].push({
          id: exp.id, date: exp.date, item: exp.item, note: exp.note,
          category: exp.category, type: "owe", amount: perPerson,
          payers: payers, debtors: debtors,
          desc: `應付 (${debtors.length}人平分)`
        });
      }
    });
  });

  // Minimize transfers
  const creditors = [], debtorsList = [];
  Object.entries(balance).forEach(([name, amt]) => {
    if (amt > 1) creditors.push({ name, amount: amt });
    else if (amt < -1) debtorsList.push({ name, amount: -amt });
  });
  creditors.sort((a, b) => b.amount - a.amount);
  debtorsList.sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtorsList.length) {
    const t = Math.min(creditors[ci].amount, debtorsList[di].amount);
    transfers.push({ from: debtorsList[di].name, to: creditors[ci].name, amount: Math.round(t) });
    creditors[ci].amount -= t;
    debtorsList[di].amount -= t;
    if (creditors[ci].amount < 1) ci++;
    if (debtorsList[di].amount < 1) di++;
  }

  const roundedBalance = {};
  Object.entries(balance).forEach(([k, v]) => roundedBalance[k] = Math.round(v));

  return { balance: roundedBalance, transfers, user_details: userDetails };
}

// ===== Messages =====

function getMessages() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MESSAGES);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  const list = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    list.push({ time: String(row[0] || ""), user: String(row[1] || ""), message: String(row[2] || "") });
  }
  return list;
}

function addMessage(payload) {
  const { user, message } = payload;
  if (!user || !message) return { error: "缺少參數" };
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MESSAGES);
  const time = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd HH:mm:ss");
  sheet.appendRow([time, user, message]);
  return { ok: true };
}
