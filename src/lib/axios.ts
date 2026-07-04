import axios from 'axios';

// Get the base URL based on the environment (Vercel sets VERCEL_URL automatically)
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return ''; // browser should use relative url
  }
  
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  return `http://localhost:${process.env.PORT || 3000}`; // localhost for dev
};

export const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to handle errors globally if needed
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // You can handle global errors here (e.g., 401 Unauthorized -> redirect to login)
    console.error('API Error:', error?.response?.data || error.message);
    return Promise.reject(error);
  }
);
