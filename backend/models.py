from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class StudentResponse(BaseModel):
    id: int
    name: str
    is_joined: bool
    bond_level: Optional[int]
    wb_hp: Optional[int]
    wb_atk: Optional[int]
    wb_heal: Optional[int]
    skill_ex: Optional[int]
    skill_normal: Optional[int]
    skill_passive: Optional[int]
    skill_sub: Optional[int]
    limit_break: Optional[int]
    equip1: Optional[int]
    equip2: Optional[int]
    equip3: Optional[int]
    updated_at: Optional[datetime]

    # 表示用フィールド
    limit_break_display: Optional[str]
    skill_ex_display: Optional[str]
    skill_normal_display: Optional[str]
    skill_passive_display: Optional[str]
    skill_sub_display: Optional[str]

    class Config:
        from_attributes = True


class StudentUpdate(BaseModel):
    bond_level: Optional[int] = None
    wb_hp: Optional[int] = None
    wb_atk: Optional[int] = None
    wb_heal: Optional[int] = None
    skill_ex: Optional[int] = None
    skill_normal: Optional[int] = None
    skill_passive: Optional[int] = None
    skill_sub: Optional[int] = None
    limit_break: Optional[int] = None
    equip1: Optional[int] = None
    equip2: Optional[int] = None
    equip3: Optional[int] = None


class StudentCreate(BaseModel):
    name: str


class CaptureResult(BaseModel):
    detected: bool
    name: Optional[str]
    bond_level: Optional[int]
    wb_hp: Optional[int]
    wb_atk: Optional[int]
    wb_heal: Optional[int]
    skill_ex: Optional[int]
    skill_normal: Optional[int]
    skill_passive: Optional[int]
    skill_sub: Optional[int]
    limit_break: Optional[int]
    equip1: Optional[int]
    equip2: Optional[int]
    equip3: Optional[int]


class FilterParams(BaseModel):
    joined_only: bool = False
    not_joined_only: bool = False
    skill_not_max: bool = False
    equip_not_t10: bool = False
    limit_break_min: Optional[int] = None
    limit_break_max: Optional[int] = None
    name: Optional[str] = None
