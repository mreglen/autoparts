import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { apiRequest, apiRequestFormData } from '../../utils/apiClient';

export const fetchAvitoMessengerEnabled = createAsyncThunk(
  'avitoChats/fetchEnabled',
  async (_, { rejectWithValue }) => {
    try {
      return await apiRequest('/avito/messenger/enabled');
    } catch (err) {
      return rejectWithValue(err?.message || 'Ошибка проверки интеграции Avito');
    }
  }
);

function silentFromArg(arg) {
  return Boolean(arg && typeof arg === 'object' && arg.silent);
}

function markReadFromArg(arg) {
  if (arg && typeof arg === 'object' && arg.markRead === false) return false;
  return true;
}

export const fetchAvitoChats = createAsyncThunk(
  'avitoChats/fetchChats',
  async (arg, { rejectWithValue }) => {
    const silent = silentFromArg(arg);
    try {
      const data = await apiRequest('/avito/messenger/chats');
      return { ...data, silent };
    } catch (err) {
      return rejectWithValue(err?.message || 'Ошибка загрузки Avito чатов');
    }
  }
);

export const fetchAvitoMessages = createAsyncThunk(
  'avitoChats/fetchMessages',
  async (arg, { rejectWithValue }) => {
    const chatId = typeof arg === 'string' ? arg : arg?.chatId;
    const silent = silentFromArg(arg);
    const markRead = markReadFromArg(arg);
    try {
      const qs = markRead ? '' : '?mark_read=false';
      const response = await apiRequest(
        `/avito/messenger/chats/${encodeURIComponent(chatId)}/messages${qs}`
      );
      return { chatId, messages: response.messages || [], silent };
    } catch (err) {
      return rejectWithValue(err?.message || 'Ошибка загрузки сообщений Avito');
    }
  }
);

/** GET /api/avito/messenger/chats/:id — прокси к messenger/v2/accounts/{user_id}/chats/{chat_id} */
export const fetchAvitoChatDetail = createAsyncThunk(
  'avitoChats/fetchChatDetail',
  async (arg, { rejectWithValue }) => {
    const chatId = typeof arg === 'string' ? arg : arg?.chatId;
    const silent = silentFromArg(arg);
    try {
      const response = await apiRequest(`/avito/messenger/chats/${encodeURIComponent(chatId)}`);
      return { chatId, chat: response.chat || null, silent };
    } catch (err) {
      return rejectWithValue(err?.message || 'Ошибка загрузки чата Avito');
    }
  }
);

export const sendAvitoMessage = createAsyncThunk(
  'avitoChats/sendMessage',
  async ({ chatId, message }, { dispatch, rejectWithValue }) => {
    try {
      await apiRequest(`/avito/messenger/chats/${encodeURIComponent(chatId)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      await dispatch(fetchAvitoMessages({ chatId, markRead: false }));
      await dispatch(fetchAvitoChatDetail(chatId));
      await dispatch(fetchAvitoChats({ silent: true }));
      return { chatId };
    } catch (err) {
      return rejectWithValue(err?.message || 'Ошибка отправки сообщения в Avito');
    }
  }
);

export const sendAvitoImageFile = createAsyncThunk(
  'avitoChats/sendImage',
  async ({ chatId, file }, { dispatch, rejectWithValue }) => {
    try {
      const fd = new FormData();
      fd.append('file', file);
      const up = await apiRequestFormData(
        `/avito/messenger/chats/${encodeURIComponent(chatId)}/upload-image`,
        fd
      );
      const imageId = up?.image_id;
      if (!imageId) throw new Error('Сервер не вернул image_id');
      await apiRequest(`/avito/messenger/chats/${encodeURIComponent(chatId)}/messages/image`, {
        method: 'POST',
        body: JSON.stringify({ image_id: imageId }),
      });
      await dispatch(fetchAvitoMessages({ chatId, silent: true, markRead: false }));
      await dispatch(fetchAvitoChatDetail({ chatId, silent: true }));
      await dispatch(fetchAvitoChats({ silent: true }));
      return { chatId };
    } catch (err) {
      return rejectWithValue(err?.message || 'Ошибка отправки изображения в Avito');
    }
  }
);

export const sendAvitoVoiceFile = createAsyncThunk(
  'avitoChats/sendVoice',
  async ({ chatId, file }, { dispatch, rejectWithValue }) => {
    try {
      const fd = new FormData();
      fd.append('file', file);
      const up = await apiRequestFormData(
        `/avito/messenger/chats/${encodeURIComponent(chatId)}/upload-voice`,
        fd
      );
      const voiceId = up?.voice_id;
      if (!voiceId) throw new Error('Сервер не вернул voice_id');
      await apiRequest(`/avito/messenger/chats/${encodeURIComponent(chatId)}/messages/voice`, {
        method: 'POST',
        body: JSON.stringify({ voice_id: voiceId }),
      });
      await dispatch(fetchAvitoMessages({ chatId, silent: true, markRead: false }));
      await dispatch(fetchAvitoChatDetail({ chatId, silent: true }));
      await dispatch(fetchAvitoChats({ silent: true }));
      return { chatId };
    } catch (err) {
      return rejectWithValue(err?.message || 'Ошибка отправки голосового в Avito');
    }
  }
);

export const markAvitoChatRead = createAsyncThunk(
  'avitoChats/markChatRead',
  async (chatId, { rejectWithValue }) => {
    try {
      const response = await apiRequest(
        `/avito/messenger/chats/${encodeURIComponent(chatId)}/mark-read`,
        { method: 'POST' }
      );
      return { chatId, success: response?.ok };
    } catch (err) {
      return rejectWithValue(err?.message || 'Ошибка пометки чата прочитанным');
    }
  }
);

export const fetchAvitoChatProductLink = createAsyncThunk(
  'avitoChats/fetchProductLink',
  async (chatId, { rejectWithValue }) => {
    try {
      return await apiRequest(`/avito/messenger/chats/${encodeURIComponent(chatId)}/product-link`);
    } catch (err) {
      return rejectWithValue(err?.message || 'Ошибка проверки связи с товаром');
    }
  }
);

const initialState = {
  enabled: false,
  /** ID пользователя Авито (аккаунт API), для стороны «я / собеседник» в переписке */
  avitoUserId: null,
  integrationLoading: false,
  chats: [],
  messages: [],
  /** Полные данные выбранного чата (v2 GET …/chats/{chat_id}) */
  chatDetail: null,
  chatDetailLoading: false,
  selectedChatId: null,
  loading: false,
  sending: false,
  error: null,
};

const avitoChatSlice = createSlice({
  name: 'avitoChats',
  initialState,
  reducers: {
    setSelectedAvitoChatId: (state, action) => {
      state.selectedChatId = action.payload;
      state.messages = [];
      state.chatDetail = null;
    },
    clearAvitoError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAvitoMessengerEnabled.pending, (state) => {
        state.integrationLoading = true;
        state.error = null;
      })
      .addCase(fetchAvitoMessengerEnabled.fulfilled, (state, action) => {
        state.integrationLoading = false;
        state.enabled = !!action.payload?.enabled;
        const uid = action.payload?.avito_user_id;
        state.avitoUserId = uid != null && uid !== '' ? uid : null;
      })
      .addCase(fetchAvitoMessengerEnabled.rejected, (state, action) => {
        state.integrationLoading = false;
        state.enabled = false;
        state.avitoUserId = null;
        state.error = action.payload;
      })
      .addCase(fetchAvitoChats.pending, (state, action) => {
        if (!silentFromArg(action.meta.arg)) {
          state.loading = true;
        }
        state.error = null;
      })
      .addCase(fetchAvitoChats.fulfilled, (state, action) => {
        if (!action.payload.silent) {
          state.loading = false;
        }
        state.chats = action.payload?.chats || [];
      })
      .addCase(fetchAvitoChats.rejected, (state, action) => {
        if (!silentFromArg(action.meta.arg)) {
          state.loading = false;
        }
        state.error = action.payload;
      })
      .addCase(fetchAvitoMessages.pending, (state, action) => {
        if (!silentFromArg(action.meta.arg)) {
          state.loading = true;
        }
        state.error = null;
      })
      .addCase(fetchAvitoMessages.fulfilled, (state, action) => {
        if (!action.payload.silent) {
          state.loading = false;
        }
        if (String(action.payload.chatId) === String(state.selectedChatId)) {
          state.messages = action.payload.messages || [];
        }
      })
      .addCase(fetchAvitoMessages.rejected, (state, action) => {
        if (!silentFromArg(action.meta.arg)) {
          state.loading = false;
        }
        state.error = action.payload;
      })
      .addCase(fetchAvitoChatDetail.pending, (state, action) => {
        if (!silentFromArg(action.meta.arg)) {
          state.chatDetailLoading = true;
        }
        state.error = null;
      })
      .addCase(fetchAvitoChatDetail.fulfilled, (state, action) => {
        if (!action.payload.silent) {
          state.chatDetailLoading = false;
        }
        if (String(action.payload.chatId) === String(state.selectedChatId)) {
          state.chatDetail = action.payload.chat;
        }
      })
      .addCase(fetchAvitoChatDetail.rejected, (state, action) => {
        if (!silentFromArg(action.meta.arg)) {
          state.chatDetailLoading = false;
        }
        state.error = action.payload;
      })
      .addCase(sendAvitoMessage.pending, (state) => {
        state.sending = true;
        state.error = null;
      })
      .addCase(sendAvitoMessage.fulfilled, (state) => {
        state.sending = false;
      })
      .addCase(sendAvitoMessage.rejected, (state, action) => {
        state.sending = false;
        state.error = action.payload;
      })
      .addCase(sendAvitoImageFile.pending, (state) => {
        state.sending = true;
        state.error = null;
      })
      .addCase(sendAvitoImageFile.fulfilled, (state) => {
        state.sending = false;
      })
      .addCase(sendAvitoImageFile.rejected, (state, action) => {
        state.sending = false;
        state.error = action.payload;
      })
      .addCase(sendAvitoVoiceFile.pending, (state) => {
        state.sending = true;
        state.error = null;
      })
      .addCase(sendAvitoVoiceFile.fulfilled, (state) => {
        state.sending = false;
      })
      .addCase(sendAvitoVoiceFile.rejected, (state, action) => {
        state.sending = false;
        state.error = action.payload;
      })
      .addCase(fetchAvitoChatProductLink.fulfilled, (state, action) => {
        // Store link info in the corresponding chat object
        const chat = state.chats.find(c => String(c.id) === String(action.meta.arg));
        if (chat) {
          chat.linked_product_id = action.payload?.product_id;
          chat.is_linked_to_product = action.payload?.linked;
        }
      });
  },
});

export const { setSelectedAvitoChatId, clearAvitoError } = avitoChatSlice.actions;
export default avitoChatSlice.reducer;
