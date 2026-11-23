// js/firebase.js
// Firebase 認証・Firestore クラウド同期

let db = null;
let auth = null;
let currentUser = null;
let isCloudReady = false;
let lastDiagMessage = "接続確認中...";

let unsubscribePersonal = null;
let unsubscribeShared = null;

let onStatusChangeCallback = null;

function onCloudStatusChange(cb) {
  onStatusChangeCallback = cb;
}

function getCurrentUser() {
  return currentUser;
}

function isCloudAvailable() {
  return isCloudReady && !!db && !!currentUser;
}

/**
 * 安全なFirestoreドキュメントIDを生成
 */
function getSafeDocId(prefix, text) {
  if (!text) return "";
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  const safe = encodeURIComponent(text.toLowerCase().trim().replace(/[\/\#\$\.\[\]\s]/g, "_"));
  return `${prefix}_${Math.abs(hash)}_${safe}`.slice(0, 60);
}

function notifyStatus(status, label, diagDetail = null) {
  if (diagDetail) lastDiagMessage = diagDetail;
  if (onStatusChangeCallback) {
    onStatusChangeCallback({
      status,
      label,
      diagMessage: lastDiagMessage,
      currentUser,
      sharedPassphrase: state.sharedPassphrase
    });
  }
}

/**
 * クラウド（Firestore）とのリアルタイムリスナーを設定
 */
function setupCloudListeners() {
  if (!db || !isCloudReady) return;

  if (unsubscribePersonal) { unsubscribePersonal(); unsubscribePersonal = null; }
  if (unsubscribeShared) { unsubscribeShared(); unsubscribeShared = null; }

  // 1. Googleアカウント個人ドキュメントリスナー
  if (currentUser) {
    unsubscribePersonal = db.collection("user_vaults").doc(currentUser.uid)
      .onSnapshot((doc) => {
        if (doc.exists) {
          const d = doc.data();
          state.personalSources = d.personalSources || d.sources || [];
          state.personalExpenses = d.personalExpenses || d.expenses || [];
          state.personalRecurring = d.personalRecurring || d.recurringList || [];
          state.personalDebts = d.personalDebts || [];
          state.personalIncomeSources = d.personalIncomeSources || [];
          state.personalIncomeEntries = d.personalIncomeEntries || [];
          state.excludedSharedSourceIds = d.excludedSharedSourceIds || [];

          if (!state.sharedPassphrase.trim()) {
            if (d.sharedSources) state.sharedSources = d.sharedSources;
            if (d.sharedExpenses) state.sharedExpenses = d.sharedExpenses;
            if (d.sharedRecurring) state.sharedRecurring = d.sharedRecurring;
            if (d.sharedDebts) state.sharedDebts = d.sharedDebts;
            if (d.sharedIncomeSources) state.sharedIncomeSources = d.sharedIncomeSources;
            if (d.sharedIncomeEntries) state.sharedIncomeEntries = d.sharedIncomeEntries;
          }

          mergeAndRefreshData();
          saveToLocalCache();
          notifyStatus('online', 'Google同期中', `✅ クラウド同期中\nアカウント: ${currentUser.email}\n最新受信: ${new Date().toLocaleTimeString()}`);
        }
      }, (err) => {
        console.warn("個人リスナー警告:", err);
        let msg = `⚠️ 受信エラー: ${err.message}`;
        if (err.code === 'permission-denied') {
          msg = "❌ 受信拒否 (permission-denied)\nFirestoreルール設定で読み取りが拒否されています。";
        }
        notifyStatus('error', '受信エラー', msg);
      });
  }

  // 2. 家族共有合言葉リスナー（パートナーからの共有更新を受信）
  if (currentUser && state.sharedPassphrase.trim()) {
    const sharedDocId = getSafeDocId("share", state.sharedPassphrase.trim());
    unsubscribeShared = db.collection("shared_vaults").doc(sharedDocId)
      .onSnapshot((doc) => {
        if (doc.exists) {
          const d = doc.data();
          state.sharedSources = d.sources || [];
          state.sharedExpenses = d.expenses || [];
          state.sharedRecurring = d.recurringList || [];
          state.sharedDebts = d.debts || [];
          state.sharedIncomeSources = d.incomeSources || [];
          state.sharedIncomeEntries = d.incomeEntries || [];
          mergeAndRefreshData();
          saveToLocalCache();
        }
      }, (err) => {
        console.warn("共有リスナー警告:", err);
      });
  }
}

/**
 * クラウドに最新データを保存・同期
 */
async function syncToCloud() {
  saveToLocalCache();

  if (!isCloudReady || !db || !currentUser) {
    return { success: false, reason: "offline" };
  }

  notifyStatus('syncing', 'クラウド保存中...');

  try {
    // 自身のuser_vaultsに全データを保存
    await db.collection("user_vaults").doc(currentUser.uid).set({
      personalSources: state.personalSources,
      personalExpenses: state.personalExpenses,
      personalRecurring: state.personalRecurring,
      personalDebts: state.personalDebts,
      personalIncomeSources: state.personalIncomeSources,
      personalIncomeEntries: state.personalIncomeEntries,
      excludedSharedSourceIds: state.excludedSharedSourceIds || [],
      sharedSources: state.sharedSources,
      sharedExpenses: state.sharedExpenses,
      sharedRecurring: state.sharedRecurring,
      sharedDebts: state.sharedDebts,
      sharedIncomeSources: state.sharedIncomeSources,
      sharedIncomeEntries: state.sharedIncomeEntries,
      userEmail: currentUser.email || "",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 家族合言葉がある場合は shared_vaults にも共有データを保存
    if (state.sharedPassphrase.trim()) {
      const sharedDocId = getSafeDocId("share", state.sharedPassphrase.trim());
      await db.collection("shared_vaults").doc(sharedDocId).set({
        sources: state.sharedSources,
        expenses: state.sharedExpenses,
        recurringList: state.sharedRecurring,
        debts: state.sharedDebts,
        incomeSources: state.sharedIncomeSources,
        incomeEntries: state.sharedIncomeEntries,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    const msg = `✅ クラウド接続＆同期 成功\nアカウント: ${currentUser.email}\n最終送信: ${new Date().toLocaleTimeString()}`;
    notifyStatus('online', 'Google同期中', msg);
    return { success: true };
  } catch (err) {
    console.error("Firestore同期エラー:", err);
    let errorMsg = `❌ 保存失敗: ${err.message}`;
    if (err.code === 'permission-denied') {
      errorMsg = "❌ 権限エラー (permission-denied)\nFirestore側で書き込みが拒否されました。\n許可された2アカウント（y37y37@gmail.com / nuri0215@gmail.com）でログインしているかご確認ください。";
    }
    notifyStatus('error', '同期エラー', errorMsg);
    return { success: false, reason: errorMsg };
  }
}

/**
 * クラウドから最新データを手動取得
 */
async function fetchVaultDataFromCloud() {
  if (!currentUser || !db) {
    throw new Error("Googleアカウントでログインしてください。");
  }

  notifyStatus('syncing', 'データ取得中...');
  try {
    const doc = await db.collection("user_vaults").doc(currentUser.uid).get();
    if (doc.exists) {
      const d = doc.data();
      state.personalSources = d.personalSources || d.sources || [];
      state.personalExpenses = d.personalExpenses || d.expenses || [];
      state.personalRecurring = d.personalRecurring || d.recurringList || [];
      state.personalDebts = d.personalDebts || [];
      state.personalIncomeSources = d.personalIncomeSources || [];
      state.personalIncomeEntries = d.personalIncomeEntries || [];
      state.excludedSharedSourceIds = d.excludedSharedSourceIds || [];

      if (d.sharedSources) state.sharedSources = d.sharedSources;
      if (d.sharedExpenses) state.sharedExpenses = d.sharedExpenses;
      if (d.sharedRecurring) state.sharedRecurring = d.sharedRecurring;
      if (d.sharedDebts) state.sharedDebts = d.sharedDebts;
      if (d.sharedIncomeSources) state.sharedIncomeSources = d.sharedIncomeSources;
      if (d.sharedIncomeEntries) state.sharedIncomeEntries = d.sharedIncomeEntries;
    }

    if (state.sharedPassphrase.trim()) {
      const sharedDocId = getSafeDocId("share", state.sharedPassphrase.trim());
      const shareDoc = await db.collection("shared_vaults").doc(sharedDocId).get();
      if (shareDoc.exists) {
        const sd = shareDoc.data();
        state.sharedSources = sd.sources || [];
        state.sharedExpenses = sd.expenses || [];
        state.sharedRecurring = sd.recurringList || [];
        state.sharedDebts = sd.debts || [];
        state.sharedIncomeSources = sd.incomeSources || [];
        state.sharedIncomeEntries = sd.incomeEntries || [];
      }
    }

    mergeAndRefreshData();
    saveToLocalCache();
    notifyStatus('online', 'Google同期中', `✅ 最新データ取得完了 (${new Date().toLocaleTimeString()})\nアカウント: ${currentUser.email}`);
  } catch (err) {
    console.error("データ取得エラー:", err);
    let msg = `❌ 取得失敗: ${err.message}`;
    if (err.code === 'permission-denied') {
      msg = "❌ 権限エラー (permission-denied)\nFirestoreのルール設定で読み取りが拒否されています。";
    }
    notifyStatus('error', '取得失敗', msg);
    throw new Error(msg);
  }
}

/**
 * Googleアカウントでログイン
 */
async function signInWithGoogle() {
  if (!auth) throw new Error("Firebaseが初期化されていません。");
  const provider = new firebase.auth.GoogleAuthProvider();

  notifyStatus('syncing', 'Google認証中...');
  const result = await auth.signInWithPopup(provider);
  const signedInUser = result.user;

  const userEmail = (signedInUser.email || "").toLowerCase();
  if (!ALLOWED_EMAILS.includes(userEmail)) {
    await auth.signOut();
    currentUser = null;
    notifyStatus('offline', '未ログイン (端末のみ保存)', `❌ アクセス拒否: ${userEmail}`);
    throw new Error(`Googleアカウント【${userEmail}】はこの家計簿アプリの利用を許可されていません。\n許可された2アカウントでお試しください。`);
  }

  currentUser = signedInUser;
  await fetchVaultDataFromCloud();
  setupCloudListeners();
  notifyStatus('online', 'Google同期中', `✅ ログイン成功: ${currentUser.email}`);
  return currentUser;
}

/**
 * ログアウト
 */
async function signOutFromGoogle() {
  if (!auth) return;
  if (unsubscribePersonal) { unsubscribePersonal(); unsubscribePersonal = null; }
  if (unsubscribeShared) { unsubscribeShared(); unsubscribeShared = null; }
  await auth.signOut();
  currentUser = null;
  notifyStatus('offline', '未ログイン (端末のみ保存)', 'ログアウトしました');
}

/**
 * 接続・認証の診断テスト実行
 */
async function runFullCloudDiagnostic() {
  notifyStatus('syncing', '診断中...', 'クラウド接続テスト中...');

  if (typeof firebase === 'undefined') {
    notifyStatus('offline', '未接続', '❌ Firebase SDKが読み込まれていません');
    return;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    auth = firebase.auth();
    db = firebase.firestore();
    isCloudReady = true;

    if (currentUser) {
      let okMsg = `✅ 1. Firebase初期化: 正常\n✅ 2. 許可ユーザー: ${currentUser.email}\n✅ 3. UID: ${currentUser.uid.slice(0, 8)}...`;
      if (state.sharedPassphrase.trim()) {
        okMsg += `\n✅ 4. 家族合言葉「${state.sharedPassphrase}」で2人共有中`;
      } else {
        okMsg += `\nℹ️ 4. 家族合言葉: 未設定（個人アカウント内のみ全カード同期）`;
      }
      notifyStatus('online', 'Google同期中', okMsg);
      setupCloudListeners();
    } else {
      const msg = `✅ 1. Firebase初期化: 正常\n⚠️ 2. Googleアカウント: 未ログイン\n端末内のみで保存されています。\n許可アカウント: y37y37@gmail.com / nuri0215@gmail.com`;
      notifyStatus('offline', '未ログイン', msg);
    }
  } catch (error) {
    console.error("診断エラー:", error);
    notifyStatus('error', '接続エラー', `❌ 初期化失敗: ${error.message}`);
  }
}

/**
 * 家族合言葉の適用と同期
 */
async function applySharedPassphrase(newPassphrase) {
  state.sharedPassphrase = newPassphrase.trim();
  try {
    localStorage.setItem(SHARED_KEY_STORAGE, state.sharedPassphrase);
  } catch (e) {}

  if (state.sharedPassphrase && isCloudReady && db && currentUser) {
    try {
      const sharedDocId = getSafeDocId("share", state.sharedPassphrase);
      const doc = await db.collection("shared_vaults").doc(sharedDocId).get();
      if (doc.exists) {
        const d = doc.data();
        state.sharedSources = d.sources || [];
        state.sharedExpenses = d.expenses || [];
        state.sharedRecurring = d.recurringList || [];
        state.sharedDebts = d.debts || [];
        state.sharedIncomeSources = d.incomeSources || [];
        state.sharedIncomeEntries = d.incomeEntries || [];
        mergeAndRefreshData();
        saveToLocalCache();
        return { isExisting: true };
      } else {
        await syncToCloud();
        return { isExisting: false };
      }
    } catch (err) {
      console.warn("共有合言葉確認警告:", err);
    }
  }

  setupCloudListeners();
  notifyStatus('online', 'Google同期中');
  return { isExisting: false };
}

/**
 * Firebase初期化（アプリ起動時）
 */
function initFirebase(onUserReady) {
  if (typeof firebase === 'undefined') return;

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  auth = firebase.auth();
  db = firebase.firestore();
  isCloudReady = true;

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      const userEmail = (user.email || "").toLowerCase();
      if (!ALLOWED_EMAILS.includes(userEmail)) {
        await auth.signOut();
        currentUser = null;
        notifyStatus('offline', '未ログイン (端末のみ保存)', `❌ アクセス拒否: ${userEmail}`);
        if (onUserReady) onUserReady({ error: `Googleアカウント【${userEmail}】はこの家計簿アプリの利用を許可されていません。` });
        return;
      }
      currentUser = user;
      runFullCloudDiagnostic();
      try {
        await fetchVaultDataFromCloud();
      } catch (e) {
        console.warn("起動時データ同期:", e);
      }
      if (onUserReady) onUserReady({ user });
    } else {
      currentUser = null;
      notifyStatus('offline', '未ログイン (端末のみ保存)');
      if (onUserReady) onUserReady({ user: null });
    }
  });
}
