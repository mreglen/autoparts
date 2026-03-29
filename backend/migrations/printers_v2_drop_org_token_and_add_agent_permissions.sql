

CREATE TABLE IF NOT EXISTS printer_agents (
    id SERIAL PRIMARY KEY,
    organization_id VARCHAR(10) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    printer_token VARCHAR(64) NOT NULL UNIQUE,
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    hostname VARCHAR(255),
    device_info VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_printer_agents_organization_id
ON printer_agents(organization_id);

CREATE INDEX IF NOT EXISTS idx_printer_agents_last_seen
ON printer_agents(last_seen);


CREATE TABLE IF NOT EXISTS printer_agent_printers (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL REFERENCES printer_agents(id) ON DELETE CASCADE,
    printer_name VARCHAR(255) NOT NULL,
    driver_name VARCHAR(255),
    port_name VARCHAR(255),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(agent_id, printer_name)
);

CREATE INDEX IF NOT EXISTS idx_printer_agent_printers_agent_id
ON printer_agent_printers(agent_id);


CREATE TABLE IF NOT EXISTS printer_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    printer_id INTEGER NOT NULL REFERENCES printer_agent_printers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_printer_permissions_user_printer UNIQUE(user_id, printer_id)
);

CREATE INDEX IF NOT EXISTS idx_printer_permissions_user_id
ON printer_permissions(user_id);

