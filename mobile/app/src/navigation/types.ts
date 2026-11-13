import type { SectionRouteParams } from "../screens/SectionScreen";

export type RootStackParamList = {
  Login: undefined;
  ChangePassword: undefined;
  Main: undefined;
  Section: SectionRouteParams;
  Search: undefined;
  BookingDetail: { id: number };
  BookingNew: undefined;
  OrderDetail: { id: number };
  OrderForm:
    | { orderId?: number; draftToken?: string; bookingId?: number }
    | undefined;
  Warehouse: undefined;
  Finance: undefined;
  Reports: undefined;
  Clients: undefined;
  Employees: undefined;
  Contractors: undefined;
  Settings: undefined;
};
