from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import complaints, users

app = FastAPI(
    title="CitizenVoice API",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://citizenvoice-three.vercel.app",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(complaints.router)
app.include_router(users.router)


@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "CitizenVoice API running. See /docs."
    }