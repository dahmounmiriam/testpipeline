import os
import requests
import pytest

BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")


def json_headers(token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def login(base_url: str, username: str, password: str) -> str:
    resp = requests.post(
        f"{base_url}/api/auth/login",
        json={"username": username, "password": password},
        headers={"Content-Type": "application/json"},
    )
    # Do not raise to allow tests to assert error responses
    data = resp.json() if resp.content else {}
    return data.get("access_token")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def admin_token(base_url):
    token = login(base_url, "admin", "adminpass")
    assert token is not None, "Admin login failed; ensure admin credentials exist."
    return token


@pytest.fixture(scope="session")
def non_admin_token(base_url):
    token = login(base_url, "user", "userpass")
    assert token is not None, "Non-admin login failed; ensure user credentials exist."
    return token


# Global placeholder for created user id to enable data persistence checks
CREATED_USER = {"id": None, "email": None}


def test_login_success(base_url):
    token = login(base_url, "admin", "adminpass")
    assert token is not None


def test_login_failure(base_url):
    resp = requests.post(
        f"{base_url}/api/auth/login",
        json={"username": "admin", "password": "wrongpass"},
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 401


def test_access_protected_without_token(base_url):
    resp = requests.get(f"{base_url}/api/users", headers={"Content-Type": "application/json"})
    assert resp.status_code == 401


def test_token_validation_with_valid_token(base_url, admin_token):
    resp = requests.get(f"{base_url}/api/users", headers=json_headers(admin_token))
    assert resp.status_code == 200
    # Ensure response is JSON and has array-like structure
    assert isinstance(resp.json(), list)


def test_token_validation_with_invalid_token(base_url):
    resp = requests.get(f"{BASE_URL}/api/users", headers=json_headers("invalid-token"))
    # Token validation should fail with 401
    assert resp.status_code == 401


def test_list_users_with_admin(base_url, admin_token):
    resp = requests.get(f"{base_url}/api/users", headers=json_headers(admin_token))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    # Ensure response headers indicate JSON
    assert resp.headers.get("Content-Type", "").lower().startswith("application/json")


def test_create_user_as_admin(base_url, admin_token):
    payload = {
        "name": "Test User",
        "email": "testuser@example.com",
        "password": "Secret123!",
        "role": "user",
    }
    resp = requests.post(f"{base_url}/api/users", json=payload, headers=json_headers(admin_token))
    assert resp.status_code in (200, 201)
    data = resp.json()
    user_id = data.get("id") or data.get("user_id")
    assert user_id is not None, "Response should include new user id"
    CREATED_USER["id"] = user_id
    CREATED_USER["email"] = payload["email"]
    # Basic response structure checks
    assert data.get("name") == payload["name"] or data.get("email") == payload["email"]
    assert "id" in data or "user_id" in data


def test_get_user_by_id(base_url, admin_token):
    user_id = CREATED_USER["id"]
    if user_id is None:
        pytest.skip("Created user not available; skipping get-by-id test.")
    resp = requests.get(f"{base_url}/api/users/{user_id}", headers=json_headers(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("id") == user_id
    assert data.get("email") == CREATED_USER["email"]


def test_get_user_by_id_not_found(base_url, admin_token):
    resp = requests.get(f"{base_url}/api/users/99999999", headers=json_headers(admin_token))
    assert resp.status_code == 404


def test_update_user(base_url, admin_token):
    user_id = CREATED_USER["id"]
    if user_id is None:
        pytest.skip("Created user not available; skipping update test.")
    payload = {"name": "Updated Test User", "email": "updated@example.com"}
    resp = requests.put(f"{base_url}/api/users/{user_id}", json=payload, headers=json_headers(admin_token))
    assert resp.status_code in (200, 204)
    # Verify update
    resp2 = requests.get(f"{base_url}/api/users/{user_id}", headers=json_headers(admin_token))
    assert resp2.status_code == 200
    data = resp2.json()
    assert data.get("name") == payload["name"]
    assert data.get("email") == payload["email"]


def test_delete_user_as_admin(base_url, admin_token):
    user_id = CREATED_USER["id"]
    if user_id is None:
        pytest.skip("Created user not available; skipping delete test.")
    resp = requests.delete(f"{base_url}/api/users/{user_id}", headers=json_headers(admin_token))
    # Depending on implementation, delete may return 204 or 200
    assert resp.status_code in (200, 204)
    # Confirm deletion
    resp2 = requests.get(f"{base_url}/api/users/{user_id}", headers=json_headers(admin_token))
    assert resp2.status_code == 404
    CREATED_USER["id"] = None  # reset since it's deleted


def test_delete_user_with_non_admin(base_url, non_admin_token):
    # Attempt to delete a user with non-admin token should yield 403
    # If there is no created user yet, this test will create one quickly
    if CREATED_USER["id"] is None:
        payload = {
            "name": "Temp User",
            "email": "tempuser@example.com",
            "password": "Temp123!",
            "role": "user",
        }
        resp = requests.post(f"{base_url}/api/users", json=payload, headers=json_headers(non_admin_token))
        assert resp.status_code in (200, 201)
        CREATED_USER["id"] = resp.json().get("id") or resp.json().get("user_id")
        CREATED_USER["email"] = payload["email"]
    user_id = CREATED_USER["id"]
    resp = requests.delete(f"{base_url}/api/users/{user_id}", headers=json_headers(non_admin_token))
    assert resp.status_code == 403 or resp.status_code == 401


def test_create_user_invalid_input(base_url, admin_token):
    # Missing required field (e.g., password) should trigger validation error
    payload = {
        "name": "Invalid User",
        "email": "invalid@example.com",
        # password missing
        "role": "user",
    }
    resp = requests.post(f"{base_url}/api/users", json=payload, headers=json_headers(admin_token))
    # FastAPI typically returns 422 for validation errors
    assert resp.status_code in (400, 422)


def test_update_user_invalid_input(base_url, admin_token):
    user_id = CREATED_USER["id"]
    if user_id is None:
        pytest.skip("Created user not available; skipping invalid input test.")
    payload = {"email": "not-an-email"}  # invalid email format
    resp = requests.put(f"{base_url}/api/users/{user_id}", json=payload, headers=json_headers(admin_token))
    assert resp.status_code in (400, 422)


def test_response_validation_headers_and_structure(base_url, admin_token):
    resp = requests.get(f"{base_url}/api/users", headers=json_headers(admin_token))
    assert resp.status_code == 200
    assert resp.headers.get("Content-Type", "").lower().startswith("application/json")
    payload = resp.json()
    assert isinstance(payload, list)
    if payload:
        first = payload[0]
        # Basic structure checks for a user item
        assert "id" in first
        assert "email" in first


def test_data_persistence_after_create(base_url, admin_token):
    # Create a new user and verify persistence via a follow-up fetch
    payload = {
        "name": "Persistent User",
        "email": "persistent@example.com",
        "password": "Persistent123!",
        "role": "user",
    }
    resp = requests.post(f"{base_url}/api/users", json=payload, headers=json_headers(admin_token))
    assert resp.status_code in (200, 201)
    data = resp.json()
    user_id = data.get("id") or data.get("user_id")
    assert user_id is not None
    # Save for further checks
    CREATED_USER["id"] = user_id
    CREATED_USER["email"] = payload["email"]

    # Fetch to verify
    resp_get = requests.get(f"{base_url}/api/users/{user_id}", headers=json_headers(admin_token))
    assert resp_get.status_code == 200
    fetched = resp_get.json()
    assert fetched.get("email") == payload["email"]


@pytest.mark.skipif(os.getenv("SKIP_500_TEST") == "1",
                    reason="500 error test is disabled by default. Enable by setting SKIP_500_TEST=0.")
def test_internal_server_error(base_url, admin_token):
    # Endpoint that deliberately triggers a server error on the API side
    resp = requests.get(f"{base_url}/api/internal-error", headers=json_headers(admin_token))
    assert resp.status_code == 500

# Note:
# - The tests assume the FastAPI app exposes:
#   - POST /api/auth/login
#   - GET /api/users
#   - POST /api/users
#   - GET /api/users/{id}
#   - PUT /api/users/{id}
#   - DELETE /api/users/{id}
#   - Optional: /api/internal-error for 500 testing
# - If your app uses slightly different field names or response shapes,
#   adjust payloads and assertions accordingly.