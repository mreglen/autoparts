import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest } from '../../utils/apiClient';

export const fetchAutoserviceClientMe = createAsyncThunk(
  'autoserviceClient/fetchMe',
  async (_, { rejectWithValue }) => {
    try {
      return await apiRequest('/autoservice/clients/me');
    } catch (err) {
      return rejectWithValue(err?.detail || 'Не удалось получить статус клиента');
    }
  }
);

const autoserviceClientSlice = createSlice({
  name: 'autoserviceClient',
  initialState: {
    isClient: false,
    client: null,
    status: 'idle',
  },
  reducers: {
    setAutoserviceClient(state, action) {
      state.isClient = Boolean(action.payload);
      state.client = action.payload || null;
      state.status = 'succeeded';
    },
    clearAutoserviceClient(state) {
      state.isClient = false;
      state.client = null;
      state.status = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAutoserviceClientMe.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchAutoserviceClientMe.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.isClient = action.payload?.is_client === true;
        state.client = action.payload?.client || null;
      })
      .addCase(fetchAutoserviceClientMe.rejected, (state) => {
        state.status = 'failed';
        state.isClient = false;
        state.client = null;
      });
  },
});

export const { setAutoserviceClient, clearAutoserviceClient } = autoserviceClientSlice.actions;

export const selectIsAutoserviceClient = (state) => state.autoserviceClient.isClient === true;

export default autoserviceClientSlice.reducer;
