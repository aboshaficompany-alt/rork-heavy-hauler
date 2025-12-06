import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Shipments from "./pages/factory/Shipments";
import NewShipment from "./pages/factory/NewShipment";
import ShipmentDetails from "./pages/factory/ShipmentDetails";
import Bids from "./pages/factory/Bids";
import AdminUsers from "./pages/admin/Users";
import AdminShipments from "./pages/admin/Shipments";
import OpenRequests from "./pages/driver/OpenRequests";
import MyTrips from "./pages/driver/MyTrips";
import DriverHome from "./pages/driver/DriverHome";
import NotFound from "./pages/NotFound";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  useRealtimeNotifications();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

function DashboardRouter() {
  const { role } = useAuth();
  
  // Redirect drivers to their map-based home page
  if (role === 'driver') {
    return <DriverHome />;
  }
  
  return <Dashboard />;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/auth" replace />} />
      <Route path="/auth" element={user ? <Navigate to="/dashboard" replace /> : <Auth />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/shipments" element={<ProtectedRoute><Shipments /></ProtectedRoute>} />
      <Route path="/shipments/new" element={<ProtectedRoute><NewShipment /></ProtectedRoute>} />
      <Route path="/shipments/:id" element={<ProtectedRoute><ShipmentDetails /></ProtectedRoute>} />
      <Route path="/bids" element={<ProtectedRoute><Bids /></ProtectedRoute>} />
      <Route path="/open-requests" element={<ProtectedRoute><OpenRequests /></ProtectedRoute>} />
      <Route path="/my-trips" element={<ProtectedRoute><MyTrips /></ProtectedRoute>} />
      <Route path="/driver-home" element={<ProtectedRoute><DriverHome /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
      <Route path="/admin/shipments" element={<ProtectedRoute><AdminShipments /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
