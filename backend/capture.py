import ctypes

# DPIスケーリング対策: pywin32とmssの座標系を物理ピクセルで統一する
try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)  # PROCESS_PER_MONITOR_DPI_AWARE
except Exception:
    try:
        ctypes.windll.user32.SetProcessDPIAware()
    except Exception:
        pass

import mss
import numpy as np
import win32api
import win32gui
import win32process

WINDOW_TITLE = "ブルーアーカイブ"

# ブラウザプロセス名（誤検出除外用）
_BROWSER_PROCESSES = {
    "chrome.exe", "msedge.exe", "firefox.exe",
    "brave.exe", "opera.exe", "vivaldi.exe",
    "iexplore.exe", "safari.exe",
}


def _get_process_name(hwnd: int) -> str:
    """ウィンドウハンドルからプロセス名（小文字）を取得する"""
    try:
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        handle = win32api.OpenProcess(0x0410, False, pid)  # QUERY_INFO | VM_READ
        path = win32process.GetModuleFileNameEx(handle, 0)
        win32api.CloseHandle(handle)
        return path.split("\\")[-1].lower()
    except Exception:
        return ""


def list_matching_windows() -> list[dict]:
    """
    タイトルに WINDOW_TITLE を含む可視ウィンドウを列挙して返す。
    デバッグ・ウィンドウ選択UIに使用。
    """
    results: list[dict] = []

    def callback(hwnd, _):
        if not win32gui.IsWindowVisible(hwnd):
            return True
        title = win32gui.GetWindowText(hwnd)
        if not title:
            return True
        proc = _get_process_name(hwnd)
        if WINDOW_TITLE in title:
            results.append({
                "hwnd": hwnd,
                "title": title,
                "process": proc,
                "is_browser": proc in _BROWSER_PROCESSES,
            })
        return True

    win32gui.EnumWindows(callback, None)
    return results


def find_game_window() -> int | None:
    """
    タイトルに WINDOW_TITLE を含み、かつブラウザではないウィンドウを返す。
    ブラウザのタブタイトルによる誤検出を防ぐ。
    """
    candidates = list_matching_windows()
    if not candidates:
        return None

    # 非ブラウザを優先
    for c in candidates:
        if not c["is_browser"]:
            return c["hwnd"]

    # 全てブラウザの場合はフォールバックとして最初を返す
    return candidates[0]["hwnd"]


def get_client_rect(hwnd: int) -> tuple[int, int, int, int] | None:
    """クライアント領域をスクリーン物理座標で返す (left, top, right, bottom)"""
    try:
        left, top = win32gui.ClientToScreen(hwnd, (0, 0))
        client_rect = win32gui.GetClientRect(hwnd)
        width = client_rect[2]
        height = client_rect[3]
        return left, top, left + width, top + height
    except Exception:
        return None


def capture_game_window() -> np.ndarray | None:
    """ゲームウィンドウをキャプチャしてBGR numpy配列で返す。"""
    hwnd = find_game_window()
    if not hwnd:
        return None

    rect = get_client_rect(hwnd)
    if not rect:
        return None

    left, top, right, bottom = rect
    width = right - left
    height = bottom - top

    if width <= 0 or height <= 0:
        return None

    with mss.mss() as sct:
        monitor = {"top": top, "left": left, "width": width, "height": height}
        screenshot = sct.grab(monitor)
        img = np.array(screenshot)   # BGRA
        return img[:, :, :3]         # BGR


def get_window_size() -> tuple[int, int] | None:
    """クライアント領域のサイズ (width, height) を返す"""
    hwnd = find_game_window()
    if not hwnd:
        return None
    rect = get_client_rect(hwnd)
    if not rect:
        return None
    left, top, right, bottom = rect
    return right - left, bottom - top
