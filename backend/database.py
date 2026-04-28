from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./bluearchive.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)

    # 育成状況（NULLなら未加入）
    bond_level = Column(Integer, nullable=True)         # 絆レベル
    wb_hp = Column(Integer, nullable=True)              # WorkBook HP 0-25
    wb_atk = Column(Integer, nullable=True)             # WorkBook 攻撃力 0-25
    wb_heal = Column(Integer, nullable=True)            # WorkBook 治癒力 0-25
    skill_ex = Column(Integer, nullable=True)           # EXスキル 1-10
    skill_normal = Column(Integer, nullable=True)       # ノーマルスキル 1-10
    skill_passive = Column(Integer, nullable=True)      # パッシブスキル 1-10
    skill_sub = Column(Integer, nullable=True)          # サブスキル 1-10
    # 凸/固有: 1-4=星1-4（固有なし）, 5-9=固有1-5
    limit_break = Column(Integer, nullable=True)
    equip1 = Column(Integer, nullable=True)             # 装備1 Tier 0-10
    equip2 = Column(Integer, nullable=True)             # 装備2 Tier 0-10
    equip3 = Column(Integer, nullable=True)             # 装備3 Tier 0-10
    updated_at = Column(DateTime, nullable=True)

    @property
    def is_joined(self) -> bool:
        return self.updated_at is not None

    def limit_break_display(self) -> str | None:
        if self.limit_break is None:
            return None
        if self.limit_break <= 4:
            return f"星{self.limit_break}"
        return f"固有{self.limit_break - 4}"

    def skill_display(self, val: int | None) -> str | None:
        if val is None:
            return None
        return "M" if val == 10 else str(val)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
