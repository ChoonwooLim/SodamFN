import importlib


def test_noop_when_unconfigured(monkeypatch):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    monkeypatch.delenv("TELEGRAM_CHAT_ID", raising=False)
    import services.telegram_service as t
    importlib.reload(t)
    assert t.send_message("hello") is False  # no-op, 예외 없음


def test_calls_api_when_configured(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "TOK")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "123")
    import services.telegram_service as t
    importlib.reload(t)
    calls = {}

    def fake_post(url, json, timeout):
        calls["url"] = url
        calls["json"] = json
        class R:
            status_code = 200
            def json(self_): return {"ok": True}
        return R()

    monkeypatch.setattr(t.requests, "post", fake_post)
    assert t.send_message("hello") is True
    assert "TOK" in calls["url"] and calls["json"]["chat_id"] == "123"
    assert calls["json"]["text"] == "hello"
