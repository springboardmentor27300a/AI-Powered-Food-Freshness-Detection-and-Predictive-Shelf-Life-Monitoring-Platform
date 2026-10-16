import React, { createContext, useContext, useState, useCallback } from "react";
import api from "../api/axios.js";

const AuthContext = createContext(null);

export const ROLE_DASHBOARD_ROUTES = {
  consumer: "/consumer/dashboard",
  retail_manager: "/retail/dashboard",
  warehouse_operator: "/warehouse/dashboard",
  food_quality_inspector: "/inspector/dashboard",
  administrator: "/admin/dashboard",
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("access_token"));

  const login = useCallback(async ({ email, password, rememberMe }) => {
    const { data } = await api.post("/api/auth/login", {
      email,
      password,
      remember_me: rememberMe,
    });

    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setToken(data.access_token);
    setUser(data.user);

    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await api.post("/api/auth/register", payload);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await api.get("/api/users/me");
    localStorage.setItem("user", JSON.stringify(data));
    setUser(data);
    return data;
  }, []);

  const value = {
    user,
    token,
    isAuthenticated: !!token,
    login,
    register,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
