import axios from "axios";

export const axiosInstance = axios.create({
  baseURL:
    import.meta.env.MODE === "development"
      ? "http://localhost:5001/api" // Development
      : "https://whisper-backend-production.up.railway.app/api", // Production URL
  withCredentials: true, // Ensure cookies are sent
});
