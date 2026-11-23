// js/storage.js
// LocalStorage キャッシュ ＆ JSONファイル保存・復元

/**
 * 現在の状態をローカルストレージへキャッシュ
 */
function saveToLocalCache() {
  try {
    const payload = {
      version: "5.2-excluded-sources",
      sharedPassphrase: state.sharedPassphrase,
      excludedSharedSourceIds: state.excludedSharedSourceIds || [],
      personal: {
        sources: state.personalSources,
        expenses: state.personalExpenses,
        recurringList: state.personalRecurring,
        debts: state.personalDebts,
        incomeSources: state.personalIncomeSources,
        incomeEntries: state.personalIncomeEntries
      },
      shared: {
        sources: state.sharedSources,
        expenses: state.sharedExpenses,
        recurringList: state.sharedRecurring,
        debts: state.sharedDebts,
        incomeSources: state.sharedIncomeSources,
        incomeEntries: state.sharedIncomeEntries
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("ローカル保存エラー:", err);
  }
}

/**
 * ローカルストレージからキャッシュを復元
 * （過去バージョンで incomeSources/incomeEntries がない場合も安全に補完・移行し既存データを完全維持）
 */
function loadFromLocalCache() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.personal) {
        state.personalSources = parsed.personal.sources || [];
        state.personalExpenses = parsed.personal.expenses || [];
        state.personalRecurring = parsed.personal.recurringList || [];
        state.personalDebts = parsed.personal.debts || [];

        state.sharedSources = parsed.shared ? (parsed.shared.sources || []) : [];
        state.sharedExpenses = parsed.shared ? (parsed.shared.expenses || []) : [];
        state.sharedRecurring = parsed.shared ? (parsed.shared.recurringList || []) : [];
        state.sharedDebts = parsed.shared ? (parsed.shared.debts || []) : [];

        // 収入元マスターの復元
        state.personalIncomeSources = parsed.personal.incomeSources || [];
        state.sharedIncomeSources = parsed.shared ? (parsed.shared.incomeSources || []) : [];

        // 収入明細の復元
        state.personalIncomeEntries = parsed.personal.incomeEntries || [];
        state.sharedIncomeEntries = parsed.shared ? (parsed.shared.incomeEntries || []) : [];

        // 収支から除外する共有カードID一覧の復元
        state.excludedSharedSourceIds = parsed.excludedSharedSourceIds || (parsed.personal && parsed.personal.excludedSharedSourceIds) || [];

        // 旧バージョン（固定額incomes）からの自動マイグレーション
        if (state.personalIncomeSources.length === 0 && parsed.personal.incomes && parsed.personal.incomes.length > 0) {
          parsed.personal.incomes.forEach((oldInc, idx) => {
            const srcId = `is-migrated-${idx}`;
            state.personalIncomeSources.push({
              id: srcId,
              name: oldInc.name || "給与",
              isShared: false,
              order: idx
            });
            // 今月の明細として引き継ぎ
            const todayStr = new Date().toISOString().slice(0, 10);
            state.personalIncomeEntries.push({
              id: `ie-migrated-${idx}`,
              sourceId: srcId,
              date: todayStr,
              amount: oldInc.amount || 0,
              memo: "移行データ",
              isShared: false
            });
          });
        }

        // 初期状態で収入元が空の場合はデフォルトサンプルを補完
        if (state.personalIncomeSources.length === 0 && defaultData.incomeSources) {
          state.personalIncomeSources = JSON.parse(JSON.stringify(defaultData.incomeSources.filter(is => !is.isShared)));
          state.personalIncomeEntries = JSON.parse(JSON.stringify((defaultData.incomeEntries || []).filter(ie => !ie.isShared)));
        }

        if (parsed.sharedPassphrase) {
          state.sharedPassphrase = parsed.sharedPassphrase;
        }

        mergeAndRefreshData();
        return true;
      }
    }
  } catch (e) {
    console.warn("ローカル読込スキップ:", e);
  }
  return false;
}

/**
 * 全データをJSONファイルとしてダウンロード保存
 */
function downloadJsonFile(currentUserEmail) {
  const dataStr = JSON.stringify({
    version: "5.2-excluded-sources",
    exportedAt: new Date().toISOString(),
    userEmail: currentUserEmail || null,
    sharedPassphrase: state.sharedPassphrase,
    excludedSharedSourceIds: state.excludedSharedSourceIds || [],
    personal: {
      sources: state.personalSources,
      expenses: state.personalExpenses,
      recurringList: state.personalRecurring,
      debts: state.personalDebts,
      incomeSources: state.personalIncomeSources,
      incomeEntries: state.personalIncomeEntries
    },
    shared: {
      sources: state.sharedSources,
      expenses: state.sharedExpenses,
      recurringList: state.sharedRecurring,
      debts: state.sharedDebts,
      incomeSources: state.sharedIncomeSources,
      incomeEntries: state.sharedIncomeEntries
    }
  }, null, 2);

  const defaultFilename = `まにゃーまにゃー_backup_${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * JSONファイルからデータをインポート復元
 */
function parseImportFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        resolve(parsed);
      } catch (err) {
        reject(new Error("ファイルの解析に失敗しました。正しいJSON形式ではありません。"));
      }
    };
    reader.onerror = () => reject(new Error("ファイルの読み込み中にエラーが発生しました。"));
    reader.readAsText(file);
  });
}
