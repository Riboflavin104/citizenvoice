from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class SimilarComplaint(BaseModel):
    id: str
    raw_text: str
    category: Optional[str]
    status: Optional[str]
    similarity: float


class ComplaintResponse(BaseModel):
    id: str
    raw_text: str
    category: Optional[str]
    department: Optional[str]
    classification_confidence: Optional[float]
    priority_score: float
    priority_label: str
    status: str
    photo_url: Optional[str] = None
    is_duplicate: bool
    duplicate_of: Optional[str] = None
    similar_complaints: List[SimilarComplaint] = []
    created_at: Optional[datetime] = None


class StatusUpdate(BaseModel):
    new_status: str
    note: Optional[str] = None


# ---------- Aadhaar validation (new) ----------

class AadhaarValidationRequest(BaseModel):
    aadhaar_number: str


class AadhaarValidationResponse(BaseModel):
    valid: bool
    message: Optional[str] = None
    masked: Optional[str] = None  # only set when valid — e.g. "XXXXXXXX9012"
