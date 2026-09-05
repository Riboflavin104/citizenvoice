from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import complaints, users

app = FastAPI(title="CitizenVoice API", version="1.0.0")

# Add every frontend origin you actually use. CORS is required when the
# Vercel frontend calls this Render/FastAPI backend from another origin.
allowed_origins = [
    "https://citizenvoice-three.vercel.app",
    "https://citizenvoice.vercel.app",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
)

app.include_router(complaints.router)
app.include_router(users.router)


@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "CitizenVoice API running. See /docs."
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
