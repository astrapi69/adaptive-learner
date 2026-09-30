"""The unhandled-exception handler never echoes the exception text in
production (#3386).

``str(exc)`` of a SQLAlchemy ``IntegrityError`` / ``OperationalError``
carries the SQL, the bound parameter values and an sqlalche.me link. The
handler returned it as ``detail`` unconditionally, so it reached toasts and
the "Report issue" GitHub body. Outside DEBUG the body now carries a stable
generic message plus a short reference that is also logged.
"""

from __future__ import annotations

import asyncio
import json
import logging

import pytest
from starlette.requests import Request

import app.main as main_module

SECRET = "INSERT INTO users (email) VALUES ('alice@example.com') sk-ant-leak"


def _request() -> Request:
    return Request(
        {"type": "http", "method": "POST", "path": "/api/x", "headers": [], "query_string": b""}
    )


def _call(exc: Exception) -> dict[str, object]:
    response = asyncio.run(main_module.global_exception_handler(_request(), exc))
    assert response.status_code == 500
    return json.loads(response.body)


def test_production_body_carries_no_exception_text(monkeypatch, caplog):
    monkeypatch.setattr(main_module, "DEBUG", False)
    with caplog.at_level(logging.ERROR):
        body = _call(RuntimeError(SECRET))
    assert SECRET not in json.dumps(body)
    assert set(body) == {"detail", "reference"}
    reference = str(body["reference"])
    assert reference and reference in str(body["detail"])
    # The reference ties the toast to the full log line.
    assert any(
        reference in record.getMessage() and SECRET in record.getMessage()
        for record in caplog.records
    )


@pytest.mark.parametrize("debug", [True], ids=["debug"])
def test_debug_body_keeps_the_diagnostics(monkeypatch, debug):
    monkeypatch.setattr(main_module, "DEBUG", debug)
    body = _call(RuntimeError(SECRET))
    assert SECRET in str(body["detail"])
    assert {"stacktrace", "endpoint", "method", "reference"} <= set(body)
