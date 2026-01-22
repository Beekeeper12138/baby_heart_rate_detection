from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .api import auth, history, websocket_routes
from .core.config import settings
from sqlalchemy import text

Base.metadata.create_all(bind=engine)

with engine.begin() as conn:
    try:
        rows = conn.execute(text("PRAGMA table_info(users)")).fetchall()
        cols = {r[1] for r in rows}
        if "avatar_url" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR"))
    except Exception:
        pass

if settings.create_default_admin:
    from sqlalchemy.orm import Session
    from .core import security
    from . import models

    def create_default_user():
        db = Session(bind=engine)
        user = db.query(models.User).filter(models.User.username == settings.default_admin_username).first()
        if not user:
            hashed_password = security.get_password_hash(settings.default_admin_password)
            db_user = models.User(
                username=settings.default_admin_username,
                hashed_password=hashed_password,
                full_name="Admin User",
            )
            db.add(db_user)
            db.commit()
        db.close()

    create_default_user()

app = FastAPI(title="Infant Monitor Backend")

# CORS
origins = settings.cors_allow_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(history.router, prefix="/api/history", tags=["history"])
app.include_router(websocket_routes.router, tags=["websocket"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Infant Monitor API"}
