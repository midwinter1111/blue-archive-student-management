import { useState, useEffect, useCallback } from "react";
import type { Student, FilterState } from "../types";
import { fetchStudents, resetStudentStatus } from "../api";

function Stars({ value }: { value: number | null }) {
  if (!value) return <span style={{ color: "var(--text-faint)" }}>—</span>;
  if (value <= 4) {
    return (
      <span className="stars-wrap">
        {Array.from({ length: value }, (_, i) => (
          <span key={i} className="star on">★</span>
        ))}
      </span>
    );
  }
  const n = value - 4;
  return (
    <span className="stars-wrap">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="star blue">★</span>
      ))}
    </span>
  );
}

function EquipBadge({ value }: { value: number | null }) {
  if (value === null || value === 0) return <span className="eq low">—</span>;
  const cls = value >= 10 ? "t10" : value >= 7 ? "normal" : "low";
  return <span className={`eq ${cls}`}>T{value}</span>;
}

function WbVal({ value }: { value: number | null }) {
  if (value === null || value === 0) return <span className="wb-val">—</span>;
  return <span className={`wb-val${value === 25 ? " max" : ""}`}>{value}</span>;
}

type SortKey = "name" | "bond_level" | "limit_break" | "equip";
type SortDir = "asc" | "desc";

const DEFAULT_FILTERS: FilterState = { name: "", join: "all" };

export default function ListView() {
  const [students, setStudents] = useState<Student[]>([]);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
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
    const timer = setTimeout(() => load(filters), 250);
    return () => clearTimeout(timer);
  }, [filters, load]);

  const setJoin = (join: FilterState["join"]) =>
    setFilters((f) => ({ ...f, join }));

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
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
      load(filters);
    } catch { /* ignore */ }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return " ↕";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  const joinedCount = students.filter((s) => s.is_joined).length;

  return (
    <div className="list-mode">
      <div className="list-sticky-header">
        <div className="section-header">
          <h2>一覧</h2>
          <span className="count-badge">{joinedCount} / {students.length} 人加入済み</span>
          {loading && <span style={{ fontSize: 11, color: "var(--text-faint)" }}>読み込み中…</span>}
        </div>

        <div className="filter-panel" style={{ marginTop: 10 }}>
          <span className="filter-label">名前</span>
          <input
            type="text"
            className="filter-input"
            value={filters.name}
            onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))}
            placeholder="例: ノゾミ"
          />
          <div className="filter-sep" />
          <span className="filter-label">加入</span>
          <button className={`chip ${filters.join === "all" ? "active" : ""}`} onClick={() => setJoin("all")}>すべて</button>
          <button className={`chip ${filters.join === "joined" ? "active" : ""}`} onClick={() => setJoin("joined")}>加入済み</button>
          <button className={`chip ${filters.join === "not_joined" ? "active" : ""}`} onClick={() => setJoin("not_joined")}>未加入</button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: 8 }}>{error}</div>}

      <div className="table-container">
        <table className="student-table">
          <thead>
            <tr>
              <th className={`sortable ${sortKey === "name" ? "sort-active" : ""}`} onClick={() => handleSort("name")}>
                生徒名{sortIcon("name")}
              </th>
              <th>加入状況</th>
              <th className={`col-center sortable ${sortKey === "limit_break" ? "sort-active" : ""}`} onClick={() => handleSort("limit_break")}>
                凸/固有{sortIcon("limit_break")}
              </th>
              <th className={`col-center sortable ${sortKey === "bond_level" ? "sort-active" : ""}`} onClick={() => handleSort("bond_level")}>
                絆{sortIcon("bond_level")}
              </th>
              <th className={`col-sep col-center sortable ${sortKey === "equip" ? "sort-active" : ""}`} onClick={() => handleSort("equip")}>
                装備1{sortIcon("equip")}
              </th>
              <th className="col-center">装備2</th>
              <th className="col-center">装備3</th>
              <th className="col-sep col-center">WB-H</th>
              <th className="col-center">WB-A</th>
              <th className="col-center">WB-R</th>
              <th className="col-sep col-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.id}>
                <td className="name-cell">{s.name}</td>
                <td>
                  <span className={`join-dot ${s.is_joined ? "yes" : "no"}`} />
                  <span className="join-label">{s.is_joined ? "加入済み" : "未加入"}</span>
                </td>
                <td className="num-cell">
                  <Stars value={s.limit_break} />
                </td>
                <td className="num-cell">{s.bond_level ?? "—"}</td>
                <td className="num-cell td-sep">{s.is_joined ? <EquipBadge value={s.equip1} /> : "—"}</td>
                <td className="num-cell">{s.is_joined ? <EquipBadge value={s.equip2} /> : "—"}</td>
                <td className="num-cell">{s.is_joined ? <EquipBadge value={s.equip3} /> : "—"}</td>
                <td className="num-cell td-sep">{s.is_joined ? <WbVal value={s.wb_hp} /> : "—"}</td>
                <td className="num-cell">{s.is_joined ? <WbVal value={s.wb_atk} /> : "—"}</td>
                <td className="num-cell">{s.is_joined ? <WbVal value={s.wb_heal} /> : "—"}</td>
                <td className="action-cell td-sep">
                  {s.is_joined && (
                    <button className="btn-xs" onClick={() => setResetTarget(s)}>リセット</button>
                  )}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && !loading && (
              <tr>
                <td colSpan={11} className="no-data">該当する生徒がいません</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {resetTarget && (
        <div className="modal-overlay" onClick={() => setResetTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>育成状況をリセット</h3>
            <p>
              <strong>{resetTarget.name}</strong> の育成状況を全てリセットし、
              未加入状態に戻します。よろしいですか？
            </p>
            <div className="modal-actions">
              <button className="btn-danger" onClick={() => handleReset(resetTarget)}>リセットする</button>
              <button className="btn-secondary" onClick={() => setResetTarget(null)}>キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
