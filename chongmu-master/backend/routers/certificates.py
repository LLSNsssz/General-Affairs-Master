"""인증서 관리 API"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date
from typing import Optional

from database import get_db
from models.certificates import Certificate

router = APIRouter(prefix="/api/certificates", tags=["인증서"])


class CertificateIn(BaseModel):
    cert_type: str
    cert_name: str
    issuer: Optional[str] = None
    cert_number: Optional[str] = None
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    file_path: Optional[str] = None
    memo: Optional[str] = None
    status: str = "유효"


class CertificateOut(CertificateIn):
    id: int
    model_config = {"from_attributes": True}


@router.get("/", response_model=list[CertificateOut])
def list_certificates(db: Session = Depends(get_db)):
    return db.query(Certificate).order_by(Certificate.expiry_date).all()


@router.post("/", response_model=CertificateOut)
def create_certificate(data: CertificateIn, db: Session = Depends(get_db)):
    row = Certificate(**data.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{item_id}", response_model=CertificateOut)
def get_certificate(item_id: int, db: Session = Depends(get_db)):
    row = db.get(Certificate, item_id)
    if not row:
        raise HTTPException(404, "인증서를 찾을 수 없습니다")
    return row


@router.put("/{item_id}", response_model=CertificateOut)
def update_certificate(item_id: int, data: CertificateIn, db: Session = Depends(get_db)):
    row = db.get(Certificate, item_id)
    if not row:
        raise HTTPException(404, "인증서를 찾을 수 없습니다")
    for k, v in data.model_dump().items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{item_id}")
def delete_certificate(item_id: int, db: Session = Depends(get_db)):
    row = db.get(Certificate, item_id)
    if not row:
        raise HTTPException(404, "인증서를 찾을 수 없습니다")
    db.delete(row)
    db.commit()
    return {"message": "삭제되었습니다"}
