import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "@/layouts/app-layout";
import { AuthLayout } from "@/layouts/auth-layout";
import { useAuth } from "@/hooks/use-auth";
import AlertsPage from "@/pages/alerts";
import AnalyticsPage from "@/pages/analytics";
import ForgotPasswordPage from "@/pages/auth/forgot-password";
import LoginPage from "@/pages/auth/login";
import ResetPasswordPage from "@/pages/auth/reset-password";
import SignupPage from "@/pages/auth/signup";
import DashboardPage from "@/pages/dashboard";
import DigitalTwinPage from "@/pages/digital-twin";
import ForecastPage from "@/pages/forecast";
import InventoryPage from "@/pages/inventory";
import LandingPage from "@/pages/landing";
import NotFoundPage from "@/pages/not-found";
import ProfilePage from "@/pages/profile";
import RecommendationsPage from "@/pages/recommendations";
import ReportsPage from "@/pages/reports";
import SettingsPage from "@/pages/settings";
import SimulationPage from "@/pages/simulation";
import SuppliersPage from "@/pages/suppliers";
import WarehousesPage from "@/pages/warehouses";
import type { UserRole } from "@/types";

/** Route guard: redirects to dashboard if the user lacks the required role. */
function RoleGuard({
  roles,
  children,
}: {
  roles: UserRole[];
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

/** Public landing page — redirect to dashboard if already logged in. */
function LandingGuard() {
  const { user, initializing } = useAuth();
  if (initializing) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

export default function App() {
  return (
    <Routes>
      {/* Public landing page */}
      <Route path="/" element={<LandingGuard />} />

      {/* Public auth routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* Authenticated application */}
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/forecast" element={<ForecastPage />} />
        <Route path="/digital-twin" element={<DigitalTwinPage />} />
        <Route path="/simulation" element={<SimulationPage />} />
        <Route path="/recommendations" element={<RecommendationsPage />} />

        {/* Admin + Manager only */}
        <Route
          path="/inventory"
          element={
            <RoleGuard roles={["admin", "supply_chain_manager"]}>
              <InventoryPage />
            </RoleGuard>
          }
        />
        <Route
          path="/suppliers"
          element={
            <RoleGuard roles={["admin", "supply_chain_manager"]}>
              <SuppliersPage />
            </RoleGuard>
          }
        />
        <Route
          path="/warehouses"
          element={
            <RoleGuard roles={["admin", "supply_chain_manager"]}>
              <WarehousesPage />
            </RoleGuard>
          }
        />
        <Route
          path="/reports"
          element={
            <RoleGuard roles={["admin", "supply_chain_manager"]}>
              <ReportsPage />
            </RoleGuard>
          }
        />

        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
