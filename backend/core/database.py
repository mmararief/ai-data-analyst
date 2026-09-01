from sqlalchemy import create_engine, Column, String, Text, Integer, DateTime, ForeignKey, func, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

try:
    from backend.core.config import MYSQL_URL
except ImportError:
    MYSQL_URL = "mysql+pymysql://root:password@localhost:3306/ai_analyst"

engine = create_engine(MYSQL_URL, pool_pre_ping=True, echo=False)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


class UserRow(Base):
    __tablename__ = "users"
    user_id = Column(String(36), primary_key=True, index=True)
    username = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="user", nullable=False)  # "admin" | "user"
    created_at = Column(DateTime, server_default=func.now())


class ProjectRow(Base):
    __tablename__ = "projects"
    project_id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class UserTokenUsageRow(Base):
    __tablename__ = "user_token_usage"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(36), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = Column(String(36), nullable=True, index=True)
    project_id = Column(String(36), nullable=True)
    model_name = Column(String(100), default="")
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())


def init_db():
    Base.metadata.create_all(bind=engine)
    # Safe auto-migration for existing tables
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'user'"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"))
            conn.commit()
        except Exception:
            pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
