import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest, apiRequestFormData, getWebSocketBaseUrl } from '../../utils/apiClient';

// WebSocket подключение
let ws = null;
let wsReconnectTimer = null;

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
    replyToMessage: null  // Message being replied to
};

const chatSlice = createSlice({
    name: 'chats',
    initialState,
    reducers: {
        // Установить текущий чат
        setCurrentChat: (state, action) => {
            state.currentChat = action.payload;
            state.messages = [];
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
                        state.messages[tempMessageIndex] = message;
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
                        state.messages[messageIndex] = message;
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
            const { chatId, message, senderId, media = [] } = action.payload;
            
            if (state.currentChat && state.currentChat.id === chatId) {
                const tempMessage = {
                    id: `temp_${Date.now()}`,
                    chat_id: chatId,
                    sender_id: senderId,
                    message: message,
                    is_read: false,
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
                        state.messages[tempMessageIndex] = message;
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
export const connectWebSocket = (userId) => (dispatch) => {
    // Проверяем, есть ли уже активное подключение
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('[WS] Already connected, skipping');
        return;
    }
    
    // Закрываем старое подключение если есть
    if (ws) {
        ws.close();
        ws = null;
    }
    
    // Получаем базовый URL для WebSocket из конфигурации API
    const wsBaseUrl = getWebSocketBaseUrl();
    const wsUrl = `${wsBaseUrl}/ws/chat/${userId}`;
    
    console.log('[WS] Connecting to:', wsUrl);
    
    try {
        ws = new WebSocket(wsUrl);
    } catch (error) {
        console.error('[WS] Failed to create WebSocket:', error);
        // Retry after 5 seconds
        wsReconnectTimer = setTimeout(() => {
            console.log('[WS] Attempting to reconnect...');
            dispatch(connectWebSocket(userId));
        }, 5000);
        return;
    }
    
    ws.onopen = () => {
        console.log('[WS] WebSocket connected');
        dispatch(setWsConnected(true));
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'message') {
            dispatch(addWebSocketMessage(data));
            // Обновляем счетчик непрочитанных
            dispatch(fetchUnreadCount());
        }
    };
    
    ws.onclose = (event) => {
        console.log('[WS] WebSocket disconnected', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
        });
        dispatch(setWsConnected(false));
        ws = null;
        
        // Don't reconnect if intentionally closed (code 1000 = normal close)
        if (event.code === 1000) {
            console.log('[WS] Normal closure, not reconnecting');
            return;
        }
        
        // Переподключение через 5 секунд
        wsReconnectTimer = setTimeout(() => {
            console.log('[WS] Attempting to reconnect...');
            dispatch(connectWebSocket(userId));
        }, 5000);
    };
    
    ws.onerror = (error) => {
        console.error('[WS] WebSocket error:', error);
        // Don't try to close here - onclose will be triggered automatically
        // Just log the error and let onclose handle reconnection
    };
};

export const sendWebSocketMessage = (chatId, senderId, message, replyToId = null) => (dispatch, getState) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('[WS] Sending message via WebSocket');
        ws.send(JSON.stringify({
            type: 'message',
            chat_id: chatId,
            sender_id: senderId,
            message: message,
            reply_to_id: replyToId
        }));
    } else {
        console.log('[WS] WebSocket not connected, falling back to HTTP');
        // Fallback to HTTP если WebSocket не подключен
        dispatch(sendMessage({
            chatId,
            messageData: {
                chat_id: chatId,
                sender_id: senderId,
                message: message,
                reply_to_id: replyToId
            }
        }));
    }
};

export const disconnectWebSocket = () => (dispatch) => {
    if (wsReconnectTimer) {
        clearTimeout(wsReconnectTimer);
        wsReconnectTimer = null;
    }
    
    if (ws) {
        ws.close();
        ws = null;
    }
    
    console.log('[WS] WebSocket disconnected manually');
    dispatch(setWsConnected(false));
};

// Push Notification Subscription
export const subscribeToPushNotifications = () => async (dispatch, getState) => {
    try {
        // Check if browser supports notifications
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            console.log('[Push] Push notifications not supported');
            return;
        }
        
        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('[Push] Notification permission denied');
            return;
        }
        
        // Get VAPID public key from backend
        const response = await fetch('/api/notifications/vapid-public-key');
        const { public_key } = await response.json();
        
        if (!public_key) {
            console.log('[Push] VAPID public key not configured');
            return;
        }
        
        // Register service worker
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('[Push] Service Worker registered');
        
        // Subscribe to push
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(public_key)
        });
        
        console.log('[Push] Subscribed to push notifications');
        
        // Send subscription to backend
        const token = getState().auth.token;
        await fetch('/api/notifications/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                endpoint: subscription.endpoint,
                p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))),
                auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')))),
                user_agent: navigator.userAgent
            })
        });
        
        console.log('[Push] Subscription sent to backend');
    } catch (error) {
        console.error('[Push] Subscription failed:', error);
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

export const { setCurrentChat, addWebSocketMessage, addOptimisticMessage, updateMediaProcessingStatus, updateMediaFailedStatus, resetChat, setReplyToMessage, setWsConnected } = chatSlice.actions;

export default chatSlice.reducer;
