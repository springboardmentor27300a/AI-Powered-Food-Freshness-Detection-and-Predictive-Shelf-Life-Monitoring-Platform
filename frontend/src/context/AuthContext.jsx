import React, { createContext, useContext, useEffect, useState } from "react";
import * as authApi from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const me = await authApi.fetchMe();
        setUser(me);
      } catch {
        localStorage.removeItem("access_token");
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, []);

  async function login(username, password) {
    const { access_token } = await authApi.login(username, password);
    localStorage.setItem("access_token", access_token);
    const me = await authApi.fetchMe();
    setUser(me);
    return me;
  }

  async function register(payload) {
    await authApi.register(payload);
    // Auto-login after registration for a smooth UX.
    return login(payload.username, payload.password);
  }

  function logout() {
    localStorage.removeItem("access_token");
    setUser(null);
  }

  const value = { user, setUser, loading, login, register, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
