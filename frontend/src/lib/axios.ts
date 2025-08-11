// src/lib/axios.ts
import Axios, { AxiosError } from "axios";

const axios = Axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

function isExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

let isRefreshing = false;

axios.interceptors.request.use(async (config) => {
  let token = localStorage.getItem("token");

  if (!token) {
    return config;
  }

  if (isExpired(token) && !isRefreshing) {
    isRefreshing = true;
    try {
      const response = await axios.post("/api/auth/refresh-token");
      const newToken = response.data.token;

      if (typeof newToken === "string") {
        token = newToken;
        localStorage.setItem("token", newToken);
      }
    } catch (err) {
      console.error("Token refresh failed", err);
    } finally {
      isRefreshing = false;
    }
  }

  if (config.headers && token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      console.warn("Unauthorized. Logging out...");
    }
    return Promise.reject(error);
  }
);

export default axios;
