"""완납증명서 관리 API (4대보험, 국세, 지방세)"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date
from typing import Optional

from database import get_db
from models.tax_clearances import TaxClearance

router = APIRouter(prefix="/api/tax-clearances", tags=["완납증명서"])


class TaxClearanceIn(BaseModel):
    clearance_type: str
    sub_type: Optional[str] = None
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    issuer: Optional[str] = None
    cert_number: Optional[str] = None
    file_path: Optional[str] = None
    memo: Optional[str] = None
    status: str = "유효"


class TaxClearanceOut(TaxClearanceIn):
    id: int
    model_config = {"from_attributes": True}


@router.get("/", response_model=list[TaxClearanceOut])
def list_tax_clearances(db: Session = Depends(get_db)):
    return db.query(TaxClearance).order_by(TaxClearance.expiry_date).all()


@router.post("/", response_model=TaxClearanceOut)
def create_tax_clearance(data: TaxClearanceIn, db: Session = Depends(get_db)):
    row = TaxClearance(**data.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{item_id}", response_model=TaxClearanceOut)
def get_tax_clearance(item_id: int, db: Session = Depends(get_db)):
    row = db.get(TaxClearance, item_id)
    if not row:
        raise HTTPException(404, "완납증명서를 찾을 수 없습니다")
    return row


@router.put("/{item_id}", response_model=TaxClearanceOut)
def update_tax_clearance(item_id: int, data: TaxClearanceIn, db: Session = Depends(get_db)):
    row = db.get(TaxClearance, item_id)
    if not row:
        raise HTTPException(404, "완납증명서를 찾을 수 없습니다")
    for k, v in data.model_dump().items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{item_id}")
def delete_tax_clearance(item_id: int, db: Session = Depends(get_db)):
    row = db.get(TaxClearance, item_id)
    if not row:
        raise HTTPException(404, "완납증명서를 찾을 수 없습니다")
    db.delete(row)
    db.commit()
    return {"message": "삭제되었습니다"}
