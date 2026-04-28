import { useState } from "react";
import { fetchDebugCapture, fetchDebugWindows, type WindowInfo } from "../api";

export default function DebugView() {
  const [captureLoading, setCaptureLoading] = useState(false);
  const [windowsLoading, setWindowsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captureResult, setCaptureResult] = useState<{
    width: number; height: number; image: string;
  } | null>(null);
  const [windowsResult, setWindowsResult] = useState<{
    target_title: string;
    detected_hwnd: number | null;
    windows: WindowInfo[];
  } | null>(null);

  const handleCapture = async () => {
    setCaptureLoading(true);
    setError(null);
    try {
      const data = await fetchDebugCapture();
      setCaptureResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "キャプチャに失敗しました");
    } finally {
      setCaptureLoading(false);
    }
  };

  const handleListWindows = async () => {
    setWindowsLoading(true);
    setError(null);
    try {
      const data = await fetchDebugWindows();
      setWindowsResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ウィンドウ一覧の取得に失敗しました");
    } finally {
      setWindowsLoading(false);
    }
  };

  return (
    <div className="debug-view">
      <div className="section-header">
        <h2>🔧 デバッグ</h2>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* ── ウィンドウ検出確認 ── */}
      <div className="debug-section">
        <h3 className="debug-section-title">① ウィンドウ検出確認</h3>
        <p className="debug-desc">
          タイトルに「ブルーアーカイブ」を含む全ウィンドウを一覧表示します。
          <br />
          ゲームが「検出対象」になっているか、ブラウザが誤検出されていないかを確認できます。
        </p>
        <button
          className="btn-secondary btn-sm"
          onClick={handleListWindows}
          disabled={windowsLoading}
        >
          {windowsLoading ? "取得中…" : "🔍 ウィンドウ一覧を取得"}
        </button>

        {windowsResult && (
          <div className="window-list">
            <p className="debug-size">
              検索タイトル: <code>{windowsResult.target_title}</code> &nbsp;|&nbsp;
              検出HWND: <code>{windowsResult.detected_hwnd ?? "なし"}</code>
            </p>
            {windowsResult.windows.length === 0 ? (
              <div className="alert alert-warn">
                「{windowsResult.target_title}」を含むウィンドウが見つかりません。
                ゲームが起動しているか確認してください。
              </div>
            ) : (
              <table className="student-table" style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th>HWND</th>
                    <th>ウィンドウタイトル</th>
                    <th>プロセス名</th>
                    <th>判定</th>
                  </tr>
                </thead>
                <tbody>
                  {windowsResult.windows.map((w) => {
                    const isSelected = w.hwnd === windowsResult.detected_hwnd;
                    return (
                      <tr key={w.hwnd} className={isSelected ? "row-selected" : ""}>
                        <td className="num-cell">{w.hwnd}</td>
                        <td>{w.title}</td>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>{w.process || "（取得不可）"}</td>
                        <td>
                          {isSelected ? (
                            <span className="badge-joined">✓ キャプチャ対象</span>
                          ) : w.is_browser ? (
                            <span className="badge-not-joined">ブラウザ（除外）</span>
                          ) : (
                            <span className="badge-not-joined">対象外</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {windowsResult.windows.some((w) => w.is_browser && w.hwnd === windowsResult.detected_hwnd) && (
              <div className="alert alert-warn" style={{ marginTop: 8 }}>
                ⚠️ ブラウザが誤検出されています。ゲームを起動してから再度確認してください。
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 座標確認 ── */}
      <div className="debug-section">
        <h3 className="debug-section-title">② 座標確認（ROIビジュアライズ）</h3>
        <p className="debug-desc">
          ゲームで生徒の「基本情報」画面を開いた状態でキャプチャすると、
          各データの読み取り領域（ROI）がカラーボックスで表示されます。
          <br />
          ボックスがズレている場合は <code>backend/extractor.py</code> の <code>COORDS</code> を調整してください。
        </p>
        <div className="debug-legend">
          <span style={{ color: "#00ff00" }}>■</span> 生徒名&nbsp;
          <span style={{ color: "#ff8c00" }}>■</span> 絆&nbsp;
          <span style={{ color: "#ff00ff" }}>■</span> スキル&nbsp;
          <span style={{ color: "#ffff00" }}>■</span> 固有星&nbsp;
          <span style={{ color: "#8000ff" }}>■</span> 装備&nbsp;
          <span style={{ color: "#0064ff" }}>■</span> WB&nbsp;
          <span style={{ color: "#b4b4b4" }}>■</span> タブ判定
        </div>
        <button
          className="btn-primary btn-sm"
          onClick={handleCapture}
          disabled={captureLoading}
          style={{ marginTop: 10 }}
        >
          {captureLoading ? "取得中…" : "📸 デバッグキャプチャ"}
        </button>

        {captureResult && (
          <div className="debug-result">
            <p className="debug-size">
              キャプチャ解像度: <strong>{captureResult.width} × {captureResult.height} px</strong>
              &nbsp;（基準解像度: 1456 × 784 px）
            </p>
            {(captureResult.width !== 1456 || captureResult.height !== 784) && (
              <div className="alert alert-warn">
                解像度が基準値と異なります。スケール X={`${(captureResult.width / 1456).toFixed(3)}`} Y={`${(captureResult.height / 784).toFixed(3)}`} でROIが自動調整されます。
              </div>
            )}
            <img
              src={captureResult.image}
              alt="debug capture"
              className="debug-image"
            />
          </div>
        )}
      </div>
    </div>
  );
}
