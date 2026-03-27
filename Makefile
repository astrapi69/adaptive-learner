.DEFAULT_GOAL := help
SHELL := /bin/bash

SRC_DIRS := scripts/ tests/

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

.PHONY: lock-install
lock-install: ## Lock and install project dependencies
	poetry lock
	poetry install

.PHONY: install
install: ## Install project with all dependencies
	poetry install

.PHONY: install-dev
install-dev: ## Install with dev dependencies
	poetry install --with dev

.PHONY: update
update: ## Update dependencies
	poetry update

.PHONY: hooks
hooks: ## Install pre-commit hooks
	poetry run pre-commit install

# ---------------------------------------------------------------------------
# Code Quality
# ---------------------------------------------------------------------------

.PHONY: lint
lint: ## Run ruff linter
	poetry run ruff check $(SRC_DIRS)

.PHONY: lint-fix
lint-fix: ## Run ruff linter with auto-fix
	poetry run ruff check $(SRC_DIRS) --fix --unsafe-fixes

.PHONY: format
format: ## Format code with black
	poetry run black $(SRC_DIRS)

.PHONY: format-check
format-check: ## Check formatting without changes
	poetry run black --check $(SRC_DIRS)

.PHONY: typecheck
typecheck: ## Run MyPy type checks
	poetry run mypy scripts/

.PHONY: codespell
codespell: ## Run codespell
	poetry run codespell $(SRC_DIRS)

.PHONY: codespell-fix
codespell-fix: ## Run codespell with auto-fix
	poetry run codespell $(SRC_DIRS) --write-changes

.PHONY: precommit
precommit: ## Run all pre-commit hooks
	poetry run pre-commit run -a

.PHONY: fix
fix: ## Run all auto-fixes (ruff + black)
	poetry run ruff check $(SRC_DIRS) --fix --unsafe-fixes
	poetry run black $(SRC_DIRS)

# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

.PHONY: test
test: ## Run all tests
	poetry run pytest

.PHONY: test-v
test-v: ## Run all tests (verbose)
	poetry run pytest -v

.PHONY: test-fast
test-fast: ## Run tests without coverage (faster)
	poetry run pytest -q --maxfail=1 --disable-warnings --no-cov

.PHONY: test-cov
test-cov: ## Run tests with coverage report
	poetry run pytest --cov=scripts --cov-report=term-missing

.PHONY: test-xml
test-xml: ## Run tests with XML coverage (for CI)
	poetry run pytest -q --maxfail=1 --disable-warnings --cov=scripts --cov-report=xml

# ---------------------------------------------------------------------------
# CI
# ---------------------------------------------------------------------------

.PHONY: ci
ci: lint format-check test ## Full CI pipeline (lint + format-check + test)

# ---------------------------------------------------------------------------
# Version Management
# ---------------------------------------------------------------------------

.PHONY: bump-patch
bump-patch: ## Bump patch version (0.1.0 -> 0.1.1)
	poetry version patch

.PHONY: bump-minor
bump-minor: ## Bump minor version (0.1.0 -> 0.2.0)
	poetry version minor

.PHONY: bump-major
bump-major: ## Bump major version (0.1.0 -> 1.0.0)
	poetry version major

# ---------------------------------------------------------------------------
# Build & Publish
# ---------------------------------------------------------------------------

.PHONY: build
build: ## Build distribution package
	poetry build

.PHONY: publish
publish: ci build ## Run CI, build and publish to PyPI
	poetry publish

.PHONY: publish-test
publish-test: ci build ## Run CI, build and publish to TestPyPI
	poetry publish -r testpypi

# ---------------------------------------------------------------------------
# Git
# ---------------------------------------------------------------------------

.PHONY: git-setup
git-setup: ## Configure git hooks and commit template
	git config core.hooksPath .githooks
	git config commit.template .gitmessage
	chmod +x .githooks/*
	@echo "Git hooks and commit template activated."

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------

.PHONY: clean
clean: ## Remove build artifacts and caches
	rm -rf dist/ build/ .pytest_cache/ .ruff_cache/ .mypy_cache/ .coverage coverage.xml htmlcov/
	find scripts/ tests/ -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -name '*.pyc' -delete

.PHONY: clean-venv
clean-venv: ## Remove Poetry virtualenv
	poetry env remove --all || true

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
