"""차량 관리 모델"""

from sqlalchemy import Column, Integer, String, Date, Text
from database import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    plate_number = Column(String(20), nullable=False)     # 차량번호
    vehicle_name = Column(String(100), nullable=False)    # 차종
    owner = Column(String(100))                           # 소유자/사용자
    lease_company = Column(String(200))                   # 리스/렌탈 회사
    lease_start = Column(Date)                            # 리스 시작일
    lease_end = Column(Date)                              # 리스 종료일
    insurance_company = Column(String(200))               # 보험회사
    insurance_expiry = Column(Date)                       # 보험 만료일
    inspection_date = Column(Date)                        # 정기검사일
    file_path = Column(String(500))                       # 첨부파일 경로
    memo = Column(Text)                                   # 비고
    status = Column(String(20), default="운행중")          # 운행중, 정비중, 반납
