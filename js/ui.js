// js/ui.js
// UI描画 & モーダル・ダイアログ・タブ制御

let toastTimeout = null;
let confirmCallback = null;

/**
 * 自動保存トースト通知の表示
 */
function showSaveToast(message = "自動保存しました") {
  const toast = document.getElementById("saveToast");
  const toastText = document.getElementById("saveToastText");
  if (!toast || !toastText) return;

  toastText.innerText = message;
  toast.classList.remove("opacity-0", "translate-y-2");
  toast.classList.add("opacity-100", "translate-y-0");

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("opacity-100", "translate-y-0");
    toast.classList.add("opacity-0", "translate-y-2");
  }, 1500);
}

/**
 * カスタム確認ダイアログ
 */
function customConfirm(message, callback, isAlertOnly = false) {
  confirmCallback = callback;
  const msgEl = document.getElementById("confirmModalMessage");
  const cancelBtn = document.getElementById("confirmModalCancelBtn");
  if (msgEl) msgEl.innerText = message;
  if (cancelBtn) cancelBtn.style.display = isAlertOnly ? "none" : "block";
  openModal("confirmModal");
}

function closeConfirmModal(result) {
  closeModal("confirmModal");
  if (confirmCallback) {
    confirmCallback(result);
    confirmCallback = null;
  }
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("hidden");
}

/**
 * 今日の日付（YYYY-MM-DD）を取得
 */
function getLocalTodayDateString() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().split("T")[0];
}

/**
 * タブ切り替え（ホーム、当月明細、年間一覧、固定費、返済、設定）
 */
const ALL_TABS = ['dashboard', 'expenses', 'yearly', 'recurring', 'debts', 'sources'];

function switchTab(tabId) {
  state.activeTab = tabId;
  ALL_TABS.forEach(id => {
    const el = document.getElementById(`tabContent-${id}`);
    const btn = document.getElementById(`tabBtn-${id}`);
    if (el) el.classList.add("hidden");
    if (btn) {
      btn.className = "pb-2.5 px-1 font-bold whitespace-nowrap border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition flex items-center gap-1.5";
    }
  });

  const targetEl = document.getElementById(`tabContent-${tabId}`);
  const targetBtn = document.getElementById(`tabBtn-${tabId}`);
  if (targetEl) targetEl.classList.remove("hidden");
  if (targetBtn) {
    targetBtn.className = "pb-2.5 px-1 font-bold whitespace-nowrap border-b-2 border-indigo-600 text-indigo-600 transition flex items-center gap-1.5";
  }
}

/**
 * 年間一覧用: 対象年の変更
 */
function changeYearlyTargetYear(delta) {
  state.yearlyTargetYear = (Number(state.yearlyTargetYear) || new Date().getFullYear()) + delta;
  render();
}

/**
 * 年間一覧用: 表示基準（引落月 vs 利用月）の切り替え
 */
function setYearlyViewMode(mode) {
  state.yearlyViewMode = mode;
  render();
}

/**
 * 年間一覧の特定月から「当月明細」へジャンプ
 */
function jumpToMonthDetails(monthStr) {
  if (monthStr) {
    state.currentMonth = monthStr;
    render();
  }
  switchTab('expenses');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * ホーム等から当月明細の現金支出枠へスクロールジャンプ
 */
function jumpToCashExpenses() {
  switchTab('expenses');
  setTimeout(() => {
    const el = document.getElementById("cashExpenseSection");
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-4', 'ring-emerald-400');
      setTimeout(() => {
        el.classList.remove('ring-4', 'ring-emerald-400');
      }, 1500);
    }
  }, 100);
}

/**
 * モーダル内セレクトボックス選択肢の更新
 */
function updateSelectOptions() {
  // 支出モーダルの支払元セレクト
  const expSelect = document.getElementById("expSourceSelect");
  const recSelect = document.getElementById("recSourceSelect");
  const opts = state.sources.map(s => {
    const shareTag = s.isShared ? ' [共有]' : '';
    return `<option value="${s.id}">${s.name}${shareTag} (${s.type === 'CREDIT' ? 'クレカ' : '口座振替'})</option>`;
  }).join("");
  if (expSelect) expSelect.innerHTML = opts;
  if (recSelect) recSelect.innerHTML = opts;

  // 収入入力モーダルの収入元セレクト
  const incEntrySelect = document.getElementById("incEntrySourceSelect");
  if (incEntrySelect) {
    const sortedIncSources = getSortedIncomeSources();
    if (sortedIncSources.length === 0) {
      incEntrySelect.innerHTML = `<option value="">（収入元が未登録です）</option>`;
    } else {
      incEntrySelect.innerHTML = sortedIncSources.map(is => {
        return `<option value="${is.id}">${is.name}</option>`;
      }).join("");
    }
  }

  // 借金・ローンモーダルの支払元セレクト
  const debtSrcSelect = document.getElementById("debtSourceSelect");
  if (debtSrcSelect) {
    let debtOpts = `<option value="CASH">💵 現金支払い (CASH)</option>`;
    state.sources.forEach(s => {
      const shareTag = s.isShared ? ' [共有]' : '';
      const typeLabel = s.type === 'CREDIT' ? '💳 クレカ' : '🏦 口座振替';
      debtOpts += `<option value="${s.id}">${typeLabel}: ${s.name}${shareTag}</option>`;
    });
    debtSrcSelect.innerHTML = debtOpts;
  }
}

/**
 * 日付セレクトボックスの初期生成
 */
function initDateSelectOptions() {
  const closingSelect = document.getElementById("srcClosingSelect");
  if (closingSelect && closingSelect.children.length === 0) {
    for (let i = 1; i <= 28; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.innerText = `毎月 ${i} 日締め`;
      if (i === 15) opt.selected = true;
      closingSelect.appendChild(opt);
    }
    const optEnd = document.createElement("option");
    optEnd.value = 99;
    optEnd.innerText = `月末締め`;
    closingSelect.appendChild(optEnd);
  }

  const paySelect = document.getElementById("srcPaymentSelect");
  if (paySelect && paySelect.children.length === 0) {
    for (let i = 1; i <= 28; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.innerText = `${i} 日払い`;
      if (i === 10) opt.selected = true;
      paySelect.appendChild(opt);
    }
    const optEnd = document.createElement("option");
    optEnd.value = 99;
    optEnd.innerText = `末日払い`;
    paySelect.appendChild(optEnd);
  }

  const recDaySelect = document.getElementById("recDaySelect");
  if (recDaySelect && recDaySelect.children.length === 0) {
    for (let i = 1; i <= 28; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.innerText = `${i} 日`;
      if (i === 20) opt.selected = true;
      recDaySelect.appendChild(opt);
    }
    const optEnd = document.createElement("option");
    optEnd.value = 99;
    optEnd.innerText = `末日`;
    recDaySelect.appendChild(optEnd);
  }

  const debtPayDaySelect = document.getElementById("debtPaymentDaySelect");
  if (debtPayDaySelect && debtPayDaySelect.children.length === 0) {
    for (let i = 1; i <= 28; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.innerText = `毎月 ${i} 日`;
      if (i === 27) opt.selected = true;
      debtPayDaySelect.appendChild(opt);
    }
    const optEnd = document.createElement("option");
    optEnd.value = 99;
    optEnd.innerText = `毎月末日`;
    debtPayDaySelect.appendChild(optEnd);
  }
}

/**
 * モーダルの背景クリック・Escキーで閉じるイベントの初期化
 */
function initModalBackdropEvents() {
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.add("hidden");
      }
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay").forEach(m => m.classList.add("hidden"));
    }
  });
}

/**
 * クラウド状態バッジ・診断パネルのUI反映
 */
function updateCloudStatusUI(info) {
  if (!info) return;
  const { status, label, diagMessage, currentUser, sharedPassphrase } = info;

  const textEl = document.getElementById("cloudStatusText");
  const dotEl = document.getElementById("cloudStatusDot");
  if (textEl && dotEl) {
    textEl.innerText = label;
    dotEl.className = "w-2 h-2 rounded-full";
    if (status === 'online') {
      dotEl.classList.add("bg-emerald-500");
    } else if (status === 'syncing') {
      dotEl.classList.add("bg-amber-500", "animate-ping");
    } else if (status === 'error') {
      dotEl.classList.add("bg-rose-500");
    } else {
      dotEl.classList.add("bg-slate-400");
    }
  }

  const diagEl = document.getElementById("cloudDiagText");
  if (diagEl && diagMessage) {
    diagEl.innerText = diagMessage;
  }

  const authBadge = document.getElementById("googleAuthBadge");
  const loggedInView = document.getElementById("googleLoggedInView");
  const loggedOutView = document.getElementById("googleLoggedOutView");

  if (currentUser) {
    if (authBadge) {
      authBadge.className = "text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-300";
      authBadge.innerText = "同期中 (Googleログイン済)";
    }
    if (loggedInView) loggedInView.classList.remove("hidden");
    if (loggedOutView) loggedOutView.classList.add("hidden");

    const nameEl = document.getElementById("userName");
    const emailEl = document.getElementById("userEmail");
    const photoEl = document.getElementById("userPhoto");

    if (nameEl) nameEl.innerText = currentUser.displayName || "Googleユーザー";
    if (emailEl) emailEl.innerText = currentUser.email || "";
    if (photoEl) {
      if (currentUser.photoURL) {
        photoEl.src = currentUser.photoURL;
        photoEl.classList.remove("hidden");
      } else {
        photoEl.classList.add("hidden");
      }
    }
  } else {
    if (authBadge) {
      authBadge.className = "text-[10px] px-2 py-0.5 rounded font-bold bg-slate-200 text-slate-600";
      authBadge.innerText = "未ログイン (端末のみ保存)";
    }
    if (loggedInView) loggedInView.classList.add("hidden");
    if (loggedOutView) loggedOutView.classList.remove("hidden");
  }

  const passBadge = document.getElementById("sharedPassphraseBadge");
  if (passBadge) {
    if (sharedPassphrase && sharedPassphrase.trim()) {
      passBadge.className = "text-[10px] px-2 py-0.5 rounded font-bold bg-amber-100 text-amber-800 border border-amber-300";
      passBadge.innerText = `設定済 (${sharedPassphrase})`;
    } else {
      passBadge.className = "text-[10px] px-2 py-0.5 rounded font-bold bg-slate-200 text-slate-600";
      passBadge.innerText = "未設定";
    }
  }
}

/**
 * メイン描画処理
 */
function render() {
  if (!state.currentMonth) return;
  const [year, month] = state.currentMonth.split("-").map(Number);
  const curLabel = document.getElementById("currentMonthLabel");
  if (curLabel) curLabel.innerText = `${year}年 ${month}月`;

  // 当月の通常利用明細の抽出
  const currentExpenses = state.expenses.map(e => {
    const src = state.sources.find(s => s.id === e.sourceId);
    const { payMonth, payDate } = calculateDueDate(e.date, src);
    return { ...e, payMonth, payDate, srcName: src ? src.name : "不明" };
  }).filter(e => e.payMonth === state.currentMonth);

  // 当月の年払い・固定費の抽出
  const currentRecurring = [];
  state.recurringList.forEach(r => {
    const src = state.sources.find(s => s.id === r.sourceId);
    if (!src) return;

    if (r.frequency === "YEARLY") {
      [-1, 0, 1].forEach(offsetYear => {
        const checkYear = year + offsetYear;
        const dueInfo = getRecurringDueDateInfo(r, src, checkYear);
        if (dueInfo.payMonth === state.currentMonth) {
          currentRecurring.push({
            ...r,
            payMonth: dueInfo.payMonth,
            payDate: dueInfo.payDate,
            useDateStr: dueInfo.useDateStr,
            useMonth: dueInfo.useMonth,
            useDay: dueInfo.useDay
          });
        }
      });
    } else if (r.frequency === "MONTHLY") {
      [-1, 0, 1].forEach(offsetMonth => {
        const d = new Date(year, month - 1 + offsetMonth, 1);
        const checkYear = d.getFullYear();
        const checkMonth = d.getMonth() + 1;
        const dummyItem = { ...r, targetMonth: checkMonth };
        const dueInfo = getRecurringDueDateInfo(dummyItem, src, checkYear);
        if (dueInfo.payMonth === state.currentMonth) {
          currentRecurring.push({
            ...r,
            payMonth: dueInfo.payMonth,
            payDate: dueInfo.payDate,
            useDateStr: dueInfo.useDateStr,
            useMonth: dueInfo.useMonth,
            useDay: dueInfo.useDay
          });
        }
      });
    }
  });

  const sortedSources = getSortedSources();
  const excludedIds = state.excludedSharedSourceIds || [];
  const isExcluded = (id) => excludedIds.includes(id);

  // 各明細に収支除外フラグを付与
  currentExpenses.forEach(e => {
    e.isExcludedFromBudget = isExcluded(e.sourceId);
  });
  currentRecurring.forEach(r => {
    r.isExcludedFromBudget = isExcluded(r.sourceId);
  });

  // カード・口座別の支出と、現金支出を分離
  const cashExpenses = currentExpenses.filter(e => e.sourceId === CASH_SOURCE_ID || e.sourceId === 'CASH');
  const cardExpenses = currentExpenses.filter(e => e.sourceId !== CASH_SOURCE_ID && e.sourceId !== 'CASH');

  // 当月のローン返済明細の計算 & 分離
  const currentDebts = calculateMonthlyDebtEntries(state.debts || [], state.currentMonth, sortedSources);
  currentDebts.forEach(d => {
    d.isExcludedFromBudget = isExcluded(d.sourceId);
  });
  const cardDebts = currentDebts.filter(d => d.sourceId !== 'CASH' && d.sourceId !== CASH_SOURCE_ID);
  const cashDebts = currentDebts.filter(d => d.sourceId === 'CASH' || d.sourceId === CASH_SOURCE_ID);

  // 収支に反映する項目のみで合計額を計算（除外カードは除外）
  const cardDebtsTotal = cardDebts.filter(d => !d.isExcludedFromBudget).reduce((sum, d) => sum + Number(d.amount), 0);
  const cashDebtsTotal = cashDebts.filter(d => !d.isExcludedFromBudget).reduce((sum, d) => sum + Number(d.amount), 0);

  const regularTotal = cardExpenses.filter(e => !e.isExcludedFromBudget).reduce((sum, e) => sum + Number(e.amount), 0) + cardDebtsTotal;
  const recurringTotal = currentRecurring.filter(r => !r.isExcludedFromBudget).reduce((sum, r) => sum + Number(r.amount), 0);
  const cashTotal = cashExpenses.filter(e => !e.isExcludedFromBudget).reduce((sum, e) => sum + Number(e.amount), 0) + cashDebtsTotal;
  const grandTotal = regularTotal + recurringTotal + cashTotal;

  // 当月の収入明細の抽出 & 総収入の計算
  const currentIncomes = (state.incomeEntries || []).map(ie => {
    const isrc = (state.incomeSources || []).find(s => s.id === ie.sourceId);
    return { ...ie, srcName: isrc ? isrc.name : "不明な収入元" };
  }).filter(ie => ie.date && ie.date.startsWith(state.currentMonth));

  const monthlyIncome = currentIncomes.reduce((sum, ie) => sum + Number(ie.amount), 0);
  const netSavings = monthlyIncome - grandTotal;
  const expenseRatio = monthlyIncome > 0 ? Math.min(Math.round((grandTotal / monthlyIncome) * 100), 100) : (grandTotal > 0 ? 100 : 0);

  // 上部サマリーの数値更新
  const grandLabel = document.getElementById("grandTotalLabel");
  const regLabel = document.getElementById("regularSubtotalLabel");
  const recLabel = document.getElementById("recurringSubtotalLabel");
  const cashLabel = document.getElementById("cashSubtotalLabel");

  if (grandLabel) grandLabel.innerText = `¥${grandTotal.toLocaleString()}`;
  if (regLabel) regLabel.innerText = `¥${regularTotal.toLocaleString()}`;
  if (recLabel) recLabel.innerText = `¥${recurringTotal.toLocaleString()}`;
  if (cashLabel) cashLabel.innerText = `¥${cashTotal.toLocaleString()}`;

  // 年払い発生アラート
  const alertBox = document.getElementById("recurringAlertBox");
  if (alertBox) {
    if (currentRecurring.length > 0) {
      alertBox.classList.remove("hidden");
      const alertText = document.getElementById("recurringAlertText");
      if (alertText) {
        alertText.innerText =
          `今月は${currentRecurring.map(r => `${r.name} (¥${r.amount.toLocaleString()})`).join("、 ")} の引き落としが予定されています。`;
      }
    } else {
      alertBox.classList.add("hidden");
    }
  }

  // 1. 📊 ダッシュボード描画
  renderDashboardTab({
    year, month,
    monthlyIncome, grandTotal, netSavings, expenseRatio,
    regularTotal, recurringTotal, cashTotal,
    currentExpenses, currentRecurring, sortedSources,
    currentIncomes, cashExpenses, currentDebts
  });

  // 2. 💳 当月明細タブ（上部に収入一覧 ＋ 中段に引き落とし予定 ＋ 下部に現金＆カード別支出）
  renderExpensesTab({
    year, month,
    currentIncomes, monthlyIncome,
    regularTotal, recurringTotal, cashTotal,
    currentExpenses, currentRecurring, sortedSources,
    cashExpenses, currentDebts
  });

  // 3. 📅 年間支出一覧タブ
  renderYearlyTab();

  // 4. 🔄 固定費・年払い一覧タブ
  renderRecurringTab({
    year, month,
    currentRecurring
  });

  // 5. 📉 返済シミュレーションタブ
  renderDebtsTab({
    netSavings,
    currentMonth: state.currentMonth,
    sources: sortedSources
  });

  // 6. ⚙️ 設定タブ（カード管理 ＋ 収入元マスター管理）
  renderSourcesTab({
    sortedSources
  });

  // 全体件数サマリー
  const countEl = document.getElementById("dataCountSummary");
  if (countEl) {
    countEl.innerText = `支出明細: ${state.expenses.length}件 | 収入明細: ${(state.incomeEntries || []).length}件 | カード/口座: ${state.sources.length}件 | 収入元: ${(state.incomeSources || []).length}件 | 固定費: ${state.recurringList.length}件`;
  }

  updateSelectOptions();
}

/**
 * 📊 ダッシュボードのレンダリング
 */
function renderDashboardTab({ year, month, monthlyIncome, grandTotal, netSavings, expenseRatio, regularTotal, recurringTotal, cashTotal = 0, currentExpenses, currentRecurring, sortedSources, currentIncomes, cashExpenses = [], currentDebts = [] }) {
  const container = document.getElementById("tabContent-dashboard");
  if (!container) return;

  const excludedIds = state.excludedSharedSourceIds || [];
  const isExcluded = (id) => excludedIds.includes(id);

  const nextAction = getNextDueAction(currentExpenses, currentRecurring, sortedSources, currentDebts, excludedIds);
  const isSurplus = netSavings >= 0;

  const totalDebtBalance = (state.debts || []).reduce((sum, d) => sum + Number(d.totalBalance), 0);
  const totalMonthlyDebtPay = (state.debts || []).reduce((sum, d) => sum + Number(d.monthlyPayment), 0);

  // 今年の年間サマリーを計算（ホームバナー用）
  const curYearSummary = calculateYearlySummary(year, 'DUE_MONTH', state.expenses, state.recurringList, state.sources, state.incomeEntries, state.debts || [], excludedIds);

  // 各カード・口座の引き落とし予定
  const dueItems = sortedSources.map(src => {
    const isSrcExcluded = isExcluded(src.id);
    const cardExpenses = currentExpenses.filter(e => e.sourceId === src.id);
    const cardRecs = currentRecurring.filter(r => r.sourceId === src.id);
    const cardDebts = currentDebts.filter(d => d.sourceId === src.id);
    const total = cardExpenses.reduce((sum, e) => sum + Number(e.amount), 0) +
                  cardRecs.reduce((sum, r) => sum + Number(r.amount), 0) +
                  cardDebts.reduce((sum, d) => sum + Number(d.amount), 0);

    let dateDisplay = "";
    let sortDay = 999;
    if (src.type === 'CREDIT') {
      const lastDayOfCurMonth = new Date(year, month, 0).getDate();
      const displayDay = src.paymentDay === 99 ? lastDayOfCurMonth : src.paymentDay;
      dateDisplay = `${month}月${displayDay}日`;
      sortDay = displayDay;
    } else {
      const dates = [...new Set([
        ...cardExpenses.map(e => Number(e.payDate.split("-")[2])),
        ...cardRecs.map(r => Number(r.payDate.split("-")[2]))
      ])].filter(Boolean).sort((a, b) => a - b);
      dateDisplay = dates.length > 0 ? `${month}月 ${dates.map(d => d + '日').join(', ')}` : '指定日引落';
      sortDay = dates.length > 0 ? dates[0] : 99;
    }
    return { src, total, dateDisplay, sortDay, isExcluded: isSrcExcluded };
  }).sort((a, b) => a.sortDay - b.sortDay);

  container.innerHTML = `
    <!-- ①【最上部】今月のマネーサマリー（着地見込み） -->
    <div class="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 text-white rounded-2xl p-5 shadow-lg border border-slate-700/50 space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div class="flex items-center gap-2">
          <span class="text-xl">💰</span>
          <div>
            <span class="text-[10px] text-slate-300 font-bold uppercase tracking-wider block">Cash Flow Forecast</span>
            <h2 class="text-sm sm:text-base font-black text-white">${year}年 ${month}月の見込み</h2>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="switchTab('yearly')" class="text-xs px-2.5 py-1 rounded-full font-bold bg-white/10 hover:bg-white/20 text-indigo-200 border border-white/20 flex items-center gap-1 transition active:scale-95">
            <span>📅</span> 年間支出一覧 ➔
          </button>
          <span class="text-xs px-2.5 py-1 rounded-full font-bold ${isSurplus ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}">
            ${isSurplus ? '● 今月は黒字見込み' : '▲ 今月は赤字見込み'}
          </span>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <!-- 収入実績・予定 -->
        <div class="bg-white/5 border border-white/10 rounded-xl p-3">
          <div class="text-[10px] text-slate-400 font-medium flex items-center justify-between">
            <span>当月の入力収入</span>
            <button onclick="openCreateIncomeEntryModal()" class="text-[10px] text-sky-400 font-bold hover:underline">＋ 収入入力</button>
          </div>
          <div class="text-xl font-black text-sky-400 mt-1">¥${monthlyIncome.toLocaleString()}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">当月明細: ${currentIncomes.length}件 入力済</div>
        </div>

        <!-- 支出予定総額 -->
        <div class="bg-white/5 border border-white/10 rounded-xl p-3">
          <div class="text-[10px] text-slate-400 font-medium flex items-center justify-between">
            <span>当月の支出予定額</span>
            <button onclick="switchTab('expenses')" class="text-[10px] text-rose-400 font-bold hover:underline">明細</button>
          </div>
          <div class="text-xl font-black text-orange-400 mt-1">¥${grandTotal.toLocaleString()}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">クレカ: ¥${regularTotal.toLocaleString()} ｜ 固定: ¥${recurringTotal.toLocaleString()} ｜ 現金: ¥${cashTotal.toLocaleString()}</div>
        </div>

        <!-- 最終手残り -->
        <div class="bg-white/10 border ${isSurplus ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-rose-500/40 bg-rose-950/20'} rounded-xl p-3">
          <div class="text-[10px] text-slate-300 font-bold">今月の手残り（貯蓄・返済へ）</div>
          <div class="text-2xl font-black ${isSurplus ? 'text-emerald-300' : 'text-rose-400'} mt-1">
            ${netSavings >= 0 ? '+' : ''}¥${netSavings.toLocaleString()}
          </div>
          <div class="text-[10px] text-slate-300 mt-0.5">
            ${monthlyIncome === 0 ? '※ 今月の収入がまだ入力されていません' : `支出消化率: ${expenseRatio}%`}
          </div>
        </div>
      </div>

      <!-- 支出プログレスバー -->
      ${monthlyIncome > 0 ? `
        <div class="space-y-1.5 pt-1">
          <div class="flex justify-between text-[11px] text-slate-300 font-medium">
            <span>収入に対する支出消化率</span>
            <span class="font-bold font-mono">${expenseRatio}% (${grandTotal.toLocaleString()} / ${monthlyIncome.toLocaleString()} 円)</span>
          </div>
          <div class="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-white/10">
            <div class="h-2.5 rounded-full transition-all duration-500 ${expenseRatio > 90 ? 'bg-rose-500' : (expenseRatio > 70 ? 'bg-amber-400' : 'bg-emerald-400')}" style="width: ${expenseRatio}%"></div>
          </div>
        </div>
      ` : ''}
    </div>

    <!-- ②【中央】年間支出レポートハイライトカード（クリックで年間一覧へジャンプ） -->
    <div onclick="switchTab('yearly')" class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 shadow-sm border border-indigo-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer hover:border-indigo-400 hover:shadow-md transition group">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-xl shrink-0">
          📅
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h3 class="font-black text-sm text-white">${year}年 年間支出レポート</h3>
            <span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 shrink-0">
              引落ベース
            </span>
          </div>
          <p class="text-[11px] text-slate-300 mt-0.5 truncate">
            年間総支出: <strong class="text-orange-400 font-bold">¥${curYearSummary.grandExpense.toLocaleString()}</strong> ｜ 月平均: <strong class="text-slate-100 font-bold">¥${curYearSummary.avgMonthlyExpense.toLocaleString()}</strong> ｜ ピーク月: <strong class="text-amber-300 font-bold">${curYearSummary.maxMonth.month}月</strong>
          </p>
        </div>
      </div>
      <div class="flex items-center gap-1.5 text-xs font-bold text-indigo-300 group-hover:text-white group-hover:translate-x-1 transition self-end sm:self-center shrink-0">
        <span>1月〜12月の推移を見る</span>
        <span class="text-base leading-none">➔</span>
      </div>
    </div>

    <!-- ③【中央グリッド】直近アクション & 現金サマリー & ローン -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- カード・口座別の引き落とし予定一覧（次回カウントダウン付き） -->
      <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div class="flex items-center justify-between">
          <div class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <span class="text-base">📅</span> ${month}月の引き落とし予定
          </div>
          ${nextAction ? `
            <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${nextAction.diffDays <= 3 ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-indigo-50 text-indigo-700'}">
              次回: ${nextAction.diffDays === 0 ? '本日！' : `あと ${nextAction.diffDays} 日`}
            </span>
          ` : ''}
        </div>

        ${nextAction ? `
          <div class="p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
              <span class="text-[10px] px-1.5 py-0.5 rounded font-bold bg-indigo-600 text-white shrink-0">直近</span>
              <span class="font-bold text-indigo-950">${nextAction.sourceName}</span>
              <span class="text-indigo-600 font-semibold text-[11px]">${nextAction.payDate}</span>
            </div>
            <div class="font-black text-indigo-950">
              ¥${Number(nextAction.amount).toLocaleString()}
            </div>
          </div>
        ` : ''}

        <div class="divide-y divide-slate-100 max-h-56 overflow-y-auto no-scrollbar">
          ${dueItems.length > 0 ? dueItems.map(item => `
            <div class="py-2 flex items-center justify-between text-xs hover:bg-slate-50 px-1 rounded transition ${item.isExcluded ? 'opacity-60 bg-slate-50/50' : ''}">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-[11px] font-bold text-slate-600 shrink-0">${item.dateDisplay}</span>
                <span class="text-[10px] px-1.5 py-0.2 rounded font-semibold shrink-0 ${item.src.type === 'CREDIT' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-teal-50 text-teal-700 border border-teal-200'}">
                  ${item.src.type === 'CREDIT' ? 'クレカ' : '口座振替'}
                </span>
                ${item.isExcluded ? '<span class="text-[9px] px-1.5 py-0.2 rounded font-bold bg-slate-200 text-slate-700 shrink-0">収支除外</span>' : ''}
                <span class="font-medium text-slate-800 truncate">${item.src.name}</span>
              </div>
              <div class="font-bold shrink-0 ml-2 ${item.isExcluded ? 'text-slate-400 text-[11px]' : 'text-slate-900'}">
                ¥${item.total.toLocaleString()}
              </div>
            </div>
          `).join('') : `
            <div class="p-3 text-center text-slate-400 text-xs">登録された口座・カードはありません</div>
          `}
        </div>

        <div class="flex justify-between items-center pt-2 border-t border-slate-100 text-[11px]">
          <span class="text-slate-400">引落合計: <strong class="text-slate-700">¥${(regularTotal + recurringTotal).toLocaleString()}</strong></span>
          <button onclick="switchTab('expenses')" class="text-indigo-600 font-bold hover:underline flex items-center gap-1">
            👉 明細を見る
          </button>
        </div>
      </div>

      <!-- 💵 現金支出サマリー（クリックで当月明細の現金枠へジャンプ） -->
      <div onclick="jumpToCashExpenses()" class="bg-white border border-emerald-200 rounded-2xl p-4 shadow-sm space-y-3 cursor-pointer hover:border-emerald-400 hover:shadow-md transition group">
        <div class="flex items-center justify-between">
          <div class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <span class="text-base">💵</span> ${month}月の現金支出
          </div>
          <span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            当月 ${cashExpenses.length} 件
          </span>
        </div>

        <div class="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl space-y-1">
          <div class="text-[10px] text-emerald-800 font-medium">現金利用の総額</div>
          <div class="text-2xl font-black text-emerald-900">
            ¥${cashTotal.toLocaleString()}
          </div>
          <div class="text-[10px] text-emerald-700">口座引き落とし以外の即時支出</div>
        </div>

        <div class="text-xs text-slate-500 space-y-1">
          ${cashExpenses.slice(0, 3).map(ce => `
            <div class="flex justify-between items-center text-[11px] py-0.5">
              <span class="text-slate-600 truncate max-w-[130px]">${ce.memo || '未分類'}</span>
              <span class="font-bold text-slate-800">¥${Number(ce.amount).toLocaleString()}</span>
            </div>
          `).join('')}
          ${cashExpenses.length > 3 ? `<div class="text-[10px] text-slate-400 text-right">ほか ${cashExpenses.length - 3} 件...</div>` : ''}
          ${cashExpenses.length === 0 ? `<div class="text-[11px] text-slate-400 text-center py-2">今月の現金入力はありません</div>` : ''}
        </div>

        <div class="flex justify-between items-center pt-2 border-t border-slate-100 text-[11px]">
          <button onclick="event.stopPropagation(); openExpenseModalWithSource(null, 'CASH')" class="text-emerald-700 font-bold hover:underline flex items-center gap-0.5">
            <span>＋</span> 現金を入力
          </button>
          <span class="text-emerald-600 font-bold group-hover:translate-x-0.5 transition-transform">
            明細を見る ➔
          </span>
        </div>
      </div>

      <!-- 借金・ローン返済の進捗ハイライト -->
      <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2.5">
        <div class="flex items-center justify-between">
          <div class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <span class="text-base">📉</span> 借金・ローン返済サマリー
          </div>
          <button onclick="switchTab('debts')" class="text-[11px] font-bold text-indigo-600 hover:underline">
            シミュレーターへ
          </button>
        </div>

        ${(state.debts && state.debts.length > 0) ? `
          <div class="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
            <div class="flex justify-between items-center">
              <div>
                <span class="text-[10px] text-amber-800 font-medium block">現在の借金・ローン総残高</span>
                <span class="text-lg font-black text-amber-950">¥${totalDebtBalance.toLocaleString()}</span>
              </div>
              <div class="text-right">
                <span class="text-[10px] text-amber-800 font-medium block">毎月返済総額</span>
                <span class="text-sm font-bold text-amber-900">¥${totalMonthlyDebtPay.toLocaleString()}/月</span>
              </div>
            </div>

            ${isSurplus && netSavings > 0 ? `
              <div class="text-[10px] text-emerald-800 bg-white/80 p-2 rounded-lg border border-emerald-200 leading-snug">
                💡 <strong>チャンス:</strong> 今月の手残り（¥${netSavings.toLocaleString()}）の一部を繰り上げ返済に充てると、完済を大幅に短縮できます！
              </div>
            ` : ''}
          </div>
        ` : `
          <div class="p-3 text-center text-slate-400 text-xs bg-slate-50 rounded-xl space-y-1">
            <div>借金・ローンの登録はありません</div>
            <button onclick="openCreateDebtModal()" class="text-indigo-600 font-bold hover:underline text-[11px]">＋ 返済管理項目を追加する</button>
          </div>
        `}

        <div class="flex justify-between items-center pt-1 text-[11px]">
          <span class="text-slate-400 text-[10px]">登録ローン数: ${(state.debts || []).length}件</span>
          <button onclick="switchTab('debts')" class="text-amber-800 font-bold hover:underline">
            返済シミュレーション ➔
          </button>
        </div>
      </div>
    </div>

    <!-- ④【下部】クイックアクションボタン（青＝収入、赤＝支出、黄＝固定費、紫＝年間） -->
    <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
      <div class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
        <span>⚡</span> クイック登録・操作
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button onclick="openExpenseModalWithSource()" class="px-3.5 py-2 text-xs font-black rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm flex items-center gap-1 active:scale-95 transition">
          <span>−</span> 支出入力
        </button>
        <button onclick="openCreateIncomeEntryModal()" class="px-3.5 py-2 text-xs font-black rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-sm flex items-center gap-1 active:scale-95 transition">
          <span>＋</span> 収入入力
        </button>
        <button onclick="openCreateRecurringModal()" class="px-3 py-2 text-xs font-semibold rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition">
          <span>＋</span> 固定費を追加
        </button>
        <button onclick="switchTab('yearly')" class="px-3 py-2 text-xs font-semibold rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition">
          <span>📅</span> 年間一覧へ
        </button>
      </div>
    </div>
  `;
}

/**
 * 📅 年間支出一覧 & 推移タブのレンダリング
 */
function renderYearlyTab() {
  const container = document.getElementById("tabContent-yearly");
  if (!container) return;

  const targetYear = Number(state.yearlyTargetYear) || new Date().getFullYear();
  const mode = state.yearlyViewMode || 'DUE_MONTH';

  const summary = calculateYearlySummary(
    targetYear,
    mode,
    state.expenses,
    state.recurringList,
    state.sources,
    state.incomeEntries,
    state.debts || [],
    state.excludedSharedSourceIds || []
  );

  const isDUE = mode === 'DUE_MONTH';

  // 1月〜12月の月別カード生成
  const monthsCardsHtml = summary.monthsData.map(m => {
    const isCurrentActive = state.currentMonth === m.monthKey;
    const isMaxMonth = summary.maxMonth.month === m.month && m.total > 0;
    const isSurplus = m.netSavings >= 0;

    return `
      <div class="bg-white border ${isCurrentActive ? 'border-indigo-500 ring-2 ring-indigo-200' : (isMaxMonth ? 'border-amber-400 bg-amber-50/10' : 'border-slate-200')} rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-3 transition hover:shadow-md hover:border-indigo-300">
        <div>
          <!-- 月ヘッダー -->
          <div class="flex items-center justify-between pb-2 border-b border-slate-100">
            <div class="flex items-center gap-1.5">
              <span class="text-base font-black text-slate-800">${m.month}月</span>
              ${isCurrentActive ? '<span class="text-[10px] px-1.5 py-0.2 rounded font-bold bg-indigo-100 text-indigo-800">選択中</span>' : ''}
              ${isMaxMonth ? '<span class="text-[10px] px-1.5 py-0.2 rounded font-bold bg-amber-100 text-amber-900 border border-amber-300">年間ピーク</span>' : ''}
            </div>
            <span class="text-[10px] text-slate-400 font-medium">${m.itemCount}件</span>
          </div>

          <!-- 支出総額 ＆ 収入総額（縦並び） -->
          <div class="pt-2 space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-[10px] text-slate-500 font-medium shrink-0">支出総額</span>
              <div class="text-base sm:text-lg font-black truncate ${m.total > 0 ? (isMaxMonth ? 'text-amber-700' : 'text-slate-900') : 'text-slate-300'}">
                ¥${m.total.toLocaleString()}
              </div>
            </div>
            <div class="flex items-baseline justify-between gap-2 pt-1 border-t border-slate-200/60">
              <span class="text-[10px] text-slate-500 font-medium shrink-0">収入総額</span>
              <div class="text-base sm:text-lg font-black truncate ${m.incomeTotal > 0 ? 'text-sky-600' : 'text-slate-300'}">
                ¥${m.incomeTotal.toLocaleString()}
              </div>
            </div>
          </div>

          <!-- 当月の収支（手残り） -->
          <div class="flex items-center justify-between text-[11px] pt-1 px-0.5">
            <span class="text-slate-400">当月の収支:</span>
            <span class="font-black ${isSurplus ? 'text-emerald-700' : 'text-rose-600'}">
              ${(m.total > 0 || m.incomeTotal > 0) ? `${isSurplus ? '+' : ''}¥${m.netSavings.toLocaleString()}` : '¥0'}
            </span>
          </div>

          <!-- 支出内訳 -->
          <div class="pt-1.5 text-[11px] text-slate-500 space-y-1">
            <div class="flex justify-between items-center">
              <span>💳 クレカ等:</span>
              <span class="font-bold text-slate-700">¥${m.regularTotal.toLocaleString()}</span>
            </div>
            <div class="flex justify-between items-center">
              <span>🔄 固定費:</span>
              <span class="font-bold text-amber-700">¥${m.recurringTotal.toLocaleString()}</span>
            </div>
            <div class="flex justify-between items-center">
              <span>💵 現金:</span>
              <span class="font-bold text-emerald-700">¥${m.cashTotal.toLocaleString()}</span>
            </div>
          </div>

          <!-- 年払い・定期固定費発生のアラート -->
          ${m.recurringItems && m.recurringItems.length > 0 ? `
            <div class="mt-2 p-2 bg-amber-50/80 border border-amber-200 rounded-xl text-[10px] text-amber-900 space-y-1">
              <div class="font-bold flex items-center gap-1 text-amber-800">
                <span>⚠️</span> <span>固定・年払い発生月</span>
              </div>
              ${m.recurringItems.map(r => `
                <div class="flex justify-between items-center pl-1 text-[10px]">
                  <span class="truncate max-w-[120px] text-slate-700">${r.name}</span>
                  <span class="font-bold text-amber-900">¥${Number(r.amount).toLocaleString()}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <!-- 明細ジャンプボタン -->
        <div class="pt-2 border-t border-slate-100">
          <button onclick="jumpToMonthDetails('${m.monthKey}')" class="w-full py-1.5 px-3 rounded-lg text-xs font-bold ${isCurrentActive ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200'} transition flex items-center justify-center gap-1 active:scale-95">
            <span>${m.month}月の明細へ</span>
            <span class="text-sm leading-none">➔</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <!-- ① 年選択 & 表示基準切り替えヘッダー -->
    <div class="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
        <!-- 年セレクタ -->
        <div class="flex items-center gap-3">
          <button onclick="changeYearlyTargetYear(-1)" class="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold active:scale-95 transition">◀</button>
          <div class="text-center min-w-[120px]">
            <span class="text-[10px] text-slate-400 font-bold block">対象年</span>
            <span class="text-2xl font-black text-indigo-600">${targetYear}年</span>
          </div>
          <button onclick="changeYearlyTargetYear(1)" class="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold active:scale-95 transition">▶</button>
        </div>

        <!-- 表示基準切替トグル（引落月基準 vs 利用月基準） -->
        <div class="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
          <button onclick="setYearlyViewMode('DUE_MONTH')" class="px-3.5 py-2 font-bold rounded-lg transition ${isDUE ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}">
            📅 引き落とし月基準（口座引落）
          </button>
          <button onclick="setYearlyViewMode('USE_MONTH')" class="px-3.5 py-2 font-bold rounded-lg transition ${!isDUE ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}">
            🛒 利用月基準（カード利用）
          </button>
        </div>
      </div>

      <div class="text-xs text-slate-500 pt-1 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <span class="flex items-center gap-1.5">
          <span>ℹ️</span>
          <span>
            ${isDUE 
              ? '<strong>引き落とし月基準:</strong> 各カードの締め日・引落日ルールに基づき、実際に口座から引落しされる月に集計しています。' 
              : '<strong>利用月基準:</strong> カード決済や現金で実際に買い物をした利用日ベースで集計しています。'}
          </span>
        </span>
        <button onclick="switchTab('expenses')" class="text-indigo-600 font-bold hover:underline shrink-0">
          当月明細（${state.currentMonth}）に戻る ➔
        </button>
      </div>
    </div>

    <!-- ② 年間サマリーカード（4大指標） -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      <!-- 年間総支出 -->
      <div class="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-4 rounded-2xl shadow-sm border border-slate-700/50 space-y-1">
        <div class="text-[10px] text-slate-300 font-bold uppercase tracking-wider">${targetYear}年 年間総支出</div>
        <div class="text-2xl font-black text-orange-400">¥${summary.grandExpense.toLocaleString()}</div>
        <div class="text-[10px] text-slate-400">${isDUE ? '全12ヶ月の引落予定合計' : '全12ヶ月の利用合計'}</div>
      </div>

      <!-- 月平均支出 -->
      <div class="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm space-y-1">
        <div class="text-[10px] text-slate-400 font-medium">月平均の支出額</div>
        <div class="text-2xl font-black text-slate-800">¥${summary.avgMonthlyExpense.toLocaleString()}</div>
        <div class="text-[10px] text-slate-400">12ヶ月平均</div>
      </div>

      <!-- 年間ピーク月 -->
      <div class="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm space-y-1">
        <div class="text-[10px] text-amber-700 font-medium">年間最高（ピーク）月</div>
        <div class="text-2xl font-black text-amber-600">
          ${summary.maxMonth.total > 0 ? `${summary.maxMonth.month}月` : 'なし'}
        </div>
        <div class="text-[10px] text-slate-400">
          ${summary.maxMonth.total > 0 ? `最高額: ¥${summary.maxMonth.total.toLocaleString()}` : '支出データなし'}
        </div>
      </div>

      <!-- 年間総収入 & 手残り -->
      <div class="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm space-y-1">
        <div class="text-[10px] text-slate-400 font-medium">年間総収入 ＆ 収支</div>
        <div class="text-lg font-black text-sky-600">¥${summary.grandIncome.toLocaleString()}</div>
        <div class="text-[11px] font-bold ${summary.netSavings >= 0 ? 'text-emerald-700' : 'text-rose-600'}">
          年間手残り: ${summary.netSavings >= 0 ? '+' : ''}¥${summary.netSavings.toLocaleString()}
        </div>
      </div>
    </div>

    <!-- ③ 1月〜12月の月別サマリーグリッド（カード形式） -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <span>📅</span> ${targetYear}年 月別支出一覧（1月〜12月）
        </h3>
        <span class="text-[11px] text-slate-400">各月のボタンから当月明細へジャンプできます</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        ${monthsCardsHtml}
      </div>
    </div>

    <!-- ④ 年間比較テーブル（PC向け一覧表） -->
    <div class="hidden sm:block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div class="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
        <h4 class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <span>📊</span> ${targetYear}年 月別詳細データ比較表
        </h4>
        <span class="text-[11px] text-slate-400">行をクリックして該当月の明細へ移動</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
            <tr>
              <th class="p-3">月</th>
              <th class="p-3 text-right">クレカ等</th>
              <th class="p-3 text-right">固定費・年払</th>
              <th class="p-3 text-right">現金支出</th>
              <th class="p-3 text-right">支出総額</th>
              <th class="p-3 text-right">収入総額</th>
              <th class="p-3 text-right">収支（手残り）</th>
              <th class="p-3">特記事項（年払い等）</th>
              <th class="p-3 text-center w-24">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${summary.monthsData.map(m => `
              <tr onclick="jumpToMonthDetails('${m.monthKey}')" class="hover:bg-indigo-50/50 cursor-pointer transition ${state.currentMonth === m.monthKey ? 'bg-indigo-50/70 font-semibold' : ''}">
                <td class="p-3 whitespace-nowrap">
                  <span class="font-bold text-slate-800">${m.month}月</span>
                  ${state.currentMonth === m.monthKey ? '<span class="text-[10px] text-indigo-600 font-bold ml-1">●当月</span>' : ''}
                </td>
                <td class="p-3 text-right text-slate-700 whitespace-nowrap">¥${m.regularTotal.toLocaleString()}</td>
                <td class="p-3 text-right text-amber-700 font-medium whitespace-nowrap">¥${m.recurringTotal.toLocaleString()}</td>
                <td class="p-3 text-right text-emerald-700 whitespace-nowrap">¥${m.cashTotal.toLocaleString()}</td>
                <td class="p-3 text-right font-black text-slate-900 whitespace-nowrap">¥${m.total.toLocaleString()}</td>
                <td class="p-3 text-right text-sky-600 font-bold whitespace-nowrap">¥${m.incomeTotal.toLocaleString()}</td>
                <td class="p-3 text-right font-bold ${m.netSavings >= 0 ? 'text-emerald-700' : 'text-rose-600'} whitespace-nowrap">
                  ${m.netSavings >= 0 ? '+' : ''}¥${m.netSavings.toLocaleString()}
                </td>
                <td class="p-3 text-slate-500 text-[11px] whitespace-normal">
                  ${m.recurringItems && m.recurringItems.length > 0 
                    ? m.recurringItems.map(r => `<span class="inline-block bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded mr-1 mb-0.5">${r.name}</span>`).join('') 
                    : '<span class="text-slate-300">-</span>'}
                </td>
                <td class="p-3 text-center whitespace-nowrap" onclick="event.stopPropagation()">
                  <button onclick="jumpToMonthDetails('${m.monthKey}')" class="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white transition">
                    明細へ
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot class="bg-slate-50 border-t-2 border-slate-200 font-bold">
            <tr>
              <td class="p-3 text-slate-900 font-black">年間合計</td>
              <td class="p-3 text-right text-slate-800">¥${summary.monthsData.reduce((s, m) => s + m.regularTotal, 0).toLocaleString()}</td>
              <td class="p-3 text-right text-amber-800">¥${summary.monthsData.reduce((s, m) => s + m.recurringTotal, 0).toLocaleString()}</td>
              <td class="p-3 text-right text-emerald-800">¥${summary.monthsData.reduce((s, m) => s + m.cashTotal, 0).toLocaleString()}</td>
              <td class="p-3 text-right font-black text-orange-700 text-sm">¥${summary.grandExpense.toLocaleString()}</td>
              <td class="p-3 text-right text-sky-700 font-black">¥${summary.grandIncome.toLocaleString()}</td>
              <td class="p-3 text-right font-black ${summary.netSavings >= 0 ? 'text-emerald-700' : 'text-rose-700'}">
                ${summary.netSavings >= 0 ? '+' : ''}¥${summary.netSavings.toLocaleString()}
              </td>
              <td colspan="2" class="p-3 text-slate-400 text-[11px] font-normal">月平均支出: ¥${summary.avgMonthlyExpense.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
}

/**
 * 💳 利用明細タブのレンダリング（上部: 当月の収入明細 ＋ 下部: カード別支出明細）
 */
function renderExpensesTab({ year, month, currentIncomes, monthlyIncome, regularTotal, recurringTotal, cashTotal = 0, currentExpenses, currentRecurring, sortedSources, cashExpenses = [], currentDebts = [] }) {
  const expensesContainer = document.getElementById("tabContent-expenses");
  if (!expensesContainer) return;

  // 1. 当月の収入一覧セクション（青系ハイライト）
  let incomeSectionHtml = `
    <div class="bg-white border border-sky-200 rounded-2xl overflow-hidden shadow-sm">
      <div class="p-4 bg-gradient-to-r from-sky-50 to-white border-b border-sky-100 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <span class="text-lg">💰</span>
          <div>
            <h3 class="font-bold text-slate-900 text-sm flex items-center gap-2">
              当月の収入明細
            </h3>
            <p class="text-[11px] text-slate-500 mt-0.5">給与や副業など、今月入金された収入の一覧です。</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="text-right">
            <span class="text-[10px] text-slate-400 block">当月収入合計</span>
            <span class="text-lg font-black text-sky-600">¥${monthlyIncome.toLocaleString()}</span>
          </div>
          <button onclick="openCreateIncomeEntryModal()" class="px-3.5 py-2 text-xs font-black rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-sm flex items-center gap-1 active:scale-95 transition">
            ＋ 収入入力
          </button>
        </div>
      </div>

      <!-- スマホ用リスト -->
      <div class="block sm:hidden divide-y divide-slate-100">
        ${currentIncomes.length > 0 ? currentIncomes.map(ie => `
          <div onclick="openEditIncomeEntryModal('${ie.id}')" class="p-3.5 hover:bg-sky-50/50 active:bg-sky-100/50 cursor-pointer transition flex items-start justify-between gap-3 group" title="タップして編集">
            <div class="min-w-0 flex-1 space-y-1">
              <div class="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span>📅</span>
                <span>${ie.date}</span>
                <span class="text-[10px] px-1.5 py-0.2 rounded font-bold bg-sky-100 text-sky-800">${ie.srcName}</span>
                <span class="text-[10px] text-sky-600">✏️編集</span>
              </div>
              <div class="text-xs font-semibold text-slate-900 break-words leading-snug whitespace-normal">
                ${ie.memo || '未分類'}
              </div>
            </div>
            <div class="text-right shrink-0 flex items-center gap-2">
              <span class="text-sm font-black text-sky-600">¥${Number(ie.amount).toLocaleString()}</span>
              <button onclick="event.stopPropagation(); deleteIncomeEntry('${ie.id}')" title="削除" class="text-slate-400 hover:text-rose-600 font-bold p-1.5 rounded active:bg-slate-200 transition">✕</button>
            </div>
          </div>
        `).join("") : `<div class="p-4 text-center text-slate-400 text-xs">当月の収入入力はありません。「＋ 収入入力」から登録できます。</div>`}
      </div>

      <!-- PC用テーブル -->
      <div class="hidden sm:block overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-sky-50/50 text-slate-500 font-semibold border-b border-sky-100">
            <tr>
              <th class="p-3 w-32">入金日</th>
              <th class="p-3 w-36">収入元</th>
              <th class="p-3">内容 / メモ</th>
              <th class="p-3 text-right w-32">金額</th>
              <th class="p-3 text-center w-14">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${currentIncomes.length > 0 ? currentIncomes.map(ie => `
              <tr onclick="openEditIncomeEntryModal('${ie.id}')" class="hover:bg-sky-50/50 cursor-pointer transition group" title="クリックして編集">
                <td class="p-3 text-slate-500 whitespace-nowrap">${ie.date}</td>
                <td class="p-3 font-bold text-sky-900 whitespace-nowrap">${ie.srcName}</td>
                <td class="p-3 text-slate-800 font-medium break-words leading-relaxed whitespace-normal">
                  ${ie.memo || '未分類'}
                  <span class="opacity-0 group-hover:opacity-100 text-[10px] text-sky-600 font-semibold ml-1.5 transition-opacity">✏️編集</span>
                </td>
                <td class="p-3 text-right font-black text-sky-600 whitespace-nowrap">¥${Number(ie.amount).toLocaleString()}</td>
                <td class="p-3 text-center whitespace-nowrap" onclick="event.stopPropagation()">
                  <button onclick="deleteIncomeEntry('${ie.id}')" title="削除" class="text-slate-400 hover:text-rose-600 font-bold px-2 py-1 rounded hover:bg-slate-100 transition">✕</button>
                </td>
              </tr>
            `).join("") : `<tr><td colspan="5" class="p-4 text-center text-slate-400 text-xs">当月の収入入力はありません。「＋ 収入入力」から登録できます。</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // 2. カード・口座別の支出明細
  let sourcesHtml = "";
  if (sortedSources.length === 0) {
    sourcesHtml = `<div class="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-400">カードや口座が登録されていません。「設定」タブから設定してください。</div>`;
  } else {
    sourcesHtml = sortedSources.map(src => {
      const isSrcExcluded = (state.excludedSharedSourceIds || []).includes(src.id);
      const cardExpenses = currentExpenses.filter(e => e.sourceId === src.id);
      const cardRecs = currentRecurring.filter(r => r.sourceId === src.id);
      const cardDebts = (currentDebts || []).filter(d => d.sourceId === src.id);

      const regAmt = cardExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
      const recAmt = cardRecs.reduce((sum, r) => sum + Number(r.amount), 0);
      const debtAmt = cardDebts.reduce((sum, d) => sum + Number(d.amount), 0);
      const total = regAmt + recAmt + debtAmt;

      const lastDayOfCurMonth = new Date(year, month, 0).getDate();
      const displayDay = src.paymentDay === 99 ? lastDayOfCurMonth : src.paymentDay;
      const offsetName = (src.paymentMonthOffset === 2) ? '翌々月' : ((src.paymentMonthOffset === 0) ? '当月' : '翌月');

      let itemsHtml = "";
      let mobileItemsHtml = "";

      // ローン返済の表示（最上段）
      if (cardDebts.length > 0) {
        itemsHtml += cardDebts.map(d => `
          <tr onclick="openEditDebtOverrideModal('${d.debtId}', '${d.payMonth}')" class="${isSrcExcluded ? 'opacity-65' : ''} bg-indigo-50/40 hover:bg-indigo-100/60 cursor-pointer transition group" title="クリックしてこの月の返済額を変更">
            <td class="p-3 text-indigo-700 whitespace-nowrap font-medium">
              <span class="inline-block px-1.5 py-0.5 rounded bg-indigo-100 text-[10px] text-indigo-800 border border-indigo-300 font-bold mr-1">🏦 ローン返済</span>
              ${isSrcExcluded ? '<span class="inline-block px-1.5 py-0.5 rounded bg-slate-200 text-[9px] text-slate-700 font-bold mr-1">除外</span>' : ''}
              <span class="text-slate-500 text-[11px]">${d.payDate}</span>
            </td>
            <td class="p-3 text-indigo-950 font-bold break-words leading-relaxed whitespace-normal">
              ${d.memo}
              ${d.isOverridden ? '<span class="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold ml-1.5 border border-amber-300">●今月返済額変更済</span>' : ''}
              <span class="opacity-0 group-hover:opacity-100 text-[10px] text-indigo-600 font-semibold ml-1.5 transition-opacity">✏️金額変更</span>
            </td>
            <td class="p-3 text-right ${isSrcExcluded ? 'text-slate-400 font-bold' : 'font-black text-indigo-950'} whitespace-nowrap">¥${Number(d.amount).toLocaleString()}</td>
            <td class="p-3 text-center text-xs text-slate-400">固定</td>
          </tr>
        `).join("");

        mobileItemsHtml += cardDebts.map(d => `
          <div onclick="openEditDebtOverrideModal('${d.debtId}', '${d.payMonth}')" class="${isSrcExcluded ? 'opacity-65' : ''} p-3.5 bg-indigo-50/40 hover:bg-indigo-100/60 active:bg-indigo-100 cursor-pointer transition flex items-start justify-between gap-3 group" title="タップしてこの月の返済額を変更">
            <div class="min-w-0 flex-1 space-y-1">
              <div class="flex items-center gap-1.5 text-[10px]">
                <span class="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 border border-indigo-300 font-bold">🏦 ローン返済</span>
                ${isSrcExcluded ? '<span class="px-1 py-0.2 rounded bg-slate-200 text-slate-700 font-bold text-[9px]">除外</span>' : ''}
                <span class="text-slate-500">${d.payDate}</span>
                <span class="text-indigo-600">✏️変更</span>
              </div>
              <div class="text-xs font-bold text-indigo-950 break-words leading-snug whitespace-normal">
                ${d.memo}
                ${d.isOverridden ? '<span class="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-bold ml-1">●変更済</span>' : ''}
              </div>
            </div>
            <div class="text-right shrink-0">
              <span class="text-sm ${isSrcExcluded ? 'text-slate-400 font-bold' : 'font-black text-indigo-950'}">¥${Number(d.amount).toLocaleString()}</span>
            </div>
          </div>
        `).join("");
      }

      if (cardExpenses.length > 0) {
        itemsHtml += cardExpenses.map(e => `
          <tr onclick="openEditExpenseModal('${e.id}')" class="${isSrcExcluded ? 'opacity-65' : ''} hover:bg-rose-50/40 cursor-pointer transition group" title="クリックして編集">
            <td class="p-3 text-slate-500 whitespace-nowrap">
              ${e.date}
              ${isSrcExcluded ? '<span class="inline-block px-1.5 py-0.5 rounded bg-slate-200 text-[9px] text-slate-700 font-bold ml-1">除外</span>' : ''}
            </td>
            <td class="p-3 text-slate-800 font-medium break-words leading-relaxed whitespace-normal">
              ${e.memo || '未分類'}
              <span class="opacity-0 group-hover:opacity-100 text-[10px] text-rose-500 font-semibold ml-1.5 transition-opacity">✏️編集</span>
            </td>
            <td class="p-3 text-right ${isSrcExcluded ? 'text-slate-400 font-normal' : 'font-bold text-slate-900'} whitespace-nowrap">¥${Number(e.amount).toLocaleString()}</td>
            <td class="p-3 text-center whitespace-nowrap" onclick="event.stopPropagation()">
              <button onclick="deleteExpense('${e.id}')" title="削除" class="text-slate-400 hover:text-rose-600 font-bold px-2 py-1 rounded hover:bg-slate-100 transition">✕</button>
            </td>
          </tr>
        `).join("");

        mobileItemsHtml += cardExpenses.map(e => `
          <div onclick="openEditExpenseModal('${e.id}')" class="${isSrcExcluded ? 'opacity-65' : ''} p-3.5 hover:bg-rose-50/40 active:bg-rose-100/40 cursor-pointer transition flex items-start justify-between gap-3 group" title="タップして編集">
            <div class="min-w-0 flex-1 space-y-1">
              <div class="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span>📅</span>
                <span>${e.date}</span>
                ${isSrcExcluded ? '<span class="px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-bold text-[9px]">収支除外</span>' : ''}
                <span class="text-[10px] text-rose-500">✏️タップで編集</span>
              </div>
              <div class="text-xs font-semibold text-slate-900 break-words leading-snug whitespace-normal">
                ${e.memo || '未分類'}
              </div>
            </div>
            <div class="text-right shrink-0 flex items-center gap-2">
              <span class="text-sm ${isSrcExcluded ? 'text-slate-400 font-medium' : 'font-black text-slate-900'}">¥${Number(e.amount).toLocaleString()}</span>
              <button onclick="event.stopPropagation(); deleteExpense('${e.id}')" title="削除" class="text-slate-400 hover:text-rose-600 font-bold p-1.5 rounded active:bg-slate-200 transition">✕</button>
            </div>
          </div>
        `).join("");
      }

      if (cardRecs.length > 0) {
        itemsHtml += cardRecs.map(r => `
          <tr onclick="openEditRecurringModal('${r.id}')" class="${isSrcExcluded ? 'opacity-65' : ''} bg-amber-50/40 hover:bg-amber-100/60 cursor-pointer transition group" title="クリックして固定費を編集">
            <td class="p-3 text-amber-800 whitespace-nowrap font-medium">
              <span class="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-[10px] text-amber-800 border border-amber-300 font-bold mr-1">固定/年払</span>
              ${isSrcExcluded ? '<span class="inline-block px-1.5 py-0.5 rounded bg-slate-200 text-[9px] text-slate-700 font-bold mr-1">除外</span>' : ''}
              <span class="text-slate-500 text-[11px]">${r.payDate}</span>
            </td>
            <td class="p-3 text-amber-900 font-bold break-words leading-relaxed whitespace-normal">
              ${r.name}
              <span class="opacity-0 group-hover:opacity-100 text-[10px] text-amber-600 font-semibold ml-1.5 transition-opacity">✏️編集</span>
            </td>
            <td class="p-3 text-right ${isSrcExcluded ? 'text-slate-400 font-normal' : 'font-bold text-amber-800'} whitespace-nowrap">¥${Number(r.amount).toLocaleString()}</td>
            <td class="p-3 text-center text-xs text-slate-400">-</td>
          </tr>
        `).join("");

        mobileItemsHtml += cardRecs.map(r => `
          <div onclick="openEditRecurringModal('${r.id}')" class="${isSrcExcluded ? 'opacity-65' : ''} p-3.5 bg-amber-50/40 hover:bg-amber-100/60 active:bg-amber-100 cursor-pointer transition flex items-start justify-between gap-3 group" title="タップして固定費を編集">
            <div class="min-w-0 flex-1 space-y-1">
              <div class="flex items-center gap-1.5 text-[10px]">
                <span class="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 font-bold">固定/年払</span>
                ${isSrcExcluded ? '<span class="px-1 py-0.2 rounded bg-slate-200 text-slate-700 font-bold text-[9px]">除外</span>' : ''}
                <span class="text-slate-500">${r.payDate}</span>
                <span class="text-amber-700">✏️編集</span>
              </div>
              <div class="text-xs font-bold text-amber-900 break-words leading-snug whitespace-normal">${r.name}</div>
            </div>
            <div class="text-right shrink-0">
              <span class="text-sm ${isSrcExcluded ? 'text-slate-400 font-medium' : 'font-black text-amber-800'}">¥${Number(r.amount).toLocaleString()}</span>
            </div>
          </div>
        `).join("");
      }

      const hasItems = cardExpenses.length > 0 || cardRecs.length > 0 || cardDebts.length > 0;
      const scheduleDescription = src.type === 'CREDIT' 
        ? `締め日: <span class="font-medium text-slate-700">${src.closingDay === 99 ? '月末' : src.closingDay + '日'}</span> ｜ 引落日: <span class="font-bold text-slate-800">${month}月${displayDay}日</span> <span class="text-slate-400 text-[10px]">(${offsetName}${src.paymentDay === 99 ? '末日' : src.paymentDay + '日'}払い)</span>`
        : `引落日: <span class="font-semibold text-teal-800">各明細の指定日に引き落とし（口座振替）</span>`;

      return `
        <div class="bg-white border ${isSrcExcluded ? 'border-slate-300 shadow-none' : 'border-slate-200 shadow-sm'} rounded-xl overflow-hidden">
          <div class="p-4 bg-gradient-to-r ${isSrcExcluded ? 'from-slate-100 to-slate-50' : 'from-slate-50 to-white'} border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <span class="text-[10px] px-2 py-0.5 rounded font-bold ${src.type === 'CREDIT' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-teal-50 text-teal-700 border border-teal-200'}">
                ${src.type === 'CREDIT' ? 'クレジットカード' : '銀行口座振替'}
              </span>
              ${src.isShared ? '<span class="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-0.5"><span>🤝</span>共有カード</span>' : ''}
              ${isSrcExcluded ? '<span class="text-[10px] px-1.5 py-0.5 rounded font-bold bg-slate-200 text-slate-700 border border-slate-300 flex items-center gap-0.5"><span>🚫</span>自分の収支から除外中</span>' : ''}
              <div>
                <h3 class="font-bold text-slate-900 text-sm flex items-center gap-2">${src.name}</h3>
                <p class="text-[11px] text-slate-500 mt-0.5">${scheduleDescription}</p>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <div class="text-right">
                <span class="text-[10px] text-slate-400 block">${isSrcExcluded ? '当月利用額（支払なし）' : '当月引落予定額'}</span>
                <span class="text-lg font-black ${isSrcExcluded ? 'text-slate-400' : 'text-orange-700'}">¥${total.toLocaleString()}</span>
                ${isSrcExcluded ? '<span class="text-[9px] text-slate-500 block font-bold">※自分の収支から除外</span>' : ''}
              </div>
              <button onclick="openExpenseModalWithSource('${src.id}')" title="このカード・口座に支出明細を追加" class="px-3 py-2 text-xs font-bold rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition active:scale-95">
                − 支出追加
              </button>
            </div>
          </div>

          <div class="block sm:hidden divide-y divide-slate-100">
            ${hasItems ? mobileItemsHtml : `<div class="p-4 text-center text-slate-400 text-xs">当月の利用明細はありません</div>`}
          </div>

          <div class="hidden sm:block overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th class="p-3 w-36">${src.type === 'CREDIT' ? '利用日' : '引落指定日'}</th>
                  <th class="p-3">品目 / 内容</th>
                  <th class="p-3 text-right w-28">金額</th>
                  <th class="p-3 text-center w-14">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${hasItems ? itemsHtml : `<tr><td colspan="4" class="p-4 text-center text-slate-400 text-xs">当月の利用明細はありません</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join("");
  }

  // 2. カード・口座別の引き落とし予定日セクション
  const dueCardsHtml = sortedSources.map(src => {
    const cardExpenses = currentExpenses.filter(e => e.sourceId === src.id);
    const cardRecs = currentRecurring.filter(r => r.sourceId === src.id);
    const cardDebts = (currentDebts || []).filter(d => d.sourceId === src.id);
    const total = cardExpenses.reduce((sum, e) => sum + Number(e.amount), 0) +
                  cardRecs.reduce((sum, r) => sum + Number(r.amount), 0) +
                  cardDebts.reduce((sum, d) => sum + Number(d.amount), 0);

    let dateDisplay = "";
    if (src.type === 'CREDIT') {
      const lastDayOfCurMonth = new Date(year, month, 0).getDate();
      const displayDay = src.paymentDay === 99 ? lastDayOfCurMonth : src.paymentDay;
      dateDisplay = `${month}月${displayDay}日`;
    } else {
      const dates = [...new Set([
        ...cardExpenses.map(e => Number(e.payDate.split("-")[2])),
        ...cardRecs.map(r => Number(r.payDate.split("-")[2]))
      ])].filter(Boolean).sort((a, b) => a - b);

      dateDisplay = dates.length > 0 ? `${month}月 ${dates.map(d => d + '日').join(', ')}` : '指定日引落';
    }

    const isSrcExcluded = (state.excludedSharedSourceIds || []).includes(src.id);

    return `
      <div class="bg-slate-50 border ${isSrcExcluded ? 'border-slate-300 opacity-60' : 'border-slate-200'} rounded-xl px-3 py-2 flex items-center justify-between gap-2 shadow-sm">
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="text-[11px] font-bold text-slate-800">${dateDisplay}</span>
            <span class="text-[10px] px-1.5 py-0.2 rounded font-semibold ${src.type === 'CREDIT' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-teal-50 text-teal-700 border border-teal-200'}">
              ${src.type === 'CREDIT' ? 'クレカ' : '口座振替'}
            </span>
            ${src.isShared ? '<span class="text-[10px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 font-bold">共有</span>' : ''}
            ${isSrcExcluded ? '<span class="text-[9px] px-1 py-0.2 rounded bg-slate-200 text-slate-700 font-bold">収支除外</span>' : ''}
          </div>
          <div class="text-xs font-semibold text-slate-700 truncate mt-0.5">${src.name}</div>
        </div>
        <div class="text-right shrink-0">
          <span class="text-[10px] text-slate-400 block">${isSrcExcluded ? '利用合計(支払なし)' : '引落予定額'}</span>
          <span class="text-xs sm:text-sm font-bold ${isSrcExcluded ? 'text-slate-400' : 'text-slate-900'}">¥${total.toLocaleString()}</span>
        </div>
      </div>
    `;
  }).join("");

  const dueScheduleSectionHtml = `
    <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2.5">
      <div class="flex items-center justify-between">
        <div class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <span>📅</span> カード・口座別の引き落とし予定日
        </div>
        <span class="text-[11px] text-slate-400">引落予定総額: <strong class="text-slate-800 font-bold">¥${((regularTotal || 0) + (recurringTotal || 0)).toLocaleString()}</strong></span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
        ${dueCardsHtml}
      </div>
    </div>
  `;

  // 3. 現金支出セクション（緑・エメラルド系バッジ）
  const cashDebts = (currentDebts || []).filter(d => d.sourceId === 'CASH' || d.sourceId === CASH_SOURCE_ID);
  let cashItemsHtml = "";
  let cashMobileItemsHtml = "";

  if (cashDebts.length > 0) {
    cashItemsHtml += cashDebts.map(d => `
      <tr onclick="openEditDebtOverrideModal('${d.debtId}', '${d.payMonth}')" class="bg-indigo-50/50 hover:bg-indigo-100/60 cursor-pointer transition group" title="クリックしてこの月の返済額を変更">
        <td class="p-3 text-indigo-700 whitespace-nowrap font-medium">
          <span class="inline-block px-1.5 py-0.5 rounded bg-indigo-100 text-[10px] text-indigo-800 border border-indigo-300 font-bold mr-1">🏦 ローン返済</span>
          <span class="text-slate-500 text-[11px]">${d.payDate}</span>
        </td>
        <td class="p-3 text-indigo-950 font-bold break-words leading-relaxed whitespace-normal">
          ${d.memo}
          ${d.isOverridden ? '<span class="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold ml-1.5 border border-amber-300">●今月返済額変更済</span>' : ''}
          <span class="opacity-0 group-hover:opacity-100 text-[10px] text-indigo-600 font-semibold ml-1.5 transition-opacity">✏️金額変更</span>
        </td>
        <td class="p-3 text-right font-black text-indigo-950 whitespace-nowrap">¥${Number(d.amount).toLocaleString()}</td>
        <td class="p-3 text-center text-xs text-slate-400">現金</td>
      </tr>
    `).join("");

    cashMobileItemsHtml += cashDebts.map(d => `
      <div onclick="openEditDebtOverrideModal('${d.debtId}', '${d.payMonth}')" class="p-3.5 bg-indigo-50/40 hover:bg-indigo-100/60 active:bg-indigo-100 cursor-pointer transition flex items-start justify-between gap-3 group" title="タップしてこの月の返済額を変更">
        <div class="min-w-0 flex-1 space-y-1">
          <div class="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span class="text-[10px] px-1.5 py-0.2 rounded font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">🏦 ローン返済</span>
            <span>${d.payDate}</span>
            <span class="text-indigo-600">✏️変更</span>
          </div>
          <div class="text-xs font-bold text-indigo-950 break-words leading-snug whitespace-normal">
            ${d.memo}
            ${d.isOverridden ? '<span class="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-bold ml-1">●変更済</span>' : ''}
          </div>
        </div>
        <div class="text-right shrink-0">
          <span class="text-sm font-black text-indigo-950">¥${Number(d.amount).toLocaleString()}</span>
        </div>
      </div>
    `).join("");
  }

  if (cashExpenses.length > 0) {
    cashItemsHtml = cashExpenses.map(e => `
      <tr onclick="openEditExpenseModal('${e.id}')" class="hover:bg-emerald-50/50 cursor-pointer transition group" title="クリックして編集">
        <td class="p-3 text-slate-500 whitespace-nowrap">${e.date}</td>
        <td class="p-3 text-slate-800 font-medium break-words leading-relaxed whitespace-normal">
          ${e.memo || '未分類'}
          <span class="opacity-0 group-hover:opacity-100 text-[10px] text-emerald-600 font-semibold ml-1.5 transition-opacity">✏️編集</span>
        </td>
        <td class="p-3 text-right font-black text-emerald-800 whitespace-nowrap">¥${Number(e.amount).toLocaleString()}</td>
        <td class="p-3 text-center whitespace-nowrap" onclick="event.stopPropagation()">
          <button onclick="deleteExpense('${e.id}')" title="削除" class="text-slate-400 hover:text-rose-600 font-bold px-2 py-1 rounded hover:bg-slate-100 transition">✕</button>
        </td>
      </tr>
    `).join("");

    cashMobileItemsHtml = cashExpenses.map(e => `
      <div onclick="openEditExpenseModal('${e.id}')" class="p-3.5 hover:bg-emerald-50/50 active:bg-emerald-100/50 cursor-pointer transition flex items-start justify-between gap-3 group" title="タップして編集">
        <div class="min-w-0 flex-1 space-y-1">
          <div class="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span>📅</span>
            <span>${e.date}</span>
            <span class="text-[10px] px-1.5 py-0.2 rounded font-bold bg-emerald-100 text-emerald-800">💵 現金</span>
            <span class="text-[10px] text-emerald-600">✏️タップで編集</span>
          </div>
          <div class="text-xs font-semibold text-slate-900 break-words leading-snug whitespace-normal">
            ${e.memo || '未分類'}
          </div>
        </div>
        <div class="text-right shrink-0 flex items-center gap-2">
          <span class="text-sm font-black text-emerald-700">¥${Number(e.amount).toLocaleString()}</span>
          <button onclick="event.stopPropagation(); deleteExpense('${e.id}')" title="削除" class="text-slate-400 hover:text-rose-600 font-bold p-1.5 rounded active:bg-slate-200 transition">✕</button>
        </div>
      </div>
    `).join("");
  }

  const cashSectionHtml = `
    <div id="cashExpenseSection" class="bg-white border border-emerald-200 rounded-xl overflow-hidden shadow-sm transition-all duration-300">
      <div class="p-4 bg-gradient-to-r from-emerald-50 to-white border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <span class="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            現金決済
          </span>
          <div>
            <h3 class="font-bold text-slate-900 text-sm flex items-center gap-2">
              💵 現金支出
            </h3>
            <p class="text-[11px] text-slate-500 mt-0.5">口座引き落としを伴わない、現金で支払った支出の一覧です。</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="text-right">
            <span class="text-[10px] text-slate-400 block">当月現金支出合計</span>
            <span class="text-lg font-black text-emerald-700">¥${cashTotal.toLocaleString()}</span>
          </div>
          <button onclick="openExpenseModalWithSource(null, 'CASH')" title="現金支出を追加" class="px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition active:scale-95">
            − 現金支出を追加
          </button>
        </div>
      </div>

      <div class="block sm:hidden divide-y divide-slate-100">
        ${(cashExpenses.length > 0 || cashDebts.length > 0) ? cashMobileItemsHtml : `<div class="p-4 text-center text-slate-400 text-xs">当月の現金支出はありません</div>`}
      </div>

      <div class="hidden sm:block overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-emerald-50/50 text-slate-500 font-semibold border-b border-emerald-100">
            <tr>
              <th class="p-3 w-36">利用日</th>
              <th class="p-3">品目 / 内容</th>
              <th class="p-3 text-right w-28">金額</th>
              <th class="p-3 text-center w-14">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${(cashExpenses.length > 0 || cashDebts.length > 0) ? cashItemsHtml : `<tr><td colspan="4" class="p-4 text-center text-slate-400 text-xs">当月の現金支出はありません</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  expensesContainer.innerHTML = `
    ${incomeSectionHtml}
    ${dueScheduleSectionHtml}
    <div class="pt-2 border-t border-slate-200">
      <div class="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
        <span>💳</span> 支出明細（現金・カード・口座別）
      </div>
      <div class="space-y-4">
        ${cashSectionHtml}
        ${sourcesHtml}
      </div>
    </div>
  `;
}

/**
 * 🔄 固定費一覧タブのレンダリング
 */
function renderRecurringTab({ year, month, currentRecurring }) {
  const recurringContainer = document.getElementById("recurringListContainer");
  if (recurringContainer) {
    recurringContainer.innerHTML = state.recurringList.map(r => {
      const src = state.sources.find(s => s.id === r.sourceId);
      const dueInfo = src ? getRecurringDueDateInfo(r, src, year) : null;
      const isHit = dueInfo && dueInfo.payMonth === state.currentMonth;
      const [, pM] = dueInfo ? dueInfo.payMonth.split("-") : ["", ""];
      const pD = dueInfo ? dueInfo.payDate.split("-")[2] : "";
      const payDateLabel = dueInfo ? `${Number(pM)}月${Number(pD)}日` : '-';

      return `
        <div class="bg-white border ${isHit ? 'border-amber-400 ring-2 ring-amber-100 bg-amber-50/20' : 'border-slate-200'} rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div>
            <div class="flex justify-between items-center mb-1">
              <div class="flex items-center gap-1">
                <span class="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  ${r.frequency === 'YEARLY' ? `毎年 ${r.targetMonth}月${r.targetDay === 99 ? '末日' : r.targetDay + '日'}` : `毎月 ${r.targetDay === 99 ? '末日' : r.targetDay + '日'}`}
                </span>
                ${r.isShared ? '<span class="text-[10px] px-1 py-0.5 rounded font-bold bg-amber-100 text-amber-900 border border-amber-300">共有</span>' : ''}
              </div>
              <div class="flex items-center gap-1">
                <button onclick="openEditRecurringModal('${r.id}')" title="編集" class="text-slate-400 hover:text-indigo-600 font-medium px-1.5 py-0.5 rounded hover:bg-slate-100 transition">✏️ 編集</button>
                <button onclick="deleteRecurring('${r.id}')" title="削除" class="text-slate-400 hover:text-rose-600 font-bold px-1.5 py-0.5 rounded hover:bg-slate-100 transition">✕</button>
              </div>
            </div>
            <h4 class="font-bold text-slate-900 text-sm mt-1.5">${r.name}</h4>
            <div class="mt-2 text-[11px] text-slate-600 space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
              <div>支払元: <span class="font-semibold text-slate-800">${src ? src.name : '不明'}</span></div>
              <div>引落予定: <span class="font-bold text-amber-800">${payDateLabel}</span></div>
            </div>
          </div>
          <div class="mt-3 pt-2 border-t border-slate-100 text-right">
            <span class="text-base font-black text-amber-700">¥${Number(r.amount).toLocaleString()}</span>
          </div>
        </div>
      `;
    }).join("");
  }
}

/**
 * 📉 返済シミュレーションタブのレンダリング
 */
function renderDebtsTab({ netSavings, currentMonth, sources = [] }) {
  const debtsContainer = document.getElementById("debtsListContainer");
  if (!debtsContainer) return;

  const debts = state.debts || [];
  if (debts.length === 0) {
    debtsContainer.innerHTML = `
      <div class="p-8 text-center text-slate-400 text-xs bg-white border border-slate-200 rounded-2xl space-y-2">
        <div class="text-2xl">🎉</div>
        <div class="font-bold text-slate-700">登録されている借金・ローンはありません</div>
        <p class="text-[11px] text-slate-500">カーローン、奨学金、住宅ローン、カードローン等を登録すると、毎月の明細に自動反映され、完済予定や繰り上げ返済シミュレーションができます。</p>
        <button onclick="openCreateDebtModal()" class="mt-2 px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs">
          ＋ 借金・ローンを追加
        </button>
      </div>
    `;
    return;
  }

  const extraPayInput = document.getElementById("extraPaySimInput");
  const extraAmount = extraPayInput ? Number(extraPayInput.value) : 10000;
  const curM = currentMonth || state.currentMonth;

  debtsContainer.innerHTML = debts.map(d => {
    const normalSim = simulateDebtPayoff(d.totalBalance, d.monthlyPayment, d.interestRate, 0);
    const extraSim = simulateDebtPayoff(d.totalBalance, d.monthlyPayment, d.interestRate, extraAmount);

    const savedMonths = Math.max(normalSim.months - extraSim.months, 0);
    const savedInterest = Math.max(normalSim.totalInterest - extraSim.totalInterest, 0);

    const src = sources.find(s => s.id === d.sourceId);
    let srcName = "💵 現金支払い";
    let payDayText = `${d.paymentDay === 99 ? '末日' : (d.paymentDay || 27) + '日'}`;
    if (d.sourceId !== 'CASH' && src) {
      srcName = `${src.type === 'CREDIT' ? '💳' : '🏦'} ${src.name}`;
      payDayText = src.type === 'CREDIT' ? `${src.paymentDay === 99 ? '末日' : src.paymentDay + '日'}` : `${d.paymentDay === 99 ? '末日' : (d.paymentDay || 27) + '日'}`;
    }

    const curOverride = d.monthlyOverrides && d.monthlyOverrides[curM] != null ? Number(d.monthlyOverrides[curM]) : null;
    const curMonthPay = curOverride != null ? curOverride : Number(d.monthlyPayment);

    // 回数計算
    let installmentText = "";
    if (d.startMonth && d.endMonth) {
      const [sy, sm] = d.startMonth.split("-").map(Number);
      const [ey, em] = d.endMonth.split("-").map(Number);
      const totalInst = (ey - sy) * 12 + (em - sm) + 1;
      const [cy, cm] = curM.split("-").map(Number);
      const curInst = (cy - sy) * 12 + (cm - sm) + 1;
      if (curInst >= 1 && curInst <= totalInst) {
        installmentText = ` (当月: 第${curInst}/${totalInst}回)`;
      } else if (curInst > totalInst) {
        installmentText = ` (完済済)`;
      }
    }

    return `
      <div class="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <!-- ヘッダー -->
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs px-2 py-0.5 rounded font-bold bg-amber-50 text-amber-800 border border-amber-200">
                年利 ${d.interestRate}%
              </span>
              <h3 class="font-black text-slate-900 text-sm sm:text-base">${d.name}</h3>
              ${d.startMonth && d.endMonth ? `
                <span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  ${d.startMonth} 〜 ${d.endMonth}${installmentText}
                </span>
              ` : ''}
            </div>
            <div class="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
              <span>基本返済額: <strong class="text-slate-800">¥${Number(d.monthlyPayment).toLocaleString()}/月</strong></span>
              <span>支払元: <strong class="text-indigo-800">${srcName}</strong> (${payDayText}引落)</span>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <button onclick="openEditDebtOverrideModal('${d.id}', '${curM}')" class="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition active:scale-95">
              ${curM}月 返済額変更
            </button>
            <button onclick="openEditDebtModal('${d.id}')" class="px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">設定編集</button>
            <button onclick="deleteDebt('${d.id}')" class="px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg">削除</button>
          </div>
        </div>

        <!-- 金額・残高・当月予定カード -->
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span class="text-[10px] text-slate-400 block font-medium">借入総額</span>
            <span class="text-lg font-black text-slate-900">¥${Number(d.totalAmount || d.totalBalance).toLocaleString()}</span>
          </div>
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span class="text-[10px] text-slate-400 block font-medium">現在の残高</span>
            <span class="text-lg font-black text-amber-900">¥${Number(d.totalBalance).toLocaleString()}</span>
          </div>
          <div class="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
            <span class="text-[10px] text-indigo-700 block font-bold">${curM}月の引落予定額</span>
            <span class="text-lg font-black text-indigo-950">¥${curMonthPay.toLocaleString()}</span>
            ${curOverride != null ? '<span class="text-[10px] text-amber-700 font-bold block">●今月個別変更適用中</span>' : ''}
          </div>
          <div class="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
            <span class="text-[10px] text-emerald-800 block font-bold">＋¥${extraAmount.toLocaleString()}/月 繰上時</span>
            <span class="text-base font-black text-emerald-700">
              ${extraSim.years}年 ${extraSim.remMonths}ヶ月
            </span>
            <span class="text-[10px] text-emerald-800 font-bold block truncate">
              ${savedMonths > 0 ? `約${savedMonths}ヶ月 & ¥${savedInterest.toLocaleString()}節約` : '短縮なし'}
            </span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

/**
 * ⚙️ 設定タブのレンダリング（カード管理 ＋ 収入元マスター管理）
 */
function renderSourcesTab({ sortedSources }) {
  // 1. カード・口座の管理
  const sourcesContainer = document.getElementById("sourcesListContainer");
  if (sourcesContainer) {
    sourcesContainer.innerHTML = sortedSources.map((src, idx) => {
      const isExcluded = (state.excludedSharedSourceIds || []).includes(src.id);
      const offsetName = (src.paymentMonthOffset === 2) ? '翌々月' : ((src.paymentMonthOffset === 0) ? '当月' : '翌月');
      const payDayText = src.paymentDay === 99 ? '末日' : `${src.paymentDay} 日`;
      const isFirst = idx === 0;
      const isLast = idx === sortedSources.length - 1;

      return `
        <div class="bg-white border ${isExcluded ? 'border-slate-300' : 'border-slate-200'} rounded-xl p-4 flex flex-col justify-between shadow-sm hover:border-slate-300 transition">
          <div>
            <div class="flex justify-between items-center mb-1">
              <div class="flex flex-wrap items-center gap-1">
                <span class="text-[10px] px-2 py-0.5 rounded font-bold ${src.type === 'CREDIT' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-teal-50 text-teal-700 border border-teal-200'}">
                  ${src.type === 'CREDIT' ? 'クレジットカード' : '銀行口座振替'}
                </span>
                ${src.isShared ? '<span class="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-0.5"><span>🤝</span>共有</span>' : '<span class="text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-500">個人専用</span>'}
                ${src.isShared && isExcluded ? '<span class="text-[10px] px-1.5 py-0.5 rounded font-bold bg-slate-200 text-slate-700 border border-slate-300 flex items-center gap-0.5"><span>🚫</span>収支除外中</span>' : ''}
              </div>
              <div class="flex items-center gap-1">
                <button onclick="handleMoveSourceOrder('${src.id}', -1)" ${isFirst ? 'disabled' : ''} title="上へ移動" class="p-1 rounded text-xs font-bold ${isFirst ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100 active:scale-95 transition'}">▲</button>
                <button onclick="handleMoveSourceOrder('${src.id}', 1)" ${isLast ? 'disabled' : ''} title="下へ移動" class="p-1 rounded text-xs font-bold ${isLast ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100 active:scale-95 transition'}">▼</button>
                <span class="h-3 w-px bg-slate-200 mx-0.5"></span>
                <button onclick="openEditSourceModal('${src.id}')" title="編集" class="text-slate-400 hover:text-indigo-600 font-medium px-1.5 py-0.5 rounded hover:bg-slate-100 transition">✏️ 編集</button>
                <button onclick="deleteSource('${src.id}')" title="削除" class="text-slate-400 hover:text-rose-600 font-bold px-1.5 py-0.5 rounded hover:bg-slate-100 transition">✕</button>
              </div>
            </div>
            <h3 class="font-bold text-slate-900 text-sm mt-1.5">${src.name}</h3>
            <div class="mt-2.5 text-xs text-slate-600 space-y-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              ${src.type === 'CREDIT' ? `
                <div class="flex justify-between">
                  <span class="text-slate-400">締め日:</span>
                  <span class="font-semibold text-slate-800">毎月 ${src.closingDay === 99 ? '月末' : src.closingDay + ' 日'}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-400">お支払い:</span>
                  <span class="font-semibold text-indigo-700">${offsetName} ${payDayText} 払い</span>
                </div>
              ` : `
                <div class="text-[11px] text-teal-800 leading-relaxed">
                  💡 明細入力時に指定した利用日がそのまま引き落とし日になります。
                </div>
              `}
            </div>

            ${src.isShared ? `
              <div class="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span class="text-slate-600 font-medium text-[11px] flex items-center gap-1">
                  <span>📊</span> 自分側の収支:
                </span>
                <button onclick="toggleExcludeSharedSource('${src.id}')" title="クリックして自分の収支に含める/除外するを切り替え" class="px-2.5 py-1 rounded-lg font-bold text-[10px] transition active:scale-95 flex items-center gap-1 ${isExcluded ? 'bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'}">
                  ${isExcluded ? '<span>🚫</span> 収支から除外中' : '<span>✅</span> 収支に反映中'}
                </button>
              </div>
              ${isExcluded ? '<div class="text-[9px] text-slate-400 mt-1 leading-tight text-right">※ 相手側の収支には影響しません</div>' : ''}
            ` : ''}
          </div>
        </div>
      `;
    }).join("");
  }

  // 2. 収入元マスターの管理セクション
  const incSourcesContainer = document.getElementById("incomeSourcesListContainer");
  if (incSourcesContainer) {
    const sortedInc = getSortedIncomeSources();
    if (sortedInc.length === 0) {
      incSourcesContainer.innerHTML = `<div class="col-span-full p-4 text-center text-slate-400 text-xs bg-slate-50 rounded-xl">収入元が登録されていません。「＋ 収入元を追加」から本業勤務先や副業先を登録してください。</div>`;
    } else {
      incSourcesContainer.innerHTML = sortedInc.map((is, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === sortedInc.length - 1;
        return `
          <div class="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-sm hover:border-slate-300 transition">
            <div class="flex items-center gap-2">
              <span class="text-base">💼</span>
              <div>
                <h4 class="font-bold text-slate-800 text-xs">${is.name}</h4>
                <span class="text-[10px] text-slate-400">収入元</span>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <button onclick="handleMoveIncomeSourceOrder('${is.id}', -1)" ${isFirst ? 'disabled' : ''} title="上へ移動" class="p-1 rounded text-xs font-bold ${isFirst ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-sky-600 hover:bg-slate-100 transition'}">▲</button>
              <button onclick="handleMoveIncomeSourceOrder('${is.id}', 1)" ${isLast ? 'disabled' : ''} title="下へ移動" class="p-1 rounded text-xs font-bold ${isLast ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-sky-600 hover:bg-slate-100 transition'}">▼</button>
              <span class="h-3 w-px bg-slate-200 mx-0.5"></span>
              <button onclick="openEditIncomeSourceModal('${is.id}')" title="編集" class="text-slate-400 hover:text-sky-600 font-medium px-1.5 py-0.5 rounded hover:bg-slate-100 transition">✏️</button>
              <button onclick="deleteIncomeSource('${is.id}')" title="削除" class="text-slate-400 hover:text-rose-600 font-bold px-1.5 py-0.5 rounded hover:bg-slate-100 transition">✕</button>
            </div>
          </div>
        `;
      }).join("");
    }
  }
}
