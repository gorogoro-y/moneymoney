// js/calculator.js
// 締め日・引き落とし日・集計・返済シミュレーション計算ロジック

/**
 * 明細の利用日とカード/口座情報から、引き落とし月と引き落とし日を計算
 */
function calculateDueDate(dateStr, source) {
  if (!dateStr) return { payMonth: "", payDate: "" };

  // 現金支出（CASH）の場合は利用月が支払月、利用日がそのまま支払日
  if (!source || source === "CASH" || (typeof source === "object" && (source.id === "CASH" || source.type === "CASH"))) {
    const parts = dateStr.split("-");
    const pMonth = `${parts[0]}-${parts[1]}`;
    return { payMonth: pMonth, payDate: dateStr };
  }

  const [y, m, d] = dateStr.split("-").map(Number);

  // 銀行口座（口座振替）の場合は利用日/指定日がそのまま引落日
  if (source.type === "BANK_DIRECT") {
    const pMonth = `${y}-${String(m).padStart(2, '0')}`;
    return { payMonth: pMonth, payDate: dateStr };
  }

  // クレジットカードの締め日計算
  let closeY = y;
  let closeM = m - 1;

  if (source.closingDay !== 99 && d > source.closingDay) {
    closeM += 1;
    if (closeM > 11) {
      closeM = 0;
      closeY += 1;
    }
  }

  const offset = typeof source.paymentMonthOffset === 'number' ? source.paymentMonthOffset : 1;
  let pY = closeY;
  let pM = closeM + offset;

  while (pM > 11) {
    pM -= 12;
    pY += 1;
  }
  while (pM < 0) {
    pM += 12;
    pY += 1;
  }

  const lastDayOfPayMonth = new Date(pY, pM + 1, 0).getDate();
  const actualPayDay = source.paymentDay === 99 ? lastDayOfPayMonth : Math.min(source.paymentDay, lastDayOfPayMonth);

  const pMonth = `${pY}-${String(pM + 1).padStart(2, '0')}`;
  return { payMonth: pMonth, payDate: `${pMonth}-${String(actualPayDay).padStart(2, '0')}` };
}

/**
 * 年払い・固定費項目の引落予定日情報を計算
 */
function getRecurringDueDateInfo(recurringItem, source, targetYear) {
  if (!source && recurringItem?.sourceId !== 'CASH') return { payMonth: "", payDate: "", useDateStr: "" };

  const year = targetYear || new Date().getFullYear();
  const month = recurringItem.targetMonth || 1;
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const day = recurringItem.targetDay === 99 ? lastDayOfMonth : Math.min(recurringItem.targetDay || 1, lastDayOfMonth);

  const useDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (recurringItem?.sourceId === 'CASH' || source?.type === 'CASH') {
    return {
      payMonth: useDateStr.slice(0, 7),
      payDate: useDateStr,
      useDateStr,
      useMonth: month,
      useDay: day
    };
  }
  const dueInfo = calculateDueDate(useDateStr, source);

  return { ...dueInfo, useDateStr, useMonth: month, useDay: day };
}

/**
 * 固定費項目が指定された利用月 (useYear, useMonth) において有効期間内か判定
 */
function isRecurringActiveInUseMonth(recurringItem, useYear, useMonth) {
  if (!recurringItem) return false;
  const useMonthKey = `${useYear}-${String(useMonth).padStart(2, '0')}`;
  if (recurringItem.startMonth && useMonthKey < recurringItem.startMonth) {
    return false;
  }
  if (recurringItem.endMonth && useMonthKey > recurringItem.endMonth) {
    return false;
  }
  return true;
}

/**
 * 起動時に開くべき月（当月未払いが残っていれば当月、完了していれば翌月）を自動判定
 */
function getInitialMonth(expenses, recurringList, sources) {
  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;
  const curD = now.getDate();
  const todayStr = `${curY}-${String(curM).padStart(2, '0')}-${String(curD).padStart(2, '0')}`;
  const curMonthStr = `${curY}-${String(curM).padStart(2, '0')}`;

  const curExpenses = expenses.map(e => {
    if (e.sourceId === 'CASH') return null;
    const src = sources.find(s => s.id === e.sourceId);
    const { payMonth, payDate } = calculateDueDate(e.date, src);
    return { payMonth, payDate };
  }).filter(e => e && e.payMonth === curMonthStr);

  const curRecurring = [];
  recurringList.forEach(r => {
    const src = sources.find(s => s.id === r.sourceId);
    if (!src) return;
    if (r.frequency === 'MONTHLY') {
      [-1, 0, 1].forEach(offsetMonth => {
        const d = new Date(curY, curM - 1 + offsetMonth, 1);
        const checkYear = d.getFullYear();
        const checkMonth = d.getMonth() + 1;
        if (!isRecurringActiveInUseMonth(r, checkYear, checkMonth)) return;
        const dummyItem = { ...r, targetMonth: checkMonth };
        const dueInfo = getRecurringDueDateInfo(dummyItem, src, checkYear);
        if (dueInfo && dueInfo.payMonth === curMonthStr) {
          curRecurring.push(dueInfo);
        }
      });
    } else {
      [-1, 0, 1].forEach(offsetYear => {
        const checkYear = curY + offsetYear;
        const checkMonth = r.targetMonth || 1;
        if (!isRecurringActiveInUseMonth(r, checkYear, checkMonth)) return;
        const dueInfo = getRecurringDueDateInfo(r, src, checkYear);
        if (dueInfo && dueInfo.payMonth === curMonthStr) {
          curRecurring.push(dueInfo);
        }
      });
    }
  });

  const hasRemainingDue = 
    curExpenses.some(e => e.payDate >= todayStr) || 
    curRecurring.some(r => r.payDate >= todayStr);

  if (hasRemainingDue) {
    return curMonthStr;
  } else {
    const nextDate = new Date(curY, curM, 1);
    return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
  }
}

/**
 * 指定月（YYYY-MM）の収入明細（incomeEntries）の合計額を計算
 */
function calculateMonthlyIncome(incomeEntries, targetMonth) {
  if (!incomeEntries || incomeEntries.length === 0 || !targetMonth) return 0;

  return incomeEntries.reduce((sum, item) => {
    const amt = Number(item.amount) || 0;
    // 日付が指定月と一致するかチェック（item.date: YYYY-MM-DD）
    if (item.date && item.date.startsWith(targetMonth)) {
      return sum + amt;
    }
    // 旧バージョンの固定収入互換
    if (!item.date && item.frequency === 'MONTHLY') {
      return sum + amt;
    }
    return sum;
  }, 0);
}

/**
 * 次回直近の引き落としアクションを取得（カウントダウン用）
 */
function getNextDueAction(currentExpenses, currentRecurring, sources, excludedSourceIds = []) {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  const todayStr = local.toISOString().split("T")[0];

  const isExcluded = (id) => (excludedSourceIds && excludedSourceIds.includes(id));

  const payMap = new Map();
  currentExpenses.forEach(e => {
    if (e.sourceId === 'CASH' || isExcluded(e.sourceId)) return; // 現金支出または収支除外カードは除外
    if (e.payDate && e.payDate >= todayStr) {
      const key = `${e.sourceId}_${e.payDate}`;
      const prev = payMap.get(key) || { sourceId: e.sourceId, payDate: e.payDate, amount: 0 };
      prev.amount += Number(e.amount);
      payMap.set(key, prev);
    }
  });

  currentRecurring.forEach(r => {
    if (r.sourceId === 'CASH' || isExcluded(r.sourceId)) return; // 現金支出または収支除外カードは除外
    if (r.payDate && r.payDate >= todayStr) {
      const key = `${r.sourceId}_${r.payDate}`;
      const prev = payMap.get(key) || { sourceId: r.sourceId, payDate: r.payDate, amount: 0 };
      prev.amount += Number(r.amount);
      payMap.set(key, prev);
    }
  });

  const futureDues = Array.from(payMap.values()).sort((a, b) => a.payDate.localeCompare(b.payDate));

  if (futureDues.length === 0) {
    return null;
  }

  const next = futureDues[0];
  const src = sources.find(s => s.id === next.sourceId);

  const dToday = new Date(todayStr);
  const dDue = new Date(next.payDate);
  const diffDays = Math.ceil((dDue - dToday) / (1000 * 60 * 60 * 24));

  return {
    sourceName: src ? src.name : "不明な支払先",
    sourceType: src ? src.type : "CREDIT",
    payDate: next.payDate,
    amount: next.amount,
    diffDays: diffDays
  };
}

/**
 * 1年分（1月〜12月）の月別支出・収入および年間統計サマリーを計算
 * @param {number} targetYear 
 * @param {'DUE_MONTH' | 'USE_MONTH'} mode 
 * @param {Array} expenses 
 * @param {Array} recurringList 
 * @param {Array} sources 
 * @param {Array} incomeEntries 
 * @param {Array} excludedSourceIds
 */
function calculateYearlySummary(targetYear, mode, expenses, recurringList, sources, incomeEntries = [], excludedSourceIds = []) {
  const monthsData = [];
  let grandExpense = 0;
  let grandIncome = 0;
  let maxMonth = { month: 1, total: 0 };

  const isExcluded = (id) => (excludedSourceIds && excludedSourceIds.includes(id));

  for (let m = 1; m <= 12; m++) {
    const monthKey = `${targetYear}-${String(m).padStart(2, '0')}`;
    let regularExpenses = [];
    let cashExpenses = [];
    let curRecurring = [];

    if (mode === 'DUE_MONTH') {
      // 引き落とし月基準
      expenses.forEach(e => {
        if (isExcluded(e.sourceId)) return; // 収支除外カードは除外
        if (e.sourceId === 'CASH' || e.sourceId === CASH_SOURCE_ID) {
          if (e.date && e.date.startsWith(monthKey)) {
            cashExpenses.push(e);
          }
        } else {
          const src = sources.find(s => s.id === e.sourceId);
          const { payMonth } = calculateDueDate(e.date, src);
          if (payMonth === monthKey) {
            regularExpenses.push(e);
          }
        }
      });

      recurringList.forEach(r => {
        if (isExcluded(r.sourceId)) return; // 収支除外カードは除外
        const src = r.sourceId === 'CASH' ? { id: 'CASH', type: 'CASH' } : sources.find(s => s.id === r.sourceId);
        if (!src) return;
        if (r.frequency === 'MONTHLY') {
          [-1, 0, 1].forEach(offsetMonth => {
            const d = new Date(targetYear, m - 1 + offsetMonth, 1);
            const checkYear = d.getFullYear();
            const checkMonth = d.getMonth() + 1;
            if (!isRecurringActiveInUseMonth(r, checkYear, checkMonth)) return;
            const dummyItem = { ...r, targetMonth: checkMonth };
            const dueInfo = getRecurringDueDateInfo(dummyItem, src, checkYear);
            if (dueInfo && dueInfo.payMonth === monthKey) {
              curRecurring.push({ ...r, ...dueInfo });
            }
          });
        } else {
          [-1, 0, 1].forEach(offsetYear => {
            const checkYear = targetYear + offsetYear;
            const checkMonth = r.targetMonth || 1;
            if (!isRecurringActiveInUseMonth(r, checkYear, checkMonth)) return;
            const dueInfo = getRecurringDueDateInfo(r, src, checkYear);
            if (dueInfo && dueInfo.payMonth === monthKey) {
              curRecurring.push({ ...r, ...dueInfo });
            }
          });
        }
      });
    } else {
      // 利用月基準（使った月）
      expenses.forEach(e => {
        if (isExcluded(e.sourceId)) return; // 収支除外カードは除外
        if (e.date && e.date.startsWith(monthKey)) {
          if (e.sourceId === 'CASH' || e.sourceId === CASH_SOURCE_ID) {
            cashExpenses.push(e);
          } else {
            regularExpenses.push(e);
          }
        }
      });

      recurringList.forEach(r => {
        if (isExcluded(r.sourceId)) return; // 収支除外カードは除外
        if (r.frequency === 'MONTHLY' || Number(r.targetMonth) === m) {
          if (!isRecurringActiveInUseMonth(r, targetYear, m)) return;
          curRecurring.push({ ...r, useMonth: m });
        }
      });
    }

    const regTotal = regularExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const recCardTotal = curRecurring.filter(r => r.sourceId !== 'CASH').reduce((sum, r) => sum + Number(r.amount), 0);
    const recCashTotal = curRecurring.filter(r => r.sourceId === 'CASH').reduce((sum, r) => sum + Number(r.amount), 0);
    const cashTotal = cashExpenses.reduce((sum, e) => sum + Number(e.amount), 0) + recCashTotal;
    const monthTotal = regTotal + recCardTotal + cashTotal;

    const monthIncome = (incomeEntries || []).reduce((sum, ie) => {
      if (ie.date && ie.date.startsWith(monthKey)) {
        return sum + Number(ie.amount);
      }
      return sum;
    }, 0);

    grandExpense += monthTotal;
    grandIncome += monthIncome;

    if (monthTotal > maxMonth.total) {
      maxMonth = { month: m, total: monthTotal };
    }

    monthsData.push({
      month: m,
      monthKey,
      regularTotal: regTotal,
      recurringTotal: recCardTotal,
      cashTotal,
      total: monthTotal,
      incomeTotal: monthIncome,
      netSavings: monthIncome - monthTotal,
      recurringItems: [...curRecurring],
      itemCount: regularExpenses.length + cashExpenses.length + curRecurring.length
    });
  }

  const avgMonthlyExpense = Math.round(grandExpense / 12);
  const netSavings = grandIncome - grandExpense;

  return {
    targetYear,
    mode,
    monthsData,
    grandExpense,
    grandIncome,
    netSavings,
    avgMonthlyExpense,
    maxMonth
  };
}
