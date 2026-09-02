from fastapi import Header, HTTPException, Depends
from supabase import create_client
from app.config import settings
from app.database import supabase as service_supabase

# A client configured with the anon key, used purely to validate the token
# the frontend sends us. This does NOT bypass RLS.
_auth_client = create_client(settings.supabase_url, settings.supabase_anon_key)


def get_current_user(authorization: str = Header(...)) -> dict:
    """
    Expects header: Authorization: Bearer <access_token>
    The frontend gets this token from supabase.auth.signInWithPassword(...).
    Raises 401 if the token is missing/invalid/expired.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header")

    token = authorization.removeprefix("Bearer ").strip()

    try:
        user_response = _auth_client.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if not user_response or not user_response.user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return {"id": user_response.user.id, "email": user_response.user.email}


def require_authority(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Use as: def endpoint(user: dict = Depends(require_authority)):
    Runs get_current_user first (verifies the token), then checks
    profiles.is_authority using the service_role client (bypasses RLS,
    since we need to read another table to make this decision).
    Raises 403 if the logged-in user isn't a marked authority.
    """
    profile = (
        service_supabase.table("profiles")
        .select("is_authority")
        .eq("id", current_user["id"])
        .single()
        .execute()
    )
    if not profile.data or not profile.data.get("is_authority"):
        raise HTTPException(status_code=403, detail="Authority access required")
    return current_user