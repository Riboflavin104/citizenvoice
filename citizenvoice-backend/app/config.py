from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    supabase_anon_key: str
    embedding_model: str = "all-MiniLM-L6-v2"
    duplicate_threshold: float = 0.15

    class Config:
        env_file = ".env"


settings = Settings()
