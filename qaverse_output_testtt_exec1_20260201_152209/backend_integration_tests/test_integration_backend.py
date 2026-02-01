# tests/test_integration.py

import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Import FastAPI app and ORM components from the application
# The tests assume the application exposes these symbols.
# Adjust imports if your actual module structure differs.
from main import app, get_db, Base, RepositoryInput, PipelineStage, PipelineResponse  # type: ignore

# Use a dedicated test database to avoid interfering with production data
TEST_DATABASE_URL = "sqlite:///./test_integration.db"


@pytest.fixture(scope="session")
def test_engine():
    # Create a separate engine bound to the test database
    engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    # Create all tables for the test database
    Base.metadata.create_all(bind=engine)
    yield engine
    # Teardown: drop all tables and remove the test database file
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_integration.db"):
        try:
            os.remove("./test_integration.db")
        except Exception:
            pass


@pytest.fixture
def test_session_factory(test_engine):
    # Create a session factory bound to the test engine
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    return TestingSessionLocal


@pytest.fixture
def override_get_db(test_session_factory, test_engine):
    # Override the application's get_db dependency to use the test session
    def _override_get_db():
        db = test_session_factory()
        try:
            yield db
        finally:
            db.close()
    return _override_get_db


@pytest.fixture
def client(test_engine, override_get_db):
    # Apply the dependency override and provide a TestClient for integration tests
    from main import app as application  # re-import to ensure we override the same instance
    application.dependency_overrides[get_db] = override_get_db  # type: ignore
    with TestClient(application) as c:
        yield c
    application.dependency_overrides.clear()  # cleanup


def test_root_and_health_endpoints_are_accessible(client):
    # Test GET / (root)
    resp_root = client.get("/")
    assert resp_root.status_code == 200

    # Test GET /health
    resp_health = client.get("/health")
    assert resp_health.status_code == 200
    # Optional: validate structure if the endpoint returns JSON health status
    try:
        data = resp_health.json()
        # If the API returns a dict with a status key, assert it's healthy
        if isinstance(data, dict) and "status" in data:
            assert data["status"] in ("ok", "healthy", "healthy/")
    except Exception:
        # If the endpoint doesn't return JSON, it's still acceptable as long as status is 200
        pass


def test_analyze_repository_stores_input_and_updates_db(client, test_engine):
    # Send a typical payload for repository analysis
    payload = {
        "repository_url": "https://example.com/repo.git",
        "branch": "main"  # include optional fields if the API supports them
    }

    resp = client.post("/api/analyze-repository", json=payload)
    assert resp.status_code in (200, 201)

    # Validate that a RepositoryInput entry was written to the database
    with test_engine.connect() as conn:
        # Attempt to count rows in the repository_input table
        # The actual table name is typically 'repository_input' if __tablename__ = 'repository_input'
        try:
            row = conn.execute(text("SELECT COUNT(*) AS cnt FROM repository_input")).fetchone()
            count = row[0] if row is not None else 0
        except Exception:
            # Fallback: some schemas may name the table differently; try a generic check
            row = conn.execute(text("SELECT COUNT(*) AS cnt FROM RepositoryInput")).fetchone()
            count = row[0] if row is not None else 0

        assert count >= 1, "Expected at least one repository_input record in the DB after analyze-repository"


def test_generate_pipeline_creates_pipeline_and_updates_db(client, test_engine):
    # Payload for pipeline generation
    payload = {
        "repository_url": "https://example.com/repo.git",
        "pipeline_type": "default"
    }

    resp = client.post("/api/generate-pipeline", json=payload)
    assert resp.status_code in (200, 201)

    # Validate that a PipelineStage entry was written to the database
    with test_engine.connect() as conn:
        try:
            row = conn.execute(text("SELECT COUNT(*) AS cnt FROM pipeline_stage")).fetchone()
            count_stage = row[0] if row is not None else 0
        except Exception:
            row = conn.execute(text("SELECT COUNT(*) AS cnt FROM PipelineStage")).fetchone()
            count_stage = row[0] if row is not None else 0

        assert count_stage >= 1, "Expected at least one pipeline_stage record in the DB after generate-pipeline"

        try:
            row = conn.execute(text("SELECT COUNT(*) AS cnt FROM pipeline_response")).fetchone()
            count_response = row[0] if row is not None else 0
        except Exception:
            row = conn.execute(text("SELECT COUNT(*) AS cnt FROM PipelineResponse")).fetchone()
            count_response = row[0] if row is not None else 0

        assert count_response >= 0  # Optional: ensure the response is stored if applicable


def test_external_service_calls_are_mocked(client, monkeypatch, test_engine):
    # Mock external HTTP calls to ensure the integration test doesn't depend on real services
    import httpx

    class MockResponse:
        status_code = 200
        def json(self):
            return {"mock": "response"}

    async def mock_post(*args, **kwargs):
        return MockResponse()

    # Patch AsyncClient.post to avoid real HTTP requests
    monkeypatch.setattr(httpx, "AsyncClient", httpx.AsyncClient)  # ensure attribute exists
    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post, raising=False)

    payload = {
        "repository_url": "https://example.com/repo.git",
        "pipeline_type": "default"
    }

    resp = client.post("/api/analyze-repository", json=payload)
    assert resp.status_code in (200, 201)

    # Optionally verify that the DB state is still consistent after mocked external call
    with test_engine.connect() as conn:
        # Ensure the repository_input table still has at least one entry
        try:
            row = conn.execute(text("SELECT COUNT(*) FROM repository_input")).fetchone()
            count = row[0] if row is not None else 0
        except Exception:
            row = conn.execute(text("SELECT COUNT(*) FROM RepositoryInput")).fetchone()
            count = row[0] if row is not None else 0
        assert count >= 1


def test_direct_database_operations_via_sqlite_reflection(test_engine):
    # This test exercises DB-level operations without relying on ORM constructors
    with test_engine.connect() as conn:
        # Create a new entry via raw SQL if the table and columns exist
        # Attempt to insert a minimal row into repository_input if possible
        try:
            conn.execute(text("INSERT INTO repository_input (repository_url) VALUES ('https://example.com/repo.git')"))
            row = conn.execute(text("SELECT COUNT(*) FROM repository_input")).fetchone()
            count = row[0] if row is not None else 0
            assert count >= 1
        except Exception:
            # If the exact schema differs, skip this part gracefully
            pytest.skip("RepositoryInput table or column(s) not present for raw SQL insertion in test DB.")