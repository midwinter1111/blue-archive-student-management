import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Student, FilterState } from "../types";
import { fetchStudents, fetchMasterStudents, resetStudentStatus } from "../api";

// ─── 型 ────────────────────────────────────────────────────────────
interface MySet {
  id: string;
  name: string;
  studentNames: string[];
}

interface PopupFilters {
  schools: string[];
  roles: string[];
  atk_types: string[];
  def_types: string[];
  classes: string[];
  positions: string[];
}

// ─── 定数 ──────────────────────────────────────────────────────────
const STORAGE_KEY = "ba_mySets";
const MAX_SETS = 10;

const ROLE_OPTIONS   = ["STRIKER", "SPECIAL"];
const ATK_OPTIONS    = ["爆発", "神秘", "貫通", "振動"];
const DEF_OPTIONS    = ["軽装備", "重装甲", "特殊装甲", "弾力装甲", "複合装甲"];
const CLASS_OPTIONS  = ["アタッカー", "サポーター", "タンク", "ヒーラー", "T.S"];
const POS_OPTIONS    = ["FRONT", "MIDDLE", "BACK"];

const EMPTY_POPUP: PopupFilters = {
  schools: [], roles: [], atk_types: [], def_types: [], classes: [], positions: [],
};
const DEFAULT_FILTERS: FilterState = {
  name: "", join: "all", ...EMPTY_POPUP,
};

const ROLE_CLASS: Record<string, string> = { STRIKER: "ib-striker", SPECIAL: "ib-special" };
const POS_CLASS:  Record<string, string> = { FRONT: "ib-front", MIDDLE: "ib-middle", BACK: "ib-back" };
const CLS_CLASS:  Record<string, string> = {
  "アタッカー": "ib-atker", "サポーター": "ib-support",
  "タンク": "ib-tank", "ヒーラー": "ib-healer", "T.S": "ib-ts",
};
const ATK_CLASS: Record<string, string> = {
  "爆発": "ib-bakuhatsu", "神秘": "ib-shinpi", "貫通": "ib-kantsuu", "振動": "ib-shindou",
};
const DEF_CLASS: Record<string, string> = {
  "軽装備": "ib-kei", "重装甲": "ib-juu", "特殊装甲": "ib-toku",
  "弾力装甲": "ib-dani", "複合装甲": "ib-fukug",
};

// ─── サブコンポーネント ─────────────────────────────────────────────
function StudentIcon({ name }: { name: string }) {
  const src = `/student-icons/${encodeURIComponent(name)}.png`;
  return (
    <img src={src} alt={name} className="student-icon"
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
  );
}

function InfoBadge({ value, cls }: { value: string | null; cls: string }) {
  if (!value) return <span style={{ color: "var(--text-faint)" }}>—</span>;
  return <span className={`ib ${cls}`}>{value}</span>;
}

function Stars({ value }: { value: number | null }) {
  if (!value) return <span style={{ color: "var(--text-faint)" }}>—</span>;
  if (value <= 4) return (
    <span className="stars-wrap">
      {Array.from({ length: value }, (_, i) => <span key={i} className="star on">★</span>)}
    </span>
  );
  return (
    <span className="stars-wrap">
      {Array.from({ length: value - 4 }, (_, i) => <span key={i} className="star blue">★</span>)}
    </span>
  );
}

function EquipBadge({ value }: { value: number | null }) {
  if (value === null || value === 0) return <span style={{ color: "var(--text-faint)" }}>—</span>;
  return <span className={`eq ${value >= 10 ? "t10" : "normal"}`}>T{value}</span>;
}

function WbVal({ value }: { value: number | null }) {
  if (value === null || value === 0) return <span style={{ color: "var(--text-faint)" }}>—</span>;
  return <span className={`eq ${value >= 25 ? "t10" : "normal"}`}>{value}</span>;
}

// ─── マイセットポップアップ ──────────────────────────────────────────
interface MySetPopupProps {
  mySets: MySet[];
  activeMySetId: string | null;
  allStudentNames: string[];
  onClose: () => void;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
  onRegister: (name: string, students: string[]) => void;
  onUpdate: (id: string, name: string, studentNames: string[]) => void;
}

function MySetPopup({
  mySets, activeMySetId, allStudentNames,
  onClose, onActivate, onDelete, onRegister, onUpdate,
}: MySetPopupProps) {
  const [newSetName, setNewSetName] = useState("");
  const [newSetStudents, setNewSetStudents] = useState<string[]>([]);
  const [studentInput, setStudentInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // 編集用ステート
  const [editingSet, setEditingSet] = useState<MySet | null>(null);
  const [editName, setEditName] = useState("");
  const [editStudents, setEditStudents] = useState<string[]>([]);
  const [editStudentInput, setEditStudentInput] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const addStudent = () => {
    const name = studentInput.trim();
    if (!name || newSetStudents.includes(name)) return;
    setNewSetStudents((prev) => [...prev, name]);
    setStudentInput("");
    inputRef.current?.focus();
  };

  const handleRegister = () => {
    if (!newSetName.trim() || newSetStudents.length === 0) return;
    onRegister(newSetName.trim(), newSetStudents);
    setNewSetName("");
    setNewSetStudents([]);
    setStudentInput("");
  };

  const startEdit = (set: MySet) => {
    setEditingSet(set);
    setEditName(set.name);
    setEditStudents([...set.studentNames]);
    setEditStudentInput("");
  };

  const cancelEdit = () => {
    setEditingSet(null);
    setEditStudentInput("");
  };

  const saveEdit = () => {
    if (!editingSet || !editName.trim() || editStudents.length === 0) return;
    onUpdate(editingSet.id, editName.trim(), editStudents);
    cancelEdit();
  };

  const addEditStudent = () => {
    const name = editStudentInput.trim();
    if (!name || editStudents.includes(name)) return;
    setEditStudents((prev) => [...prev, name]);
    setEditStudentInput("");
    editInputRef.current?.focus();
  };

  const canRegister = mySets.length < MAX_SETS;

  return (
    <div className="modal-overlay" onClick={editingSet ? cancelEdit : onClose}>
      <div className="myset-popup" onClick={(e) => e.stopPropagation()}>

        {editingSet ? (
          /* ── 編集ビュー ── */
          <>
            <div className="myset-popup-header">
              <button className="myset-back-btn" onClick={cancelEdit}>← 戻る</button>
              <h3>セット編集</h3>
              <button className="filter-popup-close" onClick={onClose}>✕</button>
            </div>
            <div className="myset-popup-body">
              <div className="myset-section">
                <div className="reg-field">
                  <label className="reg-field-label">セット名</label>
                  <input
                    type="text"
                    className="reg-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div className="reg-field">
                  <label className="reg-field-label">生徒を追加</label>
                  <div className="myset-input-row">
                    <input
                      ref={editInputRef}
                      type="text"
                      list="myset-edit-datalist"
                      className="reg-input"
                      value={editStudentInput}
                      onChange={(e) => setEditStudentInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addEditStudent()}
                      placeholder="生徒名を入力または選択"
                    />
                    <datalist id="myset-edit-datalist">
                      {allStudentNames
                        .filter((n) => !editStudents.includes(n))
                        .map((n) => <option key={n} value={n} />)}
                    </datalist>
                    <button
                      className="btn-secondary"
                      onClick={addEditStudent}
                      disabled={!editStudentInput.trim()}
                    >
                      追加
                    </button>
                  </div>
                </div>
                {editStudents.length > 0 ? (
                  <div className="myset-student-tags">
                    {editStudents.map((name) => (
                      <span key={name} className="myset-student-tag">
                        {name}
                        <button onClick={() => setEditStudents((prev) => prev.filter((n) => n !== name))}>×</button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="myset-empty">生徒が登録されていません</div>
                )}
                <div className="myset-edit-actions">
                  <button className="btn-secondary" onClick={cancelEdit}>キャンセル</button>
                  <button
                    className="btn-primary"
                    onClick={saveEdit}
                    disabled={!editName.trim() || editStudents.length === 0}
                  >
                    保存する
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* ── 一覧ビュー ── */
          <>
            <div className="myset-popup-header">
              <h3>マイセット登録/表示</h3>
              <button className="filter-popup-close" onClick={onClose}>✕</button>
            </div>
            <div className="myset-popup-body">
              {/* マイセット一覧 */}
              <div className="myset-section">
                <div className="myset-section-title">マイセット一覧（{mySets.length} / {MAX_SETS}）</div>
                {mySets.length === 0 ? (
                  <div className="myset-empty">登録されたマイセットはありません</div>
                ) : (
                  <div className="myset-list">
                    {mySets.map((s) => (
                      <div key={s.id} className={`myset-list-item ${activeMySetId === s.id ? "active" : ""}`}>
                        <div className="myset-list-item-info">
                          <span className="myset-list-item-name">{s.name}</span>
                          <span className="myset-list-item-count">{s.studentNames.length}名</span>
                        </div>
                        <div className="myset-list-item-actions">
                          <button
                            className={`chip ${activeMySetId === s.id ? "active" : ""}`}
                            onClick={() => onActivate(s.id)}
                          >
                            {activeMySetId === s.id ? "反映中" : "フィルタ反映"}
                          </button>
                          <button className="btn-xs-green" onClick={() => startEdit(s)}>編集</button>
                          <button className="btn-xs" onClick={() => onDelete(s.id)}>削除</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 新規マイセット登録 */}
              <div className="myset-section">
                <div className="myset-section-title">新規マイセット登録</div>
                {!canRegister && (
                  <div className="alert alert-warn" style={{ marginBottom: 10, fontSize: 12 }}>
                    マイセットは最大{MAX_SETS}個まで登録できます。削除してから追加してください。
                  </div>
                )}
                <div className="reg-field">
                  <label className="reg-field-label">セット名</label>
                  <input
                    type="text"
                    className="reg-input"
                    value={newSetName}
                    onChange={(e) => setNewSetName(e.target.value)}
                    placeholder="例: ゲブラLunatic"
                    disabled={!canRegister}
                  />
                </div>
                <div className="reg-field">
                  <label className="reg-field-label">生徒を追加</label>
                  <div className="myset-input-row">
                    <input
                      ref={inputRef}
                      type="text"
                      list="myset-student-datalist"
                      className="reg-input"
                      value={studentInput}
                      onChange={(e) => setStudentInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addStudent()}
                      placeholder="生徒名を入力または選択"
                      disabled={!canRegister}
                    />
                    <datalist id="myset-student-datalist">
                      {allStudentNames
                        .filter((n) => !newSetStudents.includes(n))
                        .map((n) => <option key={n} value={n} />)}
                    </datalist>
                    <button className="btn-secondary" onClick={addStudent} disabled={!canRegister || !studentInput.trim()}>
                      追加
                    </button>
                  </div>
                </div>
                {newSetStudents.length > 0 && (
                  <div className="myset-student-tags">
                    {newSetStudents.map((name) => (
                      <span key={name} className="myset-student-tag">
                        {name}
                        <button onClick={() => setNewSetStudents((prev) => prev.filter((n) => n !== name))}>×</button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                  <button
                    className="btn-primary"
                    onClick={handleRegister}
                    disabled={!canRegister || !newSetName.trim() || newSetStudents.length === 0}
                  >
                    登録する
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

// ─── メインコンポーネント ───────────────────────────────────────────
type SortKey = "name" | "bond_level" | "limit_break" | "equip";
type SortDir = "asc" | "desc";

export default function ListView() {
  const [students, setStudents] = useState<Student[]>([]);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [error, setError] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<Student | null>(null);

  // 生徒情報フィルタポップアップ
  const [filterPopupOpen, setFilterPopupOpen] = useState(false);
  const [pending, setPending] = useState<PopupFilters>(EMPTY_POPUP);

  // マイセット
  const [mySets, setMySets] = useState<MySet[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); }
    catch { return []; }
  });
  const [activeMySetId, setActiveMySetId] = useState<string | null>(null);
  const [mySetPopupOpen, setMySetPopupOpen] = useState(false);
  const [allStudentNames, setAllStudentNames] = useState<string[]>([]);
  const [filterResetConfirmOpen, setFilterResetConfirmOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mySets));
  }, [mySets]);

  useEffect(() => {
    fetchMasterStudents().then((names) => setAllStudentNames(names)).catch(() => {});
  }, []);

  const load = useCallback(async (f: FilterState) => {
    setLoading(true);
    setError(null);
    try {
      // join フィルタはクライアント側で行うため、バックエンドには常に "all" で送る。
      // これにより students は名前フィルタのみ適用した全件となり、
      // 加入済み人数カウントがフィルタ状態に左右されなくなる。
      const data = await fetchStudents({ ...f, join: "all" });
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

  // 生徒情報フィルタポップアップ操作
  const openFilterPopup = () => {
    setPending({
      schools: filters.schools, roles: filters.roles, atk_types: filters.atk_types,
      def_types: filters.def_types, classes: filters.classes, positions: filters.positions,
    });
    setFilterPopupOpen(true);
  };
  const applyFilterPopup = () => {
    setFilters((f) => ({ ...f, ...pending }));
    setFilterPopupOpen(false);
  };
  const togglePending = (key: keyof PopupFilters, value: string) => {
    setPending((p) => ({
      ...p,
      [key]: p[key].includes(value) ? p[key].filter((v) => v !== value) : [...p[key], value],
    }));
  };

  // マイセット操作
  const activateMySet = (id: string) => {
    setActiveMySetId(id);
    setFilters(DEFAULT_FILTERS);
    setMySetPopupOpen(false);
  };
  const deactivateMySet = () => setActiveMySetId(null);
  const deleteMySet = (id: string) => {
    if (activeMySetId === id) setActiveMySetId(null);
    setMySets((prev) => prev.filter((s) => s.id !== id));
  };
  const registerMySet = (name: string, studentNames: string[]) => {
    setMySets((prev) => [...prev, { id: Date.now().toString(), name, studentNames }]);
  };
  const updateMySet = (id: string, name: string, studentNames: string[]) => {
    setMySets((prev) => prev.map((s) => s.id === id ? { ...s, name, studentNames } : s));
  };

  // フィルタリセット
  const resetAllFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setActiveMySetId(null);
  };

  // ソート
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };
  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return " ↕";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  // フィルタリング
  const schoolOptions = useMemo(
    () => [...new Set(students.map((s) => s.school).filter((s): s is string => s != null))].sort(),
    [students]
  );

  const baseStudents = useMemo(() => {
    if (!activeMySetId) return students;
    const mySet = mySets.find((s) => s.id === activeMySetId);
    if (!mySet) return students;
    return students.filter((s) => mySet.studentNames.includes(s.name));
  }, [students, activeMySetId, mySets]);

  const clientFiltered = useMemo(() =>
    baseStudents.filter((s) => {
      if (filters.join === "joined" && !s.is_joined) return false;
      if (filters.join === "not_joined" && s.is_joined) return false;
      if (filters.schools.length > 0 && !filters.schools.includes(s.school ?? "")) return false;
      if (filters.roles.length > 0 && !filters.roles.includes(s.role ?? "")) return false;
      if (filters.atk_types.length > 0 && !filters.atk_types.includes(s.atk_type ?? "")) return false;
      if (filters.def_types.length > 0 && !filters.def_types.includes(s.def_type ?? "")) return false;
      if (filters.classes.length > 0 && !filters.classes.includes(s.student_class ?? "")) return false;
      if (filters.positions.length > 0 && !filters.positions.includes(s.position ?? "")) return false;
      return true;
    }),
    [baseStudents, filters.join, filters.schools, filters.roles, filters.atk_types, filters.def_types, filters.classes, filters.positions]
  );

  const sorted = useMemo(() => [...clientFiltered].sort((a, b) => {
    let va: number | string, vb: number | string;
    if (sortKey === "name") { va = a.name; vb = b.name; }
    else if (sortKey === "bond_level") { va = a.bond_level ?? -1; vb = b.bond_level ?? -1; }
    else if (sortKey === "limit_break") { va = a.limit_break ?? -1; vb = b.limit_break ?? -1; }
    else { va = (a.equip1 ?? 0) + (a.equip2 ?? 0) + (a.equip3 ?? 0); vb = (b.equip1 ?? 0) + (b.equip2 ?? 0) + (b.equip3 ?? 0); }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  }), [clientFiltered, sortKey, sortDir]);

  const handleReset = async (s: Student) => {
    try {
      await resetStudentStatus(s.id);
      setResetTarget(null);
      load(filters);
    } catch { /* ignore */ }
  };

  const joinedCount = students.filter((s) => s.is_joined).length;
  const activeFilterCount = [
    filters.schools, filters.roles, filters.atk_types,
    filters.def_types, filters.classes, filters.positions,
  ].filter((arr) => arr.length > 0).length;
  const activeMySet = mySets.find((s) => s.id === activeMySetId) ?? null;

  return (
    <div className="list-mode">
      <div className="list-sticky-header">
        <div className="section-header">
          <h2>一覧</h2>
          <span className="count-badge">{joinedCount} / {students.length} 人加入済み</span>
          {loading && <span style={{ fontSize: 11, color: "var(--text-faint)" }}>読み込み中…</span>}
        </div>

        <div className="filter-panel" style={{ marginTop: 10 }}>
          {/* 名前 */}
          <span className="filter-label">名前</span>
          <input
            type="text"
            className="filter-input"
            value={filters.name}
            onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))}
          />
          <div className="filter-sep" />

          {/* 加入状況 */}
          <span className="filter-label">加入状況</span>
          <button className={`chip ${filters.join === "all" ? "active" : ""}`} onClick={() => setFilters((f) => ({ ...f, join: "all" }))}>すべて</button>
          <button className={`chip ${filters.join === "joined" ? "active" : ""}`} onClick={() => setFilters((f) => ({ ...f, join: "joined" }))}>加入済み</button>
          <button className={`chip ${filters.join === "not_joined" ? "active" : ""}`} onClick={() => setFilters((f) => ({ ...f, join: "not_joined" }))}>未加入</button>
          <div className="filter-sep" />

          {/* 生徒情報フィルタ */}
          <button
            className={`chip filter-popup-trigger ${activeFilterCount > 0 ? "active" : ""}`}
            onClick={openFilterPopup}
          >
            🔍 生徒情報フィルタ
            {activeFilterCount > 0 && <span className="filter-active-badge">{activeFilterCount}</span>}
          </button>

          {/* マイセット */}
          <button className="chip" onClick={() => setMySetPopupOpen(true)}>
            🗂 マイセット登録/表示
          </button>

          {/* フィルタリセット */}
          <button className="btn-filter-reset" onClick={() => setFilterResetConfirmOpen(true)}>フィルタリセット</button>
        </div>

        {/* アクティブマイセット表示 */}
        {activeMySet && (
          <div className="myset-active-bar">
            <span className="myset-active-chip">
              📌 {activeMySet.name}（{activeMySet.studentNames.length}名）
              <button className="myset-active-chip-close" onClick={deactivateMySet} title="解除">×</button>
            </span>
          </div>
        )}
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: 8 }}>{error}</div>}

      <div className="table-container">
        <table className="student-table">
          <thead>
            <tr>
              <th colSpan={10} className="th-group th-group-status">生徒育成状況</th>
              <th colSpan={6} className="th-group th-group-info">生徒情報</th>
              <th className="th-group th-group-op" />
            </tr>
            <tr>
              <th className={`sortable ${sortKey === "name" ? "sort-active" : ""}`} onClick={() => handleSort("name")}>生徒名{sortIcon("name")}</th>
              <th>加入状況</th>
              <th className={`col-center sortable ${sortKey === "limit_break" ? "sort-active" : ""}`} onClick={() => handleSort("limit_break")}>凸/固有{sortIcon("limit_break")}</th>
              <th className={`col-center sortable ${sortKey === "bond_level" ? "sort-active" : ""}`} onClick={() => handleSort("bond_level")}>絆{sortIcon("bond_level")}</th>
              <th className={`col-center sortable ${sortKey === "equip" ? "sort-active" : ""}`} onClick={() => handleSort("equip")}>装備1{sortIcon("equip")}</th>
              <th className="col-center">装備2</th>
              <th className="col-center">装備3</th>
              <th className="col-center">WB-HP</th>
              <th className="col-center">WB-攻撃力</th>
              <th className="col-center">WB-治癒力</th>
              <th className="col-sep col-center">学校</th>
              <th className="col-center">役割</th>
              <th className="col-center">攻撃タイプ</th>
              <th className="col-center">防御タイプ</th>
              <th className="col-center">クラス</th>
              <th className="col-center">ポジション</th>
              <th className="col-sep col-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.id}>
                <td className="name-cell"><StudentIcon name={s.name} />{s.name}</td>
                <td>
                  <span className={`join-badge ${s.is_joined ? "yes" : "no"}`}>
                    {s.is_joined ? "加入済み" : "未加入"}
                  </span>
                </td>
                <td className="num-cell"><Stars value={s.limit_break} /></td>
                <td className="num-cell">{s.bond_level ?? "—"}</td>
                <td className="num-cell">{s.is_joined ? <EquipBadge value={s.equip1} /> : "—"}</td>
                <td className="num-cell">{s.is_joined ? <EquipBadge value={s.equip2} /> : "—"}</td>
                <td className="num-cell">{s.is_joined ? <EquipBadge value={s.equip3} /> : "—"}</td>
                <td className="num-cell">{s.is_joined ? <WbVal value={s.wb_hp} /> : "—"}</td>
                <td className="num-cell">{s.is_joined ? <WbVal value={s.wb_atk} /> : "—"}</td>
                <td className="num-cell">{s.is_joined ? <WbVal value={s.wb_heal} /> : "—"}</td>
                <td className="num-cell td-sep" style={{ fontSize: 11 }}>{s.school ?? "—"}</td>
                <td className="num-cell"><InfoBadge value={s.role} cls={ROLE_CLASS[s.role ?? ""] ?? "ib-striker"} /></td>
                <td className="num-cell"><InfoBadge value={s.atk_type} cls={ATK_CLASS[s.atk_type ?? ""] ?? "ib-bakuhatsu"} /></td>
                <td className="num-cell"><InfoBadge value={s.def_type} cls={DEF_CLASS[s.def_type ?? ""] ?? "ib-kei"} /></td>
                <td className="num-cell"><InfoBadge value={s.student_class} cls={CLS_CLASS[s.student_class ?? ""] ?? "ib-atker"} /></td>
                <td className="num-cell"><InfoBadge value={s.position} cls={POS_CLASS[s.position ?? ""] ?? "ib-middle"} /></td>
                <td className="action-cell td-sep">
                  {s.is_joined && <button className="btn-xs" onClick={() => setResetTarget(s)}>リセット</button>}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && !loading && (
              <tr><td colSpan={17} className="no-data">該当する生徒がいません</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 生徒情報フィルタ ポップアップ */}
      {filterPopupOpen && (
        <div className="modal-overlay" onClick={() => setFilterPopupOpen(false)}>
          <div className="filter-popup" onClick={(e) => e.stopPropagation()}>
            <div className="filter-popup-header">
              <h3>生徒情報フィルタ</h3>
              <button className="filter-popup-close" onClick={() => setFilterPopupOpen(false)}>✕</button>
            </div>
            <div className="filter-popup-body">
              {schoolOptions.length > 0 && (
                <div className="filter-popup-section">
                  <div className="filter-popup-section-label">学校</div>
                  <div className="filter-popup-chips">
                    {schoolOptions.map((v) => (
                      <button key={v} className={`chip ${pending.schools.includes(v) ? "active" : ""}`} onClick={() => togglePending("schools", v)}>{v}</button>
                    ))}
                  </div>
                </div>
              )}
              {[
                { label: "役割", key: "roles" as const, options: ROLE_OPTIONS },
                { label: "攻撃タイプ", key: "atk_types" as const, options: ATK_OPTIONS },
                { label: "防御タイプ", key: "def_types" as const, options: DEF_OPTIONS },
                { label: "クラス", key: "classes" as const, options: CLASS_OPTIONS },
                { label: "ポジション", key: "positions" as const, options: POS_OPTIONS },
              ].map(({ label, key, options }) => (
                <div key={key} className="filter-popup-section">
                  <div className="filter-popup-section-label">{label}</div>
                  <div className="filter-popup-chips">
                    {options.map((v) => (
                      <button key={v} className={`chip ${pending[key].includes(v) ? "active" : ""}`} onClick={() => togglePending(key, v)}>{v}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="filter-popup-footer">
              <button className="btn-secondary" onClick={() => setPending(EMPTY_POPUP)}>選択リセット</button>
              <button className="btn-primary" onClick={applyFilterPopup}>フィルタする</button>
            </div>
          </div>
        </div>
      )}

      {/* マイセットポップアップ */}
      {mySetPopupOpen && (
        <MySetPopup
          mySets={mySets}
          activeMySetId={activeMySetId}
          allStudentNames={allStudentNames}
          onClose={() => setMySetPopupOpen(false)}
          onActivate={activateMySet}
          onDelete={deleteMySet}
          onRegister={registerMySet}
          onUpdate={updateMySet}
        />
      )}

      {/* フィルタリセット確認 */}
      {filterResetConfirmOpen && (
        <div className="modal-overlay" onClick={() => setFilterResetConfirmOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>フィルタをリセット</h3>
            <p>名前・加入状況・生徒情報フィルタ・マイセットの選択をすべてリセットします。よろしいですか？</p>
            <div className="modal-actions">
              <button className="btn-danger" onClick={() => { resetAllFilters(); setFilterResetConfirmOpen(false); }}>リセットする</button>
              <button className="btn-secondary" onClick={() => setFilterResetConfirmOpen(false)}>キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* 育成状況リセット確認 */}
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
