import os
from pathlib import Path

# Load .env dari root project
def _load_env():
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

_load_env()

APP_ENV: str = os.environ.get("APP_ENV", "development").lower()
GOOGLE_API_KEY: str = os.environ.get("GOOGLE_API_KEY", "")
SECRET_KEY: str = os.environ.get("SECRET_KEY", "changeme-super-secret-key")
ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 hari

# Database
MYSQL_URL: str = os.environ.get("MYSQL_URL", "mysql+pymysql://root:password@localhost:3306/ai_analyst")
REDIS_URL: str = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# MinIO object storage
MINIO_ENDPOINT: str = os.environ.get("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY: str = os.environ.get("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY: str = os.environ.get("MINIO_SECRET_KEY", "minioadmin123")
MINIO_BUCKET: str = os.environ.get("MINIO_BUCKET", "ai-datasets")
MINIO_SECURE: bool = os.environ.get("MINIO_SECURE", "false").lower() == "true"

# Folder sementara untuk sandbox dan streamlit (bukan primary storage)
DATASETS_ROOT = Path(__file__).resolve().parents[2] / "datasets"
DATASETS_ROOT.mkdir(exist_ok=True)

# AI Model settings
AI_PROVIDER: str = os.environ.get("AI_PROVIDER", "google").lower()
MODEL_CHAT: str = os.environ.get("MODEL_CHAT", "gemini-3.1-flash-lite-preview")
MODEL_DEEP: str = os.environ.get("MODEL_DEEP", "gemini-3.1-pro-preview")
# Per-role model overrides (defaults to MODEL_CHAT if not set)
MODEL_PLANNER: str = os.environ.get("MODEL_PLANNER", "") or MODEL_CHAT
MODEL_EXECUTOR: str = os.environ.get("MODEL_EXECUTOR", "") or MODEL_CHAT
MODEL_CRITIC: str = os.environ.get("MODEL_CRITIC", "") or MODEL_CHAT
OLLAMA_BASE_URL: str = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OPENROUTER_API_KEY: str = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL: str = os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
OPENROUTER_HTTP_REFERER: str = os.environ.get("OPENROUTER_HTTP_REFERER", "")
OPENROUTER_APP_TITLE: str = os.environ.get("OPENROUTER_APP_TITLE", "Analisai")

# Sandbox limits
SANDBOX_TIMEOUT: int = int(os.environ.get("SANDBOX_TIMEOUT", "120"))   # detik
SANDBOX_MEM_LIMIT: str = os.environ.get("SANDBOX_MEM_LIMIT", "512m")
SANDBOX_CPU_QUOTA: int = int(os.environ.get("SANDBOX_CPU_QUOTA", "100000"))  # 1 core

# History trimming
MAX_HISTORY_MESSAGES: int = int(os.environ.get("MAX_HISTORY_MESSAGES", "10"))
MAX_HISTORY_CONTENT_LEN: int = int(os.environ.get("MAX_HISTORY_CONTENT_LEN", "2000"))

# API runtime limits
MAX_UPLOAD_MB: int = int(os.environ.get("MAX_UPLOAD_MB", "25"))
MAX_UPLOAD_FILES: int = int(os.environ.get("MAX_UPLOAD_FILES", "20"))
CHAT_MAX_WORKERS: int = int(os.environ.get("CHAT_MAX_WORKERS", "4"))

# Web Search (Tavily)
TAVILY_API_KEY: str = os.environ.get("TAVILY_API_KEY", "")
WEB_SEARCH_ENABLED: bool = bool(TAVILY_API_KEY)
