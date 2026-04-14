"""인증서 관리 모델 (여성기업, 중소기업, 벤처기업 등)"""

from sqlalchemy import Column, Integer, String, Date, Text
from database import Base


class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cert_type = Column(String(50), nullable=False)       # 여성기업, 중소기업, 벤처기업 등
    cert_name = Column(String(200), nullable=False)       # 인증서 명칭
    issuer = Column(String(200))                          # 발급기관
    cert_number = Column(String(100))                     # 인증번호
    issue_date = Column(Date)                             # 발급일
    expiry_date = Column(Date)                            # 만료일
    file_path = Column(String(500))                       # 첨부파일 경로
    memo = Column(Text)                                   # 비고
    status = Column(String(20), default="유효")            # 유효, 만료, 갱신필요
