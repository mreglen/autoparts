import {
  getAvitoChatUnreadCount,
  getGarageChatUnreadCount,
  getUnifiedChatUnreadCount,
} from './chatUnread';

describe('chatUnread', () => {
  it('uses unread_count when present', () => {
    expect(getGarageChatUnreadCount({ unread_count: 3 }, 1)).toBe(3);
  });

  it('falls back to last unread message', () => {
    expect(
      getGarageChatUnreadCount(
        { last_message: { is_read: false, sender_id: 2 } },
        1,
      ),
    ).toBe(1);
  });

  it('avito has_unread_messages fallback', () => {
    expect(getAvitoChatUnreadCount({ has_unread_messages: true })).toBe(1);
  });

  it('unified respects source', () => {
    expect(
      getUnifiedChatUnreadCount({ _source: 'avito', has_unread_messages: true }, 1),
    ).toBe(1);
  });
});
