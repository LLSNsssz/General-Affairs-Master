from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import DATABASE_MODE, SUPABASE_URL, SUPABASE_KEY
import httpx

security = HTTPBearer(auto_error=False)


async def get_current_user(request: Request) -> str | None:
    """현재 로그인한 사용자 ID 반환. 비로그인이면 None."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ")[1]

    if DATABASE_MODE == "sqlite":
        # 로컬 개발: 토큰을 user_id로 사용 (간단한 테스트용)
        return token if token != "anonymous" else None

    # Supabase: JWT 검증
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": SUPABASE_KEY,
                },
            )
            if resp.status_code == 200:
                user_data = resp.json()
                return user_data.get("id")
    except Exception:
        pass

    return None


async def require_auth(request: Request) -> str:
    """인증 필수 엔드포인트용. 비로그인이면 401."""
    user_id = await get_current_user(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")
    return user_id
