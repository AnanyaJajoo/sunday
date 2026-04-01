from __future__ import annotations

import py_compile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


def test_all_python_files_compile() -> None:
    for path in sorted(REPO_ROOT.rglob("*.py")):
        if "__pycache__" in path.parts:
            continue
        py_compile.compile(str(path), doraise=True)
