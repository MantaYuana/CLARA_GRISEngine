import { useEffect, useState, useCallback } from "react";
import { axiosInstance } from "../lib/axios";

const AUTH_BYPASS = import.meta.env.VITE_AUTH_BYPASS === "true";

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const getUser = useCallback(async () => {
    // Local demo bypass: resolve a synthetic user with no token/backend call.
    if (AUTH_BYPASS) {
      localStorage.setItem("token", "demo");
      setUser({ userId: "demo-user", email: "demo@clara.local", name: "Demo User" });
      setLoading(false);
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await axiosInstance.get("/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setUser(res.data.data);
    } catch (error) {
      console.error("Failed to fetch user:", error);
      // setUser(null);
      // localStorage.removeItem("token");
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = () => {
    // In demo bypass mode there is no real session to clear; keep the user signed in.
    if (AUTH_BYPASS) return;
    localStorage.removeItem("token");
    setUser(null);
    window.location.href = "/auth";
  };

  useEffect(() => {
    getUser();
  }, [getUser]);

  return { user, loading, setUser, refetchUser: getUser, logout };
};
