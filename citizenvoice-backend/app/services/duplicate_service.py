from app.database import supabase
from app.config import settings


def find_similar(embedding: list[float], exclude_id: str | None = None, match_count: int = 5):
    result = supabase.rpc(
        "match_similar_complaints",
        {
            "query_embedding": embedding,
            "match_threshold": settings.duplicate_threshold,
            "match_count": match_count,
            "exclude_id": exclude_id,
        },
    ).execute()
    return result.data or []


def link_as_duplicate(new_complaint_id: str, original_complaint_id: str):
    supabase.table("complaints").update({"duplicate_of": original_complaint_id}).eq(
        "id", new_complaint_id
    ).execute()

    original = (
        supabase.table("complaints")
        .select("duplicate_count")
        .eq("id", original_complaint_id)
        .single()
        .execute()
    )
    current_count = (original.data or {}).get("duplicate_count", 1)
    supabase.table("complaints").update({"duplicate_count": current_count + 1}).eq(
        "id", original_complaint_id
    ).execute()
