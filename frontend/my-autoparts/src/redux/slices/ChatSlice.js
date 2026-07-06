import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { API_BASE, apiRequest, apiRequestFormData, getWebSocketBaseUrl } from '../../utils/apiClient';
import { fetchAvitoChatDetail, fetchAvitoChats, fetchAvitoMessages } from './AvitoChatSlice';

// WebSocket подключение
let ws = null;
let wsReconnectTimer = null;
let wsReconnectAttempts = 0;
let pingInterval = null;
let lastPongAt = 0;
let wsActiveUserId = null;
let wsRecoveryListenersAttached = false;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000; // 1 секунда
const PING_INTERVAL_MS = 30000;
const PONG_TIMEOUT_MS = 70000;

const mergeMessageWithTempReply = (serverMessage, tempMessage) => {
    if (!tempMessage) return serverMessage;

    const merged = { ...serverMessage };
    if (!merged.reply_to_id && tempMessage.reply_to_id) {
        merged.reply_to_id = tempMessage.reply_to_id;
    }
    if (!merged.reply_to && tempMessage.reply_to) {
        merged.reply_to = tempMessage.reply_to;
    }
    return merged;
};

// --- Async Thunks ---

// Получить список чатов пользователя
export const fetchUserChats = createAsyncThunk(
    'chats/fetchUserChats',
    async ({ skip = 0, limit = 50 }, { rejectWithValue }) => {
        try {
            const response = await apiRequest(`/chats/?skip=${skip}&limit=${limit}`);
            return response;
        } catch (err) {
            return rejectWithValue(err?.response?.data?.detail || err?.message || 'Ошибка загрузки чатов');
        }
    }
);

// Создать или получить существующий чат
export const createOrGetChat = createAsyncThunk(
    'chats/createOrGetChat',
    async (chatData, { rejectWithValue }) => {
        try {
            const response = await apiRequest('/chats/', {
                method: 'POST',
                body: JSON.stringify(chatData),
            });
            return response;
        } catch (err) {
            return rejectWithValue(err?.response?.data?.detail || err?.message || 'Ошибка создания чата');
        }
    }
);

export const createOrGetChatWithUser = createAsyncThunk(
    'chats/createOrGetChatWithUser',
    async (targetUserId, { rejectWithValue }) => {
        try {
            return await apiRequest(`/chats/with-user/${targetUserId}`, { method: 'POST' });
        } catch (err) {
            return rejectWithValue(err?.response?.data?.detail || err?.message || 'Ошибка создания чата');
        }
    }
);

export const createCustomGroupChat = createAsyncThunk(
    'chats/createCustomGroupChat',
    async ({ title, participantIds, organizationId }, { rejectWithValue }) => {
        try {
            return await apiRequest('/chats/custom', {
                method: 'POST',
                body: JSON.stringify({
                    title,
                    participant_ids: participantIds || [],
                    organization_id: organizationId || null,
                }),
            });
        } catch (err) {
            return rejectWithValue(err?.response?.data?.detail || err?.message || 'Ошибка создания чата');
        }
    }
);

export const deleteCustomChat = createAsyncThunk(
    'chats/deleteCustomChat',
    async (chatId, { rejectWithValue, dispatch }) => {
        try {
            await apiRequest(`/chats/${chatId}`, { method: 'DELETE' });
            dispatch(fetchUserChats({}));
            return chatId;
        } catch (err) {
            return rejectWithValue(err?.response?.data?.detail || err?.message || 'Ошибка удаления чата');
        }
    }
);

export const fetchManageableUsers = createAsyncThunk(
    'chats/fetchManageableUsers',
    async ({ q = '', chatId = null, limit = 30 }, { rejectWithValue }) => {
        try {
            const params = new URLSearchParams({ q, limit: String(limit) });
            if (chatId != null) params.set('chat_id', String(chatId));
            return await apiRequest(`/chats/manageable-users?${params.toString()}`);
        } catch (err) {
            return rejectWithValue(err?.response?.data?.detail || err?.message || 'Ошибка загрузки пользователей');
        }
    }
);

export const addChatParticipant = createAsyncThunk(
    'chats/addChatParticipant',
    async ({ chatId, userId }, { rejectWithValue }) => {
        try {
            await apiRequest(`/chats/${chatId}/participants`, {
                method: 'POST',
                body: JSON.stringify({ user_id: userId }),
            });
            return { chatId, userId };
        } catch (err) {
            return rejectWithValue(err?.response?.data?.detail || err?.message || 'Не удалось добавить участника');
        }
    }
);

export const removeChatParticipant = createAsyncThunk(
    'chats/removeChatParticipant',
    async ({ chatId, userId }, { rejectWithValue }) => {
        try {
            await apiRequest(`/chats/${chatId}/participants/${userId}`, { method: 'DELETE' });
            return { chatId, userId };
        } catch (err) {
            return rejectWithValue(err?.response?.data?.detail || err?.message || 'Не удалось удалить участника');
        }
    }
);

// Получить сообщения чата
export const fetchChatMessages = createAsyncThunk(
    'chats/fetchChatMessages',
    async ({ chatId, skip = 0, limit = 100 }, { rejectWithValue }) => {
        try {
            const response = await apiRequest(`/chats/${chatId}/messages?skip=${skip}&limit=${limit}`);
            return { chatId, messages: response };
        } catch (err) {
            return rejectWithValue(err?.response?.data?.detail || err?.message || 'Ошибка загрузки сообщений');
        }
    }
);

// Отправить сообщение
export const sendMessage = createAsyncThunk(
    'chats/sendMessage',
    async ({ chatId, messageData }, { rejectWithValue }) => {
        try {
            const response = await apiRequest(`/chats/${chatId}/messages`, {
                method: 'POST',
                body: JSON.stringify(messageData),
            });
            return { chatId, message: response };
        } catch (err) {
            return rejectWithValue(err?.response?.data?.detail || err?.message || 'Ошибка отправки сообщения');
        }
    }
);

// Отправить сообщение с медиа
export const sendChatMedia = createAsyncThunk(
    'chats/sendChatMedia',
    async ({ chatId, files, message }, { rejectWithValue }) => {
        try {
            const formData = new FormData();
            
            // Добавляем файлы
            files.forEach(file => {
                formData.append('files', file);
            });
            
            // Добавляем текст сообщения если есть
            if (message) {
                formData.append('message', message);
            }
            
            // Используем apiRequestFormData для правильной отправки FormData с авторизацией
            const response = await apiRequestFormData(`/chats/${chatId}/messages/upload-media`, formData);
            
            return { chatId, message: response };
        } catch (err) {
            return rejectWithValue(err?.response?.data?.detail || err?.message || 'Ошибка загрузки медиа');
        }
    }
);

// Получить количество непрочитанных сообщений
export const fetchUnreadCount = createAsyncThunk(
    'chats/fetchUnreadCount',
    async (_, { rejectWithValue }) => {
        try {
            const response = await apiRequest('/chats/unread/count');
            return response.unread_count;
        } catch (err) {
            return rejectWithValue(err?.response?.data?.detail || err?.message || 'Ошибка загрузки непрочитанных');
        }
    }
);

// Заблокировать пользователя в чате
export const blockUserInChat = createAsyncThunk(
    'chats/blockUser',
    async ({ chatId, userId }, { rejectWithValue }) => {
        try {
            const response = await apiRequest(`/chats/${chatId}/block/${userId}`, {
                method: 'POST'
            });
            return { chatId, userId, ...response };
        } catch (err) {
            return rejectWithValue(err?.response?.data?.detail || 'Ошибка блокировки');
        }
    }
);

// Разблокировать пользователя в чате
export const unblockUserInChat = createAsyncThunk(
    'chats/unblockUser',
    async ({ chatId, userId }, { rejectWithValue }) => {
        try {
            const response = await apiRequest(`/chats/${chatId}/block/${userId}`, {
                method: 'DELETE'
            });
            return { chatId, userId, ...response };
        } catch (err) {
            return rejectWithValue(err?.response?.data?.detail || 'Ошибка разблокировки');
        }
    }
);

// Получить статус блокировки
export const fetchBlockStatus = createAsyncThunk(
    'chats/fetchBlockStatus',
    async (chatId, { rejectWithValue }) => {
        try {
            const response = await apiRequest(`/chats/${chatId}/block-status`);
            return { chatId, ...response };
        } catch (err) {
            return rejectWithValue(err?.response?.data?.detail || 'Ошибка получения статуса');
        }
    }
);

const initialState = {
    chats: [],
    currentChat: null,
    messages: [],
    loading: false,
    error: null,
    unreadCount: 0,
    wsConnected: false,
    totalChats: 0,
    replyToMessage: null,
    typingByChatId: {},
    incomingChatAlert: null,
};

const chatSlice = createSlice({
    name: 'chats',
    initialState,
    reducers: {
        // Установить текущий чат (сообщения сбрасываем только при смене чата, не при обновлении списка чатов)
        setCurrentChat: (state, action) => {
            const next = action.payload;
            const prevId = state.currentChat?.id ?? null;
            const nextId = next?.id ?? null;
            if (prevId !== nextId) {
                state.messages = [];
            }
            state.currentChat = next;
        },
        
        // Добавить сообщение через WebSocket
        addWebSocketMessage: (state, action) => {
            const message = action.payload;
            
            // Добавляем сообщение в текущий чат
            if (state.currentChat && state.currentChat.id === message.chat_id) {
                // Проверяем, нет ли уже такого сообщения
                const exists = state.messages.find(m => m.id === message.id);
                
                if (!exists) {
                    // Ищем временное сообщение с тем же содержанием от того же отправителя
                    // чтобы заменить его на реальное сообщение с сервера
                    const tempMessageIndex = state.messages.findIndex(m => 
                        m.id?.toString().startsWith('temp_') && 
                        m.sender_id === message.sender_id && 
                        m.message === message.message &&
                        Math.abs(new Date(m.created_at) - new Date(message.created_at)) < 10000 // в пределах 10 секунд
                    );
                    
                    if (tempMessageIndex !== -1) {
                        // Заменяем временное сообщение на реальное
                        const tempMessage = state.messages[tempMessageIndex];
                        state.messages[tempMessageIndex] = mergeMessageWithTempReply(message, tempMessage);
                        console.log('✅ Replaced temp message with real message via WebSocket:', message.id);
                    } else {
                        // Если временного сообщения нет, просто добавляем новое
                        state.messages.push(message);
                        console.log('📥 Added new message from WebSocket:', message.id);
                    }
                } else {
                    // Если сообщение уже есть, обновляем его (например, после обработки медиа)
                    const messageIndex = state.messages.findIndex(m => m.id === message.id);
                    if (messageIndex !== -1) {
                        const existingMessage = state.messages[messageIndex];
                        state.messages[messageIndex] = mergeMessageWithTempReply(message, existingMessage);
                        console.log('🔄 Updated existing message from WebSocket:', message.id);
                    }
                }
            }
            
            // Обновляем последнее сообщение в списке чатов
            const chatIndex = state.chats.findIndex(c => c.id === message.chat_id);
            if (chatIndex !== -1) {
                state.chats[chatIndex].last_message = message;
                state.chats[chatIndex].updated_at = message.created_at;
                
                // Перемещаем чат наверх списка
                const chat = state.chats[chatIndex];
                state.chats.splice(chatIndex, 1);
                state.chats.unshift(chat);
            }
        },
        
        // Добавить сообщение оптимистично (до ответа сервера)
        addOptimisticMessage: (state, action) => {
            const { chatId, message, senderId, media = [], reply_to_id = null, reply_to = null } = action.payload;
            
            if (state.currentChat && state.currentChat.id === chatId) {
                const tempMessage = {
                    id: `temp_${Date.now()}`,
                    chat_id: chatId,
                    sender_id: senderId,
                    message: message,
                    is_read: false,
                    reply_to_id: reply_to_id,
                    reply_to: reply_to,
                    created_at: new Date().toISOString(),
                    media: media
                };
                state.messages.push(tempMessage);
            }
        },
        
        // Обновить статус обработки медиа
        updateMediaProcessingStatus: (state, action) => {
            const { messageId, mediaId, updates } = action.payload;
            
            // Обновляем в сообщениях
            const message = state.messages.find(m => m.id === messageId);
            if (message && message.media) {
                const mediaItem = message.media.find(m => m.id === mediaId);
                if (mediaItem) {
                    Object.assign(mediaItem, updates);
                }
            }
        },
        
        // Обновить статус ошибки медиа
        updateMediaFailedStatus: (state, action) => {
            const { chatId, isFailed } = action.payload;
            
            // Находим последнее временное сообщение
            if (state.currentChat && state.currentChat.id === chatId) {
                const lastMessage = state.messages[state.messages.length - 1];
                if (lastMessage && lastMessage.id?.toString().startsWith('temp_') && lastMessage.media) {
                    lastMessage.media.forEach(media => {
                        media.is_processing = true;
                        media.is_failed = isFailed;
                    });
                }
            }
        },
        
        // Сбросить чат
        resetChat: (state) => {
            state.currentChat = null;
            state.messages = [];
            state.replyToMessage = null;
        },
        
        // Установить сообщение для ответа
        setReplyToMessage: (state, action) => {
            state.replyToMessage = action.payload;
        },
        
        // WebSocket подключен
        setWsConnected: (state, action) => {
            state.wsConnected = action.payload;
        },

        setTypingUser: (state, action) => {
            const { chat_id, user_id } = action.payload;
            if (!chat_id || !user_id) return;
            state.typingByChatId[chat_id] = user_id;
        },

        clearTypingUser: (state, action) => {
            const chatId = action.payload;
            if (chatId == null) return;
            delete state.typingByChatId[chatId];
        },

        setIncomingChatAlert: (state, action) => {
            state.incomingChatAlert = action.payload;
        },

        clearIncomingChatAlert: (state) => {
            state.incomingChatAlert = null;
        },

        // Пометить сообщения как прочитанные по realtime-событию
        markMessagesAsRead: (state, action) => {
            const { chat_id, message_ids } = action.payload;
            if (!Array.isArray(message_ids) || message_ids.length === 0) return;

            // Обновляем сообщения открытого чата
            if (state.currentChat && state.currentChat.id === chat_id) {
                state.messages.forEach((m) => {
                    if (message_ids.includes(m.id)) {
                        m.is_read = true;
                    }
                });
            }

            // Обновляем последнее сообщение в списке чатов (для галочки в списке)
            const chatIndex = state.chats.findIndex((c) => c.id === chat_id);
            if (chatIndex !== -1 && state.chats[chatIndex].last_message) {
                if (message_ids.includes(state.chats[chatIndex].last_message.id)) {
                    state.chats[chatIndex].last_message.is_read = true;
                }
            }
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch user chats
            .addCase(fetchUserChats.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchUserChats.fulfilled, (state, action) => {
                state.loading = false;
                state.chats = action.payload.chats;
                state.totalChats = action.payload.total;
            })
            .addCase(fetchUserChats.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            
            // Create or get chat
            .addCase(createOrGetChat.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createOrGetChat.fulfilled, (state, action) => {
                state.loading = false;
                state.currentChat = action.payload;
                
                // Добавляем чат в список если его там нет
                const exists = state.chats.find(c => c.id === action.payload.id);
                if (!exists) {
                    state.chats.unshift(action.payload);
                }
            })
            .addCase(createOrGetChat.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            
            // Fetch chat messages
            .addCase(fetchChatMessages.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchChatMessages.fulfilled, (state, action) => {
                state.loading = false;
                console.log('📥 Received messages from backend:', action.payload.messages.length);
                // Логируем статус медиа в сообщениях
                action.payload.messages.forEach(msg => {
                    if (msg.media && msg.media.length > 0) {
                        msg.media.forEach(m => {
                            console.log(`  📎 Media ${m.id}: is_processing=${m.is_processing}, type=${m.media_type}`);
                        });
                    }
                });
                
                // Находим временные сообщения которые еще не получены с сервера
                const tempMessages = state.messages.filter(m => 
                    m.id?.toString().startsWith('temp_')
                );
                
                // Заменяем сообщения из сервера, но сохраняем временные
                const serverMessageIds = new Set(action.payload.messages.map(m => m.id));
                const remainingTempMessages = tempMessages.filter(m => 
                    !serverMessageIds.has(m.id)
                );
                
                // Объединяем серверные сообщения с оставшимися временными
                state.messages = [...action.payload.messages, ...remainingTempMessages];
                
                // Сортируем по created_at
                state.messages.sort((a, b) => 
                    new Date(a.created_at) - new Date(b.created_at)
                );
            })
            .addCase(fetchChatMessages.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            
            // Send message
            .addCase(sendMessage.pending, (state) => {
                state.error = null;
            })
            .addCase(sendMessage.fulfilled, (state, action) => {
                // Сообщение будет добавлено через WebSocket
                // Но на случай если WebSocket не работает, добавим вручную
                const message = action.payload.message;
                const exists = state.messages.find(m => m.id === message.id);
                
                if (!exists) {
                    // Ищем и заменяем временное сообщение
                    const tempMessageIndex = state.messages.findIndex(m => 
                        m.id?.toString().startsWith('temp_') && 
                        m.sender_id === message.sender_id && 
                        m.message === message.message &&
                        Math.abs(new Date(m.created_at) - new Date(message.created_at)) < 5000
                    );
                    
                    if (tempMessageIndex !== -1) {
                        const tempMessage = state.messages[tempMessageIndex];
                        state.messages[tempMessageIndex] = mergeMessageWithTempReply(message, tempMessage);
                    } else {
                        state.messages.push(message);
                    }
                }
            })
            .addCase(sendMessage.rejected, (state, action) => {
                state.error = action.payload;
            })
            
            // Send chat media
            .addCase(sendChatMedia.pending, (state) => {
                state.error = null;
            })
            .addCase(sendChatMedia.fulfilled, (state, action) => {
                const message = action.payload.message;
                const exists = state.messages.find(m => m.id === message.id);
                
                if (!exists) {
                    // Ищем и заменяем временное сообщение с медиа
                    const tempMessageIndex = state.messages.findIndex(m => 
                        m.id?.toString().startsWith('temp_') && 
                        m.sender_id === message.sender_id &&
                        m.media && m.media.length > 0 &&
                        Math.abs(new Date(m.created_at) - new Date(message.created_at)) < 5000
                    );
                    
                    if (tempMessageIndex !== -1) {
                        state.messages[tempMessageIndex] = message;
                    } else {
                        state.messages.push(message);
                    }
                }
            })
            .addCase(sendChatMedia.rejected, (state, action) => {
                state.error = action.payload;
            })
            
            // Fetch unread count
            .addCase(fetchUnreadCount.fulfilled, (state, action) => {
                state.unreadCount = action.payload;
            })
            
            // Block user
            .addCase(blockUserInChat.fulfilled, (state, action) => {
                const { chatId, userId } = action.payload;
                // Обновить статус в текущем чате
                if (state.currentChat && state.currentChat.id === chatId) {
                    state.currentChat.blocked_users_count = (state.currentChat.blocked_users_count || 0) + 1;
                }
                // Обновить в списке чатов
                const chat = state.chats.find(c => c.id === chatId);
                if (chat) {
                    chat.blocked_users_count = (chat.blocked_users_count || 0) + 1;
                }
            })
            
            // Unblock user
            .addCase(unblockUserInChat.fulfilled, (state, action) => {
                const { chatId, userId } = action.payload;
                if (state.currentChat && state.currentChat.id === chatId) {
                    state.currentChat.blocked_users_count = Math.max(0, (state.currentChat.blocked_users_count || 1) - 1);
                }
                const chat = state.chats.find(c => c.id === chatId);
                if (chat) {
                    chat.blocked_users_count = Math.max(0, (chat.blocked_users_count || 1) - 1);
                }
            })
            
            // Fetch block status
            .addCase(fetchBlockStatus.fulfilled, (state, action) => {
                const { chatId, is_blocked } = action.payload;
                if (state.currentChat && state.currentChat.id === chatId) {
                    state.currentChat.is_current_user_blocked = is_blocked;
                }
            });
    }
});

// WebSocket helpers
const playChatNotificationSound = () => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = 880;
        gain.gain.value = 0.04;
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.12);
        oscillator.onended = () => ctx.close();
    } catch (error) {
        console.warn('[WS] Failed to play notification sound', error);
    }
};

const notifyIncomingMessage = (dispatch, getState, message) => {
    const state = getState();
    const currentUserId = state.auth?.user?.id;
    const currentChatId = state.chats?.currentChat?.id;

    if (!message?.chat_id || message.sender_id === currentUserId) return;
    if (currentChatId === message.chat_id) return;

    playChatNotificationSound();
    dispatch(setIncomingChatAlert({
        chatId: message.chat_id,
        senderId: message.sender_id,
        preview: (message.message || 'Новое сообщение').slice(0, 120),
        at: Date.now(),
    }));
};

const attachWsRecoveryListeners = (dispatch) => {
    if (wsRecoveryListenersAttached || typeof window === 'undefined') return;
    wsRecoveryListenersAttached = true;

    const tryResumeConnection = () => {
        if (!wsActiveUserId) return;
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
        if (!localStorage.getItem('token')) return;
        console.log('[WS] Resuming connection after network/tab recovery');
        wsReconnectAttempts = 0;
        dispatch(connectWebSocket(wsActiveUserId));
    };

    window.addEventListener('online', tryResumeConnection);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            tryResumeConnection();
        }
    });
};

export const connectWebSocket = (userId) => (dispatch, getState) => {
    wsActiveUserId = userId;
    attachWsRecoveryListeners(dispatch);

    // Проверяем, есть ли уже активное или устанавливающееся подключение
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        console.log('[WS] Already connected or connecting, skipping');
        if (ws.readyState === WebSocket.OPEN) {
            wsReconnectAttempts = 0;
        }
        return;
    }
    
    // Закрываем старое подключение если есть
    if (ws) {
        console.log('[WS] Closing old connection');
        ws.onclose = null; // Prevent reconnect when intentionally closing
        ws.close();
        ws = null;
    }
    
    // Clear any existing reconnect timer
    if (wsReconnectTimer) {
        clearTimeout(wsReconnectTimer);
        wsReconnectTimer = null;
    }
    
    // Получаем базовый URL для WebSocket из конфигурации API
    const wsBaseUrl = getWebSocketBaseUrl();
    const token = localStorage.getItem('token');
    if (!token) {
        console.warn('[WS] Missing auth token, skipping connect');
        return;
    }
    const wsUrl = `${wsBaseUrl}/ws/chat/${userId}?token=${encodeURIComponent(token)}`;
    
    console.log('[WS] Connecting to:', wsUrl);
    console.log('[WS] Reconnect attempt:', wsReconnectAttempts + 1);
    
    try {
        ws = new WebSocket(wsUrl);
    } catch (error) {
        console.error('[WS] Failed to create WebSocket:', error);
        scheduleReconnect(dispatch, userId);
        return;
    }
    
    ws.onopen = () => {
        console.log('[WS] ✅ WebSocket connected successfully');
        wsReconnectAttempts = 0; // Reset on successful connection
        lastPongAt = Date.now();
        dispatch(setWsConnected(true));
        startPingInterval(dispatch);
    };
    
    ws.onmessage = (event) => {
        let data;
        try {
            data = JSON.parse(event.data);
        } catch (error) {
            console.error('[WS] Failed to parse WS message', event.data);
            return;
        }
        
        if (data.type === 'message') {
            dispatch(addWebSocketMessage(data));
            notifyIncomingMessage(dispatch, getState, data);
            dispatch(fetchUnreadCount());
        } else if (data.type === 'messages_read') {
            dispatch(markMessagesAsRead(data));
            dispatch(fetchUserChats({ skip: 0, limit: 50 }));
        } else if (data.type === 'typing') {
            if (data.chat_id && data.user_id) {
                dispatch(setTypingUser({ chat_id: data.chat_id, user_id: data.user_id }));
                const chatId = data.chat_id;
                setTimeout(() => {
                    const typingUser = getState().chats?.typingByChatId?.[chatId];
                    if (typingUser === data.user_id) {
                        dispatch(clearTypingUser(chatId));
                    }
                }, 4000);
            }
        } else if (data.type === 'avito_messenger_refresh') {
            const cid = data.avito_chat_id != null ? String(data.avito_chat_id) : null;
            dispatch(fetchAvitoChats({ silent: true }));
            if (cid) {
                dispatch(fetchAvitoMessages({ chatId: cid, silent: true, markRead: false }));
                const selected = getState().avitoChats?.selectedChatId;
                if (selected != null && String(selected) === String(cid)) {
                    dispatch(fetchAvitoChatDetail({ chatId: cid, silent: true }));
                }
            }
        } else if (data.type === 'pong') {
            lastPongAt = Date.now();
            console.log('[WS] 🏓 Pong received');
        }
    };
    
    ws.onclose = (event) => {
        console.log('[WS] ❌ WebSocket disconnected', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
        });
        dispatch(setWsConnected(false));
        stopPingInterval();
        ws = null;
        
        // Don't reconnect if intentionally closed (code 1000 = normal close)
        if (event.code === 1000) {
            console.log('[WS] Normal closure, not reconnecting');
            wsReconnectAttempts = 0;
            return;
        }

        // Policy violation: invalid token, user mismatch, too many connections
        if (event.code === 1008) {
            console.warn('[WS] Non-recoverable close (1008), falling back to HTTP polling');
            wsReconnectAttempts = 0;
            return;
        }
        
        // Переподключение с exponential backoff
        scheduleReconnect(dispatch, userId);
    };
    
    ws.onerror = (error) => {
        console.error('[WS] ❌ WebSocket error');
        // Don't try to close here - onclose will be triggered automatically
    };
};

// Helper function for reconnection with exponential backoff
const scheduleReconnect = (dispatch, userId) => {
    if (wsReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('[WS] ❌ Max reconnection attempts reached');
        wsReconnectAttempts = 0;
        return;
    }
    
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
    const delay = Math.min(
        BASE_RECONNECT_DELAY * Math.pow(2, wsReconnectAttempts),
        30000
    );
    
    wsReconnectAttempts++;
    
    console.log(`[WS] 🔄 Scheduling reconnect #${wsReconnectAttempts} in ${delay}ms`);
    
    wsReconnectTimer = setTimeout(() => {
        console.log('[WS] Attempting to reconnect...');
        dispatch(connectWebSocket(userId));
    }, delay);
};

// Ping interval to keep connection alive
const startPingInterval = (dispatch) => {
    stopPingInterval(); // Clear any existing interval
    
    pingInterval = setInterval(() => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        if (lastPongAt && Date.now() - lastPongAt > PONG_TIMEOUT_MS) {
            console.warn('[WS] Pong timeout, forcing reconnect');
            try {
                ws.close();
            } catch (error) {
                console.error('[WS] Failed to close stale connection', error);
            }
            return;
        }

        try {
            ws.send(JSON.stringify({ type: 'ping' }));
            console.log('[WS] 🏓 Ping sent');
        } catch (error) {
            console.error('[WS] Failed to send ping:', error);
        }
    }, PING_INTERVAL_MS);
};

const stopPingInterval = () => {
    if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
    }
};

export const sendWebSocketMessage = (chatId, senderId, message, replyToId = null) => async (dispatch, getState) => {
    const wsConnected = ws && ws.readyState === WebSocket.OPEN;
    
    if (wsConnected) {
        console.log('[WS] 📤 Sending message via WebSocket');
        try {
            ws.send(JSON.stringify({
                type: 'message',
                chat_id: chatId,
                sender_id: senderId,
                message: message,
                reply_to_id: replyToId
            }));
            console.log('[WS] ✅ Message sent via WebSocket');
        } catch (error) {
            console.error('[WS] Failed to send via WebSocket:', error);
            // Fallback to HTTP
            await dispatch(sendMessageViaHTTP(chatId, senderId, message, replyToId));
        }
    } else {
        console.log('[WS] ⚠️ WebSocket not connected (readyState:', ws?.readyState, '), using HTTP');
        // Fallback to HTTP если WebSocket не подключен
        await dispatch(sendMessageViaHTTP(chatId, senderId, message, replyToId));
    }
};

// Helper function for HTTP message sending
const sendMessageViaHTTP = (chatId, senderId, message, replyToId) => async (dispatch) => {
    console.log('[HTTP] 📤 Sending message via HTTP API');
    try {
        const result = await dispatch(sendMessage({
            chatId,
            messageData: {
                chat_id: chatId,
                sender_id: senderId,
                message: message,
                reply_to_id: replyToId
            }
        })).unwrap();
        
        console.log('[HTTP] ✅ Message sent successfully:', result);
        
        // Обновляем список чатов чтобы показать новое сообщение
        dispatch(fetchUserChats({ skip: 0, limit: 50 }));
        
        return result;
    } catch (error) {
        console.error('[HTTP] ❌ Failed to send message:', error);
        throw error;
    }
};

export const disconnectWebSocket = () => (dispatch) => {
    wsActiveUserId = null;

    if (wsReconnectTimer) {
        clearTimeout(wsReconnectTimer);
        wsReconnectTimer = null;
    }
    
    stopPingInterval();
    
    if (ws) {
        console.log('[WS] Intentionally closing WebSocket');
        ws.onclose = null; // Prevent auto-reconnect
        ws.close(1000, 'Normal closure');
        ws = null;
    }
    
    wsReconnectAttempts = 0;
    console.log('[WS] WebSocket disconnected manually');
    dispatch(setWsConnected(false));
};

// Push Notification Subscription
export const subscribeToPushNotifications = ({ prompt = true } = {}) => async (dispatch, getState) => {
    try {
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            console.log('[Push] Push notifications not supported');
            return;
        }

        let permission = Notification.permission;
        if (permission === 'default' && prompt) {
            permission = await Notification.requestPermission();
        }
        if (permission !== 'granted') {
            console.log('[Push] Notification permission not granted');
            return;
        }

        const response = await fetch(`${API_BASE}/notifications/vapid-public-key`);
        const contentType = response.headers.get('content-type') || '';
        if (!response.ok || !contentType.includes('application/json')) {
            console.log('[Push] VAPID endpoint returned non-JSON response');
            return;
        }
        const { public_key } = await response.json();

        if (!public_key) {
            console.log('[Push] VAPID public key not configured');
            return;
        }

        let registration = await navigator.serviceWorker.getRegistration('/');
        if (!registration) {
            registration = await navigator.serviceWorker.register('/service-worker.js');
        }
        console.log('[Push] Service Worker ready');

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(public_key),
            });
            console.log('[Push] Subscribed to push notifications');
        }

        const token = getState().auth.token;
        if (!token) return;

        const subscribeResponse = await fetch(`${API_BASE}/notifications/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                endpoint: subscription.endpoint,
                p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))),
                auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')))),
                user_agent: navigator.userAgent,
            }),
        });

        if (!subscribeResponse.ok) {
            console.error('[Push] Backend subscription failed:', subscribeResponse.status);
            return;
        }

        console.log('[Push] Subscription sent to backend');
    } catch (error) {
        console.error('[Push] Subscription failed:', error);
    }
};

export const unsubscribeFromPushNotifications = () => async (dispatch, getState) => {
    try {
        if (!('serviceWorker' in navigator)) return;

        const token = getState().auth?.token || localStorage.getItem('token');
        if (!token) return;

        const registration = await navigator.serviceWorker.getRegistration('/');
        const subscription = await registration?.pushManager?.getSubscription();
        if (!subscription) return;

        const response = await fetch(
            `${API_BASE}/notifications/unsubscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
        );

        if (!response.ok) {
            console.warn('[Push] Backend unsubscribe failed:', response.status);
        }

        await subscription.unsubscribe();
        console.log('[Push] Unsubscribed from push notifications');
    } catch (error) {
        console.warn('[Push] Unsubscribe failed:', error);
    }
};

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export const {
    setCurrentChat,
    addWebSocketMessage,
    addOptimisticMessage,
    updateMediaProcessingStatus,
    updateMediaFailedStatus,
    resetChat,
    setReplyToMessage,
    setWsConnected,
    markMessagesAsRead,
    setTypingUser,
    clearTypingUser,
    setIncomingChatAlert,
    clearIncomingChatAlert,
} = chatSlice.actions;

export default chatSlice.reducer;
