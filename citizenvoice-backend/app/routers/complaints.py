from fastapi import APIRouter, HTTPException, Depends, Form, File, UploadFile, Query
from typing import Optional

from app.database import supabase
from app.auth import get_current_user, require_authority
from app.schemas import ComplaintResponse, StatusUpdate, SimilarComplaint
from app.services import nlp_service, priority_service, duplicate_service, storage_service

router = APIRouter(prefix="/complaints", tags=["complaints"])

STRONG_DUPLICATE_SIMILARITY = 0.92


@router.post("", response_model=ComplaintResponse)
async def submit_complaint(
    title: str = Form(...),
    description: str = Form(...),
    location: str = Form(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    photo: Optional[UploadFile] = File(None),
    user: dict = Depends(get_current_user),
):
    """
    Matches index1.html's form fields exactly: title, description, location, photo.
    Requires the frontend to send a Supabase Auth token in the Authorization header.
    """
    # Combine theme + description into the text we analyze — both carry signal
    full_text = f"{title}. {description}"
    normalized_text, lang = nlp_service.normalize_text(full_text)

    category, confidence, department_name = nlp_service.classify(normalized_text)
    priority_score, priority_label = priority_service.score_priority(normalized_text, category)
    embedding = nlp_service.embed(normalized_text)

    dept_row = supabase.table("departments").select("id").eq("name", department_name).single().execute()
    department_id = dept_row.data["id"] if dept_row.data else None

    similar = duplicate_service.find_similar(embedding)

    photo_url = None
    if photo is not None:
        file_bytes = await photo.read()
        photo_url = storage_service.upload_photo(file_bytes, photo.filename, photo.content_type)

    insert_data = {
        "citizen_id": user["id"],
        "raw_text": full_text,
        "normalized_text": normalized_text,
        "detected_language": lang,
        "address": location,
        "latitude": latitude,
        "longitude": longitude,
        "photo_url": photo_url,
        "category": category,
        "department_id": department_id,
        "classification_confidence": confidence,
        "priority_score": priority_score,
        "priority_label": priority_label,
        "embedding": embedding,
    }
    inserted = supabase.table("complaints").insert(insert_data).execute()
    new_complaint = inserted.data[0]

    is_duplicate = False
    duplicate_of = None
    if similar and similar[0]["similarity"] >= STRONG_DUPLICATE_SIMILARITY:
        duplicate_of = similar[0]["id"]
        duplicate_service.link_as_duplicate(new_complaint["id"], duplicate_of)
        is_duplicate = True

    return ComplaintResponse(
        id=new_complaint["id"],
        raw_text=full_text,
        category=category,
        department=department_name,
        classification_confidence=confidence,
        priority_score=priority_score,
        priority_label=priority_label,
        status=new_complaint["status"],
        photo_url=photo_url,
        is_duplicate=is_duplicate,
        duplicate_of=duplicate_of,
        similar_complaints=[SimilarComplaint(**s) for s in similar],
        created_at=new_complaint.get("created_at"),
    )


@router.get("/mine")
def list_my_complaints(user: dict = Depends(get_current_user)):
    """Powers the 'Track Complaint' page — every complaint the logged-in citizen filed."""
    result = (
        supabase.table("complaints")
        .select("*")
        .eq("citizen_id", user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.get("/all")
def list_all_complaints(
    status: Optional[str] = None,
    category: Optional[str] = None,
    priority_label: Optional[str] = None,
    user: dict = Depends(require_authority),
):
    """
    Powers the authority dashboard — EVERY citizen's complaints, not just one
    person's. Locked behind require_authority, so a regular citizen calling
    this gets a 403, even with a valid login token.
    """
    query = supabase.table("complaints").select("*").order("created_at", desc=True)
    if status:
        query = query.eq("status", status)
    if category:
        query = query.eq("category", category)
    if priority_label:
        query = query.eq("priority_label", priority_label)
    return query.execute().data


@router.get("/hotspots")
def get_hotspots(precision: int = 3, user: dict = Depends(require_authority)):
    """
    Groups complaints into geographic grid cells (rounding lat/lng) so the
    map shows clustered hotspot markers instead of thousands of overlapping
    raw points. Authority-only, since it exposes patterns across all citizens.

    precision = decimal places to round to.
      2 decimals ≈ ~1.1km grid cells
      3 decimals ≈ ~110m grid cells (default — good for neighborhood-level)
      4 decimals ≈ ~11m grid cells (very fine, rarely useful)
    """
    from collections import defaultdict

    rows = (
        supabase.table("complaints")
        .select("latitude, longitude, category, priority_label, status")
        .not_.is_("latitude", "null")
        .not_.is_("longitude", "null")
        .execute()
        .data
    )

    clusters = defaultdict(
        lambda: {"count": 0, "categories": defaultdict(int), "priorities": defaultdict(int), "unresolved": 0}
    )

    for r in rows:
        key = (round(r["latitude"], precision), round(r["longitude"], precision))
        cell = clusters[key]
        cell["count"] += 1
        cell["categories"][r["category"] or "Uncategorized"] += 1
        cell["priorities"][r["priority_label"]] += 1
        if r["status"] not in ("resolved", "rejected"):
            cell["unresolved"] += 1

    output = []
    for (lat, lng), data in clusters.items():
        output.append(
            {
                "latitude": lat,
                "longitude": lng,
                "count": data["count"],
                "unresolved": data["unresolved"],
                "dominant_category": max(data["categories"], key=data["categories"].get),
                "dominant_priority": max(data["priorities"], key=data["priorities"].get),
            }
        )

    output.sort(key=lambda x: x["count"], reverse=True)
    return output


@router.get("/{complaint_id}")
def get_complaint(complaint_id: str, user: dict = Depends(get_current_user)):
    result = supabase.table("complaints").select("*").eq("id", complaint_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if result.data["citizen_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your complaint")
    return result.data


@router.patch("/{complaint_id}/status")
def update_status(
    complaint_id: str,
    payload: StatusUpdate,
    user: dict = Depends(require_authority),
):
    """Now locked to authorities only — was previously open to any logged-in user."""
    current = supabase.table("complaints").select("status").eq("id", complaint_id).single().execute()
    if not current.data:
        raise HTTPException(status_code=404, detail="Complaint not found")

    old_status = current.data["status"]
    supabase.table("complaints").update({"status": payload.new_status}).eq("id", complaint_id).execute()
    supabase.table("complaint_status_history").insert(
        {"complaint_id": complaint_id, "old_status": old_status, "new_status": payload.new_status, "note": payload.note}
    ).execute()

    return {"id": complaint_id, "old_status": old_status, "new_status": payload.new_status}