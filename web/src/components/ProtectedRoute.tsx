import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

export function ProtectedRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function AdminRoute() {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
