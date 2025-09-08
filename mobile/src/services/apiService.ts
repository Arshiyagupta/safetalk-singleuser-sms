import axios, { AxiosInstance, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  User, 
  Message, 
  ResponseOptions, 
  AuthVerifyRequest, 
  ResponseSelectRequest,
  APIResponse,
  StorageKeys 
} from '../types';

class APIService {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    // Use your actual backend URL when deployed
    this.baseURL = __DEV__ 
      ? 'http://localhost:8080'  // Development
      : 'https://your-app-name.fly.dev'; // Production

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async (config) => {
        const token = await AsyncStorage.getItem(StorageKeys.AUTH_TOKEN);
        const userData = await AsyncStorage.getItem(StorageKeys.USER_DATA);
        
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        if (userData) {
          const user = JSON.parse(userData) as User;
          config.headers['x-user-phone'] = user.phoneNumber;
        }

        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        console.log(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      async (error) => {
        console.error('API Error:', error.response?.data || error.message);
        
        // Handle 401 errors (unauthorized)
        if (error.response?.status === 401) {
          await this.clearAuthData();
          // Navigate to login screen - would need navigation context
        }

        return Promise.reject(error);
      }
    );
  }

  // Authentication APIs
  async sendVerificationCode(phoneNumber: string): Promise<APIResponse> {
    const response = await this.client.post('/api/v1/auth/send-code', {
      phoneNumber
    });
    return response.data;
  }

  async verifyPhone(phoneNumber: string, code: string): Promise<APIResponse<{ user: User; token: string }>> {
    const response = await this.client.post('/api/v1/auth/verify', {
      phoneNumber,
      code
    } as AuthVerifyRequest);
    
    if (response.data.success && response.data.data) {
      // Store auth data locally
      await AsyncStorage.setItem(StorageKeys.AUTH_TOKEN, response.data.data.token);
      await AsyncStorage.setItem(StorageKeys.USER_DATA, JSON.stringify(response.data.data.user));
    }
    
    return response.data;
  }

  async getUserProfile(userId: string): Promise<APIResponse<User>> {
    const response = await this.client.get(`/api/v1/auth/profile/${userId}`);
    return response.data;
  }

  // Message APIs
  async getUserMessages(userId: string, limit?: number): Promise<APIResponse<Message[]>> {
    const params = limit ? { limit } : {};
    const response = await this.client.get(`/api/v1/messages/user/${userId}`, { params });
    return response.data;
  }

  async getMessage(messageId: string): Promise<APIResponse<{ message: Message; responseOptions: ResponseOptions }>> {
    const response = await this.client.get(`/api/v1/messages/${messageId}`);
    return response.data;
  }

  async getResponseOptions(messageId: string): Promise<APIResponse<ResponseOptions>> {
    const response = await this.client.get(`/api/v1/messages/${messageId}/options`);
    return response.data;
  }

  async sendResponse(messageId: string, request: ResponseSelectRequest): Promise<APIResponse> {
    const response = await this.client.post(`/api/v1/messages/${messageId}/respond`, request);
    return response.data;
  }

  async getConversationSummary(userId: string): Promise<APIResponse> {
    const response = await this.client.get(`/api/v1/messages/user/${userId}/summary`);
    return response.data;
  }

  // Utility methods
  async clearAuthData(): Promise<void> {
    await AsyncStorage.multiRemove([
      StorageKeys.AUTH_TOKEN,
      StorageKeys.USER_DATA
    ]);
  }

  async getStoredUser(): Promise<User | null> {
    try {
      const userData = await AsyncStorage.getItem(StorageKeys.USER_DATA);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error getting stored user:', error);
      return null;
    }
  }

  async getStoredToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(StorageKeys.AUTH_TOKEN);
    } catch (error) {
      console.error('Error getting stored token:', error);
      return null;
    }
  }

  // Health check
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', { timeout: 5000 });
      return response.data.status === 'healthy';
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  // Update base URL (useful for switching between dev/prod)
  updateBaseURL(url: string): void {
    this.baseURL = url;
    this.client.defaults.baseURL = url;
  }

  // Get current base URL
  getBaseURL(): string {
    return this.baseURL;
  }
}

export default new APIService();