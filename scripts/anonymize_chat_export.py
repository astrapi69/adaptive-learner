"""Anonymize a Claude.ai per-conversation Markdown export.

Used once to derive the committed test fixture
``frontend/src/chat_import/__fixtures__/claude-markdown-export.md``
from a user-supplied real export. The committed fixture is the
output of this script; the raw export is kept out of git.

Scrubs:
  - First names listed in NAMES (replaced with "TestUser")
  - Cross-chat references in REFS (replaced with generic terms)
  - The Claude.ai chat URL UUID (the conversation link in the
    metadata header) replaced with a constant.

Leaves intact:
  - All grammar content, exercises, answers
  - Timestamps (harmless)
  - Code fences, formatting
  - Tool/thought-process blocks (these are part of the real
    export shape and parsers must handle them)
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

NAMES = ["Aster"]

# Cross-chat / other-topic references the user mentions
# in this conversation. Replaced to preserve the grammar
# learning topic without leaking the user's other learning
# history.
REFS = {
    "Docker + Skills Sessions": "earlier topic sessions",
    "Docker and Skills sessions": "earlier topic sessions",
    "Docker and Ansible": "previous topics",
    "Docker sessions": "previous topic sessions",
    "Docker session": "previous topic session",
    "Docker learning": "previous topic learning",
    "Docker": "the previous topic",
    "Ansible": "another topic",
    "Skills Sessions": "previous sessions",
    "Skills sessions": "previous sessions",
    "Skills": "previous sessions",
}

CHAT_URL_RE = re.compile(
    r"https://claude\.ai/chat/[0-9a-f-]+",
)


def anonymize(text: str) -> str:
    for ref_in, ref_out in REFS.items():
        text = text.replace(ref_in, ref_out)
    for name in NAMES:
        text = re.sub(rf"\b{re.escape(name)}\b", "TestUser", text)
        text = re.sub(
            rf"\b{re.escape(name)}'s\b",
            "TestUser's",
            text,
        )
    text = CHAT_URL_RE.sub(
        "https://claude.ai/chat/00000000-0000-0000-0000-000000000000",
        text,
    )
    return text


def main() -> int:
    if len(sys.argv) != 3:
        print(
            "usage: anonymize_chat_export.py <input.md> <output.md>",
            file=sys.stderr,
        )
        return 2
    inp = Path(sys.argv[1])
    out = Path(sys.argv[2])
    out.write_text(anonymize(inp.read_text(encoding="utf-8")), encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
