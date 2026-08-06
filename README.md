# Свой Гараж

Marketplace автозапчастей: React SPA, FastAPI API, PostgreSQL, Redis и Celery.

## Быстрый локальный запуск

Prerequisites: Node.js 22 LTS, Python 3.11+, PostgreSQL, Redis, FFmpeg and
Playwright browsers (only for PDF label generation).

```bash
cp backend/.env.example backend/.env
cp frontend/my-autoparts/.env.example frontend/my-autoparts/.env
```

Set valid local database, email, and integration values in `backend/.env`.
Never add that file to Git.

```bash
cd backend
python -m venv venv
# Linux/macOS: source venv/bin/activate
# Windows PowerShell: .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
```

In separate terminals:

```bash
cd backend
celery -A app.celery_app worker --loglevel=info
```

```bash
cd frontend/my-autoparts
npm ci
npm start
```

The frontend runs on `http://localhost:3000`; the API runs on
`http://127.0.0.1:8080`.

## Verification

```bash
cd frontend/my-autoparts && npm test -- --watchAll=false
cd frontend/my-autoparts && npm run build
cd backend && python -m unittest tests.test_backup_service
```

## Production

The current production deployment is documented in
[`docs/ops/`](docs/ops/). Apply nginx configuration only after
`nginx -t`. The deploy script supports `update --rollback` after a previous
successful release has been recorded.

Backups and restoration are described in
[`docs/ops/backup-restore.md`](docs/ops/backup-restore.md). Restore only after
a successful staging drill.

## Security

- Production secrets belong in protected environment files or a secret manager,
  never in Git.
- Rotating credentials after any prior Git exposure is mandatory.
- API docs are disabled by default; enable them only for local development with
  `API_DOCS_ENABLED=true`.
