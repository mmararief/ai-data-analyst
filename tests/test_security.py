"""Unit tests for backend.core.security — JWT and password helpers.

Covers:
  - hash_password / verify_password round-trip
  - create_access_token / create_refresh_token structure & expiry
  - verify_refresh_token with valid, expired, and wrong-type tokens
  - get_current_user dependency (valid token, missing user, bad token)
"""

from __future__ import annotations

import time
from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from jose import jwt

from backend.core.config import SECRET_KEY, ALGORITHM
from backend.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    get_current_user,
    REFRESH_TOKEN_EXPIRE_DAYS,
)


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------
class TestPasswordHashing:
    def test_round_trip(self):
        hashed = hash_password("s3cret!")
        assert verify_password("s3cret!", hashed) is True

    def test_wrong_password_rejected(self):
        hashed = hash_password("correct")
        assert verify_password("wrong", hashed) is False

    def test_hash_is_not_plaintext(self):
        hashed = hash_password("mypassword")
        assert hashed != "mypassword"

    def test_different_hashes_for_same_password(self):
        h1 = hash_password("same")
        h2 = hash_password("same")
        assert h1 != h2  # bcrypt salt differs each time


# ---------------------------------------------------------------------------
# Access tokens
# ---------------------------------------------------------------------------
class TestAccessToken:
    def test_contains_expected_claims(self):
        token = create_access_token({"sub": "alice", "user_id": "u1"})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "alice"
        assert payload["user_id"] == "u1"
        assert payload["type"] == "access"
        assert "exp" in payload

    def test_custom_expiry_delta(self):
        token = create_access_token({"sub": "bob"}, expires_delta=timedelta(minutes=5))
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # Token should expire roughly 5 minutes from now
        remaining = payload["exp"] - time.time()
        assert 200 < remaining < 310  # generous tolerance

    def test_does_not_mutate_input_dict(self):
        data = {"sub": "eve"}
        create_access_token(data)
        assert "exp" not in data
        assert "type" not in data


# ---------------------------------------------------------------------------
# Refresh tokens
# ---------------------------------------------------------------------------
class TestRefreshToken:
    def test_contains_refresh_type(self):
        token = create_refresh_token({"sub": "carol"})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["type"] == "refresh"
        assert payload["sub"] == "carol"

    def test_expiry_is_multi_day(self):
        token = create_refresh_token({"sub": "dave"})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        remaining_days = (payload["exp"] - time.time()) / 86400
        assert remaining_days > (REFRESH_TOKEN_EXPIRE_DAYS - 1)


# ---------------------------------------------------------------------------
# verify_refresh_token
# ---------------------------------------------------------------------------
class TestVerifyRefreshToken:
    def test_valid_refresh_token(self):
        token = create_refresh_token({"sub": "alice"})
        result = verify_refresh_token(token)
        assert result is not None
        assert result["sub"] == "alice"

    def test_rejects_access_token(self):
        token = create_access_token({"sub": "alice"})
        assert verify_refresh_token(token) is None

    def test_rejects_expired_token(self):
        token = create_refresh_token({"sub": "alice"})
        # Manually create an expired token
        expired = jwt.encode(
            {"sub": "alice", "type": "refresh", "exp": time.time() - 10},
            SECRET_KEY,
            algorithm=ALGORITHM,
        )
        assert verify_refresh_token(expired) is None

    def test_rejects_garbage_string(self):
        assert verify_refresh_token("not.a.real.token") is None

    def test_rejects_token_with_wrong_secret(self):
        bad_token = jwt.encode(
            {"sub": "alice", "type": "refresh", "exp": time.time() + 3600},
            "wrong-secret-key",
            algorithm=ALGORITHM,
        )
        assert verify_refresh_token(bad_token) is None


# ---------------------------------------------------------------------------
# get_current_user dependency
# ---------------------------------------------------------------------------
class TestGetCurrentUser:
    def _make_access_token(self, sub: str, user_id: str = "u1") -> str:
        return create_access_token({"sub": sub, "user_id": user_id})

    def test_valid_token_returns_user(self):
        token = self._make_access_token("alice")
        mock_row = MagicMock()
        mock_row.user_id = "u1"
        mock_row.username = "alice"
        mock_row.hashed_password = "hashed"

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_row

        user = get_current_user(token=token, db=mock_db)
        assert user.username == "alice"

    def test_refresh_token_rejected(self):
        token = create_refresh_token({"sub": "alice"})
        mock_db = MagicMock()
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(token=token, db=mock_db)
        assert exc_info.value.status_code == 401

    def test_missing_sub_claim(self):
        token = jwt.encode(
            {"type": "access", "exp": time.time() + 3600},
            SECRET_KEY,
            algorithm=ALGORITHM,
        )
        mock_db = MagicMock()
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(token=token, db=mock_db)
        assert exc_info.value.status_code == 401

    def test_user_not_found_in_db(self):
        token = self._make_access_token("ghost")
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(token=token, db=mock_db)
        assert exc_info.value.status_code == 401

    def test_invalid_token_string(self):
        mock_db = MagicMock()
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(token="garbage.token.here", db=mock_db)
        assert exc_info.value.status_code == 401
