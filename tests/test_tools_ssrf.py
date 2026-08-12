"""Unit tests for the SSRF guard in backend.agent.tools._assert_url_safe.

No Docker, LLM, or sandbox required — these test the pure URL-validation logic.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from backend.agent.tools import _assert_url_safe


class TestAssertUrlSafeBlocked:
    """URLs that must be rejected."""

    def test_rejects_ftp_scheme(self):
        with pytest.raises(ValueError, match="Skema URL"):
            _assert_url_safe("ftp://example.com/file.csv")

    def test_rejects_file_scheme(self):
        with pytest.raises(ValueError, match="Skema URL"):
            _assert_url_safe("file:///etc/passwd")

    def test_rejects_empty_scheme(self):
        with pytest.raises(ValueError, match="Skema URL"):
            _assert_url_safe("://missing-scheme.com")

    def test_rejects_no_host(self):
        with pytest.raises(ValueError):
            _assert_url_safe("http://")

    @patch("backend.agent.tools.socket.getaddrinfo")
    def test_rejects_loopback_ipv4(self, mock_gai):
        mock_gai.return_value = [(2, 1, 6, "", ("127.0.0.1", 0))]
        with pytest.raises(ValueError, match="internal|privat"):
            _assert_url_safe("http://localhost/secret")

    @patch("backend.agent.tools.socket.getaddrinfo")
    def test_rejects_private_10_range(self, mock_gai):
        mock_gai.return_value = [(2, 1, 6, "", ("10.0.0.1", 0))]
        with pytest.raises(ValueError, match="internal|privat"):
            _assert_url_safe("http://internal.corp/api")

    @patch("backend.agent.tools.socket.getaddrinfo")
    def test_rejects_private_172_range(self, mock_gai):
        mock_gai.return_value = [(2, 1, 6, "", ("172.16.0.1", 0))]
        with pytest.raises(ValueError, match="internal|privat"):
            _assert_url_safe("http://internal-service.local/data")

    @patch("backend.agent.tools.socket.getaddrinfo")
    def test_rejects_private_192_range(self, mock_gai):
        mock_gai.return_value = [(2, 1, 6, "", ("192.168.1.1", 0))]
        with pytest.raises(ValueError, match="internal|privat"):
            _assert_url_safe("http://router.local/admin")

    @patch("backend.agent.tools.socket.getaddrinfo")
    def test_rejects_link_local(self, mock_gai):
        mock_gai.return_value = [(2, 1, 6, "", ("169.254.169.254", 0))]
        with pytest.raises(ValueError, match="internal|privat"):
            _assert_url_safe("http://169.254.169.254/latest/meta-data/")

    @patch("backend.agent.tools.socket.getaddrinfo", side_effect=Exception("DNS fail"))
    def test_rejects_unresolvable_host(self, _):
        with pytest.raises(ValueError, match="resolve"):
            _assert_url_safe("http://nonexistent.invalid/data")


class TestAssertUrlSafeAllowed:
    """URLs that should pass validation."""

    @patch("backend.agent.tools.socket.getaddrinfo")
    def test_allows_public_https(self, mock_gai):
        mock_gai.return_value = [(2, 1, 6, "", ("93.184.216.34", 0))]
        _assert_url_safe("https://example.com/data.csv")  # should not raise

    @patch("backend.agent.tools.socket.getaddrinfo")
    def test_allows_public_http(self, mock_gai):
        mock_gai.return_value = [(2, 1, 6, "", ("8.8.8.8", 0))]
        _assert_url_safe("http://public-data.org/file.json")  # should not raise

    @patch("backend.agent.tools.socket.getaddrinfo")
    def test_allows_google_sheets_url(self, mock_gai):
        mock_gai.return_value = [(2, 1, 6, "", ("142.250.80.46", 0))]
        _assert_url_safe("https://docs.google.com/spreadsheets/d/abc123/export?format=csv")
