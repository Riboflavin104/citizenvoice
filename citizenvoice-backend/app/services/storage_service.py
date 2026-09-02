import uuid
from app.database import supabase

BUCKET_NAME = "complaint-photos"


def upload_photo(file_bytes: bytes, original_filename: str, content_type: str) -> str:
    """
    Uploads a photo to the 'complaint-photos' Supabase Storage bucket and
    returns its public URL. Requires the bucket to already exist and be
    public (created manually in the dashboard — see sql/schema.sql notes).
    """
    extension = original_filename.split(".")[-1] if "." in original_filename else "jpg"
    unique_name = f"{uuid.uuid4()}.{extension}"

    supabase.storage.from_(BUCKET_NAME).upload(
        path=unique_name,
        file=file_bytes,
        file_options={"content-type": content_type},
    )

    return supabase.storage.from_(BUCKET_NAME).get_public_url(unique_name)
