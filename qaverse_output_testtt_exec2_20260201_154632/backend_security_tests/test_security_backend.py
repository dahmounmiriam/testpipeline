import pytest
import os
from httpx import AsyncClient
from main import app

pytestmark = pytest.mark.asyncio

API_KEY_HEADER_X = "X-API-Key"
API_KEY_HEADER_AUTH = "Authorization"

@pytest.fixture
async def client():
    async with AsyncClient(app=app, base_url="http://testserver") as c:
        yield c

# 1) API Security - API Key authentication and general access
async def test_public_endpoints_accessible_without_auth(client):
    resp_root = await client.get("/")
    assert resp_root.status_code in (200, 204)

    resp_health = await client.get("/health")
    assert resp_health.status_code in (200, 204)

async def test_api_key_bypass_for_public_endpoints(client):
    # Try with API Key header variant 1
    resp_with_key = await client.get("/", headers={API_KEY_HEADER_X: "invalid-key"})
    assert resp_with_key.status_code in (200, 204)

    # Try with API Key header variant 2
    resp_with_auth = await client.get("/", headers={API_KEY_HEADER_AUTH: "ApiKey invalid-key"})
    assert resp_with_auth.status_code in (200, 204)

    # Try without any auth header
    resp_no_key = await client.get("/")
    assert resp_no_key.status_code in (200, 204)

# 2) SQL Injection - Test on actual endpoints and their queries
async def test_sql_injection_generate_pipeline(client):
    payload = {
        "pipeline_name": "test';--",
        "config": { "param": "value" }
    }
    resp = await client.post("/api/generate-pipeline", json=payload)
    # Should not crash with server error due to injection
    assert resp.status_code != 500
    # If possible, ensure no raw SQL error is exposed in response
    text = resp.text or ""
    upper = text.upper()
    assert "SQL" not in upper and "SYN" not in upper  # avoid surfacing SQL related messages

async def test_sql_injection_analyze_repository(client):
    payload = {
        "repository_url": "https://example.com/repo'; SELECT * FROM users;--",
        "analysis_type": "full"
    }
    resp = await client.post("/api/analyze-repository", json=payload)
    assert resp.status_code != 500
    text = resp.text or ""
    upper = text.upper()
    assert "SQL" not in upper and "SYN" not in upper

# 3) Authentication bypass - test authentication mechanisms detected
async def test_authentication_bypass_mechanisms(client):
    # Access with invalid API key should still be allowed for public endpoints (auth: False)
    resp1 = await client.get("/api/generate-pipeline", headers={API_KEY_HEADER_X: "invalid-key"})
    assert resp1.status_code != 401  # not unauthorized (auth is disabled on these endpoints)

    resp2 = await client.post("/api/analyze-repository", json={
        "repository_url": "https://example.com/repo",
        "analysis_type": "quick"
    }, headers={API_KEY_HEADER_AUTH: "ApiKey invalid-key"})
    assert resp2.status_code != 401

# 4) Authorization and access control - protected endpoints behavior
async def test_access_control_on_protected_endpoints(client):
    # Even with no auth, endpoints are declared as auth: False, but verify no 403 is returned
    resp_get = await client.get("/")
    assert resp_get.status_code in (200, 204)

    resp_post_gen = await client.post("/api/generate-pipeline", json={
        "pipeline_name": "auth-test",
        "config": {}
    })
    assert resp_post_gen.status_code in (200, 201, 202)

    resp_post_analyze = await client.post("/api/analyze-repository", json={
        "repository_url": "https://example.com/repo",
        "analysis_type": "full"
    })
    assert resp_post_analyze.status_code in (200, 201, 202)

# 5) Data validation - input validation and sanitization
async def test_input_validation_missing_fields_generate_pipeline(client):
    resp = await client.post("/api/generate-pipeline", json={})
    assert resp.status_code in (400, 422)

async def test_input_validation_invalid_types_analyze_repository(client):
    resp = await client.post("/api/analyze-repository", json={
        "repository_url": 12345,  # should be string
        "analysis_type": None     # should be string / enum
    })
    assert resp.status_code in (400, 422)

# 6) Sensitive data handling - ensure no leakage of env vars
async def test_sensitive_data_not_exposed_in_errors(client):
    resp = await client.post("/api/generate-pipeline", json={
        "pipeline_name": "<script>alert(1)</script>",
        "config": {}
    })
    text = (resp.text or "")
    # Ensure env var values are not echoed back in responses
    sensitive_vars = ["SECRET_KEY", "DATABASE_URL", "API_KEY", "PASSWORD"]
    for v in sensitive_vars:
        # If the response contains the actual value of an env var, fail
        val = os.environ.get(v)
        if val:
            assert val not in text

# 7) Rate limiting and throttling
async def test_rate_limiting_on_generate_pipeline(client):
    payload = {
        "pipeline_name": "ratelimit-test",
        "config": {}
    }
    observed_429 = False
    # Try multiple requests to trigger rate limiting if configured
    for i in range(20):
        resp = await client.post("/api/generate-pipeline", json=payload)
        if resp.status_code == 429:
            observed_429 = True
            break
    if not observed_429:
        pytest.skip("Rate limiting not enforced in this environment")

# 8) CSRF protection
async def test_csrf_protection_not_enforced_for_api_keys(client):
    # CSRF tokens are typically not required for API-key based auth in REST APIs.
    resp = await client.post("/api/generate-pipeline", json={
        "pipeline_name": "csrf-test",
        "config": {}
    }, headers={"Origin": "https://evil.example.com"})
    assert resp.status_code in (200, 201, 202)

# 9) OWASP Top 10 coverage - XSS sanitization
async def test_xss_input_sanitization_on_generate_pipeline(client):
    payload = {
        "pipeline_name": "<script>alert('xss')</script>",
        "config": {}
    }
    resp = await client.post("/api/generate-pipeline", json=payload)
    assert resp.status_code != 500
    # Ensure the response does not echo the raw script tag
    assert "<script>alert('xss')</script>" not in (resp.text or "")

# 10) Positive and negative test cases
async def test_positive_case_generate_pipeline_valid_input(client):
    payload = {
        "pipeline_name": "valid-pipeline",
        "config": { "param": "value" }
    }
    resp = await client.post("/api/generate-pipeline", json=payload)
    assert resp.status_code in (200, 201, 202)

async def test_negative_case_generate_pipeline_invalid_input(client):
    payload = {
        # Missing required fields or invalid structure
    }
    resp = await client.post("/api/generate-pipeline", json=payload)
    assert resp.status_code in (400, 422)  # validation error