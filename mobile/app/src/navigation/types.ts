import type { GarageVehicle } from "../api/clientAccount";
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
  ClientHistory: undefined;
  ClientOrder: { orderId: number };
  ClientBookingNew: undefined;
  ClientNotifications: undefined;
  ClientProfile: undefined;
  ClientVehicle: { vehicle: GarageVehicle; orgName?: string | null };
  ClientVehicleForm:
    | { vehicle?: GarageVehicle; organizationId?: string }
    | undefined;
  Employees: undefined;
  Contractors: undefined;
  Settings: undefined;
};
