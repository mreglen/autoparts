CREATE TABLE IF NOT EXISTS avito_autoload_jobs (
    id SERIAL PRIMARY KEY,
    organization_id VARCHAR(10) NOT NULL
        REFERENCES organizations(id) ON DELETE CASCADE,
    created_by INTEGER
        REFERENCES users(id) ON DELETE SET NULL,
    job_type VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    stage VARCHAR(64) NOT NULL DEFAULT 'queued',
    processed_count INTEGER NOT NULL DEFAULT 0,
    total_count INTEGER NOT NULL DEFAULT 0,
    celery_task_id VARCHAR(128),
    result_file_ref VARCHAR(512),
    payload_json TEXT,
    result_json TEXT,
    error_summary TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_avito_autoload_jobs_org_id
    ON avito_autoload_jobs (organization_id);
CREATE INDEX IF NOT EXISTS ix_avito_autoload_jobs_status
    ON avito_autoload_jobs (status);
CREATE INDEX IF NOT EXISTS ix_avito_autoload_jobs_task_id
    ON avito_autoload_jobs (celery_task_id);
