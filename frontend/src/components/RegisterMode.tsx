import { useState, useEffect, useCallback } from "react";
import type { CaptureResult, Student, StudentUpdate } from "../types";
import {
  triggerCapture,
  getPendingCapture,
  clearPendingCapture,
  fetchStudents,
  updateStudent,
} from "../api";

const LIMIT_BREAK_OPTIONS: { value: string; label: string }[] = [
  { value: "1", label: "星1" },
  { value: "2", label: "星2" },
  { value: "3", label: "星3" },
  { value: "4", label: "星4" },
  { value: "5", label: "固有1" },
  { value: "6", label: "固有2" },
  { value: "7", label: "固有3" },
  { value: "8", label: "固有4" },
];

const SKILL_OPTIONS: { value: string; label: string }[] = [
  ...Array.from({ length: 9 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
  { value: "10", label: "M（MAX）" },
];

const EQUIP_OPTIONS: { value: string; label: string }[] = [
  { value: "0", label: "なし" },
  ...Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: `T${i + 1}` })),
];

const WB_OPTIONS: { value: string; label: string }[] = Array.from(
  { length: 26 },
  (_, i) => ({ value: String(i), label: String(i) })
);

interface EditForm {
  name: string;
  bond_level: string;
  wb_hp: string;
  wb_atk: string;
  wb_heal: string;
  skill_ex: string;
  skill_normal: string;
  skill_passive: string;
  skill_sub: string;
  limit_break: string;
  equip1: string;
  equip2: string;
  equip3: string;
}

function captureToForm(c: CaptureResult): EditForm {
  return {
    name: c.name ?? "",
    bond_level: c.bond_level != null ? String(c.bond_level) : "",
    wb_hp: c.wb_hp != null ? String(c.wb_hp) : "0",
    wb_atk: c.wb_atk != null ? String(c.wb_atk) : "0",
    wb_heal: c.wb_heal != null ? String(c.wb_heal) : "0",
    skill_ex: c.skill_ex != null ? String(c.skill_ex) : "",
    skill_normal: c.skill_normal != null ? String(c.skill_normal) : "",
    skill_passive: c.skill_passive != null ? String(c.skill_passive) : "",
    skill_sub: c.skill_sub != null ? String(c.skill_sub) : "",
    limit_break: c.limit_break != null ? String(c.limit_break) : "",
    equip1: c.equip1 != null ? String(c.equip1) : "",
    equip2: c.equip2 != null ? String(c.equip2) : "",
    equip3: c.equip3 != null ? String(c.equip3) : "",
  };
}

function formToUpdate(form: EditForm): StudentUpdate {
  const n = (s: string) => (s === "" ? null : Number(s));
  return {
    bond_level: n(form.bond_level),
    wb_hp: n(form.wb_hp),
    wb_atk: n(form.wb_atk),
    wb_heal: n(form.wb_heal),
    skill_ex: n(form.skill_ex),
    skill_normal: n(form.skill_normal),
    skill_passive: n(form.skill_passive),
    skill_sub: n(form.skill_sub),
    limit_break: n(form.limit_break),
    equip1: n(form.equip1),
    equip2: n(form.equip2),
    equip3: n(form.equip3),
  };
}

export default function RegisterMode() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [capture, setCapture] = useState<CaptureResult | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(async () => {
      try {
        const pending = await getPendingCapture();
        if (pending && pending.detected) {
          setCapture(pending);
          setForm(captureToForm(pending));
          await clearPendingCapture();
          setPolling(false);
          setLoading(false);
        }
      } catch { /* ignore */ }
    }, 500);
    return () => clearInterval(interval);
  }, [polling]);

  useEffect(() => {
    if (!form?.name) return;
    fetchStudents({ name: form.name, join: "all" })
      .then((students) => {
        const exact = students.find((s) => s.name === form.name);
        setMatchedStudent(exact ?? null);
      })
      .catch(() => setMatchedStudent(null));
  }, [form?.name]);

  const handleCapture = useCallback(async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const result = await triggerCapture();
      if (!result.detected) {
        setError("基本情報タブが表示されている生徒画面を開いてください");
        setLoading(false);
        return;
      }
      setCapture(result);
      setForm(captureToForm(result));
    } catch (e) {
      setError(e instanceof Error ? e.message : "キャプチャに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleHotkeyWait = useCallback(() => {
    setError(null);
    setSuccess(null);
    setCapture(null);
    setForm(null);
    setPolling(true);
    setLoading(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form || !matchedStudent) return;
    setLoading(true);
    setError(null);
    try {
      await updateStudent(matchedStudent.id, formToUpdate(form));
      setSuccess(`${form.name} の育成状況を保存しました`);
      setCapture(null);
      setForm(null);
      setMatchedStudent(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [form, matchedStudent]);

  const handleFieldChange = (key: keyof EditForm, val: string) => {
    setForm((prev) => (prev ? { ...prev, [key]: val } : null));
  };

  return (
    <div className="register-mode">
      {/* キャプチャエリア */}
      <div className="capture-area">
        <div className="capture-icon">📸</div>
        <div className="capture-text">
          ゲームで生徒の「基本情報」タブを開き、キャプチャしてください。
        </div>
        <div className="capture-buttons">
          <button className="btn-capture" onClick={handleCapture} disabled={loading}>
            {loading && !polling ? "処理中…" : "今すぐキャプチャ"}
          </button>
          <button
            className={`btn-hotkey ${polling ? "waiting" : ""}`}
            onClick={handleHotkeyWait}
            disabled={loading}
          >
            ⌨️ Ctrl+Shift+S 待機
          </button>
        </div>
        {polling && <div className="capture-ok">ホットキー待機中…</div>}
      </div>

      {error && <div className="alert alert-error" style={{ maxWidth: 860, margin: "0 auto 14px" }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ maxWidth: 860, margin: "0 auto 14px" }}>{success}</div>}

      {form && (
        <>
          <div className="reg-wrap">
            {/* 基本情報 */}
            <div className="reg-card">
              <div className="reg-card-title">
                <span className="reg-card-title-dot" />
                基本情報
              </div>

              <div className="reg-field">
                <label className="reg-field-label">生徒名</label>
                <input
                  type="text"
                  className="reg-input"
                  value={form.name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                />
                {!matchedStudent && form.name && (
                  <div style={{ marginTop: 6 }}>
                    <span className="warn-badge">⚠️ マスターリストに未登録</span>
                  </div>
                )}
              </div>

              <div className="reg-field">
                <label className="reg-field-label">絆レベル</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="reg-input"
                  value={form.bond_level}
                  onChange={(e) => handleFieldChange("bond_level", e.target.value)}
                />
              </div>

              <div className="reg-field">
                <label className="reg-field-label">凸・固有</label>
                <select
                  className="reg-select"
                  value={form.limit_break}
                  onChange={(e) => handleFieldChange("limit_break", e.target.value)}
                >
                  <option value="">—</option>
                  {LIMIT_BREAK_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* スキルレベル */}
            <div className="reg-card">
              <div className="reg-card-title">
                <span className="reg-card-title-dot" />
                スキルレベル
              </div>
              <div className="reg-grid">
                {(["skill_ex", "skill_normal", "skill_passive", "skill_sub"] as const).map((key, i) => {
                  const labels = ["EX", "ノーマル", "パッシブ", "サブ"];
                  return (
                    <div className="reg-field" key={key}>
                      <label className="reg-field-label">{labels[i]}</label>
                      <select
                        className="reg-select"
                        value={form[key]}
                        onChange={(e) => handleFieldChange(key, e.target.value)}
                      >
                        <option value="">—</option>
                        {SKILL_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 装備 */}
            <div className="reg-card">
              <div className="reg-card-title">
                <span className="reg-card-title-dot" />
                装備
              </div>
              <div className="reg-grid-3">
                {(["equip1", "equip2", "equip3"] as const).map((key, i) => (
                  <div className="reg-field" key={key}>
                    <label className="reg-field-label">装備{i + 1}</label>
                    <select
                      className="reg-select"
                      value={form[key]}
                      onChange={(e) => handleFieldChange(key, e.target.value)}
                    >
                      <option value="">—</option>
                      {EQUIP_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* ワークブック */}
            <div className="reg-card">
              <div className="reg-card-title">
                <span className="reg-card-title-dot" />
                ワークブック
              </div>
              <div className="reg-grid-3">
                {(["wb_hp", "wb_atk", "wb_heal"] as const).map((key, i) => {
                  const labels = ["HP", "攻撃力", "治癒力"];
                  return (
                    <div className="reg-field" key={key}>
                      <label className="reg-field-label">{labels[i]}</label>
                      <select
                        className="reg-select"
                        value={form[key]}
                        onChange={(e) => handleFieldChange(key, e.target.value)}
                      >
                        {WB_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 保存エリア */}
          <div style={{ maxWidth: 860, margin: "16px auto 0" }}>
            {capture && (
              <div className="raw-result">
                <strong>OCR生データ：</strong>
                {JSON.stringify(capture, null, 2)}
              </div>
            )}
            <div className="save-buttons">
              <button
                className="btn-save"
                onClick={handleSave}
                disabled={loading || !matchedStudent}
              >
                💾 登録
              </button>
              <button
                className="btn-secondary"
                onClick={() => { setForm(null); setCapture(null); }}
              >
                ✕ キャンセル
              </button>
            </div>
            {!matchedStudent && form.name && (
              <p className="warn-text">保存するには生徒名をマスターリストの名前と一致させてください。</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
