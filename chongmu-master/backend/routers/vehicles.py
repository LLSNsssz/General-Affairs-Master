"""차량 관리 API"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date
from typing import Optional

from database import get_db
from models.vehicles import Vehicle

router = APIRouter(prefix="/api/vehicles", tags=["차량"])


class VehicleIn(BaseModel):
    plate_number: str
    vehicle_name: str
    owner: Optional[str] = None
    lease_company: Optional[str] = None
    lease_start: Optional[date] = None
    lease_end: Optional[date] = None
    insurance_company: Optional[str] = None
    insurance_expiry: Optional[date] = None
    inspection_date: Optional[date] = None
    file_path: Optional[str] = None
    memo: Optional[str] = None
    status: str = "운행중"


class VehicleOut(VehicleIn):
    id: int
    model_config = {"from_attributes": True}


@router.get("/", response_model=list[VehicleOut])
def list_vehicles(db: Session = Depends(get_db)):
    return db.query(Vehicle).order_by(Vehicle.id.desc()).all()


@router.post("/", response_model=VehicleOut)
def create_vehicle(data: VehicleIn, db: Session = Depends(get_db)):
    row = Vehicle(**data.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{item_id}", response_model=VehicleOut)
def get_vehicle(item_id: int, db: Session = Depends(get_db)):
    row = db.get(Vehicle, item_id)
    if not row:
        raise HTTPException(404, "차량을 찾을 수 없습니다")
    return row


@router.put("/{item_id}", response_model=VehicleOut)
def update_vehicle(item_id: int, data: VehicleIn, db: Session = Depends(get_db)):
    row = db.get(Vehicle, item_id)
    if not row:
        raise HTTPException(404, "차량을 찾을 수 없습니다")
    for k, v in data.model_dump().items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{item_id}")
def delete_vehicle(item_id: int, db: Session = Depends(get_db)):
    row = db.get(Vehicle, item_id)
    if not row:
        raise HTTPException(404, "차량을 찾을 수 없습니다")
    db.delete(row)
    db.commit()
    return {"message": "삭제되었습니다"}
