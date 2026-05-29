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

TEMP_ROOT = Path(__file__).resolve().parents[2] / "temp"
TEMP_ROOT.mkdir(exist_ok=True)

# AI Model settings
AI_PROVIDER: str = os.environ.get("AI_PROVIDER", "sumopod").lower()
MODEL_CHAT: str = os.environ.get("MODEL_CHAT", "gpt-4o-mini")
MODEL_DEEP: str = os.environ.get("MODEL_DEEP", "gpt-4o-mini")
# Per-role model overrides (defaults to MODEL_CHAT if not set)
MODEL_INTENT: str = os.environ.get("MODEL_INTENT", "") or MODEL_CHAT
MODEL_PLANNER: str = os.environ.get("MODEL_PLANNER", "") or MODEL_CHAT
MODEL_EXECUTOR: str = os.environ.get("MODEL_EXECUTOR", "") or MODEL_CHAT
MODEL_CRITIC: str = os.environ.get("MODEL_CRITIC", "") or MODEL_CHAT
OLLAMA_BASE_URL: str = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
SUMOPOD_API_KEY: str = os.environ.get("SUMOPOD_API_KEY", "")
SUMOPOD_BASE_URL: str = os.environ.get("SUMOPOD_BASE_URL", "https://ai.sumopod.com/v1")

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
