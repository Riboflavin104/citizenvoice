import re
from fastapi import APIRouter

from app.schemas import AadhaarValidationRequest, AadhaarValidationResponse

router = APIRouter(prefix="/users", tags=["users"])

# ============================================================
# Verhoeff checksum — ported 1:1 from frontend/script.js so the
# backend's authoritative check agrees with the frontend's instant
# feedback check. Do not edit one without editing the other.
# ============================================================

VERHOEFF_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]

VERHOEFF_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]


def verhoeff_valid(num_str: str) -> bool:
    c = 0
    digits = [int(d) for d in reversed(num_str)]
    for i, d in enumerate(digits):
        c = VERHOEFF_D[c][VERHOEFF_P[i % 8][d]]
    return c == 0


def is_valid_aadhaar_format(raw: str) -> bool:
    """Format only: 12 digits, doesn't start with 0/1, passes Verhoeff checksum.
    This does NOT verify the number is real or belongs to the user."""
    cleaned = re.sub(r"[\s-]", "", raw)
    if not re.match(r"^[2-9][0-9]{11}$", cleaned):
        return False
    return verhoeff_valid(cleaned)


def mask_aadhaar(raw: str) -> str:
    cleaned = re.sub(r"[\s-]", "", raw)
    return "XXXXXXXX" + cleaned[-4:]


@router.post("/validate-aadhaar", response_model=AadhaarValidationResponse)
def validate_aadhaar(payload: AadhaarValidationRequest):
    """
    Called from script.js's registerSuccess() before signUp(). No auth
    required — the account doesn't exist yet at this point in the flow.
    This is the authoritative check; the frontend's own check is just for
    instant feedback and can be bypassed by calling this endpoint directly.
    """
    if not is_valid_aadhaar_format(payload.aadhaar_number):
        return AadhaarValidationResponse(
            valid=False,
            message="That doesn't look like a valid Aadhaar number. Please check the 12 digits and try again.",
        )

    return AadhaarValidationResponse(
        valid=True,
        masked=mask_aadhaar(payload.aadhaar_number),
    )
