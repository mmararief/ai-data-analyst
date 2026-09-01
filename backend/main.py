from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text as sa_text

from backend.core.database import init_db, engine
from backend.core.config import APP_ENV, SECRET_KEY, ALLOWED_ORIGINS, REDIS_URL, MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET
from backend.routers import auth, datasets, chat, notebook, history, projects, admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    if APP_ENV != "development" and SECRET_KEY == "changeme-super-secret-key":
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
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(datasets.router)
app.include_router(admin.router)

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
    except Exception as e:
        statuses["mysql"] = f"error: {e}"
    try:
        rc = redis.from_url(REDIS_URL, decode_responses=True)
        rc.ping()
        statuses["redis"] = "ok"
    except Exception as e:
        statuses["redis"] = f"error: {e}"
    try:
        from minio import Minio
        mc = Minio(MINIO_ENDPOINT, access_key=MINIO_ACCESS_KEY, secret_key=MINIO_SECRET_KEY, secure=False)
        mc.bucket_exists(MINIO_BUCKET)
        statuses["minio"] = "ok"
    except Exception as e:
        statuses["minio"] = f"error: {e}"
    return statuses
