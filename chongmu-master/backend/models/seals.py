"""직인/사용인감 관리 모델"""

from sqlalchemy import Column, Integer, String, Date, Text
from database import Base


class Seal(Base):
    __tablename__ = "seals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    seal_type = Column(String(50), nullable=False)        # 직인, 사용인감, 법인인감
    seal_name = Column(String(200), nullable=False)       # 인감 명칭
    holder = Column(String(100))                          # 보관자
    purpose = Column(String(300))                         # 사용용도
    register_date = Column(Date)                          # 등록일
    image_path = Column(String(500))                      # 인감 이미지 경로
    file_path = Column(String(500))                       # 관련서류 경로
    memo = Column(Text)                                   # 비고
    status = Column(String(20), default="사용중")          # 사용중, 폐기, 분실
