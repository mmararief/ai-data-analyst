from sqlalchemy import create_engine, Column, String, Text, DateTime, ForeignKey, func
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


class ProjectRow(Base):
    __tablename__ = "projects"
    project_id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
