import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiAxios } from '../../utils/apiClient';

// Async thunks
export const fetchClients = createAsyncThunk(
  'clients/fetchClients',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiAxios.get('/clients');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch clients');
    }
  }
);

export const createClient = createAsyncThunk(
  'clients/createClient',
  async (clientData, { rejectWithValue }) => {
    try {
      const response = await apiAxios.post('/clients', clientData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to create client');
    }
  }
);

export const updateClient = createAsyncThunk(
  'clients/updateClient',
  async ({ id, clientData }, { rejectWithValue }) => {
    try {
      const response = await apiAxios.put(`/clients/${id}`, clientData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to update client');
    }
  }
);

export const fetchClientBuyerOrders = createAsyncThunk(
  'clients/fetchClientBuyerOrders',
  async ({ clientId, email, phone }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (clientId != null) params.set('client_id', String(clientId));
      else {
        if (email) params.set('email', email);
        if (phone) params.set('phone', phone);
      }
      const response = await apiAxios.get(`/clients/buyer-orders?${params.toString()}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Не удалось загрузить заказы');
    }
  }
);

export const deleteClient = createAsyncThunk(
  'clients/deleteClient',
  async (id, { rejectWithValue }) => {
    try {
      await apiAxios.delete(`/clients/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to delete client');
    }
  }
);

// Initial state
const initialState = {
  clients: [],
  loading: false,
  error: null,
  creating: false,
  updating: false,
  deleting: false,
  buyerOrders: null,
  buyerOrdersLoading: false,
};

// Slice
const clientSlice = createSlice({
  name: 'clients',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearClients: (state) => {
      state.clients = [];
    },
    clearBuyerOrders: (state) => {
      state.buyerOrders = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch clients
      .addCase(fetchClients.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchClients.fulfilled, (state, action) => {
        state.loading = false;
        state.clients = action.payload;
      })
      .addCase(fetchClients.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Create client
      .addCase(createClient.pending, (state) => {
        state.creating = true;
        state.error = null;
      })
      .addCase(createClient.fulfilled, (state, action) => {
        state.creating = false;
        state.clients.push(action.payload);
      })
      .addCase(createClient.rejected, (state, action) => {
        state.creating = false;
        state.error = action.payload;
      })

      // Update client
      .addCase(updateClient.pending, (state) => {
        state.updating = true;
        state.error = null;
      })
      .addCase(updateClient.fulfilled, (state, action) => {
        state.updating = false;
        const index = state.clients.findIndex(client => client.id === action.payload.id);
        if (index !== -1) {
          state.clients[index] = action.payload;
        }
      })
      .addCase(updateClient.rejected, (state, action) => {
        state.updating = false;
        state.error = action.payload;
      })

      // Delete client
      .addCase(deleteClient.pending, (state) => {
        state.deleting = true;
        state.error = null;
      })
      .addCase(deleteClient.fulfilled, (state, action) => {
        state.deleting = false;
        state.clients = state.clients.filter(client => client.id !== action.payload);
      })
      .addCase(deleteClient.rejected, (state, action) => {
        state.deleting = false;
        state.error = action.payload;
      })

      .addCase(fetchClientBuyerOrders.pending, (state) => {
        state.buyerOrdersLoading = true;
        state.error = null;
      })
      .addCase(fetchClientBuyerOrders.fulfilled, (state, action) => {
        state.buyerOrdersLoading = false;
        state.buyerOrders = action.payload;
      })
      .addCase(fetchClientBuyerOrders.rejected, (state, action) => {
        state.buyerOrdersLoading = false;
        state.error = action.payload;
      });
  }
});

// Export actions
export const { clearError, clearClients, clearBuyerOrders } = clientSlice.actions;

// Export selectors
export const selectClients = (state) => state.clients.clients;
export const selectClientsLoading = (state) => state.clients.loading;
export const selectClientsError = (state) => state.clients.error;
export const selectCreatingClient = (state) => state.clients.creating;
export const selectUpdatingClient = (state) => state.clients.updating;
export const selectDeletingClient = (state) => state.clients.deleting;
export const selectBuyerOrders = (state) => state.clients.buyerOrders;
export const selectBuyerOrdersLoading = (state) => state.clients.buyerOrdersLoading;

export default clientSlice.reducer;