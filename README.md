# python-poetry-template

A lightweight, ready-to-use template for modern Python projects using [Poetry](https://python-poetry.org/).
Ideal for quick prototyping, scripting projects, or laying the foundation for scalable applications.

---

## Features

- Clean and minimal `pyproject.toml` with Poetry
- Script-based layout (`scripts/` folder)
- Pytest test setup under `tests/`
- Dependency locking with `poetry.lock`
- Coverage support via `pytest-cov`
- Code quality with `ruff` (linting + import sorting) and `black` (formatting)
- Type checking with `mypy`
- Pre-commit hooks via `.pre-commit-config.yaml`
- GitHub Actions CI workflow
- `Makefile` for common development tasks

---

## Getting Started

### 1. Create Your Project from this Template

- Click the green **Use this template** button at the top of this repository page.
- Choose **Create a new repository** and name your project (e.g., `my-python-tool`).
- Clone your new repository:

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_PROJECT_NAME.git
cd YOUR_PROJECT_NAME
```

### 2. Install Dependencies

Make sure [Poetry](https://python-poetry.org/docs/#installation) is installed, then run:

```bash
make install
# or
poetry install --with dev
```

### 3. Install Pre-commit Hooks

```bash
make hooks
# or
poetry run pre-commit install
```

### 4. Run the Script

```bash
# As a CLI command
poetry run template-script

# Or directly via Python
poetry run python scripts/template_script.py
```

### 5. Run Tests

```bash
make test
# or
poetry run pytest
```

With coverage:

```bash
make test-cov
```

---

## Makefile Commands

Run `make help` to see all available targets:

| Command               | Description                                   |
|-----------------------|-----------------------------------------------|
| `make install`        | Install project with all dependencies         |
| `make install-dev`    | Install with dev dependencies                 |
| `make update`         | Update dependencies                           |
| `make hooks`          | Install pre-commit hooks                      |
| `make lint`           | Run ruff linter                               |
| `make lint-fix`       | Run ruff linter with auto-fix                 |
| `make format`         | Format code with black                        |
| `make format-check`   | Check formatting without changes              |
| `make typecheck`      | Run MyPy type checks                          |
| `make codespell`      | Run codespell spell checker                   |
| `make fix`            | Run all auto-fixes (ruff + black)             |
| `make precommit`      | Run all pre-commit hooks                      |
| `make test`           | Run all tests                                 |
| `make test-v`         | Run all tests (verbose)                       |
| `make test-cov`       | Run tests with coverage report                |
| `make ci`             | Full CI pipeline (lint + format-check + test) |
| `make build`          | Build distribution package                    |
| `make publish`        | Publish to PyPI                               |
| `make bump-patch`     | Bump patch version                            |
| `make bump-minor`     | Bump minor version                            |
| `make bump-major`     | Bump major version                            |
| `make clean`          | Remove build artifacts and caches             |

---

## Project Structure

```text
python-poetry-template/
├── .github/
│   └── workflows/
│       └── ci.yml            # GitHub Actions CI workflow
├── .pre-commit-config.yaml   # Pre-commit hook configuration
├── .env.example              # Environment variable template
├── LICENSE                   # License file (MIT by default)
├── Makefile                  # Development task automation
├── pyproject.toml            # Poetry config, dependencies, tool config
├── poetry.lock               # Exact version locks for reproducibility
├── README.md                 # You're reading it
├── scripts/                  # Your Python scripts live here
│   ├── __init__.py
│   └── template_script.py
└── tests/                    # Pytest-based test suite
    ├── __init__.py
    └── test_example.py
```

---

## Example Script

```python
# scripts/template_script.py

def main():
    print("Hello from template script!")

if __name__ == "__main__":
    main()
```

---

## License

This project is licensed under the **MIT License**.
See [LICENSE](LICENSE) for details.

---

## Contributing

Feel free to fork this template, open issues, or submit pull requests.

---

> Created with love by Asterios Raptis
