import base64
import io
import threading
from datetime import datetime
from typing import Optional

import cv2
import keyboard
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image as PILImage
from sqlalchemy.orm import Session

import capture as cap
import extractor as ext
from database import Student, SessionLocal, init_db, get_db
from models import (
    StudentResponse,
    StudentUpdate,
    StudentCreate,
    CaptureResult,
)
from students_master import STUDENTS_MASTER

app = FastAPI(title="ブルーアーカイブ育成管理")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 最新キャプチャ結果（ホットキー → フロントエンドへの橋渡し）
_pending_capture: Optional[CaptureResult] = None
_pending_lock = threading.Lock()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 起動処理
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.on_event("startup")
def startup_event():
    init_db()
    _seed_students()
    _register_hotkey()
    print("✅ サーバー起動完了")
    print("📸 ホットキー Ctrl+Shift+S でキャプチャ")


def _seed_students():
    db = SessionLocal()
    try:
        for name in STUDENTS_MASTER:
            if not db.query(Student).filter(Student.name == name).first():
                db.add(Student(name=name))
        db.commit()
    finally:
        db.close()


def _do_capture():
    global _pending_capture
    image = cap.capture_game_window()
    if image is None:
        print("⚠️  ゲームウィンドウが見つかりません")
        return
    data = ext.extract_student_data(image)
    with _pending_lock:
        _pending_capture = CaptureResult(**data)
    print(f"📸 キャプチャ完了: {data.get('name', '不明')}")


def _register_hotkey():
    keyboard.add_hotkey("ctrl+shift+s", _do_capture)
    print("⌨️  Ctrl+Shift+S でキャプチャ開始")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ヘルパー
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _to_response(student: Student) -> StudentResponse:
    return StudentResponse(
        id=student.id,
        name=student.name,
        is_joined=student.is_joined,
        bond_level=student.bond_level,
        wb_hp=student.wb_hp,
        wb_atk=student.wb_atk,
        wb_heal=student.wb_heal,
        skill_ex=student.skill_ex,
        skill_normal=student.skill_normal,
        skill_passive=student.skill_passive,
        skill_sub=student.skill_sub,
        limit_break=student.limit_break,
        equip1=student.equip1,
        equip2=student.equip2,
        equip3=student.equip3,
        updated_at=student.updated_at,
        limit_break_display=student.limit_break_display(),
        skill_ex_display=student.skill_display(student.skill_ex),
        skill_normal_display=student.skill_display(student.skill_normal),
        skill_passive_display=student.skill_display(student.skill_passive),
        skill_sub_display=student.skill_display(student.skill_sub),
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# キャプチャ API
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.post("/api/capture/trigger", response_model=CaptureResult)
def trigger_capture():
    """手動でキャプチャを実行する（ホットキーの代替）"""
    _do_capture()
    with _pending_lock:
        if _pending_capture is None:
            raise HTTPException(status_code=503, detail="ゲームウィンドウが見つかりません")
        return _pending_capture


@app.get("/api/capture/pending", response_model=Optional[CaptureResult])
def get_pending_capture():
    """ホットキーで発火したキャプチャ結果を取得する"""
    with _pending_lock:
        return _pending_capture


@app.delete("/api/capture/pending")
def clear_pending_capture():
    global _pending_capture
    with _pending_lock:
        _pending_capture = None
    return {"ok": True}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 生徒 API
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.get("/api/students", response_model=list[StudentResponse])
def list_students(
    name: Optional[str] = Query(None),
    joined_only: bool = Query(False),
    not_joined_only: bool = Query(False),
    skill_not_max: bool = Query(False),
    equip_not_t10: bool = Query(False),
    limit_break_min: Optional[int] = Query(None),
    limit_break_max: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Student)

    if name:
        q = q.filter(Student.name.contains(name))
    if joined_only:
        q = q.filter(Student.updated_at.isnot(None))
    if not_joined_only:
        q = q.filter(Student.updated_at.is_(None))
    if skill_not_max:
        q = q.filter(
            (Student.skill_ex < 10)
            | (Student.skill_normal < 10)
            | (Student.skill_passive < 10)
            | (Student.skill_sub < 10)
        ).filter(Student.updated_at.isnot(None))
    if equip_not_t10:
        q = q.filter(
            (Student.equip1 < 10)
            | (Student.equip2 < 10)
            | (Student.equip3 < 10)
        ).filter(Student.updated_at.isnot(None))
    if limit_break_min is not None:
        q = q.filter(Student.limit_break >= limit_break_min)
    if limit_break_max is not None:
        q = q.filter(Student.limit_break <= limit_break_max)

    students = q.order_by(Student.name).all()
    return [_to_response(s) for s in students]


@app.get("/api/students/{student_id}", response_model=StudentResponse)
def get_student(student_id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="生徒が見つかりません")
    return _to_response(student)


@app.put("/api/students/{student_id}", response_model=StudentResponse)
def update_student(
    student_id: int, data: StudentUpdate, db: Session = Depends(get_db)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="生徒が見つかりません")

    for field, val in data.model_dump(exclude_none=True).items():
        setattr(student, field, val)
    student.updated_at = datetime.now()
    db.commit()
    db.refresh(student)
    return _to_response(student)


@app.post("/api/students", response_model=StudentResponse)
def create_student(data: StudentCreate, db: Session = Depends(get_db)):
    """マスターリストにない生徒を手動追加する"""
    if db.query(Student).filter(Student.name == data.name).first():
        raise HTTPException(status_code=409, detail="すでに登録済みです")
    student = Student(name=data.name)
    db.add(student)
    db.commit()
    db.refresh(student)
    return _to_response(student)


@app.delete("/api/students/{student_id}/status")
def reset_student_status(student_id: int, db: Session = Depends(get_db)):
    """育成状況をリセット（未加入状態に戻す）"""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="生徒が見つかりません")

    for field in [
        "bond_level", "wb_hp", "wb_atk", "wb_heal",
        "skill_ex", "skill_normal", "skill_passive", "skill_sub",
        "limit_break", "equip1", "equip2", "equip3", "updated_at",
    ]:
        setattr(student, field, None)
    db.commit()
    return {"ok": True}


@app.get("/api/master/students", response_model=list[str])
def get_master_students():
    return sorted(STUDENTS_MASTER)


@app.get("/api/status")
def health_check():
    window = cap.find_game_window()
    size = cap.get_window_size()
    return {
        "ok": True,
        "game_window_found": bool(window),
        "window_size": {"width": size[0], "height": size[1]} if size else None,
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# デバッグ API
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _image_to_base64_jpeg(bgr_image) -> str:
    rgb = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2RGB)
    pil_img = PILImage.fromarray(rgb)
    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG", quality=80)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


@app.get("/api/debug/windows")
def debug_list_windows():
    """
    タイトルに「ブルーアーカイブ」を含む全ウィンドウを列挙する。
    ゲームウィンドウの誤検出確認に使用する。
    """
    windows = cap.list_matching_windows()
    detected_hwnd = cap.find_game_window()
    return {
        "target_title": cap.WINDOW_TITLE,
        "detected_hwnd": detected_hwnd,
        "windows": windows,
    }


@app.get("/api/debug/capture")
def debug_capture_view():
    """
    ゲームウィンドウをキャプチャし、ROI座標をボックス描画した画像をBase64 JPEGで返す。
    座標がずれていないかの確認に使用する。
    """
    image = cap.capture_game_window()
    if image is None:
        raise HTTPException(status_code=503, detail="ゲームウィンドウが見つかりません")

    h, w = image.shape[:2]
    debug_img = ext.get_debug_image(image)

    return {
        "width": w,
        "height": h,
        "image": _image_to_base64_jpeg(debug_img),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
