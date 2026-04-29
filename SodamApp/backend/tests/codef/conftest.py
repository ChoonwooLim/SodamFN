"""CODEF 테스트 공통 픽스처.

- mock_codef_sdk: easycodefpy.Codef 인스턴스를 mock 으로 대체
- codef_env: 환경변수 setup
"""
import pytest
from unittest.mock import MagicMock


@pytest.fixture
def codef_env(monkeypatch):
    monkeypatch.setenv("CODEF_CLIENT_ID", "test-client-id")
    monkeypatch.setenv("CODEF_CLIENT_SECRET", "test-secret")
    monkeypatch.setenv(
        "CODEF_PUBLIC_KEY",
        "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjTpwVhvGAdLrRfSlRCdNhfg3"
        "neR33yHSjULwsYJrzlUALn+p+2xG8q+TorInmvdPd4L7yhtFHZ01g3ngdI3nlOM234F9"
        "Fuq5lGW85s7h/u6AawKFVd8pCLoGIyEITPQw0GbGmIJ2KumulMMaFdlvZEz/H5X6hU7K"
        "EC5eopZn9A5XHnkjoUh0iv7wuYAPWUBqjCJqePa9whzWL4VQFs0OawI7BXAl/liYQpWk"
        "CBzXmRcOcak6Xt8B1LchMYDt6MvvQq4+ZxjKoetzTxUfY5b5lWt1ELX296wvt8Pb0lP1"
        "Im1/WdOqs+VBcClaxBoP0EHMVE1OTr+aQYZVteg/EakWuQIDAQAB",
    )
    monkeypatch.setenv("CODEF_ENV", "demo")


@pytest.fixture
def mock_codef_sdk(monkeypatch, codef_env):
    """easycodefpy.Codef() 호출 시 mock 인스턴스 반환."""
    sdk = MagicMock()
    sdk.set_client_info = MagicMock()
    sdk.create_account = MagicMock()
    sdk.request_product = MagicMock()
    monkeypatch.setattr("services.codef.codef_client.Codef", lambda: sdk)
    return sdk
