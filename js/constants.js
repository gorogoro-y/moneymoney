// js/constants.js
// アプリ共通の定数・設定

const STORAGE_KEY = "moneymoney_app_data_v1";
const SHARED_KEY_STORAGE = "manyamanya_shared_passphrase";
const CASH_SOURCE_ID = "CASH";

// 許可されたGoogleアカウント一覧（ホワイトリスト）
const ALLOWED_EMAILS = [
  "y37y37@gmail.com",
  "nuri0215@gmail.com"
];

// Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyAvTC8y6El06i0xkUXmFKBkHed7gCJfqKs",
  authDomain: "moneymoney--app.firebaseapp.com",
  projectId: "moneymoney--app",
  storageBucket: "moneymoney--app.firebasestorage.app",
  messagingSenderId: "112549376608",
  appId: "1:112549376608:web:4d4d16d5da600ef4924905"
};

// 初期サンプルデータ（互換性維持のため既存キーはそのまま保持）
const defaultData = {
  sources: [
    { id: "s-1", name: "三井住友カード (NL)", type: "CREDIT", closingDay: 15, paymentMonthOffset: 1, paymentDay: 10, isShared: false, order: 0 },
    { id: "s-2", name: "楽天カード (家族共有)", type: "CREDIT", closingDay: 99, paymentMonthOffset: 1, paymentDay: 27, isShared: true, order: 1 },
    { id: "s-3", name: "三菱UFJ銀行 (口座振替)", type: "BANK_DIRECT", closingDay: 0, paymentMonthOffset: 0, paymentDay: 0, isShared: false, order: 2 }
  ],
  expenses: [
    { id: "e-1", sourceId: "s-1", date: "2026-08-20", amount: 6200, memo: "スーパー食材まとめ買い", isShared: false },
    { id: "e-2", sourceId: "s-1", date: "2026-09-05", amount: 13500, memo: "秋物衣料", isShared: false },
    { id: "e-3", sourceId: "s-2", date: "2026-08-28", amount: 28000, memo: "家電量販店 (共有)", isShared: true },
    { id: "e-4", sourceId: "s-3", date: "2026-10-25", amount: 75000, memo: "10月分 家賃", isShared: false },
    { id: "e-5", sourceId: "s-3", date: "2026-10-12", amount: 8900, memo: "ガス・水道光熱費", isShared: false }
  ],
  recurringList: [
    { id: "r-1", name: "楽天ゴールド 年会費", amount: 11000, frequency: "YEARLY", targetMonth: 9, targetDay: 20, sourceId: "s-2", isShared: true },
    { id: "r-2", name: "Amazonプライム (年払い)", amount: 5900, frequency: "YEARLY", targetMonth: 9, targetDay: 5, sourceId: "s-1", isShared: false },
    { id: "r-3", name: "自動車税", amount: 39500, frequency: "YEARLY", targetMonth: 5, targetDay: 10, sourceId: "s-3", isShared: false }
  ],
  // 収入元マスター（勤務先・副業先など）
  incomeSources: [
    { id: "is-1", name: "本業給与", isShared: false, order: 0 },
    { id: "is-2", name: "副業 / 臨時収入", isShared: false, order: 1 }
  ],
  // 毎月の変動収入明細
  incomeEntries: [
    { id: "ie-1", sourceId: "is-1", date: "2026-11-25", amount: 320000, memo: "11月度 給与手取り", isShared: false },
    { id: "ie-2", sourceId: "is-1", date: "2026-10-25", amount: 315000, memo: "10月度 給与手取り", isShared: false }
  ],
  // 借金・ローン設定
  debts: [
    {
      id: "d-1",
      name: "マイカーローン",
      totalAmount: 1200000,
      totalBalance: 850000,
      monthlyPayment: 25000,
      interestRate: 3.8,
      startMonth: "2025-01",
      endMonth: "2028-12",
      sourceId: "s-3",
      paymentDay: 27,
      monthlyOverrides: {},
      isShared: false
    }
  ]
};
