from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    supabase_anon_key: str
    embedding_model: str = "embed-multilingual-v3.0"
    duplicate_threshold: float = 0.15
    cohere_api_key: str  # required — set via .env locally or Render env vars in production

    class Config:
        env_file = ".env"


settings = Settings()