# backend/tests/conftest.py
import uuid
import pytest
from unittest.mock import MagicMock
from cryptography.fernet import Fernet


@pytest.fixture
def test_fernet_key():
    return Fernet.generate_key().decode()


@pytest.fixture
def mock_db():
    return MagicMock()


@pytest.fixture
def mock_user():
    user = MagicMock()
    user.id = uuid.UUID("12345678-1234-5678-1234-567812345678")
    user.family_id = uuid.UUID("87654321-4321-8765-4321-876543210000")
    return user


@pytest.fixture
def mock_connection(test_fernet_key):
    from app.broker.encryption import encrypt
    conn = MagicMock()
    conn.id = uuid.UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    conn.account_id = uuid.UUID("11111111-2222-3333-4444-555555555555")
    conn.user_id = uuid.UUID("12345678-1234-5678-1234-567812345678")
    conn.api_key = encrypt("test_api_key", key=test_fernet_key)
    conn.api_secret = encrypt("test_api_secret", key=test_fernet_key)
    conn.access_token = encrypt("test_access_token", key=test_fernet_key)
    conn.broker = "kite"
    conn.zerodha_user_id = "ZP1234"
    conn.is_active = True
    conn.last_synced_at = None
    conn.token_expires_at = None
    return conn
