import { buildChatsQueryUrl, resolveActiveChatParams } from './resolveActiveChatParams';

describe('resolveActiveChatParams', () => {
  const params = (obj) => ({
    get: (key) => obj[key] ?? null,
  });

  it('prefers query chatId over path param', () => {
    const result = resolveActiveChatParams(
      '/chats/99',
      params({ chatId: '42', source: 'garage' }),
      { chatId: '99' },
    );
    expect(result.chatId).toBe('42');
    expect(result.isActiveChat).toBe(true);
    expect(result.needsPathCanonicalization).toBe(false);
  });

  it('reads chatId from path when query missing', () => {
    const result = resolveActiveChatParams('/chats/77', params({}), {});
    expect(result.chatId).toBe('77');
    expect(result.needsPathCanonicalization).toBe(true);
  });

  it('buildChatsQueryUrl includes source and chatId', () => {
    expect(buildChatsQueryUrl({ chatId: 5, source: 'avito', avitoChatId: 5 })).toBe(
      '/chats?source=avito&chatId=5&avitoChatId=5',
    );
  });
});
