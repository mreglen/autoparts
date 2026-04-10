import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { apiRequest } from '../../utils/apiClient';

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

export const fetchAvitoChats = createAsyncThunk(
  'avitoChats/fetchChats',
  async (_, { rejectWithValue }) => {
    try {
      return await apiRequest('/avito/messenger/chats');
    } catch (err) {
      return rejectWithValue(err?.message || 'Ошибка загрузки Avito чатов');
    }
  }
);

export const fetchAvitoMessages = createAsyncThunk(
  'avitoChats/fetchMessages',
  async (chatId, { rejectWithValue }) => {
    try {
      const response = await apiRequest(`/avito/messenger/chats/${encodeURIComponent(chatId)}/messages`);
      return { chatId, messages: response.messages || [] };
    } catch (err) {
      return rejectWithValue(err?.message || 'Ошибка загрузки сообщений Avito');
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
      await dispatch(fetchAvitoMessages(chatId));
      await dispatch(fetchAvitoChats());
      return { chatId };
    } catch (err) {
      return rejectWithValue(err?.message || 'Ошибка отправки сообщения в Avito');
    }
  }
);

const initialState = {
  enabled: false,
  integrationLoading: false,
  chats: [],
  messages: [],
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
      })
      .addCase(fetchAvitoMessengerEnabled.rejected, (state, action) => {
        state.integrationLoading = false;
        state.enabled = false;
        state.error = action.payload;
      })
      .addCase(fetchAvitoChats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAvitoChats.fulfilled, (state, action) => {
        state.loading = false;
        state.chats = action.payload?.chats || [];
      })
      .addCase(fetchAvitoChats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchAvitoMessages.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAvitoMessages.fulfilled, (state, action) => {
        state.loading = false;
        state.messages = action.payload.messages || [];
      })
      .addCase(fetchAvitoMessages.rejected, (state, action) => {
        state.loading = false;
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
      });
  },
});

export const { setSelectedAvitoChatId, clearAvitoError } = avitoChatSlice.actions;
export default avitoChatSlice.reducer;
