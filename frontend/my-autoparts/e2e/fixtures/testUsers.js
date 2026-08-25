export const MOCK_ACCESS_TOKEN = 'e2e-access-token';
export const MOCK_REFRESH_TOKEN = 'e2e-refresh-token';

export const buyerProfile = {
  id: 1,
  public_code: 'B000001',
  email: 'buyer@test.ru',
  phone: '+7 (999) 111-22-33',
  first_name: 'Покупатель',
  last_name: 'Тест',
  patronymic: null,
  avatar_url: null,
  is_buyer: true,
  is_seller: false,
  is_admin: false,
  is_director: false,
  is_employee: false,
  organization_id: null,
  organization_name: null,
  notification_prefs: {},
};

export const sellerProfile = {
  ...buyerProfile,
  id: 2,
  public_code: 'S000001',
  email: 'seller@test.ru',
  first_name: 'Продавец',
  is_buyer: false,
  is_seller: true,
  is_director: true,
  organization_id: 1,
  organization_name: 'Тестовая организация',
};

export function loginResponse(user = buyerProfile) {
  return {
    access_token: MOCK_ACCESS_TOKEN,
    refresh_token: MOCK_REFRESH_TOKEN,
    token_type: 'bearer',
    user,
  };
}
