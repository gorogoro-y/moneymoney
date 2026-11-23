// js/app.js
// アプリケーション・エントリーポイント

// クラウドステータス通知ハンドラ
onCloudStatusChange((info) => {
  updateCloudStatusUI(info);
});

// --- 月送り・月戻し ---
function changeMonth(delta) {
  const [y, m] = state.currentMonth.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  state.currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  render();
}

// --- クラウド・認証モーダル ---
function openCloudModal() {
  const shareInput = document.getElementById("sharedPassphraseInput");
  if (shareInput) shareInput.value = state.sharedPassphrase;
  runFullCloudDiagnostic();
  openModal('cloudModal');
}

async function handleGoogleSignIn() {
  try {
    await signInWithGoogle();
    showSaveToast("Googleアカウントで接続・同期しました！");
  } catch (err) {
    customConfirm(err.message, null, true);
  }
}

async function handleGoogleSignOut() {
  customConfirm("ログアウトしますか？\n（ログアウト後は端末のローカルキャッシュのみ参照されます）", async (ok) => {
    if (!ok) return;
    try {
      await signOutFromGoogle();
      showSaveToast("ログアウトしました");
    } catch (err) {
      customConfirm("ログアウト処理中にエラーが発生しました: " + err.message, null, true);
    }
  });
}

async function fetchLatestFromCloud(showToast = true) {
  try {
    await fetchVaultDataFromCloud();
    if (showToast) showSaveToast("クラウドから最新データを受信しました！");
  } catch (err) {
    if (showToast) customConfirm(err.message, null, true);
  }
}

async function handleApplySharedPassphrase() {
  const input = document.getElementById("sharedPassphraseInput");
  const val = input ? input.value.trim() : "";
  const result = await applySharedPassphrase(val);

  if (val) {
    if (result.isExisting) {
      showSaveToast("相手の共有カードデータと接続・同期しました！");
    } else {
      showSaveToast("新しい家族合言葉として登録しました！");
    }
  }
  closeModal('cloudModal');
}

function copySecurityRule() {
  const ruleEl = document.getElementById("securityRuleCode");
  if (!ruleEl) return;
  const ruleCode = ruleEl.innerText;
  const textarea = document.createElement("textarea");
  textarea.value = ruleCode;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
  showSaveToast("セキュリティルールをコピーしました");
}

// --- 支出（利用明細: Expense）の操作 ---
function setExpensePaymentType(type) {
  const typeInput = document.getElementById("expPaymentType");
  const btnSource = document.getElementById("expTypeBtnSource");
  const btnCash = document.getElementById("expTypeBtnCash");
  const sourceContainer = document.getElementById("expSourceContainer");
  const dateLabel = document.getElementById("expDateLabel");

  if (typeInput) typeInput.value = type;

  if (type === 'CASH') {
    if (btnCash) {
      btnCash.className = "py-1.5 text-xs font-bold rounded-lg bg-white text-emerald-800 shadow-sm transition";
    }
    if (btnSource) {
      btnSource.className = "py-1.5 text-xs font-bold rounded-lg text-slate-500 hover:text-slate-800 transition";
    }
    if (sourceContainer) sourceContainer.classList.add("hidden");
    if (dateLabel) dateLabel.innerText = "利用日";
  } else {
    if (btnSource) {
      btnSource.className = "py-1.5 text-xs font-bold rounded-lg bg-white text-slate-800 shadow-sm transition";
    }
    if (btnCash) {
      btnCash.className = "py-1.5 text-xs font-bold rounded-lg text-slate-500 hover:text-slate-800 transition";
    }
    if (sourceContainer) sourceContainer.classList.remove("hidden");
    if (dateLabel) dateLabel.innerText = "利用日 / 引落日";
  }
}

function openExpenseModalWithSource(sourceId = null, paymentType = 'SOURCE') {
  document.getElementById("editingExpenseId").value = "";
  document.getElementById("expenseModalTitle").innerText = "支出明細の入力";
  document.getElementById("expenseSubmitBtn").innerText = "登録";
  document.getElementById("expAmountInput").value = "";
  document.getElementById("expMemoInput").value = "";
  document.getElementById("expDateInput").value = getLocalTodayDateString();

  if (sourceId === 'CASH' || sourceId === CASH_SOURCE_ID || paymentType === 'CASH') {
    setExpensePaymentType('CASH');
  } else {
    setExpensePaymentType('SOURCE');
    const select = document.getElementById("expSourceSelect");
    if (sourceId && select) select.value = sourceId;
  }

  openModal('expenseModal');
}

function openEditExpenseModal(id) {
  const exp = state.expenses.find(e => e.id === id);
  if (!exp) return;

  document.getElementById("editingExpenseId").value = exp.id;
  document.getElementById("expenseModalTitle").innerText = "支出明細の編集";
  document.getElementById("expenseSubmitBtn").innerText = "更新する";

  if (exp.sourceId === 'CASH' || exp.sourceId === CASH_SOURCE_ID) {
    setExpensePaymentType('CASH');
  } else {
    setExpensePaymentType('SOURCE');
    const select = document.getElementById("expSourceSelect");
    if (select) select.value = exp.sourceId;
  }

  document.getElementById("expDateInput").value = exp.date;
  document.getElementById("expAmountInput").value = exp.amount;
  document.getElementById("expMemoInput").value = exp.memo || "";

  openModal('expenseModal');
}

async function handleSaveExpense(e) {
  e.preventDefault();
  const editId = document.getElementById("editingExpenseId").value;
  const paymentType = document.getElementById("expPaymentType")?.value || 'SOURCE';
  const date = document.getElementById("expDateInput").value;
  const amount = Number(document.getElementById("expAmountInput").value);
  const memo = document.getElementById("expMemoInput").value.trim();

  let sourceId = paymentType === 'CASH' ? CASH_SOURCE_ID : document.getElementById("expSourceSelect").value;
  let isShared = false;

  if (paymentType === 'CASH') {
    if (!date || isNaN(amount) || amount <= 0) {
      customConfirm("正しい日付と金額を入力してください。", null, true);
      return;
    }
  } else {
    if (!sourceId || !date || isNaN(amount) || amount <= 0) {
      customConfirm("正しい支払元、日付、金額を入力してください。", null, true);
      return;
    }
    const targetSrc = state.sources.find(s => s.id === sourceId);
    isShared = targetSrc ? !!targetSrc.isShared : false;
  }

  if (editId) {
    state.personalExpenses = state.personalExpenses.filter(x => x.id !== editId);
    state.sharedExpenses = state.sharedExpenses.filter(x => x.id !== editId);

    const updated = { id: editId, sourceId, date, amount, memo, isShared };
    if (isShared) {
      state.sharedExpenses.unshift(updated);
    } else {
      state.personalExpenses.unshift(updated);
    }
  } else {
    const newExp = { id: "e-" + Date.now(), sourceId, date, amount, memo, isShared };
    if (isShared) {
      state.sharedExpenses.unshift(newExp);
    } else {
      state.personalExpenses.unshift(newExp);
    }
  }

  closeModal("expenseModal");
  mergeAndRefreshData();
  render();
  const res = await syncToCloud();
  if (res.success) {
    showSaveToast("クラウドと同期しました");
  } else if (res.reason === "offline") {
    showSaveToast("端末内に保存しました（未ログイン）");
  }
}

function deleteExpense(id) {
  const target = state.expenses.find(e => e.id === id);
  const memoText = target ? (target.memo || '未分類') : 'この明細';
  const amountText = target ? `¥${Number(target.amount).toLocaleString()}` : '';
  const dateText = target ? target.date : '';
  const msg = `以下の支出明細を削除しますか？\n【${memoText}】 ${amountText} (${dateText})`;

  customConfirm(msg, async (ok) => {
    if (!ok) return;
    state.personalExpenses = state.personalExpenses.filter(e => e.id !== id);
    state.sharedExpenses = state.sharedExpenses.filter(e => e.id !== id);
    mergeAndRefreshData();
    render();
    await syncToCloud();
    showSaveToast("明細を削除しました");
  });
}

// --- 変動収入明細（Income Entry）の操作 ---
function openCreateIncomeEntryModal() {
  const sortedInc = getSortedIncomeSources();
  if (sortedInc.length === 0) {
    customConfirm("まず収入元（勤務先や副業先など）を登録してください。", (ok) => {
      if (ok) openCreateIncomeSourceModal();
    });
    return;
  }

  document.getElementById("incomeEntryModalTitle").innerText = "＋ 収入入力";
  document.getElementById("incomeEntrySubmitBtn").innerText = "登録";
  document.getElementById("editingIncomeEntryId").value = "";
  document.getElementById("incEntryDateInput").value = getLocalTodayDateString();
  document.getElementById("incEntryAmountInput").value = "";
  document.getElementById("incEntryMemoInput").value = "";

  updateSelectOptions();
  openModal('incomeEntryModal');
}

function openEditIncomeEntryModal(id) {
  const ie = (state.incomeEntries || []).find(item => item.id === id);
  if (!ie) return;

  document.getElementById("incomeEntryModalTitle").innerText = "収入明細の編集";
  document.getElementById("incomeEntrySubmitBtn").innerText = "更新する";
  document.getElementById("editingIncomeEntryId").value = ie.id;
  document.getElementById("incEntryDateInput").value = ie.date;
  document.getElementById("incEntryAmountInput").value = ie.amount;
  document.getElementById("incEntryMemoInput").value = ie.memo || "";

  updateSelectOptions();
  const select = document.getElementById("incEntrySourceSelect");
  if (select) select.value = ie.sourceId;

  openModal('incomeEntryModal');
}

async function handleSaveIncomeEntry(e) {
  e.preventDefault();
  const editId = document.getElementById("editingIncomeEntryId").value;
  const sourceId = document.getElementById("incEntrySourceSelect").value;
  const date = document.getElementById("incEntryDateInput").value;
  const amount = Number(document.getElementById("incEntryAmountInput").value);
  const memo = document.getElementById("incEntryMemoInput").value.trim();

  if (!sourceId || !date || isNaN(amount) || amount <= 0) {
    customConfirm("収入元、入金日、金額を正しく入力してください。", null, true);
    return;
  }

  const newEntry = {
    id: editId || ("ie-" + Date.now()),
    sourceId,
    date,
    amount,
    memo,
    isShared: false
  };

  if (editId) {
    state.personalIncomeEntries = (state.personalIncomeEntries || []).filter(item => item.id !== editId);
    state.sharedIncomeEntries = (state.sharedIncomeEntries || []).filter(item => item.id !== editId);
  }

  state.personalIncomeEntries.unshift(newEntry);

  closeModal("incomeEntryModal");
  mergeAndRefreshData();
  render();
  await syncToCloud();
  showSaveToast("収入を入力しました！");
}

function deleteIncomeEntry(id) {
  const target = (state.incomeEntries || []).find(ie => ie.id === id);
  const memoText = target ? (target.memo || '収入') : 'この収入';
  const amountText = target ? `¥${Number(target.amount).toLocaleString()}` : '';
  const dateText = target ? target.date : '';

  customConfirm(`以下の収入明細を削除しますか？\n【${memoText}】 ${amountText} (${dateText})`, async (ok) => {
    if (!ok) return;
    state.personalIncomeEntries = (state.personalIncomeEntries || []).filter(ie => ie.id !== id);
    state.sharedIncomeEntries = (state.sharedIncomeEntries || []).filter(ie => ie.id !== id);
    mergeAndRefreshData();
    render();
    await syncToCloud();
    showSaveToast("収入明細を削除しました");
  });
}

// --- 収入元マスター（Income Source）の操作 ---
function openCreateIncomeSourceModal() {
  document.getElementById("incomeSourceModalTitle").innerText = "収入元の追加";
  document.getElementById("incomeSourceSubmitBtn").innerText = "追加";
  document.getElementById("editingIncomeSourceId").value = "";
  document.getElementById("incSourceNameInput").value = "";
  openModal('incomeSourceModal');
}

function openEditIncomeSourceModal(id) {
  const is = (state.incomeSources || []).find(item => item.id === id);
  if (!is) return;

  document.getElementById("incomeSourceModalTitle").innerText = "収入元の編集";
  document.getElementById("incomeSourceSubmitBtn").innerText = "更新する";
  document.getElementById("editingIncomeSourceId").value = is.id;
  document.getElementById("incSourceNameInput").value = is.name;
  openModal('incomeSourceModal');
}

async function handleSaveIncomeSource(e) {
  e.preventDefault();
  const editId = document.getElementById("editingIncomeSourceId").value;
  const name = document.getElementById("incSourceNameInput").value.trim();

  if (!name) {
    customConfirm("収入元の名称を入力してください。", null, true);
    return;
  }

  const maxOrder = (state.incomeSources || []).reduce((max, is) => Math.max(max, is.order ?? 0), -1);
  const existing = editId ? (state.incomeSources || []).find(is => is.id === editId) : null;
  const order = existing && typeof existing.order === 'number' ? existing.order : (maxOrder + 1);

  const newSource = {
    id: editId || ("is-" + Date.now()),
    name,
    isShared: false,
    order
  };

  if (editId) {
    state.personalIncomeSources = (state.personalIncomeSources || []).filter(is => is.id !== editId);
    state.sharedIncomeSources = (state.sharedIncomeSources || []).filter(is => is.id !== editId);
  }

  state.personalIncomeSources.push(newSource);

  closeModal("incomeSourceModal");
  mergeAndRefreshData();
  render();
  await syncToCloud();
  showSaveToast("収入元を登録しました");

  // もし収入入力モーダルが開いていた場合はセレクトボックスを即時反映して選択
  const entrySelect = document.getElementById("incEntrySourceSelect");
  if (entrySelect) {
    entrySelect.value = newSource.id;
  }
}

function deleteIncomeSource(id) {
  customConfirm("この収入元を削除しますか？\n（関連する収入明細も削除されます）", async (ok) => {
    if (!ok) return;
    state.personalIncomeSources = (state.personalIncomeSources || []).filter(is => is.id !== id);
    state.sharedIncomeSources = (state.sharedIncomeSources || []).filter(is => is.id !== id);
    state.personalIncomeEntries = (state.personalIncomeEntries || []).filter(ie => ie.sourceId !== id);
    state.sharedIncomeEntries = (state.sharedIncomeEntries || []).filter(ie => ie.sourceId !== id);

    mergeAndRefreshData();
    render();
    await syncToCloud();
    showSaveToast("収入元を削除しました");
  });
}

async function handleMoveIncomeSourceOrder(sourceId, direction) {
  const success = moveIncomeSourceOrder(sourceId, direction);
  if (success) {
    render();
    await syncToCloud(false);
  }
}

// --- カード・口座（Source）の操作 ---
function setSourceType(type) {
  state.selectedSourceType = type;
  if (type === "CREDIT") {
    document.getElementById("btnTypeCredit").className = "py-1.5 font-bold rounded-lg border bg-indigo-600 border-indigo-600 text-white";
    document.getElementById("btnTypeBank").className = "py-1.5 font-bold rounded-lg border bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200";
    document.getElementById("creditRuleInputs").classList.remove("hidden");
    document.getElementById("bankRuleInputs").classList.add("hidden");
  } else {
    document.getElementById("btnTypeCredit").className = "py-1.5 font-bold rounded-lg border bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200";
    document.getElementById("btnTypeBank").className = "py-1.5 font-bold rounded-lg border bg-teal-600 border-teal-600 text-white";
    document.getElementById("creditRuleInputs").classList.add("hidden");
    document.getElementById("bankRuleInputs").classList.remove("hidden");
  }
}

function updateCreditRulePreview() {
  const closingDay = Number(document.getElementById("srcClosingSelect").value);
  const offset = Number(document.getElementById("srcPaymentOffsetSelect").value);
  const paymentDay = Number(document.getElementById("srcPaymentSelect").value);

  const closeText = closingDay === 99 ? '月末' : `${closingDay} 日`;
  const offsetText = offset === 1 ? '翌月' : (offset === 2 ? '翌々月' : '当月');
  const payText = paymentDay === 99 ? '末日' : `${paymentDay} 日`;

  const previewEl = document.getElementById("creditRulePreviewText");
  if (previewEl) {
    previewEl.innerText = `毎月 ${closeText} 締め ${offsetText} ${payText} 払い`;
  }
}

function openCreateSourceModal() {
  document.getElementById("sourceModalTitle").innerText = "カード / 銀行口座の追加";
  document.getElementById("sourceSubmitBtn").innerText = "追加";
  document.getElementById("editingSourceId").value = "";
  document.getElementById("srcNameInput").value = "";
  document.getElementById("srcClosingSelect").value = "15";
  document.getElementById("srcPaymentOffsetSelect").value = "1";
  document.getElementById("srcPaymentSelect").value = "10";
  document.getElementById("srcIsSharedCheckbox").checked = false;
  const budgetBox = document.getElementById("srcIncludeInBudgetCheckbox");
  if (budgetBox) budgetBox.checked = true;
  setSourceType("CREDIT");
  updateCreditRulePreview();
  openModal("sourceModal");
}

function openEditSourceModal(id) {
  const src = state.sources.find(s => s.id === id);
  if (!src) return;

  document.getElementById("sourceModalTitle").innerText = "カード / 銀行口座の編集";
  document.getElementById("sourceSubmitBtn").innerText = "更新する";
  document.getElementById("editingSourceId").value = src.id;
  document.getElementById("srcNameInput").value = src.name;
  document.getElementById("srcIsSharedCheckbox").checked = !!src.isShared;
  const isExcluded = (state.excludedSharedSourceIds || []).includes(src.id);
  const budgetBox = document.getElementById("srcIncludeInBudgetCheckbox");
  if (budgetBox) budgetBox.checked = !isExcluded;
  setSourceType(src.type);

  if (src.type === "CREDIT") {
    document.getElementById("srcClosingSelect").value = String(src.closingDay);
    document.getElementById("srcPaymentOffsetSelect").value = String(typeof src.paymentMonthOffset === 'number' ? src.paymentMonthOffset : 1);
    document.getElementById("srcPaymentSelect").value = String(src.paymentDay);
    updateCreditRulePreview();
  }
  openModal("sourceModal");
}

async function handleSaveSource(e) {
  e.preventDefault();
  const editId = document.getElementById("editingSourceId").value;
  const name = document.getElementById("srcNameInput").value.trim();
  const isShared = document.getElementById("srcIsSharedCheckbox").checked;
  const closingDay = state.selectedSourceType === "CREDIT" ? Number(document.getElementById("srcClosingSelect").value) : 0;
  const paymentMonthOffset = state.selectedSourceType === "CREDIT" ? Number(document.getElementById("srcPaymentOffsetSelect").value) : 0;
  const paymentDay = state.selectedSourceType === "CREDIT" ? Number(document.getElementById("srcPaymentSelect").value) : 0;

  if (!name) {
    customConfirm("名前・金融機関名を入力してください。", null, true);
    return;
  }

  const maxOrder = state.sources.reduce((max, s) => Math.max(max, s.order ?? 0), -1);
  const existing = editId ? state.sources.find(s => s.id === editId) : null;
  const order = existing && typeof existing.order === 'number' ? existing.order : (maxOrder + 1);

  const newSourceData = {
    id: editId || ("s-" + Date.now()),
    name,
    type: state.selectedSourceType,
    closingDay,
    paymentMonthOffset,
    paymentDay,
    isShared,
    order
  };

  if (editId) {
    state.personalSources = state.personalSources.filter(s => s.id !== editId);
    state.sharedSources = state.sharedSources.filter(s => s.id !== editId);
  }

  if (isShared) {
    state.sharedSources.push(newSourceData);
  } else {
    state.personalSources.push(newSourceData);
  }

  // 自分の収支への反映/除外設定を個人設定に反映
  const budgetBox = document.getElementById("srcIncludeInBudgetCheckbox");
  const includeInBudget = budgetBox ? budgetBox.checked : true;
  if (!state.excludedSharedSourceIds) state.excludedSharedSourceIds = [];
  if (!includeInBudget) {
    if (!state.excludedSharedSourceIds.includes(newSourceData.id)) {
      state.excludedSharedSourceIds.push(newSourceData.id);
    }
  } else {
    state.excludedSharedSourceIds = state.excludedSharedSourceIds.filter(id => id !== newSourceData.id);
  }
  saveToLocalCache();

  // カードの共有ON/OFF変更に合わせて、登録済み明細の共有フラグも連動更新
  const allExpenses = [...state.personalExpenses, ...state.sharedExpenses];
  state.personalExpenses = [];
  state.sharedExpenses = [];
  allExpenses.forEach(exp => {
    const card = (exp.sourceId === newSourceData.id) ? newSourceData : state.sources.find(s => s.id === exp.sourceId);
    const cardIsShared = card ? !!card.isShared : !!exp.isShared;
    const updatedExp = { ...exp, isShared: cardIsShared };
    if (cardIsShared) {
      state.sharedExpenses.push(updatedExp);
    } else {
      state.personalExpenses.push(updatedExp);
    }
  });

  closeModal("sourceModal");
  mergeAndRefreshData();
  render();
  await syncToCloud();
  showSaveToast("カード・口座を保存しました");
}

/**
 * 共有カードを自分の収支に反映/除外をワンタップで切り替え（個人設定）
 */
async function toggleExcludeSharedSource(sourceId) {
  if (!state.excludedSharedSourceIds) state.excludedSharedSourceIds = [];
  const idx = state.excludedSharedSourceIds.indexOf(sourceId);
  let isNowExcluded = false;
  if (idx >= 0) {
    state.excludedSharedSourceIds.splice(idx, 1);
    isNowExcluded = false;
  } else {
    state.excludedSharedSourceIds.push(sourceId);
    isNowExcluded = true;
  }
  saveToLocalCache();
  render();
  await syncToCloud();
  showSaveToast(isNowExcluded ? "このカードを自分の収支から除外しました" : "このカードを自分の収支に反映しました");
}

function deleteSource(id) {
  if (state.sources.length <= 1) {
    customConfirm("最低1つのカードまたは口座が必要です。", null, true);
    return;
  }
  customConfirm("このカード/口座を削除しますか？\n（関連する利用明細や固定費設定も削除されます）", async (ok) => {
    if (!ok) return;
    state.personalSources = state.personalSources.filter(s => s.id !== id);
    state.sharedSources = state.sharedSources.filter(s => s.id !== id);
    state.personalExpenses = state.personalExpenses.filter(e => e.sourceId !== id);
    state.sharedExpenses = state.sharedExpenses.filter(e => e.sourceId !== id);
    state.personalRecurring = state.personalRecurring.filter(r => r.sourceId !== id);
    state.sharedRecurring = state.sharedRecurring.filter(r => r.sourceId !== id);
    state.excludedSharedSourceIds = (state.excludedSharedSourceIds || []).filter(x => x !== id);
    saveToLocalCache();

    mergeAndRefreshData();
    render();
    await syncToCloud();
    showSaveToast("削除しました");
  });
}

async function handleMoveSourceOrder(sourceId, direction) {
  const success = moveSourceOrder(sourceId, direction);
  if (success) {
    render();
    await syncToCloud(false);
  }
}

// --- 年払い・固定費（Recurring）の操作 ---
function toggleTargetMonth() {
  const isYearly = document.getElementById("recFreqSelect").value === "YEARLY";
  const el = document.getElementById("targetMonthWrapper");
  if (el) el.style.display = isYearly ? "block" : "none";
}

function updateRecurringRulePreview() {
  const sourceId = document.getElementById("recSourceSelect").value;
  const source = state.sources.find(s => s.id === sourceId);
  const frequency = document.getElementById("recFreqSelect").value;
  const targetMonth = Number(document.getElementById("recMonthSelect").value);
  const targetDay = Number(document.getElementById("recDaySelect").value);

  const previewEl = document.getElementById("recurringRulePreviewText");
  if (!previewEl) return;

  const [curY] = state.currentMonth ? state.currentMonth.split("-").map(Number) : [new Date().getFullYear()];
  const dayText = targetDay === 99 ? '末日' : `${targetDay}日`;

  if (sourceId === "CASH") {
    if (frequency === "YEARLY") {
      previewEl.innerText = `毎年 【${targetMonth}月${dayText} 現金支払い】（当月明細の現金枠に反映）`;
    } else {
      previewEl.innerText = `毎月 【${dayText} 現金支払い】（当月明細の現金枠に反映）`;
    }
    return;
  }

  if (!source) return;

  if (frequency === "YEARLY") {
    const dummyItem = { targetMonth, targetDay, frequency, sourceId };
    const dueInfo = getRecurringDueDateInfo(dummyItem, source, curY);
    const [, payM] = dueInfo.payMonth.split("-");
    const payD = dueInfo.payDate.split("-")[2];

    if (source.type === "CREDIT") {
      previewEl.innerText = `毎年 ${targetMonth}月${dayText}利用 ➔ 【${Number(payM)}月${Number(payD)}日引落】(${source.name}の締め日/支払日を自動適用)`;
    } else {
      previewEl.innerText = `毎年 【${targetMonth}月${dayText}引落】(口座振替: ${source.name})`;
    }
  } else {
    const dummyItem = { targetMonth: Number((state.currentMonth || new Date().toISOString().slice(0, 7)).split("-")[1]), targetDay, frequency, sourceId };
    const dueInfo = getRecurringDueDateInfo(dummyItem, source, curY);
    const [, payM] = dueInfo.payMonth.split("-");
    const payD = dueInfo.payDate.split("-")[2];

    if (source.type === "CREDIT") {
      previewEl.innerText = `毎月 ${dayText}利用 ➔ 毎月 ${Number(payD)}日頃引落 (${source.name})`;
    } else {
      previewEl.innerText = `毎月 【${dayText}引落】(口座振替: ${source.name})`;
    }
  }
}

function clearRecurringPeriodInputs() {
  const startEl = document.getElementById("recStartMonthInput");
  const endEl = document.getElementById("recEndMonthInput");
  if (startEl) startEl.value = "";
  if (endEl) endEl.value = "";
}

function openCreateRecurringModal() {
  document.getElementById("recurringModalTitle").innerText = "固定費の登録";
  document.getElementById("recurringSubmitBtn").innerText = "登録";
  document.getElementById("editingRecurringId").value = "";
  document.getElementById("recNameInput").value = "";
  document.getElementById("recFreqSelect").value = "YEARLY";
  document.getElementById("recMonthSelect").value = "9";
  document.getElementById("recDaySelect").value = "20";
  document.getElementById("recAmountInput").value = "";
  clearRecurringPeriodInputs();
  if (state.sources.length > 0) {
    document.getElementById("recSourceSelect").value = state.sources[0].id;
  }
  toggleTargetMonth();
  updateRecurringRulePreview();
  openModal("recurringModal");
}

function openEditRecurringModal(id) {
  const item = state.recurringList.find(r => r.id === id);
  if (!item) return;

  document.getElementById("recurringModalTitle").innerText = "固定費の編集";
  document.getElementById("recurringSubmitBtn").innerText = "更新する";
  document.getElementById("editingRecurringId").value = item.id;
  document.getElementById("recNameInput").value = item.name;
  document.getElementById("recFreqSelect").value = item.frequency;
  document.getElementById("recMonthSelect").value = String(item.targetMonth || 9);
  document.getElementById("recDaySelect").value = String(item.targetDay || 20);
  document.getElementById("recAmountInput").value = item.amount;
  document.getElementById("recSourceSelect").value = item.sourceId;
  const startEl = document.getElementById("recStartMonthInput");
  const endEl = document.getElementById("recEndMonthInput");
  if (startEl) startEl.value = item.startMonth || "";
  if (endEl) endEl.value = item.endMonth || "";
  toggleTargetMonth();
  updateRecurringRulePreview();
  openModal("recurringModal");
}

async function handleSaveRecurring(e) {
  e.preventDefault();
  const editId = document.getElementById("editingRecurringId").value;
  const name = document.getElementById("recNameInput").value.trim();
  const frequency = document.getElementById("recFreqSelect").value;
  const targetMonth = Number(document.getElementById("recMonthSelect").value);
  const targetDay = Number(document.getElementById("recDaySelect").value);
  const amount = Number(document.getElementById("recAmountInput").value);
  const sourceId = document.getElementById("recSourceSelect").value;
  const startMonth = document.getElementById("recStartMonthInput")?.value || "";
  const endMonth = document.getElementById("recEndMonthInput")?.value || "";

  if (!name || isNaN(amount) || amount <= 0) {
    customConfirm("正しい名称と金額を入力してください。", null, true);
    return;
  }

  if (startMonth && endMonth && startMonth > endMonth) {
    customConfirm("開始月は終了月以前の年月を指定してください。", null, true);
    return;
  }

  const targetSrc = state.sources.find(s => s.id === sourceId);
  const isShared = targetSrc ? !!targetSrc.isShared : false;

  const recData = {
    id: editId || ("r-" + Date.now()),
    name,
    frequency,
    targetMonth,
    targetDay,
    amount,
    sourceId,
    isShared,
    startMonth: startMonth || null,
    endMonth: endMonth || null
  };

  if (editId) {
    state.personalRecurring = state.personalRecurring.filter(r => r.id !== editId);
    state.sharedRecurring = state.sharedRecurring.filter(r => r.id !== editId);
  }

  if (isShared) {
    state.sharedRecurring.push(recData);
  } else {
    state.personalRecurring.push(recData);
  }

  closeModal("recurringModal");
  mergeAndRefreshData();
  render();
  await syncToCloud();
  showSaveToast("固定費を保存しました");
}

function deleteRecurring(id) {
  customConfirm("この固定費設定を削除しますか？", async (ok) => {
    if (!ok) return;
    state.personalRecurring = state.personalRecurring.filter(r => r.id !== id);
    state.sharedRecurring = state.sharedRecurring.filter(r => r.id !== id);
    mergeAndRefreshData();
    render();
    await syncToCloud();
    showSaveToast("削除しました");
  });
}

// --- バックアップ・データ管理 ---
function exportDataToFile() {
  const user = getCurrentUser();
  downloadJsonFile(user ? user.email : null);
  showSaveToast("JSONバックアップファイルを保存しました");
}

function loadFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  parseImportFile(file).then(parsed => {
    customConfirm("選択したファイルの内容で復元しますか？（現在のデータは上書きされます）", async (ok) => {
      if (!ok) return;
      if (parsed.personal) {
        state.personalSources = parsed.personal.sources || [];
        state.personalExpenses = parsed.personal.expenses || [];
        state.personalRecurring = parsed.personal.recurringList || [];
        state.personalDebts = parsed.personal.debts || [];
        state.personalIncomeSources = parsed.personal.incomeSources || [];
        state.personalIncomeEntries = parsed.personal.incomeEntries || [];

        state.sharedSources = parsed.shared ? (parsed.shared.sources || []) : [];
        state.sharedExpenses = parsed.shared ? (parsed.shared.expenses || []) : [];
        state.sharedRecurring = parsed.shared ? (parsed.shared.recurringList || []) : [];
        state.sharedDebts = parsed.shared ? (parsed.shared.debts || []) : [];
        state.sharedIncomeSources = parsed.shared ? (parsed.shared.incomeSources || []) : [];
        state.sharedIncomeEntries = parsed.shared ? (parsed.shared.incomeEntries || []) : [];

        if (parsed.sharedPassphrase) state.sharedPassphrase = parsed.sharedPassphrase;
      } else if (parsed.sources) {
        state.personalSources = parsed.sources || [];
        state.personalExpenses = parsed.expenses || [];
        state.personalRecurring = parsed.recurringList || [];
        state.personalDebts = [];
        state.personalIncomeSources = [];
        state.personalIncomeEntries = [];
        state.sharedSources = [];
        state.sharedExpenses = [];
        state.sharedRecurring = [];
        state.sharedDebts = [];
        state.sharedIncomeSources = [];
        state.sharedIncomeEntries = [];
      }
      mergeAndRefreshData();
      render();
      await syncToCloud();
      showSaveToast("データを正常に復元しました！");
    });
  }).catch(err => {
    customConfirm(err.message, null, true);
  }).finally(() => {
    event.target.value = "";
  });
}

function confirmResetData() {
  customConfirm("すべてのデータを初期のサンプル状態にリセットしますか？\n（現在の内容は上書きされます）", async (ok) => {
    if (!ok) return;
    resetToDefaultData();
    render();
    await syncToCloud();
    showSaveToast("初期データにリセットしました");
  });
}

// --- アプリケーションの初期化起動 ---
function initApp() {
  initDateSelectOptions();
  initModalBackdropEvents();

  const hasLocal = loadFromLocalCache();
  if (!hasLocal) {
    resetToDefaultData();
  }

  state.currentMonth = getInitialMonth(state.expenses, state.recurringList, state.sources);

  const dateInput = document.getElementById("expDateInput");
  if (dateInput) {
    dateInput.value = getLocalTodayDateString();
  }

  // 初期タブをダッシュボードに
  switchTab("dashboard");
  render();

  initFirebase(({ error }) => {
    if (error) {
      customConfirm(error, null, true);
    } else {
      render();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
