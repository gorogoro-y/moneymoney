// js/state.js
// アプリケーションの状態管理（State）

const state = {
  currentMonth: "",
  activeTab: "dashboard",
  sharedPassphrase: "",
  selectedSourceType: "CREDIT",
  yearlyTargetYear: new Date().getFullYear(),
  yearlyViewMode: "DUE_MONTH", // "DUE_MONTH" (引落月基準) | "USE_MONTH" (利用月基準)

  // 個人データ
  personalSources: [],
  personalExpenses: [],
  personalRecurring: [],
  personalDebts: [],
  personalIncomeSources: [], // 収入元マスター
  personalIncomeEntries: [], // 変動収入明細

  // 家族共有データ
  sharedSources: [],
  sharedExpenses: [],
  sharedRecurring: [],
  sharedDebts: [],
  sharedIncomeSources: [],
  sharedIncomeEntries: [],

  // 統合（UI表示用）データ
  sources: [],
  expenses: [],
  recurringList: [],
  debts: [],
  incomeSources: [],
  incomeEntries: [],

  // リスナー
  listeners: []
};

// 家族合言葉の初期ロード
try {
  state.sharedPassphrase = localStorage.getItem(SHARED_KEY_STORAGE) || "";
} catch (e) {
  state.sharedPassphrase = "";
}

/**
 * 状態変更リスナーの登録
 */
function subscribeState(listener) {
  state.listeners.push(listener);
}

function notifyStateChange() {
  state.listeners.forEach(fn => fn(state));
}

/**
 * 個人データと家族共有データを統合し、orderや日付でソートする
 */
function mergeAndRefreshData() {
  // 1. 口座・カードの統合とorder補正
  const mapSources = new Map();
  [...(state.personalSources || []), ...(state.sharedSources || [])].forEach(s => mapSources.set(s.id, s));
  state.sources = Array.from(mapSources.values());

  let maxOrder = -1;
  state.sources.forEach(s => {
    if (typeof s.order === 'number') {
      maxOrder = Math.max(maxOrder, s.order);
    }
  });
  state.sources.forEach(s => {
    if (typeof s.order !== 'number') {
      maxOrder += 1;
      s.order = maxOrder;
      const p = (state.personalSources || []).find(x => x.id === s.id);
      if (p) p.order = maxOrder;
      const sh = (state.sharedSources || []).find(x => x.id === s.id);
      if (sh) sh.order = maxOrder;
    }
  });

  // 2. 利用明細の統合（日付降順）
  const mapExpenses = new Map();
  [...(state.personalExpenses || []), ...(state.sharedExpenses || [])].forEach(e => mapExpenses.set(e.id, e));
  state.expenses = Array.from(mapExpenses.values()).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  // 3. 年払い・固定費の統合
  const mapRec = new Map();
  [...(state.personalRecurring || []), ...(state.sharedRecurring || [])].forEach(r => mapRec.set(r.id, r));
  state.recurringList = Array.from(mapRec.values());

  // 4. 収入元マスターの統合とorder補正
  const mapIncSources = new Map();
  [...(state.personalIncomeSources || []), ...(state.sharedIncomeSources || [])].forEach(is => mapIncSources.set(is.id, is));
  state.incomeSources = Array.from(mapIncSources.values());

  let maxIncOrder = -1;
  state.incomeSources.forEach(is => {
    if (typeof is.order === 'number') {
      maxIncOrder = Math.max(maxIncOrder, is.order);
    }
  });
  state.incomeSources.forEach(is => {
    if (typeof is.order !== 'number') {
      maxIncOrder += 1;
      is.order = maxIncOrder;
      const p = (state.personalIncomeSources || []).find(x => x.id === is.id);
      if (p) p.order = maxIncOrder;
      const sh = (state.sharedIncomeSources || []).find(x => x.id === is.id);
      if (sh) sh.order = maxIncOrder;
    }
  });

  // 5. 変動収入明細の統合（日付降順）
  const mapIncEntries = new Map();
  [...(state.personalIncomeEntries || []), ...(state.sharedIncomeEntries || [])].forEach(ie => mapIncEntries.set(ie.id, ie));
  state.incomeEntries = Array.from(mapIncEntries.values()).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  // 6. 借金・ローンの統合
  const mapDebts = new Map();
  [...(state.personalDebts || []), ...(state.sharedDebts || [])].forEach(d => mapDebts.set(d.id, d));
  state.debts = Array.from(mapDebts.values());

  notifyStateChange();
}

/**
 * 表示順（order順）でカード・口座一覧を取得
 */
function getSortedSources() {
  return [...state.sources].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * 表示順（order順）で収入元マスター一覧を取得
 */
function getSortedIncomeSources() {
  return [...state.incomeSources].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * カード・口座の並び順の入れ替え
 */
function moveSourceOrder(sourceId, direction) {
  const sorted = getSortedSources();
  const currentIndex = sorted.findIndex(s => s.id === sourceId);
  const targetIndex = currentIndex + direction;

  if (currentIndex === -1 || targetIndex < 0 || targetIndex >= sorted.length) {
    return false;
  }

  sorted.forEach((item, idx) => {
    item.order = idx;
  });

  const currentItem = sorted[currentIndex];
  const targetItem = sorted[targetIndex];
  const temp = currentItem.order;
  currentItem.order = targetItem.order;
  targetItem.order = temp;

  [currentItem, targetItem].forEach(item => {
    const p = (state.personalSources || []).find(x => x.id === item.id);
    if (p) p.order = item.order;
    const sh = (state.sharedSources || []).find(x => x.id === item.id);
    if (sh) sh.order = item.order;
  });

  mergeAndRefreshData();
  return true;
}

/**
 * 収入元マスターの並び順の入れ替え
 */
function moveIncomeSourceOrder(sourceId, direction) {
  const sorted = getSortedIncomeSources();
  const currentIndex = sorted.findIndex(s => s.id === sourceId);
  const targetIndex = currentIndex + direction;

  if (currentIndex === -1 || targetIndex < 0 || targetIndex >= sorted.length) {
    return false;
  }

  sorted.forEach((item, idx) => {
    item.order = idx;
  });

  const currentItem = sorted[currentIndex];
  const targetItem = sorted[targetIndex];
  const temp = currentItem.order;
  currentItem.order = targetItem.order;
  targetItem.order = temp;

  [currentItem, targetItem].forEach(item => {
    const p = (state.personalIncomeSources || []).find(x => x.id === item.id);
    if (p) p.order = item.order;
    const sh = (state.sharedIncomeSources || []).find(x => x.id === item.id);
    if (sh) sh.order = item.order;
  });

  mergeAndRefreshData();
  return true;
}

/**
 * 初期サンプルデータへリセット
 */
function resetToDefaultData() {
  state.personalSources = JSON.parse(JSON.stringify(defaultData.sources.filter(s => !s.isShared)));
  state.sharedSources = JSON.parse(JSON.stringify(defaultData.sources.filter(s => s.isShared)));
  state.personalExpenses = JSON.parse(JSON.stringify(defaultData.expenses.filter(e => !e.isShared)));
  state.sharedExpenses = JSON.parse(JSON.stringify(defaultData.expenses.filter(e => e.isShared)));
  state.personalRecurring = JSON.parse(JSON.stringify(defaultData.recurringList.filter(r => !r.isShared)));
  state.sharedRecurring = JSON.parse(JSON.stringify(defaultData.recurringList.filter(r => r.isShared)));

  state.personalIncomeSources = JSON.parse(JSON.stringify((defaultData.incomeSources || []).filter(is => !is.isShared)));
  state.sharedIncomeSources = JSON.parse(JSON.stringify((defaultData.incomeSources || []).filter(is => is.isShared)));
  state.personalIncomeEntries = JSON.parse(JSON.stringify((defaultData.incomeEntries || []).filter(ie => !ie.isShared)));
  state.sharedIncomeEntries = JSON.parse(JSON.stringify((defaultData.incomeEntries || []).filter(ie => ie.isShared)));

  state.personalDebts = JSON.parse(JSON.stringify((defaultData.debts || []).filter(d => !d.isShared)));
  state.sharedDebts = JSON.parse(JSON.stringify((defaultData.debts || []).filter(d => d.isShared)));

  mergeAndRefreshData();
}
