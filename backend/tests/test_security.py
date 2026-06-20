"""تست‌های واحدِ امنیت — JWT و parsing محدودیت نرخ."""
import pytest

from src.shared.errors.exceptions import AuthError
from src.shared.security.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from src.shared.security.password import hash_password, verify_password
from src.shared.security.rate_limit import _parse_rule


def test_access_token_roundtrip():
    token = create_access_token("user-1", ["admin"], ["students:read"],
                                email="a@b.c", full_name="علی")
    payload = decode_token(token)
    assert payload["sub"] == "user-1"
    assert payload["type"] == "access"
    assert "students:read" in payload["perms"]
    assert payload["email"] == "a@b.c"


def test_refresh_token_has_jti():
    token, jti = create_refresh_token("user-1")
    payload = decode_token(token)
    assert payload["type"] == "refresh"
    assert payload["jti"] == jti


def test_decode_invalid_token_raises():
    with pytest.raises(AuthError):
        decode_token("not-a-valid-token")


def test_password_hashing():
    hashed = hash_password("Secret@123")
    assert hashed != "Secret@123"
    assert verify_password("Secret@123", hashed)
    assert not verify_password("wrong", hashed)


@pytest.mark.parametrize("rule,expected", [
    ("100/minute", (100, 60)),
    ("5/second", (5, 1)),
    ("1000/hour", (1000, 3600)),
])
def test_parse_rate_rule(rule, expected):
    assert _parse_rule(rule) == expected
