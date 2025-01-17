/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { io, Socket } from "socket.io-client";

const BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:5001"
    : "https://whisper-backend-production.up.railway.app/api";

interface SignupData {
  fullName: string;
  email: string;
  password: string;
}

interface LoginData {
  email: string;
  password: string;
}

interface AuthUser {
  _id: string;
  fullName: string;
  email: string;
  createdAt: string;
  profilePic: string | null;
}

interface UpdateProfileData {
  profilePic: string;
}

interface AuthState {
  authUser: AuthUser | null;
  isCheckingAuth: boolean;
  isSigningUp: boolean;
  isLoggingIn: boolean;
  isUpdatingProfile: boolean;
  onlineUsers: AuthUser[];
  socket: Socket | null;
  checkAuth: () => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  login: (data: LoginData) => Promise<void>;
  updateProfile: (data: UpdateProfileData) => Promise<void>;
  logout: () => Promise<void>;
  connectSocket: () => void;
  disconnectSocket: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  authUser: null,
  isCheckingAuth: true,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  onlineUsers: [],
  socket: null,

  checkAuth: async () => {
    try {
      const response = await axiosInstance.get<AuthUser>("/auth/check");
      set({ authUser: response.data });
      get().connectSocket();
    } catch (error: any) {
      if (error?.response?.status === 401) {
        // Clear any stored auth state when unauthorized
        set({ authUser: null });
        localStorage.removeItem("token"); // If you're storing the token in localStorage

        // Optional: Redirect to login page if using React Router
        // window.location.href = '/login';
      }
      console.error(`Error in checkAuth:`, error?.response?.data || error);
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const response = await axiosInstance.post<AuthUser>("/auth/signup", data);
      set({ authUser: response.data });
      toast.success("Account Created Successfully");
      get().connectSocket();
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message || "Failed to create account";
      toast.error(errorMessage);
      throw error; // Propagate error to component for handling
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const response = await axiosInstance.post<AuthUser>("/auth/login", data);
      set({ authUser: response.data });
      get().connectSocket();
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message || "Invalid credentials";
      toast.error(errorMessage);
      throw error; // Propagate error to component for handling
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      // Clear all auth-related state
      set({
        authUser: null,
        onlineUsers: [],
      });
      localStorage.removeItem("token"); // If you're storing the token in localStorage
      get().disconnectSocket();
      toast.success("Logged out Successfully");
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message || "Error logging out";
      toast.error(errorMessage);
      // Force logout on frontend even if backend call fails
      set({ authUser: null, onlineUsers: [] });
      get().disconnectSocket();
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const response = await axiosInstance.put<AuthUser>(
        "/auth/update-profile",
        data
      );
      set({ authUser: response.data });
      toast.success("Profile updated Successfully");
    } catch (error: any) {
      if (error?.response?.status === 401) {
        // Handle unauthorized error
        get().logout();
        toast.error("Session expired. Please login again.");
        return;
      }
      const errorMessage =
        error?.response?.data?.message || "Failed to update profile";
      toast.error(errorMessage);
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  connectSocket: () => {
    const { authUser } = get();
    if (!authUser || get().socket?.connected) return;

    const socket = io(BASE_URL, {
      query: {
        userId: authUser._id,
      },
      auth: {
        token: localStorage.getItem("token"), // If you're using token-based auth
      },
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      if (error.message === "unauthorized") {
        get().logout();
      }
    });

    socket.connect();
    set({ socket: socket });

    socket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (socket?.connected) {
      socket.disconnect();
      set({ socket: null });
    }
  },
}));
