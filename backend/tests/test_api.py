from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.database import Base
from app.main import app


engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def register_user(username: str, password: str, full_name: str | None = None):
    return client.post(
        "/api/auth/register",
        json={"username": username, "password": password, "full_name": full_name},
    )


def login_user(username: str, password: str) -> str:
    response = client.post("/api/auth/token", data={"username": username, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def auth_header(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_read_main():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to Infant Monitor API"}


def test_register_login_me():
    r = register_user("alice", "password123", "Alice")
    assert r.status_code == 200
    token = login_user("alice", "password123")
    me = client.get("/api/auth/me", headers=auth_header(token))
    assert me.status_code == 200
    assert me.json()["username"] == "alice"
    assert "avatar_url" in me.json()

def test_update_profile_and_change_password():
    register_user("charlie", "password123", "Charlie")
    token = login_user("charlie", "password123")

    upd = client.put(
        "/api/auth/me",
        headers=auth_header(token),
        json={"full_name": "New Nick", "avatar_url": "https://example.com/a.png"},
    )
    assert upd.status_code == 200
    assert upd.json()["full_name"] == "New Nick"
    assert upd.json()["avatar_url"] == "https://example.com/a.png"

    pw = client.put(
        "/api/auth/password",
        headers=auth_header(token),
        json={"current_password": "password123", "new_password": "password456"},
    )
    assert pw.status_code == 200
    assert pw.json() == {"ok": True}

    bad = client.post("/api/auth/token", data={"username": "charlie", "password": "password123"})
    assert bad.status_code in (400, 401)
    good = client.post("/api/auth/token", data={"username": "charlie", "password": "password456"})
    assert good.status_code == 200

def test_register_allows_chinese_username():
    r = register_user("张恒博", "password123", "ZHB")
    assert r.status_code == 200
    token = login_user("张恒博", "password123")
    me = client.get("/api/auth/me", headers=auth_header(token))
    assert me.status_code == 200
    assert me.json()["username"] == "张恒博"


def test_history_isolation_by_user_id():
    register_user("user1", "password123", "User One")
    register_user("user2", "password123", "User Two")

    t1 = login_user("user1", "password123")
    t2 = login_user("user2", "password123")

    create = client.post(
        "/api/history/",
        headers=auth_header(t1),
        json={
            "date": "2026-01-22",
            "start_time": "10:00",
            "end_time": "10:01",
            "avg_bpm": 123.4,
            "signal_quality": "Good",
        },
    )
    assert create.status_code == 200

    h1 = client.get("/api/history/", headers=auth_header(t1))
    assert h1.status_code == 200
    assert len(h1.json()) == 1

    h2 = client.get("/api/history/", headers=auth_header(t2))
    assert h2.status_code == 200
    assert h2.json() == []


def test_sql_injection_like_login_rejected():
    register_user("bob", "password123", "Bob")
    response = client.post(
        "/api/auth/token",
        data={"username": "bob' OR 1=1 --", "password": "password123"},
    )
    assert response.status_code in (400, 401)
