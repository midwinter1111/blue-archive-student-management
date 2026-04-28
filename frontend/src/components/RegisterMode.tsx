import { useState, useEffect, useCallback } from "react";
import type { CaptureResult, Student, StudentUpdate } from "../types";
import {
  triggerCapture,
  getPendingCapture,
  clearPendingCapture,
  fetchStudents,
  updateStudent,
} from "../api";

const LIMIT_BREAK_OPTIONS = [
  { value: 1, label: "星1" },
  { value: 2, label: "星2" },
  { value: 3, label: "星3" },
  { value: 4, label: "星4" },
  { value: 5, label: "固有1" },
  { value: 6, label: "固有2" },
  { value: 7, label: "固有3" },
  { value: 8, label: "固有4" },
  { value: 9, label: "固有5" },
];

function skillLabel(val: number | null): string {
  if (val === null) return "-";
  return val === 10 ? "M" : String(val);
}

function equipLabel(val: number | null): string {
  if (val === null) return "-";
  return val === 0 ? "なし" : `T${val}`;
}

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

  // ホットキー検出のためのポーリング
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
      } catch {
        // ignore
      }
    }, 500);
    return () => clearInterval(interval);
  }, [polling]);

  // キャプチャ後に生徒名で既存データを検索
  useEffect(() => {
    if (!form?.name) return;
    fetchStudents({ name: form.name, joinedOnly: false, notJoinedOnly: false, skillNotMax: false, equipNotT10: false, limitBreakMin: "", limitBreakMax: "" })
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
      <div className="section-header">
        <h2>📸 登録モード</h2>
        <p className="hint">
          ゲームで生徒の「基本情報」タブを開き、キャプチャしてください。
        </p>
      </div>

      <div className="capture-buttons">
        <button
          className="btn-primary"
          onClick={handleCapture}
          disabled={loading}
        >
          {loading ? "処理中…" : "📸 今すぐキャプチャ"}
        </button>
        <button
          className="btn-secondary"
          onClick={handleHotkeyWait}
          disabled={loading}
        >
          ⌨️ Ctrl+Shift+S 待機
        </button>
        {polling && (
          <span className="waiting-badge">
            🟡 ホットキー待機中…
          </span>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {form && (
        <div className="capture-result">
          <div className="result-header">
            <h3>キャプチャ結果の確認・修正</h3>
            {!matchedStudent && form.name && (
              <span className="warn-badge">⚠️ 「{form.name}」はマスターリストに未登録</span>
            )}
          </div>

          <div className="form-grid">
            {/* 生徒名 */}
            <div className="form-row full-width">
              <label>生徒名</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                className="input-text"
              />
            </div>

            {/* 絆 */}
            <div className="form-row">
              <label>絆レベル</label>
              <input
                type="number"
                min={1}
                max={100}
                value={form.bond_level}
                onChange={(e) => handleFieldChange("bond_level", e.target.value)}
                className="input-number"
              />
            </div>

            {/* 固有/星 */}
            <div className="form-row">
              <label>凸・固有</label>
              <select
                value={form.limit_break}
                onChange={(e) => handleFieldChange("limit_break", e.target.value)}
                className="input-select"
              >
                <option value="">-</option>
                {LIMIT_BREAK_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* WB */}
            <div className="form-section">
              <h4>WorkBook</h4>
              <div className="form-row-inline">
                <div className="form-row">
                  <label>HP WB</label>
                  <input
                    type="number"
                    min={0}
                    max={25}
                    value={form.wb_hp}
                    onChange={(e) => handleFieldChange("wb_hp", e.target.value)}
                    className="input-number"
                  />
                </div>
                <div className="form-row">
                  <label>攻撃力 WB</label>
                  <input
                    type="number"
                    min={0}
                    max={25}
                    value={form.wb_atk}
                    onChange={(e) => handleFieldChange("wb_atk", e.target.value)}
                    className="input-number"
                  />
                </div>
                <div className="form-row">
                  <label>治癒力 WB</label>
                  <input
                    type="number"
                    min={0}
                    max={25}
                    value={form.wb_heal}
                    onChange={(e) => handleFieldChange("wb_heal", e.target.value)}
                    className="input-number"
                  />
                </div>
              </div>
            </div>

            {/* スキル */}
            <div className="form-section">
              <h4>スキルレベル（1–10, 10=M）</h4>
              <div className="form-row-inline">
                {(["skill_ex", "skill_normal", "skill_passive", "skill_sub"] as const).map((key, i) => {
                  const labels = ["EX", "ノーマル", "パッシブ", "サブ"];
                  return (
                    <div className="form-row" key={key}>
                      <label>{labels[i]}</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={form[key]}
                        onChange={(e) => handleFieldChange(key, e.target.value)}
                        className="input-number"
                      />
                    </div>
                  );
                })}
              </div>
              <div className="skill-preview">
                {skillLabel(Number(form.skill_ex) || null)}/{skillLabel(Number(form.skill_normal) || null)}/
                {skillLabel(Number(form.skill_passive) || null)}/{skillLabel(Number(form.skill_sub) || null)}
              </div>
            </div>

            {/* 装備 */}
            <div className="form-section">
              <h4>装備 Tier（0–10）</h4>
              <div className="form-row-inline">
                {(["equip1", "equip2", "equip3"] as const).map((key, i) => (
                  <div className="form-row" key={key}>
                    <label>装備{i + 1}</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={form[key]}
                      onChange={(e) => handleFieldChange(key, e.target.value)}
                      className="input-number"
                    />
                  </div>
                ))}
              </div>
              <div className="equip-preview">
                {equipLabel(Number(form.equip1) || null)}/
                {equipLabel(Number(form.equip2) || null)}/
                {equipLabel(Number(form.equip3) || null)}
              </div>
            </div>
          </div>

          <div className="save-area">
            {capture && (
              <div className="raw-result">
                <strong>OCR生データ：</strong>
                {JSON.stringify(capture, null, 2)}
              </div>
            )}
            <div className="save-buttons">
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={loading || !matchedStudent}
              >
                💾 保存
              </button>
              <button
                className="btn-danger"
                onClick={() => { setForm(null); setCapture(null); }}
              >
                ✕ キャンセル
              </button>
            </div>
            {!matchedStudent && form.name && (
              <p className="warn-text">
                保存するには生徒名をマスターリストの名前と一致させてください。
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
