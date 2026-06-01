import axios from "axios";

const apiURL = import.meta.env.VITE_API_URL;

export const axiosInstance = axios.create({
  baseURL: apiURL,
});
