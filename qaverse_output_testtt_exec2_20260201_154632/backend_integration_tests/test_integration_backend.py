# tests/test_integration_fastapi.py

import os
import pytest
from httpx import AsyncClient

# The tests are designed to run with a FastAPI app that exposes:
# - GET / 
# - GET /health
# - POST /api/generate-pipeline
# - POST /api/analyze-repository
# and with SQLAlchemy models:
# - RepositoryInput
# - PipelineStage
# - PipelineResponse

@pytest.fixture(scope="session")
def app():
    # Ensure a test database URL is provided before importing the app
    os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
    # Import the FastAPI app after environment setup
    from main import app as fastapi_app  # type: ignore
    return fastapi_app

@pytest.fixture(scope="session")
def db_engine(app):
    # Create a SQLAlchemy engine for the test database file
    from sqlalchemy import create_engine
    database_url = os.environ["DATABASE_URL"]
    engine = create_engine(database_url, connect_args={"check_same_thread": False})
    return engine

@pytest.fixture
def db_session(db_engine):
    # Simple session per test to interact with the DB directly
    from sqlalchemy.orm import sessionmaker
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture
async def client(app, db_engine):
    # Use AsyncClient to hit FastAPI endpoints
    async with AsyncClient(app=app, base_url="http://testserver") as ac:
        yield ac

@pytest.fixture(scope="session", autouse=True)
def cleanup_db():
    # Cleanup test DB file after the test session
    yield
    db_path = "./test.db"
    try:
        if os.path.exists(db_path):
            os.remove(db_path)
    except Exception:
        pass

@pytest.mark.asyncio
async def test_health_endpoint(client):
    resp = await client.get("/health")
    assert resp.status_code == 200

@pytest.mark.asyncio
async def test_root_endpoint(client):
    resp = await client.get("/")
    assert resp.status_code == 200

@pytest.mark.asyncio
async def test_analyze_repository_flow(client, db_session):
    payload = {"repository_url": "https://github.com/example/repo"}
    resp = await client.post("/api/analyze-repository", json=payload)
    assert resp.status_code in (200, 201)

    # Verify a RepositoryInput entry was created in the DB
    try:
        from main import RepositoryInput
    except Exception:
        pytest.skip("Model RepositoryInput not available in main.py")

    count = db_session.query(RepositoryInput).count()
    assert count >= 1

@pytest.mark.asyncio
async def test_generate_pipeline_flow(client, db_session):
    # Try to fetch an existing RepositoryInput to use as a source for pipeline generation
    try:
        from main import RepositoryInput, PipelineStage, PipelineResponse
    except Exception:
        pytest.skip("Models not available in main.py")

    # Prefer an existing repository entry
    repo = None
    if hasattr(RepositoryInput, "id"):
        repo = db_session.query(RepositoryInput).order_by(RepositoryInput.id.desc()).first()  # type: ignore
    else:
        repo = db_session.query(RepositoryInput).first()  # type: ignore

    if repo is None:
        pytest.skip("No RepositoryInput available to trigger generate-pipeline")

    repo_id = getattr(repo, "id", None)
    repo_url = getattr(repo, "repository_url", None) or getattr(repo, "url", None) or getattr(repo, "repo_url", None)

    payload = {}
    if repo_id is not None:
        payload["repository_id"] = repo_id
    if repo_url:
        payload["repository_url"] = repo_url

    if not payload:
        pytest.skip("Insufficient data to trigger generate-pipeline")

    # Capture counts before operation
    before_count = (
        db_session.query(PipelineStage).count() + db_session.query(PipelineResponse).count()
    )

    resp = await client.post("/api/generate-pipeline", json=payload)
    assert resp.status_code in (200, 201)

    # Verify that new Pipeline-related entries were created
    after_count = (
        db_session.query(PipelineStage).count() + db_session.query(PipelineResponse).count()
    )
    assert after_count > before_count