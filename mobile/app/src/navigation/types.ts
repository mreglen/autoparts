import type { GarageVehicle } from "../api/clientAccount";
import type { ShopPart } from "../api/partsShop";
import type { SectionRouteParams } from "../screens/SectionScreen";

export type RootStackParamList = {
  Login: undefined;
  ChangePassword: undefined;
  Main: { screen?: string } | undefined;
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
  ClientHistory: undefined;
  ClientOrder: { orderId: number };
  ClientBookingNew: undefined;
  ClientNotifications: undefined;
  ClientProfile: undefined;
  ClientVehicle: { vehicle: GarageVehicle; orgName?: string | null };
  ClientVehicleForm:
    | { vehicle?: GarageVehicle; organizationId?: string }
    | undefined;
  ClientPartDetail: { part: ShopPart };
  ClientCheckout: undefined;
  ClientPayment: { sessionId: string };
  ClientPurchases: undefined;
  Employees: undefined;
  Contractors: undefined;
  ExpenseArticles: undefined;
  Settings: undefined;
};
