-- =====================================================
-- Migration: Create Push Subscriptions Table
-- Purpose: Store browser push notification subscriptions
-- =====================================================

CREATE TABLE push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    endpoint TEXT NOT NULL,
    p256dh VARCHAR NOT NULL,
    auth VARCHAR NOT NULL,
    user_agent VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_active ON push_subscriptions(user_id, is_active);

-- Verification
SELECT COUNT(*) FROM push_subscriptions; -- Should return 0 initially
