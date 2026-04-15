# 총무 마스터 — NAS 배포 가이드

Docker 지원 NAS(Synology, QNAP, Asustor 등)에서 사내 공유 서버로 돌리는 방법.

## 사전 준비

- Docker / Container 지원 NAS 기종
- Synology: **DSM 7.2+ / Container Manager** 설치
- QNAP: **Container Station** 설치
- SSH 접속 가능하면 편함 (없어도 GUI로 가능)

## 경로 정하기

NAS에 공유폴더를 하나 만들어 그 안에 데이터와 코드를 둡니다.

예시 (Synology 기준):
```
/volume1/docker/chongmu/        ← 소스 코드 (git clone)
/volume1/docker/chongmu/data/   ← DB + 업로드 파일 (자동 생성)
```

QNAP:
```
/share/Container/chongmu/
/share/Container/chongmu/data/
```

## 설치 순서

### 1. 소스 가져오기

NAS SSH로 접속해서:
```bash
cd /volume1/docker
git clone <이 저장소 주소> chongmu
cd chongmu/chongmu-master
```

또는 GUI에서 zip 받아 해당 폴더에 업로드.

### 2. 데이터 폴더 경로 확인

`docker-compose.yml`의 볼륨 부분이 기본 `./data:/data`로 되어 있습니다.
NAS 공유폴더를 별도로 쓰려면 수정:

```yaml
volumes:
  - /volume1/chongmu-data:/data      # Synology 예시
  - /share/chongmu-data:/data        # QNAP 예시
```

### 3. 빌드 & 실행

```bash
docker compose up -d --build
```

처음엔 이미지 빌드로 2-3분 걸립니다. 이후 실행은 즉시.

### 4. 접속 확인

같은 사내망 PC 브라우저에서:
```
http://<NAS 내부 IP>:8201
```

예: `http://192.168.0.10:8201`

## 재시작·업데이트

```bash
# 최신 코드 반영
git pull
docker compose up -d --build

# 중지
docker compose down

# 로그 확인
docker compose logs -f chongmu
```

## Synology GUI로 설치하는 경우

1. **File Station** — `/docker/chongmu/` 공유폴더 생성, 소스 업로드
2. **Container Manager** → 프로젝트 → **생성**
   - 경로: `/docker/chongmu/chongmu-master`
   - 소스: `docker-compose.yml` 선택
3. **빌드 및 시작** 클릭 → 완료되면 웹 UI 접속

## 백업 (NAS 장점 활용)

DB와 업로드 파일이 전부 `/data` 아래에 있으므로 이 폴더만 백업하면 됩니다.

- **Synology**: `Hyper Backup`으로 `/data` 공유폴더를 외장HDD/클라우드로 자동 백업
- **QNAP**: `Hybrid Backup Sync` 사용
- **스냅샷**: btrfs 볼륨이면 스냅샷으로 시점 복원 가능 (권장 — 랜섬웨어 대비)

## 고정 사내 주소 부여 (선택)

매번 IP 외우기 귀찮으면:
1. NAS의 **DNS Server** 패키지 설치
2. `chongmu.company.local` → NAS IP 레코드 추가
3. 또는 사내 공유기에서 호스트명 지정

## HTTPS (선택)

사내에서도 HTTPS가 필요하면 NAS 리버스 프록시 기능 활용:

**Synology**: 제어판 → 로그인 포털 → 고급 → **역방향 프록시**
- 소스: `https://chongmu.company.local:443`
- 대상: `http://localhost:8201`
- Let's Encrypt 사내 도메인으로는 안 되므로 자체 서명 인증서 or 내부 CA

## 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| 8201 포트 충돌 | `docker-compose.yml`에서 `"8201:8201"` → `"9201:8201"` 등으로 변경 |
| 한글 파일명 깨짐 | NAS 공유폴더 인코딩을 UTF-8로 설정 |
| 업로드 파일이 리붓 후 사라짐 | 볼륨이 `./data`로 돼있고 컨테이너 안에만 저장됨 — NAS 실제 경로로 매핑 확인 |
| 권한 오류 | NAS 사용자 `docker` 그룹 권한, 공유폴더 RW 권한 확인 |

## 동시 사용자가 많아지면 (20명 이상)

SQLite → PostgreSQL 전환:
1. `docker-compose.yml`의 `db:` 블록 주석 해제
2. `chongmu:` 의 `DATABASE_URL` 주석 해제
3. `psycopg[binary]`를 `requirements.txt`에 추가
4. 기존 SQLite 데이터는 `sqlite-dump` → `pg_restore`로 이관
