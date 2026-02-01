import json
import pytest
from httpx import AsyncClient
from types import SimpleNamespace

from main import app


def fake_ai_response(content: str):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


@pytest.mark.asyncio
async def test_root_endpoint():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        resp = await ac.get("/")
        assert resp.status_code == 200
        assert resp.json() == {"message": "Test Pipeline Generator API", "version": "1.0.0"}


@pytest.mark.asyncio
async def test_health_endpoint():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        resp = await ac.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "healthy"}


@pytest.mark.asyncio
async def test_generate_pipeline_success(monkeypatch):
    valid_pipeline_json = json.dumps({
        "stages": [
            {
                "name": "Unit Tests Backend",
                "type": "unit_test_backend",
                "description": "Test backend components",
                "commands": ["pytest"],
                "tools": ["pytest"],
                "estimatedDuration": "2m"
            }
        ],
        "summary": "All good",
        "recommendations": ["increase coverage"]
    })

    async def fake_create(*args, **kwargs):
        return fake_ai_response(valid_pipeline_json)

    import main
    monkeypatch.setattr(main, "client", SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=fake_create))))

    async with AsyncClient(app=app, base_url="http://test") as ac:
        payload = {
            "repository_url": "https://example.com/repo.git",
            "repository_content": "print('hello world')",
            "language": "Python",
            "framework": "FastAPI"
        }
        resp = await ac.post("/api/generate-pipeline", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert "stages" in data
        assert isinstance(data["stages"], list)
        assert data["summary"] == "All good"
        assert data["recommendations"] == ["increase coverage"]


@pytest.mark.asyncio
async def test_generate_pipeline_invalid_json(monkeypatch):
    invalid_json = "not json"

    async def fake_create(*args, **kwargs):
        return fake_ai_response(invalid_json)

    import main
    monkeypatch.setattr(main, "client", SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=fake_create))))

    async with AsyncClient(app=app, base_url="http://test") as ac:
        payload = {
            "repository_url": "https://example.com/repo.git",
            "repository_content": "content",
            "language": "Python",
            "framework": "FastAPI"
        }
        resp = await ac.post("/api/generate-pipeline", json=payload)
        assert resp.status_code == 500
        detail = resp.json().get("detail", "")
        assert "Failed to parse AI response" in detail


@pytest.mark.asyncio
async def test_analyze_repository_success(monkeypatch):
    analyze_json = json.dumps({
        "language": "Python",
        "framework": "FastAPI",
        "projectType": "API",
        "recommendedTools": ["pytest", "ruff"]
    })

    async def fake_create(*args, **kwargs):
        return fake_ai_response(analyze_json)

    import main
    monkeypatch.setattr(main, "client", SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=fake_create))))

    async with AsyncClient(app=app, base_url="http://test") as ac:
        payload = {
            "repository_url": "https://example.com/repo.git",
            "repository_content": "def app(): pass",
            "language": "Python",
            "framework": "FastAPI"
        }
        resp = await ac.post("/api/analyze-repository", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["language"] == "Python"
        assert data["framework"] == "FastAPI"
        assert data["projectType"] == "API"
        assert data["recommendedTools"] == ["pytest", "ruff"]


@pytest.mark.asyncio
async def test_analyze_repository_invalid_json(monkeypatch):
    invalid_json = "not json"

    async def fake_create(*args, **kwargs):
        return fake_ai_response(invalid_json)

    import main
    monkeypatch.setattr(main, "client", SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=fake_create))))

    async with AsyncClient(app=app, base_url="http://test") as ac:
        payload = {
            "repository_url": "https://example.com/repo.git",
            "repository_content": "content",
            "language": "Python",
            "framework": "FastAPI"
        }
        resp = await ac.post("/api/analyze-repository", json=payload)
        assert resp.status_code == 500
        detail = resp.json().get("detail", "")
        assert "Error analyzing repository" in detail


@pytest.mark.asyncio
async def test_analyze_repository_exception(monkeypatch):
    async def fake_create(*args, **kwargs):
        raise Exception("boom")

    import main
    monkeypatch.setattr(main, "client", SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=fake_create))))

    async with AsyncClient(app=app, base_url="http://test") as ac:
        payload = {
            "repository_url": "https://example.com/repo.git",
            "repository_content": "content",
            "language": "Python",
            "framework": "FastAPI"
        }
        resp = await ac.post("/api/analyze-repository", json=payload)
        assert resp.status_code == 500
        detail = resp.json().get("detail", "")
        assert "Error analyzing repository" in detail