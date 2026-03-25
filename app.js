// ===== 設定：填入你的 Google Apps Script Web App URL =====
const API_URL = "https://script.google.com/macros/s/AKfycbw_bt7uNJrVzY9nBjI4420ORFIO8gdJo7VwBcjAMqByXbZNF911rAAsPwbBJ7Lhodp2kQ/exec";

// ===== State =====
let currentUser = null;
let allExpenses = [];
let filteredExpenses = [];
let allMembers = [];
let userDetails = {};
let globalBankAccounts = {};
let pendingTransfer = null;
let currentSort = { column: 'id', order: 'asc' };

// ===== QR Helper =====
function getQrUrl(bank, account) {
  if (!bank || !account) return null;
  bank = String(bank);
  account = String(account);
  const match = bank.match(/^(\d{3})/);
  const bankCode = match ? match[1] : bank.substring(0, 3);
  const uri = `TWQRP://${bankCode}ntransfer/15/01/V1?D6=${account}&D9=&D10=901`;
  return `https://quickchart.io/qr?text=${encodeURIComponent(uri)}&size=150&margin=1`;
}

// ===== API Helper =====
async function callAPI(action, payload = null) {
  const url = `${API_URL}?action=${action}`;
  const options = payload
    ? { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "text/plain" } }
    : { method: "GET" };
  // GAS requires redirect follow
  options.redirect = "follow";
  const res = await fetch(url, options);
  return res.json();
}

// ===== Init =====
document.addEventListener("DOMContentLoaded", () => { loadMembers(); });

function showLoader(show) {
  document.getElementById("loaderOverlay").style.display = show ? "flex" : "none";
}

async function loadMembers() {
  showLoader(true);
  try {
    allMembers = await callAPI("getMembers");
    const select = document.getElementById("memberSelect");
    const addPayer = document.getElementById("addPayer");
    const filterPayer = document.getElementById("filterPayer");
    allMembers.forEach(m => {
      select.appendChild(new Option(m, m));
      addPayer.appendChild(new Option(m, m));
      filterPayer.appendChild(new Option(m, m));
    });
  } catch (err) { showToast("載入失敗，請確認 API URL 已設定", "error"); }
  finally { showLoader(false); }
}

// ===== Login / Logout =====
function login() {
  const name = document.getElementById("memberSelect").value;
  if (!name) { showToast("請選擇成員", "error"); return; }
  currentUser = name;
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("appContainer").style.display = "block";
  document.getElementById("userName").textContent = name;
  document.getElementById("userAvatar").textContent = name.charAt(name.length - 1);
  loadBankAccount(); loadAllBankAccounts(); loadDashboard(); loadExpenses(); loadSettlement();
}

function logout() {
  currentUser = null;
  document.getElementById("loginScreen").style.display = "flex";
  document.getElementById("appContainer").style.display = "none";
  switchTab("account");
}

// ===== Tabs =====
function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tabName));
  document.querySelectorAll(".tab-content").forEach(tc => tc.classList.toggle("active", tc.id === `tab-${tabName}`));
  if (tabName === "settlement") loadSettlement();
  else if (tabName === "expenses") { loadDashboard(); loadExpenses(); }
}

// ===== Bank Accounts =====
async function loadBankAccount() {
  const accounts = await callAPI("getBankAccounts");
  globalBankAccounts = accounts;
  const info = accounts[currentUser];
  if (info) {
    document.getElementById("bankName").value = info.bank || "";
    document.getElementById("bankAccount").value = info.account || "";
    document.getElementById("btnDeleteBank").style.display = "block";
    
    // 渲染 QR Code
    const qrSection = document.getElementById("myQrSection");
    const qrUrl = getQrUrl(info.bank, info.account);
    if (qrUrl) {
      document.getElementById("myQrImg").src = qrUrl;
      qrSection.style.display = "flex";
    } else {
      qrSection.style.display = "none";
    }
  } else {
    document.getElementById("bankName").value = "";
    document.getElementById("bankAccount").value = "";
    document.getElementById("btnDeleteBank").style.display = "none";
    document.getElementById("myQrSection").style.display = "none";
  }
}

async function loadAllBankAccounts() {
  const accounts = await callAPI("getBankAccounts");
  globalBankAccounts = accounts;
  const container = document.getElementById("allBankAccounts");
  
  // Build display list: group members together
  const processed = new Set();
  const displayList = [];
  for (const group of MEMBER_GROUPS) {
    displayList.push({ names: group, label: getGroupLabel(group) });
    group.forEach(m => processed.add(m));
  }
  allMembers.forEach(name => {
    if (!processed.has(name)) displayList.push({ names: [name], label: name });
  });

  let html = '<div class="settlement-grid">';
  displayList.forEach(item => {
    // Collect bank infos for all members in the group
    const memberInfos = item.names.map(name => ({ name, info: accounts[name] })).filter(m => m.info);

    if (memberInfos.length > 0) {
      let detailHtml = memberInfos.map(m => {
        const fullText = `${m.info.bank} ${m.info.account}`;
        return `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">
          <div style="font-size:13px;color:var(--text-secondary);word-break:break-all;">
            <span style="color:var(--text-primary);font-weight:500;">${m.name}</span>：${m.info.bank} - ${m.info.account}
          </div>
          <button class="transfer-qr-btn" style="padding:4px 8px;font-size:11px;flex-shrink:0;margin-left:8px;" onclick="copyText('${fullText}')">📋</button>
        </div>`;
      }).join('');

      html += `<div class="balance-card positive">
        <div class="balance-avatar">${item.label.charAt(item.label.length-1)}</div>
        <div class="balance-info">
          <div class="balance-name">${item.label}</div>
          ${detailHtml}
        </div>
      </div>`;
    } else {
      html += `<div class="balance-card zero">
        <div class="balance-avatar">${item.label.charAt(item.label.length-1)}</div>
        <div class="balance-info">
          <div class="balance-name">${item.label}</div>
          <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">尚未設定</div>
        </div>
      </div>`;
    }
  });
  container.innerHTML = html + "</div>";
}

async function saveBankAccount() {
  const bank = document.getElementById("bankName").value.trim();
  const account = document.getElementById("bankAccount").value.trim();
  if (!bank || !account) { showToast("請填寫銀行名稱和帳號", "error"); return; }
  showLoader(true);
  await callAPI("saveBankAccount", { name: currentUser, bank, account });
  showToast("帳號已儲存！", "success");
  document.getElementById("btnDeleteBank").style.display = "block";
  loadAllBankAccounts();
  showLoader(false);
}

async function deleteBankAccount() {
  if (!confirm("確定要刪除？")) return;
  showLoader(true);
  await callAPI("deleteBankAccount", { name: currentUser });
  showToast("帳號已刪除", "success");
  loadBankAccount(); loadAllBankAccounts();
  showLoader(false);
}

// ===== Dashboard & Expenses =====
async function loadDashboard() {
  const data = await callAPI("getSummary");
  document.getElementById("dashCount").textContent = data.count;
  document.getElementById("dashTwd").textContent = `NT$ ${formatNum(data.total_twd)}`;
  document.getElementById("dashJpy").textContent = `¥ ${formatNum(data.total_jpy)}`;
  document.getElementById("dashCalcTwd").textContent = `NT$ ${formatNum(data.calculated_twd)}`;
}

async function loadExpenses() {
  showLoader(true);
  try {
    allExpenses = await callAPI("getExpenses");
    applyFilterAndSort();
  } finally { showLoader(false); }
}

function toggleSort(col) {
  if (currentSort.column === col) currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
  else { currentSort.column = col; currentSort.order = 'asc'; }
  applyFilterAndSort();
}

function applyFilterAndSort() {
  const catFilter = document.getElementById("filterCategory").value;
  const payerFilter = document.getElementById("filterPayer").value;
  filteredExpenses = allExpenses.filter(e => {
    if (catFilter && e.category !== catFilter) return false;
    if (payerFilter && !e.payers.includes(payerFilter) && e.payer !== payerFilter) return false;
    return true;
  });
  filteredExpenses.sort((a, b) => {
    let va = a[currentSort.column], vb = b[currentSort.column];
    if (va == null) va = ''; if (vb == null) vb = '';
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return currentSort.order === 'asc' ? -1 : 1;
    if (va > vb) return currentSort.order === 'asc' ? 1 : -1;
    return 0;
  });
  renderExpenseTable();
}

function renderExpenseTable() {
  const tbody = document.getElementById("expenseBody");
  const catIcons = { 住宿:"🏨", 交通:"🚌", 餐飲:"🍜", 雪場:"⛷️", 移動:"✈️", "門票/活動":"🎫" };
  let html = "";
  filteredExpenses.forEach(exp => {
    const statusCls = exp.status === "ok" ? "badge-ok" : exp.status === "各自負擔" ? "badge-self" : "badge-pending";
    const statusTxt = exp.status === "ok" ? "✓" : exp.status === "各自負擔" ? "各自" : "⚠";
    const icon = catIcons[exp.category] || "📌";
    html += `<tr>
      <td>${exp.id}</td>
      <td>${esc(exp.date||"-")}</td>
      <td><div style="font-weight:600">${esc(exp.item||"-")}</div><div style="font-size:11px;color:var(--text-muted)">${icon} ${esc(exp.category||"-")}</div></td>
      <td>${esc(exp.payer)}</td>
      <td style="font-weight:600;color:var(--warning);">${exp.amount_twd_total != null ? "NT$"+formatNum(exp.amount_twd_total) : "-"}</td>
      <td><span class="badge ${statusCls}">${statusTxt}</span></td>
      <td>
        <button class="btn-icon" onclick="showDetail(${exp.id})" title="檢視">👁️</button>
        <button class="btn-icon" onclick="deleteExp(${exp.id})" title="刪除">🗑️</button>
      </td>
    </tr>`;
  });
  tbody.innerHTML = html || '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:30px;">無資料</td></tr>';
}

// ===== Add / Delete =====
function showAddExpenseModal() { document.getElementById("expenseModal").style.display = "flex"; }
function closeExpenseModal() { document.getElementById("expenseModal").style.display = "none"; }

async function submitAddExpense() {
  const item = document.getElementById("addItem").value;
  const note = document.getElementById("addNote").value;
  const payer = document.getElementById("addPayer").value;
  if ((!item && !note) || !payer) { showToast("項目和代墊人為必填", "error"); return; }

  showLoader(true);
  await callAPI("addExpense", {
    "日期": document.getElementById("addDate").value,
    "項目": item, "備註": note, "代墊人": payer,
    "應付人員": document.getElementById("addDebtors").value,
    "金額-台幣": document.getElementById("addTwd").value,
    "金額-日幣": document.getElementById("addJpy").value,
    "類別": document.getElementById("addCategory").value,
  });
  showToast("新增成功", "success"); closeExpenseModal();
  loadDashboard(); loadExpenses();
  showLoader(false);
}

async function deleteExp(id) {
  if (!confirm("確定要刪除？")) return;
  showLoader(true);
  await callAPI("deleteExpense", { id });
  showToast("已刪除", "success");
  loadDashboard(); loadExpenses();
  showLoader(false);
}

function showDetail(id) {
  const exp = allExpenses.find(e => e.id === id);
  if (!exp || !exp.amount_twd_total) { showToast("無法顯示", "warning"); return; }
  const debtors = exp.debtors.length ? exp.debtors : allMembers;
  const payers = exp.payers.length ? exp.payers : [exp.payer];
  const perP = Math.round(exp.amount_twd_total / debtors.length);
  const perPay = Math.round(exp.amount_twd_total / payers.length);
  let html = `<div style="margin-bottom:15px;padding:15px;background:rgba(255,255,255,0.05);border-radius:8px;">
    <h3 style="margin:0 0 10px;color:var(--accent);font-size:22px;">💰 NT$ ${formatNum(exp.amount_twd_total)}</h3>
    <div style="font-size:14px;color:var(--text-secondary);line-height:1.6;">
      <div><b>📌</b> ${esc(exp.item||"-")} <span style="color:var(--text-muted)">${esc(exp.note||"")}</span></div>
      <div><b>📅</b> ${esc(exp.date||"-")}</div></div></div>
    <div style="margin-bottom:12px;"><h4 style="margin:0 0 8px;font-size:15px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:5px;">
      🎯 應付 <span style="float:right;font-size:13px;font-weight:normal;color:var(--warning);">每人 NT$ ${formatNum(perP)}</span></h4>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">${debtors.map(d=>`<span class="badge badge-pending">${d}</span>`).join("")}</div></div>
    <div><h4 style="margin:0 0 8px;font-size:15px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:5px;">
      💳 代墊 <span style="float:right;font-size:13px;font-weight:normal;color:var(--accent);">每人 NT$ ${formatNum(perPay)}</span></h4>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">${payers.map(p=>`<span class="badge badge-ok">${p}</span>`).join("")}</div></div>`;
  document.getElementById("detailModalContent").innerHTML = html;
  document.getElementById("expenseDetailModal").style.display = "flex";
}

// ===== Member Grouping =====
const MEMBER_GROUPS = [
  ["林大為", "張雨玄"],
  ["林君翰", "定定"],
];

function getGroupLabel(members) {
  return members.join("+");
}

function findGroupForMember(name) {
  for (const group of MEMBER_GROUPS) {
    if (group.includes(name)) return group;
  }
  return null;
}

function applyGrouping(balance) {
  const grouped = {};
  const processed = new Set();

  // First, merge grouped members
  for (const group of MEMBER_GROUPS) {
    const label = getGroupLabel(group);
    let sum = 0;
    for (const m of group) {
      sum += (balance[m] || 0);
      processed.add(m);
    }
    grouped[label] = Math.round(sum);
  }

  // Then, keep ungrouped members as-is
  for (const [name, amt] of Object.entries(balance)) {
    if (!processed.has(name)) {
      grouped[name] = amt;
    }
  }

  return grouped;
}

function recalcTransfers(groupedBalance) {
  const creditors = [], debtorsList = [];
  Object.entries(groupedBalance).forEach(([name, amt]) => {
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
  return transfers;
}

// ===== Settlement =====
async function loadSettlement() {
  showLoader(true);
  try {
    const data = await callAPI("getSettlement");
    userDetails = data.user_details || {};
    populateDetailMemberSelect();

    // Apply member grouping
    const groupedBalance = applyGrouping(data.balance);
    const groupedTransfers = recalcTransfers(groupedBalance);

    renderBalance(groupedBalance);
    renderTransfers(groupedTransfers);
    updatePersonalSummary(groupedBalance);
    renderPersonalDetails();
    await loadMessages();
  } finally { showLoader(false); }
}

function populateDetailMemberSelect() {
  const sel = document.getElementById("detailMemberSelect");
  if (!sel) return;
  sel.innerHTML = "";

  // Build grouped options
  const processed = new Set();
  const options = [];

  for (const group of MEMBER_GROUPS) {
    const label = getGroupLabel(group);
    options.push(label);
    group.forEach(m => processed.add(m));
  }
  Object.keys(userDetails).forEach(m => {
    if (!processed.has(m)) options.push(m);
  });

  options.forEach(label => {
    const opt = new Option(label, label);
    // Select if currentUser matches or is in this group
    if (label === currentUser || (label.includes('+') && label.split('+').includes(currentUser))) {
      opt.selected = true;
    }
    sel.appendChild(opt);
  });
}

function renderPersonalDetails() {
  const sel = document.getElementById("detailMemberSelect");
  if (!sel) return;
  const selected = sel.value;

  // Merge details from all members in the group
  const members = selected.includes('+') ? selected.split('+') : [selected];
  let mergedList = [];
  const seenTxKeys = new Set();
  members.forEach(m => {
    (userDetails[m] || []).forEach(tx => {
      // Deduplicate: same id + same type = same transaction
      const key = `${tx.id}-${tx.type}`;
      if (!seenTxKeys.has(key)) {
        seenTxKeys.add(key);
        mergedList.push(tx);
      }
    });
  });

  const tbody = document.getElementById("personalDetailBody");
  const catIcons = { 住宿:"🏨", 交通:"🚌", 餐飲:"🍜", 雪場:"⛷️", 移動:"✈️", "門票/活動":"🎫" };
  let html = "", totalPay = 0, totalOwe = 0;

  mergedList.forEach(tx => {
    const isPay = tx.type === "pay";
    const amt = Number(tx.amount);
    if (isPay) totalPay += amt; else totalOwe += amt;
    const sign = isPay ? "+" : "-";
    const color = isPay ? "var(--accent)" : "var(--warning)";
    const icon = catIcons[tx.category] || "📌";
    html += `<tr><td>${formatDate(tx.date)}</td><td>${icon}</td>
      <td><div style="font-weight:600">${esc(tx.item||"-")}</div><div style="font-size:11px;color:var(--text-muted)">${esc(tx.note||"")}</div></td>
      <td style="font-size:13px;">${esc((tx.payers||[]).join("、")||"-")}</td>
      <td style="font-size:13px;">${esc((tx.debtors||[]).join("、")||"-")}</td>
      <td><span class="badge ${isPay?'badge-ok':'badge-pending'}">${esc(tx.desc)}</span></td>
      <td style="color:${color};font-weight:bold;text-align:right;">${sign} NT$ ${formatNum(amt)}</td></tr>`;
  });

  if (!mergedList.length) html = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px;">無明細</td></tr>';
  tbody.innerHTML = html;

  const net = totalPay - totalOwe;
  const netColor = net > 0 ? "var(--accent)" : net < 0 ? "var(--error)" : "var(--text-primary)";
  document.getElementById("personalDetailTotal").innerHTML = `
    <div style="color:var(--text-secondary);margin-bottom:5px;">代墊: <span style="color:var(--accent)">+NT$ ${formatNum(totalPay)}</span> &nbsp;|&nbsp; 應付: <span style="color:var(--warning)">-NT$ ${formatNum(totalOwe)}</span></div>
    <div style="font-size:1.3em;color:${netColor};margin-top:10px;border-top:1px solid rgba(255,255,255,0.1);padding-top:10px;">淨額: ${net>0?"+":""}NT$ ${formatNum(net)}</div>`;
}

function updatePersonalSummary(balance) {
  const div = document.getElementById("personalSummary");
  // Look up balance: try direct name first, then check if user is in a group
  let b = balance[currentUser];
  if (b === undefined) {
    const group = findGroupForMember(currentUser);
    if (group) b = balance[getGroupLabel(group)] || 0;
    else b = 0;
  }
  const displayName = currentUser;
  if (b === 0) div.innerHTML = `<div><h2>👋 嗨，${displayName}</h2><p style="color:var(--text-secondary)">已結清！</p></div><div class="ps-amount ps-zero">NT$ 0</div>`;
  else if (b > 0) div.innerHTML = `<div><h2>👋 嗨，${displayName}</h2><p style="color:var(--text-secondary)">可收回</p></div><div class="ps-amount ps-positive">+ NT$ ${formatNum(b)}</div>`;
  else div.innerHTML = `<div><h2>👋 嗨，${displayName}</h2><p style="color:var(--text-secondary)">需支付</p></div><div class="ps-amount ps-negative">- NT$ ${formatNum(Math.abs(b))}</div>`;
  div.style.display = "flex";
}

function renderBalance(balance) {
  const grid = document.getElementById("balanceGrid");
  let html = "";
  Object.entries(balance).sort((a,b) => Math.abs(b[1]) - Math.abs(a[1])).forEach(([name, amt]) => {
    const cls = amt > 0 ? "positive" : amt < 0 ? "negative" : "zero";
    const label = amt > 0 ? "可收回" : amt < 0 ? "需支付" : "已結清";
    const sign = amt > 0 ? "+" : amt < 0 ? "-" : "";
    html += `<div class="balance-card ${cls}" style="cursor:pointer;" onclick="selectMember('${name}')">
      <div class="balance-avatar">${name.charAt(name.length-1)}</div>
      <div class="balance-info"><div class="balance-name">${name}</div>
      <div class="balance-amount">${sign}NT$ ${formatNum(Math.abs(amt))}</div>
      <div class="balance-label">${label}</div></div></div>`;
  });
  grid.innerHTML = html;
}

function selectMember(name) {
  const sel = document.getElementById("detailMemberSelect");
  if (sel) { sel.value = name; renderPersonalDetails(); sel.scrollIntoView({ behavior:"smooth", block:"center" }); }
}

function renderTransfers(transfers) {
  const list = document.getElementById("transferList");
  if (!transfers.length) { list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">沒有需要轉帳的項目</p>'; return; }
  let html = "";
  transfers.forEach(t => {
    // 檢查收款人有沒有帳號 — 支援分組名稱（如 "林大為+張雨玄"）
    const toMembers = t.to.includes("+") ? t.to.split("+") : [t.to];
    let qrBtnHtml = "";
    let qrModalHtml = "";

    // 為每個有帳號的組員產生 QR Code
    toMembers.forEach(member => {
      const info = globalBankAccounts[member];
      if (info) {
        const qrUrl = getQrUrl(info.bank, info.account);
        if (qrUrl) {
          const qrId = `qr-${t.from}-${member}-${Math.random().toString(36).substring(7)}`;
          qrBtnHtml += `<div style="margin-top:10px;"><button class="transfer-qr-btn" onclick="document.getElementById('${qrId}').style.display='flex'">📱 ${member} 收款條碼</button></div>`;
          qrModalHtml += `<div class="modal-overlay" id="${qrId}" style="display:none" onclick="this.style.display='none'">
            <div class="modal-content" style="text-align:center;max-width:320px;" onclick="event.stopPropagation()">
              <h3 style="margin-top:0;">${member} 的收款條碼</h3>
              <p style="color:var(--text-secondary);font-size:13px;line-height:1.5;margin-bottom:20px;">
                ${info.bank}<br>帳號：${info.account}
              </p>
              <div style="background:white;padding:12px;border-radius:12px;display:inline-block;">
                <img src="${qrUrl}" width="180" height="180" style="display:block;">
              </div>
              <button class="btn btn-secondary" style="margin-top:20px;width:100%;" onclick="document.getElementById('${qrId}').style.display='none'">關閉</button>
            </div>
          </div>`;
        }
      }
    });

    // 已匯款按鈕 — 支援分組（檢查 currentUser 是否在 from 群組中）
    let transferDoneBtn = "";
    const fromMembers = t.from.includes("+") ? t.from.split("+") : [t.from];
    if (fromMembers.includes(currentUser)) {
      transferDoneBtn = `<div style="margin-top:10px;"><button class="btn-transfer-done" onclick="showTransferConfirmModal('${t.from}','${t.to}',${t.amount})">✅ 我已匯款</button></div>`;
    }

    html += `<div class="transfer-item" style="flex-wrap:wrap;">
      <div style="width:100%;display:flex;align-items:center;min-width:0;">
        <span class="transfer-from">${t.from}</span><span class="transfer-arrow" style="margin:0 12px;">→</span>
        <span class="transfer-to">${t.to}</span>
        <span class="transfer-amount" style="margin-left:auto;">NT$ ${formatNum(t.amount)}</span>
      </div>
      ${qrBtnHtml}
      ${transferDoneBtn}
      ${qrModalHtml}
    </div>`;
  });
  list.innerHTML = html;
}

// ===== Messages =====
async function loadMessages() {
  const msgs = await callAPI("getMessages");
  const board = document.getElementById("messageBoard");
  if (!msgs || !msgs.length) {
    board.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:30px 20px;">還沒有留言，頭香等你來搶！</div>';
    return;
  }
  let html = "";
  msgs.forEach(m => {
    // 匯款通知格式: [匯款通知] 付款人 → 收款人 NT$ 金額 | 後五碼: XXXXX | 備註
    const transferMatch = m.message.match(/^\[匯款通知\]\s*(.+?)\s*→\s*(.+?)\s*NT\$\s*([\d,]+)\s*\|\s*後五碼:\s*(\d+)(?:\s*\|\s*(.+))?$/);
    if (transferMatch) {
      const [, from, to, amount, lastFive, note] = transferMatch;
      html += `<div class="msg-item transfer-notice">
        <div class="msg-header"><span class="msg-user">${esc(m.user)}</span><span>${esc(m.time)}</span></div>
        <div class="msg-content">
          <span class="transfer-notice-badge">💸 匯款通知</span>
          ${esc(from)} → ${esc(to)} <strong style="color:var(--warning);">NT$ ${esc(amount)}</strong>
        </div>
        <div class="transfer-notice-detail">
          <span>🔢 後五碼: ${esc(lastFive)}</span>
          ${note ? `<span>📝 ${esc(note)}</span>` : ''}
        </div>
      </div>`;
    } else {
      html += `<div class="msg-item">
        <div class="msg-header"><span class="msg-user">${esc(m.user)}</span><span>${esc(m.time)}</span></div>
        <div class="msg-content">${esc(m.message)}</div>
      </div>`;
    }
  });
  board.innerHTML = html;
  board.scrollTop = board.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById("msgInput");
  const message = input.value.trim();
  if (!message) return;
  
  showLoader(true);
  try {
    await callAPI("addMessage", { user: currentUser, message });
    input.value = "";
    await loadMessages();
    showToast("留言已送出", "success");
  } catch (err) {
    showToast("發送失敗", "error");
  } finally {
    showLoader(false);
  }
}

// ===== Transfer Confirm =====
function showTransferConfirmModal(from, to, amount) {
  pendingTransfer = { from, to, amount };
  document.getElementById("tcFrom").textContent = from;
  document.getElementById("tcTo").textContent = to;
  document.getElementById("tcAmount").textContent = `NT$ ${formatNum(amount)}`;
  document.getElementById("tcLastFive").value = "";
  document.getElementById("tcNote").value = "";
  document.getElementById("transferConfirmModal").style.display = "flex";
  setTimeout(() => document.getElementById("tcLastFive").focus(), 100);
}

function closeTransferConfirmModal() {
  document.getElementById("transferConfirmModal").style.display = "none";
  pendingTransfer = null;
}

async function confirmTransfer() {
  if (!pendingTransfer) return;
  const lastFive = document.getElementById("tcLastFive").value.trim();
  if (!lastFive || lastFive.length < 3) {
    showToast("請輸入匯款帳號後五碼", "error");
    return;
  }
  const note = document.getElementById("tcNote").value.trim();
  const msg = `[匯款通知] ${pendingTransfer.from} → ${pendingTransfer.to} NT$ ${formatNum(pendingTransfer.amount)} | 後五碼: ${lastFive}${note ? ` | ${note}` : ''}`;

  showLoader(true);
  try {
    await callAPI("addMessage", { user: currentUser, message: msg });
    closeTransferConfirmModal();
    await loadMessages();
    showToast("匯款通知已送出！🎉", "success");
  } catch (err) {
    showToast("發送失敗", "error");
  } finally {
    showLoader(false);
  }
}

// ===== Utils =====
function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast("📋 已複製帳號：\n" + text, "success");
  }).catch(() => {
    showToast("複製失敗", "error");
  });
}

function formatNum(n) { return n == null ? "-" : Math.round(n).toLocaleString(); }
function formatDate(d) {
  if (!d || d === "-") return "-";
  const s = String(d).trim();
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})/);
  if (slashMatch) return `${slashMatch[1].padStart(2,'0')}/${slashMatch[2].padStart(2,'0')}`;
  const cnMatch = s.match(/(\d{1,2})月(\d{1,2})日?/);
  if (cnMatch) return `${cnMatch[1].padStart(2,'0')}/${cnMatch[2].padStart(2,'0')}`;
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return `${String(parsed.getMonth()+1).padStart(2,'0')}/${String(parsed.getDate()).padStart(2,'0')}`;
  return d;
}
function esc(s) { if (!s) return ""; const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
function showToast(msg, type = "success") {
  const t = document.createElement("div"); t.className = `toast toast-${type}`; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 3000);
}
