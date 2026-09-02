from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import complaints, users

app = FastAPI(title="CitizenVoice API", version="1.0.0")

# Allow your frontend (served from file:// or a local dev server) to call this API.
# Tighten this to your real frontend origin before deploying.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(complaints.router)
app.include_router(users.router)


@app.get("/")
def root():
    return {"status": "ok", "message": "CitizenVoice API running. See /docs."}
