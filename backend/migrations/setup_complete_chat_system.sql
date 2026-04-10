-- =====================================================
-- Migration: Setup complete chat system
-- Run this script to create all necessary tables
-- =====================================================

-- 1. First ensure users table has primary key
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') 
    AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'users' AND constraint_type = 'PRIMARY KEY') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id') THEN
            ALTER TABLE users ADD PRIMARY KEY (id);
            RAISE NOTICE '✓ Primary key added to users table';
        END IF;
    ELSE
        RAISE NOTICE '✓ Users table already has primary key';
    END IF;
END $$;

-- 2. Ensure products table has primary key
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') 
    AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'products' AND constraint_type = 'PRIMARY KEY') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'id') THEN
            ALTER TABLE products ADD PRIMARY KEY (id);
            RAISE NOTICE '✓ Primary key added to products table';
        END IF;
    ELSE
        RAISE NOTICE '✓ Products table already has primary key';
    END IF;
END $$;

-- 3. Drop old chat tables if they exist (in correct order)
DROP TABLE IF EXISTS chat_blocked_users CASCADE;
DROP TABLE IF EXISTS chat_media CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS chats CASCADE;

RAISE NOTICE '✓ Old chat tables dropped';

-- 4. Create chats table
CREATE TABLE chats (
    id SERIAL PRIMARY KEY,
    buyer_id INTEGER NOT NULL REFERENCES users(id),
    seller_id INTEGER NOT NULL REFERENCES users(id),
    product_id INTEGER REFERENCES products(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_chats_buyer_id ON chats(buyer_id);
CREATE INDEX idx_chats_seller_id ON chats(seller_id);
CREATE INDEX idx_chats_product_id ON chats(product_id);

RAISE NOTICE '✓ Chats table created';

-- 5. Create messages table
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

RAISE NOTICE '✓ Messages table created';

-- 6. Create chat_media table
CREATE TABLE chat_media (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    media_type VARCHAR(20) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    thumbnail_path VARCHAR(500),
    original_filename VARCHAR(255),
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    width INTEGER,
    height INTEGER,
    duration FLOAT,
    is_processing BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chat_media_message_id ON chat_media(message_id);

RAISE NOTICE '✓ Chat media table created';

-- 7. Create chat_blocked_users table
CREATE TABLE chat_blocked_users (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    blocked_by_id INTEGER NOT NULL REFERENCES users(id),
    blocked_user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(chat_id, blocked_user_id)
);

CREATE INDEX idx_chat_blocked_chat_user ON chat_blocked_users(chat_id, blocked_user_id);
CREATE INDEX idx_chat_blocked_by ON chat_blocked_users(blocked_by_id);
CREATE INDEX idx_chat_blocked_user ON chat_blocked_users(blocked_user_id);

RAISE NOTICE '✓ Chat blocked users table created';

-- Final verification
SELECT 
    table_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.table_constraints 
            WHERE table_name = t.table_name AND constraint_type = 'PRIMARY KEY'
        ) THEN '✓ Has PK'
        ELSE '✗ Missing PK'
    END as pk_status,
    (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name IN ('users', 'products', 'chats', 'messages', 'chat_media', 'chat_blocked_users')
ORDER BY table_name;
