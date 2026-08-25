import { fetchChatMediaBlobUrl, getChatMediaPath } from './chatMediaAuth';

describe('chatMediaAuth', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['x'], { type: 'image/jpeg' }),
    });
    global.URL.createObjectURL = jest.fn(() => 'blob:mock');
  });

  it('builds path without token query', () => {
    expect(getChatMediaPath(12)).toBe('/chats/media/12');
    expect(getChatMediaPath(12, { thumbnail: true })).toBe('/chats/media/12/thumbnail');
  });

  it('fetches with Authorization header', async () => {
    await fetchChatMediaBlobUrl(5);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/chats/media/5'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-token' },
      }),
    );
    expect(String(global.fetch.mock.calls[0][0])).not.toContain('token=');
  });
});
