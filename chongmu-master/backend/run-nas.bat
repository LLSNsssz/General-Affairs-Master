@echo off
REM 총무 마스터 실행 스크립트 (NAS 저장 버전)
REM 사용법: 이 배치파일을 더블클릭하거나, NSSM 서비스에 등록

REM === 설정 ===
REM NAS 경로를 UNC로 직접 지정 (Windows 서비스에서도 동작)
REM 192.168.0.239 = Synology DS220j
set DATA_DIR=\\192.168.0.239\chongmu\data
set UPLOAD_DIR=\\192.168.0.239\chongmu\data\uploads
set PYTHONUNBUFFERED=1

REM === 실행 ===
cd /d "%~dp0"
python app.py
