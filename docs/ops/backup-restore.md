# Backup and restore runbook

## Scope

The application creates separate PostgreSQL (`db-*.sql.gz`) and uploads
(`uploads-*.tar.gz`) archives in `backend/backups/`. A restore is a privileged,
manual operation and must first be rehearsed on staging.

## Before every restore

1. Record the incident, selected backup filenames, current Git SHA, and operator.
2. Put the site into maintenance mode and stop `kroan` and `celery`.
3. Create fresh database and uploads backups before changing anything.
4. Download the chosen archives to a second, access-controlled location and
   verify their checksums with `sha256sum`.

## Restore a staging database

```bash
gzip -cd backend/backups/db-scheduled-YYYYMMDD-HHMMSS.sql.gz \
  | psql "$DATABASE_URL_DIRECT" -v ON_ERROR_STOP=1
```

Use an empty staging database. Never execute the command against production
until the archive and restoration have been validated in staging.

## Restore uploads

```bash
mkdir -p /srv/autoparts-restore
tar -xzf backend/backups/uploads-scheduled-YYYYMMDD-HHMMSS.tar.gz \
  -C /srv/autoparts-restore --no-same-owner --no-same-permissions
rsync -a --delete /srv/autoparts-restore/uploads/ backend/uploads/
```

Verify that the archive contains only the `uploads/` prefix before rsyncing.

## Validation and return to service

1. Start `kroan`, wait for `/api/auth/public-site-config` to return HTTP 200,
   then start `celery`.
2. Validate public catalog, authenticated seller account, one existing order,
   one product image, and WebSocket chat connection.
3. Check `journalctl -u kroan`, `journalctl -u celery`, nginx errors, and
   PostgreSQL logs for 30 minutes.
4. Record the outcome and archive checksums in the incident ticket.

## Quarterly restore drill

Run the staging restore sequence quarterly. A backup is not considered valid
until a restore drill has completed successfully and its evidence is recorded.
