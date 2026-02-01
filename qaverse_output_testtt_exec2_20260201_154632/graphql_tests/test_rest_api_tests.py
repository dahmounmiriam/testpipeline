import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "adminpass")


def login(base_url: str, email: str, password: str):
    try:
        resp = requests.post(f"{base_url}/api/auth/login", json={"email": email, "password": password}, timeout=5)
    except requests.RequestException:
        return None
    if resp.status_code != 200:
        return None
    try:
        data = resp.json()
    except ValueError:
        return None
    # Support common token field names
    return data.get("access_token") or data.get("token") or data.get("jwt")


@pytest.fixture
def base_url():
    return BASE_URL


@pytest.fixture
def admin_headers(base_url):
    token = login(base_url, ADMIN_EMAIL, ADMIN_PASSWORD)
    if not token:
        pytest.skip("Admin credentials not available")
    return {"Authorization": f"Bearer {token}"}


def test_login_with_valid_credentials(base_url):
    token = login(base_url, ADMIN_EMAIL, ADMIN_PASSWORD)
    assert token is not None and isinstance(token, str)


def test_login_with_invalid_credentials(base_url):
    token = login(base_url, "nonexistent@example.com", "wrongpassword")
    assert token is None


def test_auth_logout_flow(base_url, admin_headers):
    # Obtain fresh token
    token = login(base_url, ADMIN_EMAIL, ADMIN_PASSWORD)
    assert token is not None
    headers = {"Authorization": f"Bearer {token}"}

    # Logout and ensure token is invalidated for protected endpoints
    resp = requests.post(f"{base_url}/api/auth/logout", headers=headers)
    assert resp.status_code in (200, 204, 202)

    # Access protected endpoint with the same token should fail
    resp2 = requests.get(f"{base_url}/api/users", headers=headers)
    assert resp2.status_code in (401, 403)


def test_protected_endpoints_require_auth(base_url):
    resp = requests.get(f"{base_url}/api/users")
    assert resp.status_code in (401, 403)


def test_user_crud_workflow(base_url, admin_headers):
    # Create a new user as admin
    new_email = f"qa-user-{uuid.uuid4()}@example.com"
    payload = {
        "email": new_email,
        "name": "QA User",
        "password": "testpass123",
        "role": "user"
    }
    resp = requests.post(f"{base_url}/api/users", json=payload, headers=admin_headers, timeout=10)
    assert resp.status_code in (200, 201)
    try:
        data = resp.json()
    except ValueError:
        pytest.fail("Response is not valid JSON on user creation")

    user_id = data.get("id") or data.get("user_id")
    assert user_id is not None

    # List users and verify presence
    resp_list = requests.get(f"{base_url}/api/users", headers=admin_headers, timeout=10)
    assert resp_list.status_code == 200
    try:
        users = resp_list.json()
    except ValueError:
        pytest.fail("Response is not valid JSON for user list")
    assert isinstance(users, list)

    assert any((u.get("id") == user_id) or (u.get("email") == new_email) for u in users)

    # Get user by id
    resp_get = requests.get(f"{base_url}/api/users/{user_id}", headers=admin_headers, timeout=10)
    assert resp_get.status_code == 200
    try:
        user_details = resp_get.json()
    except ValueError:
        pytest.fail("Response is not valid JSON for user detail")
    assert user_details.get("id") == user_id or user_details.get("user_id") == user_id
    assert user_details.get("email") == new_email

    # Update user as admin
    update_payload = {"name": "QA User Updated"}
    resp_update = requests.put(f"{base_url}/api/users/{user_id}", json=update_payload, headers=admin_headers, timeout=10)
    assert resp_update.status_code == 200

    # Login as the new user to test authorization
    user_token = login(base_url, new_email, "testpass123")
    assert user_token is not None
    headers_user = {"Authorization": f"Bearer {user_token}"}

    # Unauthorized update attempt by non-admin
    resp_unauth_update = requests.put(f"{base_url}/api/users/{user_id}", json={"name": "Hack Attempt"}, headers=headers_user, timeout=10)
    assert resp_unauth_update.status_code in (403, 401)

    # Delete user as admin
    resp_delete = requests.delete(f"{base_url}/api/users/{user_id}", headers=admin_headers, timeout=10)
    assert resp_delete.status_code in (200, 204)

    # Verify user no longer exists
    resp_get_after_delete = requests.get(f"{base_url}/api/users/{user_id}", headers=admin_headers, timeout=10)
    assert resp_get_after_delete.status_code == 404


def test_create_user_input_validation(base_url, admin_headers):
    # Missing required field 'email'
    payload = {
        "name": "Invalid User",
        "password": "pw123",
        "role": "user"
    }
    resp = requests.post(f"{base_url}/api/users", json=payload, headers=admin_headers)
    assert resp.status_code in (400, 422)

    # Invalid email format
    payload_bad_email = {
        "email": "not-an-email",
        "name": "Invalid Email",
        "password": "pw123",
        "role": "user"
    }
    resp2 = requests.post(f"{base_url}/api/users", json=payload_bad_email, headers=admin_headers)
    assert resp2.status_code in (400, 422)


def test_get_user_not_found(base_url, admin_headers):
    resp = requests.get(f"{base_url}/api/users/999999999999", headers=admin_headers)
    assert resp.status_code == 404


def test_server_error_trigger(base_url, admin_headers):
    # This test attempts to trigger a 500 error if the server exposes such a route.
    # If the endpoint is not configured, the test will be skipped gracefully.
    try:
        resp = requests.get(f"{base_url}/api/trigger-error?mode=500", headers=admin_headers, timeout=5)
    except requests.RequestException:
        pytest.skip("Server error trigger endpoint not available")

    if resp.status_code == 500:
        assert True
    else:
        pytest.skip("Server error endpoint not configured to return 500 in this environment")


def test_response_structure_and_headers(base_url, admin_headers):
    resp = requests.get(f"{base_url}/api/users", headers=admin_headers, timeout=10)
    assert resp.status_code == 200
    assert "application/json" in resp.headers.get("Content-Type", "")
    try:
        body = resp.json()
    except ValueError:
        pytest.fail("Response is not valid JSON")
    assert isinstance(body, list)