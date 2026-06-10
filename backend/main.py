from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text as sa_text

from backend.core.database import init_db, engine
from backend.core.config import APP_ENV, SECRET_KEY, ALLOWED_ORIGINS, REDIS_URL, MINIO_BUCKET
from backend.routers import auth, datasets, chat, notebook, history, projects


@asynccontextmanager
async def lifespan(app: FastAPI):
    from backend.core.config import _DEFAULT_SECRET
    if APP_ENV != "development" and SECRET_KEY == _DEFAULT_SECRET:
        raise RuntimeError("SECRET_KEY default tidak boleh digunakan di environment non-development")
    init_db()
    yield


app = FastAPI(title="AI Data Analyst API", version="1.0.0", lifespan=lifespan)
app.state.limiter = auth.limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(datasets.router)

app.include_router(chat.router)
app.include_router(notebook.router)
app.include_router(history.router)


@app.get("/health")
def health():
    statuses = {"status": "ok"}
    try:
        with engine.connect() as conn:
            conn.execute(sa_text("SELECT 1"))
        statuses["mysql"] = "ok"
    except Exception:
        statuses["mysql"] = "error"
    try:
        rc = redis.from_url(REDIS_URL, decode_responses=True)
        rc.ping()
        statuses["redis"] = "ok"
    except Exception:
        statuses["redis"] = "error"
    try:
        from backend.core.minio_store import _get_client
        _get_client().bucket_exists(MINIO_BUCKET)
        statuses["minio"] = "ok"
    except Exception:
        statuses["minio"] = "error"
    return statuses
