.PHONY: help install accuracy-smoke accuracy-full lint test

help:
	@echo "AI-SCERN Makefile targets:"
	@echo "  make install         - install Python + Node deps"
	@echo "  make accuracy-smoke  - run <60s accuracy smoke test against vendored fixtures"
	@echo "  make accuracy-full   - run full calibration against Tiny-GenImage (network required)"
	@echo "  make lint            - run eslint + ruff"
	@echo "  make test            - run all unit + smoke tests"

install:
	cd frontend && pnpm install
	cd signal-worker && pip install -q -r requirements.txt pytest httpx

accuracy-smoke:
	cd signal-worker && python -m pytest tests/test_accuracy_fixture.py -v --tb=short -s -o asyncio_mode=auto -o addopts=""

accuracy-full:
	python signal-worker/scripts/fetch_calibration_dataset.py --output /tmp/calib_data --per-class 50
	python signal-worker/scripts/calibrate.py --dataset /tmp/calib_data --output /tmp/calib_report.json
	@echo "=== Calibration report ==="
	@cat /tmp/calib_report.json | python -c "import json,sys; r=json.load(sys.stdin); print(json.dumps(r, indent=2))"

lint:
	cd frontend && pnpm lint
	cd signal-worker && ruff check .

test:
	cd frontend && pnpm test
	cd signal-worker && python -m pytest tests/ -v --tb=short -o asyncio_mode=auto -o addopts=""
