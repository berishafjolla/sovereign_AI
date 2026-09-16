from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    claude_api_key: str = ""
    jwt_secret: str = "sovereignai-secret"
    jwt_expire_hours: int = 24
    upload_dir: str = "./uploads"
    database_url: str = "sqlite:///./sovereignai.db"
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2:0.5b"

    class Config:
        env_file = ".env"

settings = Settings()
