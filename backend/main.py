from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core.database import init_db
from backend.core.config import APP_ENV, SECRET_KEY
from backend.routers import auth, datasets, chat, notebook, history, streamlit_runner

app = FastAPI(title="AI Data Analyst API", version="1.0.0")


@app.on_event("startup")
def on_startup():
    if APP_ENV != "development" and SECRET_KEY == "changeme-super-secret-key":
        raise RuntimeError("SECRET_KEY default tidak boleh digunakan di environment non-development")
    init_db()  # Create SQLite tables if they don't exist


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(datasets.router)
app.include_router(chat.router)
app.include_router(notebook.router)
app.include_router(history.router)
app.include_router(streamlit_runner.router)


@app.get("/health")
def health():
    return {"status": "ok"}
