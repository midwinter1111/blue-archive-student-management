import { useState, useEffect } from "react";
import RegisterMode from "./components/RegisterMode";
import ListView from "./components/ListView";
import DebugView from "./components/DebugView";
import { checkStatus } from "./api";

type Tab = "register" | "list" | "debug";

export default function App() {
  const [tab, setTab] = useState<Tab>("list");
  const [gameFound, setGameFound] = useState<boolean | null>(null);
  const [windowSize, setWindowSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const update = () => {
      checkStatus()
        .then((s) => {
          setGameFound(s.game_window_found);
          setWindowSize(s.window_size);
        })
        .catch(() => setGameFound(false));
    };
    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app">
      <header className="header">
        <div className="header-title">
          <span className="header-icon">🎓</span>
          <h1>ブルアカ育成管理</h1>
        </div>
        <div className="header-status">
          <span className={`status-dot ${gameFound === true ? "ok" : gameFound === false ? "ng" : "unknown"}`} />
          <span className="status-text">
            {gameFound === true
              ? `ゲーム検出中${windowSize ? ` (${windowSize.width}×${windowSize.height})` : ""}`
              : gameFound === false
              ? "ゲーム未検出"
              : "確認中…"}
          </span>
        </div>
      </header>

      <nav className="tab-nav">
        <button className={`tab-btn ${tab === "list" ? "active" : ""}`} onClick={() => setTab("list")}>
          📋 一覧
        </button>
        <button className={`tab-btn ${tab === "register" ? "active" : ""}`} onClick={() => setTab("register")}>
          📸 登録
        </button>
        <button className={`tab-btn ${tab === "debug" ? "active" : ""}`} onClick={() => setTab("debug")}>
          🔧 デバッグ
        </button>
      </nav>

      <main className="main-content">
        {tab === "register" && <RegisterMode />}
        {tab === "list" && <ListView />}
        {tab === "debug" && <DebugView />}
      </main>
    </div>
  );
}
