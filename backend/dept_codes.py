"""Canonical diploma department codes and legacy aliases.

The former Computer Hardware Engineering branch (CM) was renamed
Computer Science and Technology (CG). Related records keep the same
department primary key; only the unique code string changed.
"""

DEPT_CODE_ALIASES = {
    "CM": "CG",
}


def canonical_dept_code(code: str) -> str:
    if not code:
        return code
    normalized = code.strip().upper()
    return DEPT_CODE_ALIASES.get(normalized, normalized)
