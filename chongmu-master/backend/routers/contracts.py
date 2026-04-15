"""계약문서 관리 API"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date
from typing import Optional

from database import get_db
from models.contracts import Contract

router = APIRouter(prefix="/api/contracts", tags=["계약문서"])


class ContractIn(BaseModel):
    order_number: Optional[str] = None
    institution: Optional[str] = None
    contract_type: str
    title: str
    counterpart: Optional[str] = None
    contract_amount: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    auto_renew: str = "N"
    manager: Optional[str] = None
    file_path: Optional[str] = None
    memo: Optional[str] = None
    status: str = "진행중"


class ContractOut(ContractIn):
    id: int
    model_config = {"from_attributes": True}


@router.get("/", response_model=list[ContractOut])
def list_contracts(db: Session = Depends(get_db)):
    return db.query(Contract).order_by(Contract.end_date.desc()).all()


@router.post("/", response_model=ContractOut)
def create_contract(data: ContractIn, db: Session = Depends(get_db)):
    row = Contract(**data.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{item_id}", response_model=ContractOut)
def get_contract(item_id: int, db: Session = Depends(get_db)):
    row = db.get(Contract, item_id)
    if not row:
        raise HTTPException(404, "계약문서를 찾을 수 없습니다")
    return row


@router.put("/{item_id}", response_model=ContractOut)
def update_contract(item_id: int, data: ContractIn, db: Session = Depends(get_db)):
    row = db.get(Contract, item_id)
    if not row:
        raise HTTPException(404, "계약문서를 찾을 수 없습니다")
    for k, v in data.model_dump().items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{item_id}")
def delete_contract(item_id: int, db: Session = Depends(get_db)):
    row = db.get(Contract, item_id)
    if not row:
        raise HTTPException(404, "계약문서를 찾을 수 없습니다")
    db.delete(row)
    db.commit()
    return {"message": "삭제되었습니다"}
