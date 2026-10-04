import {
  BarChart3,
  Bell,
  Boxes,
  FileText,
  LayoutDashboard,
  Lightbulb,
  Network,
  Settings,
  ShieldAlert,
  TrendingUp,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/types";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Roles that can see this item. Omit = visible to all. */
  roles?: UserRole[];
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/forecast", label: "Forecast", icon: TrendingUp },
  { to: "/digital-twin", label: "Digital Twin", icon: Network },
  { to: "/simulation", label: "Simulation", icon: ShieldAlert },
  { to: "/recommendations", label: "Recommendations", icon: Lightbulb },
  { to: "/inventory", label: "Inventory", icon: Boxes, roles: ["admin", "supply_chain_manager"] },
  { to: "/suppliers", label: "Suppliers", icon: Truck, roles: ["admin", "supply_chain_manager"] },
  { to: "/warehouses", label: "Warehouses", icon: Warehouse, roles: ["admin", "supply_chain_manager"] },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/reports", label: "Reports", icon: FileText, roles: ["admin", "supply_chain_manager"] },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/settings", label: "Settings", icon: Settings },
];
