"""파일 업로드 + 파일명 자동 파싱 API"""

import re
import shutil
from datetime import datetime, date
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from config import UPLOAD_DIR
from models.certificates import Certificate
from models.vehicles import Vehicle
from models.tax_clearances import TaxClearance
from models.seals import Seal
from models.contracts import Contract

router = APIRouter(prefix="/api/upload", tags=["파일업로드"])

# ── 날짜 추출 ──
def extract_dates(name: str) -> list[date]:
    """파일명에서 날짜 패턴 추출
    지원 형식:
      - 2026년 05월 14일  (한글)
      - 2026년05월14일    (한글, 공백 없음)
      - 2026.05.14
      - 2026-05-14
      - 20260514
    """
    patterns = [
        # 한글 날짜: 2026년 05월 14일 / 2026년05월14일
        r'(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일',
        r'(\d{4})\.(\d{2})\.(\d{2})',
        r'(\d{4})-(\d{2})-(\d{2})',
        r'(\d{4})(\d{2})(\d{2})',
    ]
    dates = []
    for p in patterns:
        for m in re.finditer(p, name):
            try:
                d = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
                if 2020 <= d.year <= 2030:
                    dates.append(d)
            except ValueError:
                pass
    # 중복 제거 & 정렬
    return sorted(set(dates))


def extract_expiry_date(name: str):
    """'유효기간' 키워드 뒤의 날짜를 만료일로 추출"""
    m = re.search(r'유효기간\s*(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일', name)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            pass
    return None


def extract_company_name(name: str):
    """회사명 추출: (주)OOO, 주식회사OOO 등"""
    patterns = [
        r'\(주\)\s*(\S+)',          # (주)그린주의
        r'주식회사\s*(\S+)',         # 주식회사그린주의
        r'\(유\)\s*(\S+)',          # (유)OOO
    ]
    for p in patterns:
        m = re.search(p, name)
        if m:
            # 뒤에 붙는 키워드 제거
            company = m.group(0).split('4대')[0].split('국세')[0].split('지방세')[0]
            company = company.split('완납')[0].split('납세')[0].split('인증')[0].split('확인')[0]
            return company.strip()
    return None


# ── 카테고리 감지 ──
CATEGORY_RULES = {
    # 완납증명서
    "4대보험": {"category": "tax", "clearance_type": "4대보험", "sub_type": None},
    "국민연금": {"category": "tax", "clearance_type": "4대보험", "sub_type": "국민연금"},
    "건강보험": {"category": "tax", "clearance_type": "4대보험", "sub_type": "건강보험"},
    "고용보험": {"category": "tax", "clearance_type": "4대보험", "sub_type": "고용보험"},
    "산재보험": {"category": "tax", "clearance_type": "4대보험", "sub_type": "산재보험"},
    "국세": {"category": "tax", "clearance_type": "국세", "sub_type": None},
    "지방세": {"category": "tax", "clearance_type": "지방세", "sub_type": None},
    "완납": {"category": "tax", "clearance_type": "기타", "sub_type": None},
    "납세": {"category": "tax", "clearance_type": "기타", "sub_type": None},

    # 인증서
    "여성기업": {"category": "cert", "cert_type": "여성기업"},
    "중소기업": {"category": "cert", "cert_type": "중소기업"},
    "벤처기업": {"category": "cert", "cert_type": "벤처기업"},
    "이노비즈": {"category": "cert", "cert_type": "이노비즈"},
    "메인비즈": {"category": "cert", "cert_type": "메인비즈"},
    "ISO": {"category": "cert", "cert_type": "ISO"},
    "인증서": {"category": "cert", "cert_type": "기타"},
    "확인서": {"category": "cert", "cert_type": "기타"},

    # 차량
    "차량": {"category": "vehicle"},
    "자동차": {"category": "vehicle"},
    "리스": {"category": "vehicle"},
    "보험증권": {"category": "vehicle"},

    # 직인/생인
    "직인": {"category": "seal", "seal_type": "직인"},
    "사용인감": {"category": "seal", "seal_type": "사용인감"},
    "법인인감": {"category": "seal", "seal_type": "법인인감"},
    "인감": {"category": "seal", "seal_type": "기타"},

    # 계약
    "계약": {"category": "contract"},
    "임대차": {"category": "contract", "contract_type": "임대차"},
    "용역": {"category": "contract", "contract_type": "용역"},
    "유지보수": {"category": "contract", "contract_type": "유지보수"},
}


def detect_category(name: str) -> dict:
    """파일명에서 카테고리와 세부정보 감지 (구체적 키워드 우선)"""
    name_upper = name.upper()

    # 매칭된 모든 키워드 수집
    matches = []
    for keyword, info in CATEGORY_RULES.items():
        if keyword in name or keyword.upper() in name_upper:
            matches.append((keyword, info))

    if not matches:
        return {}

    # 긴 키워드(더 구체적) 우선 정렬
    matches.sort(key=lambda x: len(x[0]), reverse=True)

    # 가장 구체적인 매칭을 기본으로
    best_keyword, best_info = matches[0]
    result = {**best_info}

    # 같은 카테고리의 다른 매칭에서 세부정보 보강
    for keyword, info in matches[1:]:
        if info.get("category") == result.get("category"):
            for k, v in info.items():
                if v and k != "category" and not result.get(k):
                    result[k] = v

    return result


def extract_plate_number(name: str):
    """차량번호 추출 (예: 12가3456, 123가4567)"""
    m = re.search(r'(\d{2,3}[가-힣]\d{4})', name)
    return m.group(1) if m else None


@router.post("/")
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """파일 업로드 → 파일명 파싱 → 자동 등록"""

    original_name = file.filename
    stem = Path(original_name).stem  # 확장자 제거

    # 파일 저장
    save_path = UPLOAD_DIR / original_name
    # 중복 파일명 처리
    counter = 1
    while save_path.exists():
        save_path = UPLOAD_DIR / f"{stem}_{counter}{Path(original_name).suffix}"
        counter += 1

    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    file_path_str = str(save_path)

    # 파싱
    dates = extract_dates(stem)
    expiry = extract_expiry_date(stem)
    company = extract_company_name(stem)
    info = detect_category(stem)
    category = info.get("category", "unknown")

    result = {
        "file": original_name,
        "category": category,
        "parsed": info,
        "dates": [str(d) for d in dates],
        "expiry": str(expiry) if expiry else None,
        "company": company,
    }

    if category == "tax":
        # 유효기간 키워드가 있으면 만료일로 사용
        final_expiry = expiry or (dates[1] if len(dates) >= 2 else (dates[0] if len(dates) == 1 else None))
        # 유효기간이 만료일이면, 나머지 날짜 중 이전 날짜를 발급일로
        final_issue = None
        if expiry and dates:
            issue_candidates = [d for d in dates if d < expiry]
            if issue_candidates:
                final_issue = issue_candidates[0]
        elif len(dates) >= 2:
            final_issue = dates[0]

        row = TaxClearance(
            clearance_type=info.get("clearance_type", "기타"),
            sub_type=info.get("sub_type"),
            issue_date=final_issue,
            expiry_date=final_expiry,
            issuer=company,
            cert_number=None,
            file_path=file_path_str,
            memo=f"자동등록: {original_name}",
            status="유효",
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        result["id"] = row.id
        result["message"] = f"완납증명서 등록 완료 ({row.clearance_type} {row.sub_type or ''})"

    elif category == "cert":
        row = Certificate(
            cert_type=info.get("cert_type", "기타"),
            cert_name=stem,
            issuer=None,
            cert_number=None,
            issue_date=dates[0] if len(dates) >= 1 else None,
            expiry_date=dates[1] if len(dates) >= 2 else None,
            file_path=file_path_str,
            memo=f"자동등록: {original_name}",
            status="유효",
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        result["id"] = row.id
        result["message"] = f"인증서 등록 완료 ({row.cert_type})"

    elif category == "vehicle":
        plate = extract_plate_number(stem)
        row = Vehicle(
            plate_number=plate or "미확인",
            vehicle_name=stem,
            file_path=file_path_str,
            memo=f"자동등록: {original_name}",
            status="운행중",
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        result["id"] = row.id
        result["message"] = f"차량 등록 완료 ({row.plate_number})"

    elif category == "seal":
        row = Seal(
            seal_type=info.get("seal_type", "기타"),
            seal_name=stem,
            register_date=dates[0] if dates else None,
            file_path=file_path_str,
            memo=f"자동등록: {original_name}",
            status="사용중",
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        result["id"] = row.id
        result["message"] = f"직인/생인 등록 완료 ({row.seal_type})"

    elif category == "contract":
        row = Contract(
            contract_type=info.get("contract_type", "기타"),
            title=stem,
            start_date=dates[0] if len(dates) >= 1 else None,
            end_date=dates[1] if len(dates) >= 2 else None,
            file_path=file_path_str,
            memo=f"자동등록: {original_name}",
            status="진행중",
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        result["id"] = row.id
        result["message"] = f"계약문서 등록 완료 ({row.contract_type})"

    else:
        result["message"] = f"카테고리를 자동 감지하지 못했습니다. 파일은 저장되었습니다."

    return result


@router.post("/batch")
async def upload_batch(files: list[UploadFile] = File(...), db: Session = Depends(get_db)):
    """여러 파일 일괄 업로드"""
    results = []
    for file in files:
        r = await upload_file(file=file, db=db)
        results.append(r)
    return results
