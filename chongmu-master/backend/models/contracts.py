"""계약문서 관리 모델"""

from sqlalchemy import Column, Integer, String, Date, Text
from database import Base


class Contract(Base):
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    contract_type = Column(String(50), nullable=False)    # 임대차, 용역, 구매, 유지보수 등
    title = Column(String(300), nullable=False)           # 계약명
    counterpart = Column(String(200))                     # 계약상대방
    contract_amount = Column(String(50))                  # 계약금액
    start_date = Column(Date)                             # 계약 시작일
    end_date = Column(Date)                               # 계약 종료일
    auto_renew = Column(String(10), default="N")          # 자동갱신 여부
    manager = Column(String(100))                         # 담당자
    file_path = Column(String(500))                       # 계약서 파일 경로
    memo = Column(Text)                                   # 비고
    status = Column(String(20), default="진행중")          # 진행중, 만료, 해지
