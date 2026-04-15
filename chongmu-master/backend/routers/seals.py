"""직인/사용인감 관리 API"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date
from typing import Optional

from database import get_db
from models.seals import Seal

router = APIRouter(prefix="/api/seals", tags=["직인/생인"])


class SealIn(BaseModel):
    seal_type: str
    seal_name: str
    holder: Optional[str] = None
    purpose: Optional[str] = None
    register_date: Optional[date] = None
    image_path: Optional[str] = None
    file_path: Optional[str] = None
    memo: Optional[str] = None
    status: str = "사용중"


class SealOut(SealIn):
    id: int
    model_config = {"from_attributes": True}


@router.get("/", response_model=list[SealOut])
def list_seals(db: Session = Depends(get_db)):
    return db.query(Seal).order_by(Seal.id.desc()).all()


@router.post("/", response_model=SealOut)
def create_seal(data: SealIn, db: Session = Depends(get_db)):
    row = Seal(**data.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{item_id}", response_model=SealOut)
def get_seal(item_id: int, db: Session = Depends(get_db)):
    row = db.get(Seal, item_id)
    if not row:
        raise HTTPException(404, "직인/생인을 찾을 수 없습니다")
    return row


@router.put("/{item_id}", response_model=SealOut)
def update_seal(item_id: int, data: SealIn, db: Session = Depends(get_db)):
    row = db.get(Seal, item_id)
    if not row:
        raise HTTPException(404, "직인/생인을 찾을 수 없습니다")
    for k, v in data.model_dump().items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{item_id}")
def delete_seal(item_id: int, db: Session = Depends(get_db)):
    row = db.get(Seal, item_id)
    if not row:
        raise HTTPException(404, "직인/생인을 찾을 수 없습니다")
    db.delete(row)
    db.commit()
    return {"message": "삭제되었습니다"}
