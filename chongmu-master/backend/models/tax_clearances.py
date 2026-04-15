"""완납증명서 관리 모델 (4대보험, 국세, 지방세)"""

from sqlalchemy import Column, Integer, String, Date, Text
from database import Base


class TaxClearance(Base):
    __tablename__ = "tax_clearances"

    id = Column(Integer, primary_key=True, autoincrement=True)
    clearance_type = Column(String(50), nullable=False)   # 4대보험, 국세, 지방세
    sub_type = Column(String(50))                         # 국민연금, 건강보험, 고용보험, 산재보험
    issue_date = Column(Date)                             # 발급일
    expiry_date = Column(Date)                            # 유효기간 만료일
    issuer = Column(String(200))                          # 발급기관
    cert_number = Column(String(100))                     # 증명번호
    file_path = Column(String(500))                       # 첨부파일 경로
    memo = Column(Text)                                   # 비고
    status = Column(String(20), default="유효")            # 유효, 만료, 갱신필요
    is_latest = Column(Integer, default=1)                 # 1=최신, 0=과거자료
