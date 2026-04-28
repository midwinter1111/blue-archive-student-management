import { useState, useEffect } from "react";
import RegisterMode from "./components/RegisterMode";
import ListView from "./components/ListView";
import DebugView from "./components/DebugView";
import { checkStatus } from "./api";

type Tab = "register" | "list" | "debug";

function SchaleLogo() {
  return (
    <svg viewBox="0 0 44 44" width="36" height="36" fill="none" stroke="currentColor"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="22" cy="8" rx="7" ry="2.5" strokeWidth="1.5" opacity="0.65" />
      <line x1="2" y1="24" x2="42" y2="24" strokeWidth="1" opacity="0.45" />
      <line x1="22" y1="11" x2="22" y2="44" strokeWidth="1" opacity="0.45" />
      <circle cx="22" cy="24" r="14" strokeWidth="1.5" />
      <circle cx="22" cy="24" r="8" strokeWidth="1" opacity="0.6" />
      <polygon points="22,11 25,24 22,37 19,24" strokeWidth="1" opacity="0.65" />
      <line x1="22" y1="10.5" x2="22" y2="13.5" strokeWidth="2" />
      <line x1="22" y1="34.5" x2="22" y2="37.5" strokeWidth="2" />
      <line x1="7.5" y1="24" x2="10.5" y2="24" strokeWidth="2" />
      <line x1="33.5" y1="24" x2="36.5" y2="24" strokeWidth="2" />
      <circle cx="22" cy="24" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

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
        <div className="header-logo">
          <SchaleLogo />
        </div>
        <div className="header-title">
          <h1>ブルアカ生徒育成状況管理</h1>
          <p>Blue Archive Students Manager</p>
        </div>
        <div className="header-right">
          <div className="game-status">
            <span className={`status-dot ${gameFound === true ? "ok" : gameFound === false ? "ng" : "unknown"}`} />
            <span>
              {gameFound === true
                ? `ゲーム検出中${windowSize ? ` (${windowSize.width}×${windowSize.height})` : ""}`
                : gameFound === false
                ? "ゲーム未検出"
                : "確認中…"}
            </span>
          </div>
        </div>
      </header>

      <nav className="tab-nav">
        <button className={`tab-btn ${tab === "list" ? "active" : ""}`} onClick={() => setTab("list")}>
          一覧
        </button>
        <button className={`tab-btn ${tab === "register" ? "active" : ""}`} onClick={() => setTab("register")}>
          登録
        </button>
        <button className={`tab-btn ${tab === "debug" ? "active" : ""}`} onClick={() => setTab("debug")}>
          デバッグ
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
