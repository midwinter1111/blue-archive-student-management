import { useState, useEffect, useCallback } from "react";
import type { Student, FilterState } from "../types";
import { fetchStudents, resetStudentStatus } from "../api";

const LIMIT_BREAK_LABELS: Record<number, string> = {
  1: "星1", 2: "星2", 3: "星3", 4: "星4",
  5: "固有1", 6: "固有2", 7: "固有3", 8: "固有4", 9: "固有5",
};

function skillDisplay(v: number | null): string {
  if (v === null) return "-";
  return v === 10 ? "M" : String(v);
}

function equipDisplay(v: number | null): string {
  if (v === null) return "-";
  return v === 0 ? "なし" : `T${v}`;
}

function wbDisplay(hp: number | null, atk: number | null, heal: number | null): string {
  if (hp === null && atk === null && heal === null) return "-";
  const f = (v: number | null) => (v == null || v === 0 ? "-" : String(v));
  return `${f(hp)}/${f(atk)}/${f(heal)}`;
}

function isAllSkillMax(s: Student): boolean {
  return s.skill_ex === 10 && s.skill_normal === 10 && s.skill_passive === 10 && s.skill_sub === 10;
}

function isAllEquipT10(s: Student): boolean {
  return s.equip1 === 10 && s.equip2 === 10 && s.equip3 === 10;
}

type SortKey = "name" | "bond_level" | "limit_break" | "equip";
type SortDir = "asc" | "desc";

const DEFAULT_FILTERS: FilterState = {
  name: "",
  joinedOnly: false,
  notJoinedOnly: false,
  skillNotMax: false,
  equipNotT10: false,
  limitBreakMin: "",
  limitBreakMax: "",
};

export default function ListView() {
  const [students, setStudents] = useState<Student[]>([]);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [error, setError] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<Student | null>(null);

  const load = useCallback(async (f: FilterState) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStudents(f);
      setStudents(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込み失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(appliedFilters);
  }, [appliedFilters, load]);

  const applyFilters = () => setAppliedFilters({ ...filters });
  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = [...students].sort((a, b) => {
    let va: number | string, vb: number | string;
    if (sortKey === "name") { va = a.name; vb = b.name; }
    else if (sortKey === "bond_level") { va = a.bond_level ?? -1; vb = b.bond_level ?? -1; }
    else if (sortKey === "limit_break") { va = a.limit_break ?? -1; vb = b.limit_break ?? -1; }
    else { va = (a.equip1 ?? 0) + (a.equip2 ?? 0) + (a.equip3 ?? 0); vb = (b.equip1 ?? 0) + (b.equip2 ?? 0) + (b.equip3 ?? 0); }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const handleReset = async (s: Student) => {
    try {
      await resetStudentStatus(s.id);
      setResetTarget(null);
      load(appliedFilters);
    } catch {
      // ignore
    }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return " ↕";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  const joinedCount = students.filter((s) => s.is_joined).length;
  const totalCount = students.length;

  return (
    <div className="list-mode">
      {/* 固定ヘッダ（スクロール時も表示） */}
      <div className="list-sticky-header">
        <div className="section-header">
          <h2>📋 一覧モード</h2>
          <span className="count-badge">{joinedCount} / {totalCount} 人加入済み</span>
        </div>

        {/* フィルターパネル */}
        <div className="filter-panel">
        <div className="filter-row">
          <div className="filter-group">
            <label>名前検索</label>
            <input
              type="text"
              value={filters.name}
              onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))}
              placeholder="例: ノゾミ"
              className="input-text-sm"
            />
          </div>

          <div className="filter-group">
            <label>加入状態</label>
            <select
              value={filters.joinedOnly ? "joined" : filters.notJoinedOnly ? "not_joined" : "all"}
              onChange={(e) => {
                const v = e.target.value;
                setFilters((f) => ({
                  ...f,
                  joinedOnly: v === "joined",
                  notJoinedOnly: v === "not_joined",
                }));
              }}
              className="input-select-sm"
            >
              <option value="all">全て</option>
              <option value="joined">加入済みのみ</option>
              <option value="not_joined">未加入のみ</option>
            </select>
          </div>

          <div className="filter-group">
            <label>スキル</label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={filters.skillNotMax}
                onChange={(e) => setFilters((f) => ({ ...f, skillNotMax: e.target.checked }))}
              />
              MAX未達のみ
            </label>
          </div>

          <div className="filter-group">
            <label>装備</label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={filters.equipNotT10}
                onChange={(e) => setFilters((f) => ({ ...f, equipNotT10: e.target.checked }))}
              />
              T10未達のみ
            </label>
          </div>

          <div className="filter-group">
            <label>凸/固有（1–9）</label>
            <div className="range-inputs">
              <input
                type="number"
                min={1}
                max={9}
                value={filters.limitBreakMin}
                onChange={(e) => setFilters((f) => ({ ...f, limitBreakMin: e.target.value }))}
                placeholder="下限"
                className="input-number-sm"
              />
              <span>〜</span>
              <input
                type="number"
                min={1}
                max={9}
                value={filters.limitBreakMax}
                onChange={(e) => setFilters((f) => ({ ...f, limitBreakMax: e.target.value }))}
                placeholder="上限"
                className="input-number-sm"
              />
            </div>
          </div>
        </div>

        <div className="filter-actions">
          <button className="btn-primary btn-sm" onClick={applyFilters}>
            🔍 絞り込み
          </button>
          <button className="btn-secondary btn-sm" onClick={resetFilters}>
            ✕ リセット
          </button>
          <button className="btn-secondary btn-sm" onClick={() => load(appliedFilters)}>
            🔄 更新
          </button>
        </div>
      </div>
      </div>{/* /list-sticky-header */}

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <div className="loading">読み込み中…</div>}

      {/* テーブル */}
      {!loading && (
        <div className="table-container">
          <table className="student-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort("name")}>
                  生徒名{sortIcon("name")}
                </th>
                <th>状態</th>
                <th className="sortable col-center" onClick={() => handleSort("bond_level")}>
                  絆{sortIcon("bond_level")}
                </th>
                <th className="col-center">WB (H/A/R)</th>
                <th>スキル</th>
                <th className="sortable col-center" onClick={() => handleSort("limit_break")}>
                  凸/固有{sortIcon("limit_break")}
                </th>
                <th className="sortable col-center" onClick={() => handleSort("equip")}>
                  装備{sortIcon("equip")}
                </th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.id} className={s.is_joined ? "" : "row-not-joined"}>
                  <td className="name-cell">{s.name}</td>
                  <td>
                    {s.is_joined ? (
                      <span className="badge-joined">加入済</span>
                    ) : (
                      <span className="badge-not-joined">未加入</span>
                    )}
                  </td>
                  <td className="num-cell">{s.bond_level ?? "-"}</td>
                  <td className="num-cell">{wbDisplay(s.wb_hp, s.wb_atk, s.wb_heal)}</td>
                  <td className={`skill-cell ${s.is_joined && !isAllSkillMax(s) ? "warn" : ""}`}>
                    {s.is_joined
                      ? `${skillDisplay(s.skill_ex)}/${skillDisplay(s.skill_normal)}/${skillDisplay(s.skill_passive)}/${skillDisplay(s.skill_sub)}`
                      : "-"}
                  </td>
                  <td className="num-cell">
                    {s.limit_break ? (LIMIT_BREAK_LABELS[s.limit_break] ?? "-") : "-"}
                  </td>
                  <td className={`equip-cell ${s.is_joined && !isAllEquipT10(s) ? "warn" : ""}`}>
                    {s.is_joined
                      ? `${equipDisplay(s.equip1)}/${equipDisplay(s.equip2)}/${equipDisplay(s.equip3)}`
                      : "-"}
                  </td>
                  <td className="action-cell">
                    {s.is_joined && (
                      <button
                        className="btn-danger btn-xs"
                        onClick={() => setResetTarget(s)}
                      >
                        リセット
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="no-data">
                    該当する生徒がいません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* リセット確認モーダル */}
      {resetTarget && (
        <div className="modal-overlay" onClick={() => setResetTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>育成状況をリセット</h3>
            <p>
              <strong>{resetTarget.name}</strong> の育成状況を全てリセットし、
              未加入状態に戻します。よろしいですか？
            </p>
            <div className="modal-actions">
              <button className="btn-danger" onClick={() => handleReset(resetTarget)}>
                リセットする
              </button>
              <button className="btn-secondary" onClick={() => setResetTarget(null)}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
