"""
スクリーンショットから生徒の育成情報を抽出するモジュール。

座標系: 1456 x 784 (クライアント領域、タイトルバーなし) を基準とした相対座標。
実際のウィンドウサイズに応じてスケーリングされる。

【座標調整方法】
 デバッグエンドポイント GET /api/debug/capture でキャプチャ画像に
 各ROIのボックスを描画した画像が取得できる。
 ずれている場合は下記 COORDS の値を調整すること。
"""

import re
import cv2
import numpy as np
from difflib import get_close_matches
from typing import Any

from students_master import STUDENTS_MASTER

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 基準解像度
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REF_W = 1456
REF_H = 784

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 座標定義 (x1, y1, x2, y2) @ REF_W x REF_H
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COORDS = {
    # 左下パネル
    "bond_level":     (40,  600,  88,  640),   # 絆レベル数値
    "student_name":   (88,  600, 300,  640),   # 生徒名
    "portrait_stars": (300, 600, 390,  640),   # 星ランク

    # ステータスパネル - WBバッジ領域 (値の右側)
    "wb_hp":          (880, 240, 950,  280),   # HP WorkBook
    "wb_atk":         (1130, 240, 1200, 280),  # 攻撃力 WorkBook
    "wb_heal":        (1130, 290, 1200, 330),  # 治癒力 WorkBook

    # スキルレベル (アイコン下のテキスト)
    "skill_ex":       (782,  435, 870,  465),
    "skill_normal":   (890,  435, 990, 465),
    "skill_passive":  (1023, 435, 1120, 465),
    "skill_sub":      (1150, 435, 1240, 465),

    # 固有武器の星 (幅を広げてより多くの星を捕捉)
    "unique_stars":   (1100, 545, 1295, 592),

    # 装備Tier
    "equip1_tier":    (760,  660, 830,  700),
    "equip2_tier":    (860,  660, 930,  700),
    "equip3_tier":    (965, 660, 1035, 700),

    # タブ検出 (基本情報タブが選択されているか確認用)
    "tab_check":      (785,  135, 945,  170),
}

# デバッグ用: ROIごとの描画色 (BGR)
_DEBUG_COLORS: dict[str, tuple[int, int, int]] = {
    "student_name":   (0,   255,  0),    # 緑
    "bond_level":     (0,   140, 255),   # 橙
    "portrait_stars": (0,   255, 255),   # 黄
    "wb_hp":          (255, 100,   0),   # 青系
    "wb_atk":         (255, 165,   0),   # 水色
    "wb_heal":        (255, 200,   0),   # 水色2
    "skill_ex":       (255,   0, 255),   # マゼンタ
    "skill_normal":   (200,   0, 200),
    "skill_passive":  (150,   0, 150),
    "skill_sub":      (100,   0, 100),
    "unique_stars":   (255, 255,   0),   # シアン
    "equip1_tier":    (128,   0, 255),   # 紫
    "equip2_tier":    (100,   0, 200),
    "equip3_tier":    ( 80,   0, 150),
    "tab_check":      (180, 180, 180),   # グレー
}

# 金色（塗り星・スキルMAXバッジ）のHSV範囲
# H:15-45 = 橙黄〜黄（STRIKERバッジ赤橙 H=5-10 を除外）
# S:80以上, V:100以上（JPEG圧縮後のエッジピクセルも補捉）
GOLD_STAR_LOWER = np.array([15, 80, 100])
GOLD_STAR_UPPER = np.array([45, 255, 255])

# 固有武器の青い星（スパークルエフェクト）のHSV範囲
# H:90-130 = 水色〜青、S:100以上（UIパネル背景の淡青 S<100 を除外）、V:130以上
UNIQUE_STAR_LOWER = np.array([90, 100, 130])
UNIQUE_STAR_UPPER = np.array([130, 255, 255])

# スキルMAXバッジ判定: 高彩度の金色ピクセル最低数
SKILL_MAX_GOLD_MIN = 25

# EasyOCR リーダー (遅延初期化)
_reader = None


def get_reader():
    global _reader
    if _reader is None:
        import easyocr
        _reader = easyocr.Reader(["ja", "en"], gpu=False)
    return _reader


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ユーティリティ
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def scale_coords(x1, y1, x2, y2, w, h):
    sx = w / REF_W
    sy = h / REF_H
    return int(x1 * sx), int(y1 * sy), int(x2 * sx), int(y2 * sy)


def crop_roi(image: np.ndarray, key: str) -> np.ndarray:
    h, w = image.shape[:2]
    x1, y1, x2, y2 = scale_coords(*COORDS[key], w, h)
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    return image[y1:y2, x1:x2]


def _to_rgb(roi: np.ndarray) -> np.ndarray:
    """EasyOCRはRGB入力を期待するため BGR→RGB に変換"""
    return cv2.cvtColor(roi, cv2.COLOR_BGR2RGB)


def ocr_text(roi: np.ndarray) -> str:
    if roi.size == 0:
        return ""
    reader = get_reader()
    results = reader.readtext(_to_rgb(roi), detail=0)
    return " ".join(results).strip()


def ocr_number(roi: np.ndarray) -> int | None:
    if roi.size == 0:
        return None
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    enlarged = cv2.resize(thresh, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
    # EasyOCRにRGB形式で渡す（グレースケール→RGB変換）
    enlarged_rgb = cv2.cvtColor(enlarged, cv2.COLOR_GRAY2RGB)
    reader = get_reader()
    results = reader.readtext(enlarged_rgb, detail=0, allowlist="0123456789")
    text = " ".join(results)
    nums = re.findall(r"\d+", text)
    return int(nums[0]) if nums else None


def _projection_peak_count(mask: np.ndarray, max_stars: int, kernel: int = 3) -> int:
    """列方向の輝度投影によるピーク数カウント（共通ロジック）。

    kernel: 平滑化ウィンドウ幅（ノイズ除去用。星間の谷幅より小さく設定）
    50%閾値で隣接星間の谷（谷深さ30-40%）を確実に分離する。
    従来の20%閾値では隣接星の谷が閾値を超えたままになり星が合体していた。
    """
    col_sums = mask.sum(axis=0).astype(np.float32)
    if col_sums.max() == 0:
        return 0
    smoothed = np.convolve(col_sums, np.ones(kernel) / kernel, mode='same')
    thr = smoothed.max() * 0.50
    count = 0
    in_peak = False
    for v in smoothed:
        if v > thr:
            if not in_peak:
                count += 1
                in_peak = True
        else:
            in_peak = False
    return min(count, max_stars)


def count_unique_stars(roi: np.ndarray) -> tuple[int, dict]:
    """固有武器の青い★をカウントする。上限は固有4（=4個）。(BGR入力)

    ROI右端25%（section3）は「固有武器」ボタン（常時青、定数）。
    左75%（sections0-2）の星エリアの青ピクセル数を ROI面積 × 1.75% で割って
    星数を推定する。セクション数ではなくピクセル量で計算する理由:
    星は右詰め配置かつ複数星が同一セクションに収まるため。
    戻り値: (count, debug_info)
    """
    debug: dict = {}
    if roi.size == 0:
        debug["error"] = "empty roi"
        return 0, debug

    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, UNIQUE_STAR_LOWER, UNIQUE_STAR_UPPER)
    debug["mask_sum"] = int(mask.sum())
    debug["roi_shape"] = list(roi.shape)

    # ROIを4等分: section0=左余白, section1-2=星エリア, section3=固有武器ボタン
    w = roi.shape[1]
    section_w = w // 4
    section_sums = []
    for i in range(4):
        x1 = i * section_w
        x2 = x1 + section_w if i < 3 else w
        section_sums.append(int(mask[:, x1:x2].sum()))
    debug["section_w"] = section_w
    debug["section_sums"] = section_sums

    # section3（固有武器ボタン）を除いた星エリア(sections 0-2)の実ピクセル数
    # mask値は0/255なので255で割る
    star_pixels = (section_sums[0] + section_sums[1] + section_sums[2]) / 255

    # 1星あたり ≈ ROI面積の1.75%（固有1実測: 205px / 11718px²）
    # ROIが解像度に応じてスケールするため比率は解像度不変
    per_star = 0.0175 * roi.shape[0] * roi.shape[1]

    debug["star_pixels"] = round(star_pixels, 1)
    debug["per_star"] = round(per_star, 1)

    if star_pixels < per_star * 0.4:
        debug["count"] = 0
        return 0, debug

    count = min(round(star_pixels / per_star), 4)
    debug["count"] = count
    return count, debug


def count_filled_stars(roi: np.ndarray) -> int:
    """金色の塗り星の数をカウントする (BGR入力)。上限5（固有1相当の5金星まで対応）。

    50%閾値の列投影ピーク検出を使用。
    kernel=3 の最小限平滑化で星間の谷を保持する。
    """
    if roi.size == 0:
        return 0
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, GOLD_STAR_LOWER, GOLD_STAR_UPPER)
    if mask.sum() < 30:
        return 0
    return _projection_peak_count(mask, 5, kernel=3)


def detect_wb_level(roi: np.ndarray) -> int:
    """WBバッジのレベルをOCRで読み取る (BGR入力)"""
    if roi.size == 0:
        return 0
    enlarged = cv2.resize(roi, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
    text = ocr_text(enlarged).upper()
    # パターン1: "Lv.X" / "Lv X" 形式（v が V/W/Y と誤読される場合も許容）
    m = re.search(r"L\s*[VWY]\.?\s*(\d{1,2})", text)
    if m:
        val = int(m.group(1))
        return val if 1 <= val <= 25 else 0

    # パターン2: "X MAX" 形式（"Lv" が読めなかった場合。数字の直後にMAX）
    m = re.search(r"(\d{1,2})\s*(?:MAX|M4X)", text)
    if m:
        val = int(m.group(1))
        return val if 1 <= val <= 25 else 0

    # パターン3: "MAX" のみ（数値部分が読めなかった場合は25確定）
    if re.search(r"MAX|M4X", text):
        return 25

    return 0


def parse_skill_level(text: str) -> int | None:
    text = text.strip().upper()
    if "MAX" in text or text == "M":
        return 10
    nums = re.findall(r"\d+", text)
    if nums:
        val = int(nums[0])
        return val if 1 <= val <= 10 else None
    return None


def parse_equip_tier(text: str) -> int | None:
    text = text.strip().upper()
    m = re.search(r"T(\d+)", text)
    if m:
        return int(m.group(1))
    nums = re.findall(r"\d+", text)
    return int(nums[0]) if nums else None


def ocr_skill_level(roi: np.ndarray) -> int | None:
    """スキルレベルROIからレベルを抽出 (BGR入力)。MAXバッジはバッジ下部の金色輝きで判定。"""
    if roi.size == 0:
        return None
    # MAXバッジ判定: ROI下部60%で金色(H=10-50, S≥120, V≥180)ピクセルを確認
    h = roi.shape[0]
    badge_area = roi[max(0, int(h * 0.4)):, :]
    if badge_area.size > 0:
        hsv_b = cv2.cvtColor(badge_area, cv2.COLOR_BGR2HSV)
        gold_b = cv2.inRange(hsv_b, np.array([10, 120, 180]), np.array([50, 255, 255]))
        if cv2.countNonZero(gold_b) >= SKILL_MAX_GOLD_MIN:
            return 10
    # 通常OCR: allowlistなしで読み取り "Lv.X" / "MAX" / 数値を抽出
    enlarged = cv2.resize(roi, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
    reader = get_reader()
    results = reader.readtext(_to_rgb(enlarged), detail=0)
    text = " ".join(results).upper()
    if "MAX" in text:
        return 10
    # "LV.7" "LV 7" "LV7" などに対応
    m = re.search(r"LV\.?\s*(\d+)", text)
    if m:
        val = int(m.group(1))
        return val if 1 <= val <= 10 else None
    nums = re.findall(r"\d+", text)
    if nums:
        val = int(nums[0])
        return val if 1 <= val <= 10 else None
    return None


def ocr_equip_tier(roi: np.ndarray) -> tuple[int | None, list[str]]:
    """装備TierをOCRで読み取る。複数の前処理を試みる (BGR入力)。
    戻り値: (value, [各試行のOCR生テキスト])
    """
    if roi.size == 0:
        return None, []

    def _parse(text: str) -> int | None:
        t = text.upper().replace(" ", "")
        # 誤認識補正（7→/や\と混同しやすい等）
        for src, dst in [("I", "1"), ("L", "1"), ("O", "0"), ("S", "5"),
                         ("B", "8"), ("Z", "2"), ("/", "7"), ("\\", "7")]:
            t = t.replace(src, dst)
        m = re.search(r"T(\d+)", t)
        if m:
            val = int(m.group(1))
            return val if 1 <= val <= 10 else None
        for n in re.findall(r"\d+", t):
            val = int(n)
            if 1 <= val <= 10:
                return val
        return None

    reader = get_reader()
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

    import base64
    _, buf = cv2.imencode(".png", roi)
    roi_b64 = "data:image/png;base64," + base64.b64encode(buf).decode()
    attempts: list[str] = [f"roi: {roi_b64}"]

    def _run(img: np.ndarray, label: str, free: bool = False) -> tuple[str, int | None]:
        rgb = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB) if img.ndim == 2 else _to_rgb(img)
        kw: dict = dict(detail=0, paragraph=False)
        if not free:
            kw["allowlist"] = "T0123456789"
        text = " ".join(reader.readtext(rgb, **kw))
        attempts.append(f"{label}: {repr(text)}")
        return text, _parse(text)

    # 試行1: 生カラー 4x（標準）
    _, val = _run(cv2.resize(roi, None, fx=4, fy=4, interpolation=cv2.INTER_CUBIC), "1(color4x)")
    if val is not None:
        return val, attempts

    # 試行2: 白ピクセル反転マスク (S<100, V>160) 反転→8x cubic
    # 青バッジ背景(S≈120)と紫アイコン(S≈150)が混在する ROI で OTSU が失敗する場合の代替
    # 白テキスト(S≈10, V≈255) を抽出→反転して黒テキストon白背景にする（EasyOCRに有効）
    white_mask = cv2.inRange(hsv, np.array([0, 0, 160]), np.array([180, 100, 255]))
    white_mask = cv2.dilate(white_mask, np.ones((2, 2), np.uint8), iterations=1)
    inv_mask = cv2.bitwise_not(white_mask)
    _, val = _run(cv2.resize(inv_mask, None, fx=8, fy=8, interpolation=cv2.INTER_CUBIC), "2(inv_mask8x)")
    if val is not None:
        return val, attempts

    # 試行3: HSV明度(V)チャネルOTSU二値化 6x
    _, v_bin = cv2.threshold(hsv[:, :, 2], 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    _, val = _run(cv2.resize(v_bin, None, fx=6, fy=6, interpolation=cv2.INTER_NEAREST), "3(v_otsu6x)")
    if val is not None:
        return val, attempts

    # 試行4: グレースケールOTSU + ストローク拡張 4x
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    binary = cv2.dilate(binary, np.ones((2, 2), np.uint8), iterations=1)
    _, val = _run(cv2.resize(binary, None, fx=4, fy=4, interpolation=cv2.INTER_CUBIC), "4(gray_otsu4x)")
    if val is not None:
        return val, attempts

    # 試行5: 固定閾値150 4x
    _, white = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)
    _, val = _run(cv2.resize(white, None, fx=4, fy=4, interpolation=cv2.INTER_CUBIC), "5(thresh150_4x)")
    if val is not None:
        return val, attempts

    # 試行6: allowlistなし 生カラー 6x（OCR自由読み取り→後処理で抽出）
    _, val = _run(cv2.resize(roi, None, fx=6, fy=6, interpolation=cv2.INTER_CUBIC), "6(color6x_free)", free=True)
    if val is not None:
        return val, attempts

    # 試行7: CLAHE コントラスト強調 4x
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(4, 4))
    enhanced = cv2.resize(clahe.apply(gray), None, fx=4, fy=4, interpolation=cv2.INTER_CUBIC)
    _, val = _run(enhanced, "7(clahe4x)")
    return val, attempts


# OCRが形の似た漢字をカタカナと誤認識する場合の対応表
_KANJI_TO_KANA = str.maketrans({
    "三": "ミ", "力": "カ", "口": "ロ", "工": "エ", "二": "ニ",
    "八": "ハ", "千": "チ", "万": "マ", "卜": "ト", "又": "ス",
    "弓": "ユ", "己": "コ", "已": "コ", "乃": "ノ", "之": "ノ",
})


def _normalize_ocr(text: str) -> str:
    return text.translate(_KANJI_TO_KANA)


def match_student_name(raw: str) -> str:
    raw = raw.strip()
    # 1. まず元テキストでマッチ
    matches = get_close_matches(raw, STUDENTS_MASTER, n=1, cutoff=0.5)
    if matches:
        return matches[0]
    # 2. 漢字→カタカナ正規化後に再マッチ
    normalized = _normalize_ocr(raw)
    if normalized != raw:
        matches = get_close_matches(normalized, STUDENTS_MASTER, n=1, cutoff=0.5)
        if matches:
            return matches[0]
    return raw


def is_basic_info_tab(image: np.ndarray) -> bool:
    """基本情報タブ選択確認（判定できない場合はTrueを返して処理続行）"""
    roi = crop_roi(image, "tab_check")
    if roi.size == 0:
        return True  # 座標外の場合は判定スキップ
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    mean_val = float(np.mean(gray))
    # 閾値を緩め: 選択タブは明るい、非選択は暗い
    return mean_val > 120


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# デバッグ: ROI可視化
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def get_debug_image(image: np.ndarray) -> np.ndarray:
    """各ROIの位置をカラーボックスで描画したデバッグ画像を返す (BGR)"""
    debug = image.copy()
    h, w = debug.shape[:2]

    for key, color in _DEBUG_COLORS.items():
        if key not in COORDS:
            continue
        x1, y1, x2, y2 = scale_coords(*COORDS[key], w, h)
        cv2.rectangle(debug, (x1, y1), (x2, y2), color, 2)
        # ラベルをボックスの内側上部に描画
        cv2.putText(
            debug, key,
            (x1 + 2, min(y1 + 13, y2 - 2)),
            cv2.FONT_HERSHEY_SIMPLEX, 0.35, color, 1, cv2.LINE_AA,
        )

    # ウィンドウサイズをオーバーレイ表示
    cv2.putText(
        debug, f"{w}x{h}",
        (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA,
    )
    return debug


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# メイン抽出関数
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def extract_student_data(image: np.ndarray) -> dict[str, Any]:
    """
    スクリーンショットから生徒データを抽出して返す。
    image: BGR numpy配列（クライアント領域）
    """
    result: dict[str, Any] = {
        "detected": False,
        "name": None,
        "bond_level": None,
        "wb_hp": 0,
        "wb_atk": 0,
        "wb_heal": 0,
        "skill_ex": None,
        "skill_normal": None,
        "skill_passive": None,
        "skill_sub": None,
        "limit_break": None,
        "equip1": None,
        "equip2": None,
        "equip3": None,
    }

    if not is_basic_info_tab(image):
        return result

    result["detected"] = True

    # 生徒名
    name_roi = crop_roi(image, "student_name")
    raw_name = ocr_text(name_roi)
    result["name"] = match_student_name(raw_name)

    # 絆レベル
    bond_roi = crop_roi(image, "bond_level")
    result["bond_level"] = ocr_number(bond_roi)

    # WBレベル (HP/ATK/Heal)
    result["wb_hp"]   = detect_wb_level(crop_roi(image, "wb_hp"))
    result["wb_atk"]  = detect_wb_level(crop_roi(image, "wb_atk"))
    result["wb_heal"] = detect_wb_level(crop_roi(image, "wb_heal"))

    # スキルレベル (MAXバッジはゴールド輝き判定 + 前処理OCR)
    for key in ("skill_ex", "skill_normal", "skill_passive", "skill_sub"):
        roi = crop_roi(image, key)
        result[key] = ocr_skill_level(roi)

    # 固有武器/星ランク
    # 青い星（固有）を先に確認。検出できれば limit_break = 4 + 固有数（5〜8）。
    # 検出できない場合は金星の数で判定（1〜4: 通常星、5: 固有1相当の5金星表示）。
    unique_count, unique_debug = count_unique_stars(crop_roi(image, "unique_stars"))
    result["_debug_unique_stars"] = unique_debug

    if 1 <= unique_count <= 4:
        result["limit_break"] = 4 + unique_count
    else:
        star_count = count_filled_stars(crop_roi(image, "portrait_stars"))
        if star_count == 5:
            result["limit_break"] = 5       # 5金星表示 = 固有1
        elif 1 <= star_count <= 4:
            result["limit_break"] = star_count
        else:
            result["limit_break"] = None

    # 装備Tier (結合OCR + O→0変換)
    for i, key in enumerate(("equip1_tier", "equip2_tier", "equip3_tier"), 1):
        roi = crop_roi(image, key)
        val, attempts = ocr_equip_tier(roi)
        result[f"equip{i}"] = val
        result[f"_debug_equip{i}"] = attempts

    return result
