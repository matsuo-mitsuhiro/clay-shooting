// ============================================================
// 所属協会 短縮名 ⇔ 正式名称 変換
// ============================================================
// DBには短縮名（例: "大阪"）のみ保存する。
// 書類・画面表示で正式名称（例: "大阪府クレー射撃協会"）が必要なときだけ展開する。
// ============================================================

/** 47都道府県 + 芸文 の短縮名一覧（プルダウン・選択肢用） */
export const AFFILIATION_SHORT_NAMES = [
  '北海道', '青森', '岩手', '宮城', '秋田', '山形', '福島',
  '茨城', '栃木', '群馬', '埼玉', '千葉', '東京', '神奈川',
  '新潟', '富山', '石川', '福井', '山梨', '長野',
  '岐阜', '静岡', '愛知', '三重',
  '滋賀', '京都', '大阪', '兵庫', '奈良', '和歌山',
  '鳥取', '島根', '岡山', '広島', '山口',
  '徳島', '香川', '愛媛', '高知',
  '福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '沖縄',
  '芸文',
] as const;

const TO_FORMAL: Record<string, string> = {
  '北海道': '北海道クレー射撃協会',
  '東京': '東京都クレー射撃協会',
  '大阪': '大阪府クレー射撃協会',
  '京都': '京都府クレー射撃協会',
  '芸文': '芸能文化人ガンクラブ',
};

for (const s of AFFILIATION_SHORT_NAMES) {
  if (!(s in TO_FORMAL)) TO_FORMAL[s] = `${s}県クレー射撃協会`;
}

const TO_SHORT: Record<string, string> = Object.fromEntries(
  Object.entries(TO_FORMAL).map(([short, formal]) => [formal, short])
);

/**
 * 短縮名 → 正式名称
 * マップにない値はそのまま返す（"個人"、"招待"、空白など未知の値を壊さない）
 */
export function toFormalName(short: string | null | undefined): string {
  if (!short) return '';
  return TO_FORMAL[short] ?? short;
}

/**
 * 正式名称または短縮名 → 短縮名
 * すでに短縮名ならそのまま。マップにない値もそのまま返す。
 */
export function toShortName(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed in TO_FORMAL) return trimmed; // すでに短縮名
  if (trimmed in TO_SHORT) return TO_SHORT[trimmed]; // 正式名称 → 短縮
  return trimmed;
}
