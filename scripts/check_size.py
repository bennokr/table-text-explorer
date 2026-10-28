"""Count Python AST statements, independent of formatting and comments."""

import ast
from pathlib import Path

EXCLUDED = {"node_modules", "dist", "dist-feasibility", "vendor", ".cache", ".venv"}


def main():
    counts = {}
    for path in Path(".").rglob("*.py"):
        if EXCLUDED.intersection(path.parts):
            continue
        tree = ast.parse(path.read_text(), filename=str(path))
        counts[path] = sum(isinstance(node, ast.stmt) for node in ast.walk(tree))
    for path, count in counts.items():
        print(f"{path}: {count} Python statements")
    oversized = [path for path, count in counts.items() if count > 250]
    if oversized or sum(counts.values()) > 2500:
        raise SystemExit(
            "Python statement budget exceeded; split responsibilities, keep readability."
        )


if __name__ == "__main__":
    main()
