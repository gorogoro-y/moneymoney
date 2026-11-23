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
  if (!source) return { payMonth: "", payDate: "", useDateStr: "" };

  const year = targetYear || new Date().getFullYear();
  const month = recurringItem.targetMonth || 1;
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const day = recurringItem.targetDay === 99 ? lastDayOfMonth : Math.min(recurringItem.targetDay || 1, lastDayOfMonth);

  const useDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const dueInfo = calculateDueDate(useDateStr, source);

  return { ...dueInfo, useDateStr, useMonth: month, useDay: day };
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
    [-1, 0, 1].forEach(offsetYear => {
      const dueInfo = getRecurringDueDateInfo(r, src, curY + offsetYear);
      if (dueInfo && dueInfo.payMonth === curMonthStr) {
        curRecurring.push(dueInfo);
      }
    });
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
 * 指定月（YYYY-MM）におけるローンの返済情報を計算
 */
function getDebtDueInfoForMonth(debt, targetMonth, sources) {
  if (!debt || !targetMonth) return null;

  // 開始年月と終了年月があれば、その期間内か判定
  if (debt.startMonth && targetMonth < debt.startMonth) return null;
  if (debt.endMonth && targetMonth > debt.endMonth) return null;

  // 返済額（月ごとの個別修正があれば優先、なければ基本返済額）
  let amount = Number(debt.monthlyPayment) || 0;
  if (debt.monthlyOverrides && debt.monthlyOverrides[targetMonth] != null) {
    amount = Number(debt.monthlyOverrides[targetMonth]);
  }

  // 支払日（payDate）の算出
  const [y, m] = targetMonth.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();

  const sourceId = debt.sourceId || "CASH";
  const src = sources ? sources.find(s => s.id === sourceId) : null;

  let payDate = "";
  if (sourceId === 'CASH' || !src) {
    const day = debt.paymentDay === 99 ? lastDay : Math.min(debt.paymentDay || 27, lastDay);
    payDate = `${targetMonth}-${String(day).padStart(2, '0')}`;
  } else if (src.type === 'CREDIT') {
    const day = src.paymentDay === 99 ? lastDay : Math.min(src.paymentDay || 27, lastDay);
    payDate = `${targetMonth}-${String(day).padStart(2, '0')}`;
  } else {
    // 銀行口座振替
    const day = debt.paymentDay === 99 ? lastDay : Math.min(debt.paymentDay || 27, lastDay);
    payDate = `${targetMonth}-${String(day).padStart(2, '0')}`;
  }

  // 回数計算（第X回 / 全Y回）
  let currentInstallment = null;
  let totalInstallments = null;
  if (debt.startMonth && debt.endMonth) {
    const [sy, sm] = debt.startMonth.split("-").map(Number);
    const [ey, em] = debt.endMonth.split("-").map(Number);
    totalInstallments = (ey - sy) * 12 + (em - sm) + 1;
    currentInstallment = (y - sy) * 12 + (m - sm) + 1;
  }

  return {
    id: `debt-pay-${debt.id}-${targetMonth}`,
    debtId: debt.id,
    isDebt: true,
    name: debt.name,
    amount,
    payDate,
    payMonth: targetMonth,
    date: payDate,
    memo: `🏦 ローン返済: ${debt.name}${totalInstallments ? ` (${currentInstallment}/${totalInstallments}回)` : ''}`,
    sourceId,
    src,
    isShared: !!debt.isShared,
    currentInstallment,
    totalInstallments,
    isOverridden: debt.monthlyOverrides && debt.monthlyOverrides[targetMonth] != null
  };
}

/**
 * 指定月に有効なすべてのローン返済明細を取得
 */
function calculateMonthlyDebtEntries(debts, targetMonth, sources) {
  if (!debts || debts.length === 0 || !targetMonth) return [];
  const list = [];
  debts.forEach(d => {
    const info = getDebtDueInfoForMonth(d, targetMonth, sources);
    if (info) list.push(info);
  });
  return list;
}

/**
 * 次回直近の引き落としアクションを取得（カウントダウン用）
 */
function getNextDueAction(currentExpenses, currentRecurring, sources, currentDebts = [], excludedSourceIds = []) {
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
    if (isExcluded(r.sourceId)) return; // 収支除外カードは除外
    if (r.payDate && r.payDate >= todayStr) {
      const key = `${r.sourceId}_${r.payDate}`;
      const prev = payMap.get(key) || { sourceId: r.sourceId, payDate: r.payDate, amount: 0 };
      prev.amount += Number(r.amount);
      payMap.set(key, prev);
    }
  });

  (currentDebts || []).forEach(d => {
    if (d.sourceId === 'CASH' || isExcluded(d.sourceId)) return; // 現金返済または収支除外カードは除外
    if (d.payDate && d.payDate >= todayStr) {
      const key = `${d.sourceId}_${d.payDate}`;
      const prev = payMap.get(key) || { sourceId: d.sourceId, payDate: d.payDate, amount: 0 };
      prev.amount += Number(d.amount);
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
 * 借金・ローンの返済シミュレーション計算
 */
function simulateDebtPayoff(totalBalance, monthlyPayment, interestRate = 0, extraMonthly = 0) {
  const balance = Number(totalBalance) || 0;
  const basePay = Number(monthlyPayment) || 0;
  const extra = Number(extraMonthly) || 0;
  const rate = (Number(interestRate) || 0) / 100 / 12; // 月利

  if (balance <= 0 || (basePay + extra) <= 0) {
    return { months: 0, totalInterest: 0, totalPayment: 0, years: 0, remMonths: 0 };
  }

  if (rate > 0 && balance * rate >= (basePay + extra)) {
    return { infinite: true, months: 999, totalInterest: 0, totalPayment: 0 };
  }

  let curBalance = balance;
  let months = 0;
  let totalInterest = 0;
  const maxMonths = 600;

  while (curBalance > 0 && months < maxMonths) {
    months++;
    const monthlyInt = Math.floor(curBalance * rate);
    totalInterest += monthlyInt;

    const totalPayThisMonth = basePay + extra;
    const principalPay = totalPayThisMonth - monthlyInt;

    if (curBalance <= principalPay) {
      curBalance = 0;
      break;
    } else {
      curBalance -= principalPay;
    }
  }

  const years = Math.floor(months / 12);
  const remMonths = months % 12;

  return {
    months,
    years,
    remMonths,
    totalInterest,
    totalPayment: balance + totalInterest,
    infinite: false
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
 */
function calculateYearlySummary(targetYear, mode, expenses, recurringList, sources, incomeEntries = [], debts = [], excludedSourceIds = []) {
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

    // ローン返済の抽出
    const curDebts = calculateMonthlyDebtEntries(debts, monthKey, sources);

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
        const src = sources.find(s => s.id === r.sourceId);
        if (!src) return;
        [-1, 0, 1].forEach(offsetYear => {
          const dueInfo = getRecurringDueDateInfo(r, src, targetYear + offsetYear);
          if (dueInfo && dueInfo.payMonth === monthKey) {
            curRecurring.push({ ...r, ...dueInfo });
          }
        });
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
          curRecurring.push({ ...r, useMonth: m });
        }
      });
    }

    // ローン返済額を仕分け
    let debtRegTotal = 0;
    let debtCashTotal = 0;
    curDebts.forEach(d => {
      if (isExcluded(d.sourceId)) return; // 収支除外カードは除外
      if (d.sourceId === 'CASH') {
        debtCashTotal += d.amount;
      } else {
        debtRegTotal += d.amount;
      }
    });

    const regTotal = regularExpenses.reduce((sum, e) => sum + Number(e.amount), 0) + debtRegTotal;
    const recTotal = curRecurring.reduce((sum, r) => sum + Number(r.amount), 0);
    const cashTotal = cashExpenses.reduce((sum, e) => sum + Number(e.amount), 0) + debtCashTotal;
    const monthTotal = regTotal + recTotal + cashTotal;

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

    // 特記事項リストにローンも含める
    const allNotices = [...curRecurring];
    curDebts.forEach(d => {
      allNotices.push({ name: `🏦 ${d.name}返済`, amount: d.amount });
    });

    monthsData.push({
      month: m,
      monthKey,
      regularTotal: regTotal,
      recurringTotal: recTotal,
      cashTotal,
      total: monthTotal,
      incomeTotal: monthIncome,
      netSavings: monthIncome - monthTotal,
      recurringItems: allNotices,
      debtsCount: curDebts.length,
      itemCount: regularExpenses.length + cashExpenses.length + curRecurring.length + curDebts.length
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
