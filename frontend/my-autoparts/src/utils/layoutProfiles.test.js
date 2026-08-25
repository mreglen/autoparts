import { getCabinetMainClasses, getPublicMainClasses } from './layoutProfiles';

describe('chat layout classes', () => {
  it('makes public chats fill the mobile shell', () => {
    const classes = getPublicMainClasses({
      isChatsPage: true,
      isMobileActiveChat: true,
    });
    expect(classes).toContain('max-lg:flex-1');
    expect(classes).toContain('max-lg:flex-col');
    expect(classes).toContain('max-lg:min-h-0');
  });

  it('makes cabinet chats fill the mobile shell', () => {
    const classes = getCabinetMainClasses({
      isChatsPage: true,
      isMobileActiveChat: true,
    });
    expect(classes).toContain('max-lg:flex-1');
    expect(classes).toContain('max-lg:flex-col');
    expect(classes).toContain('max-lg:min-h-0');
  });
});
