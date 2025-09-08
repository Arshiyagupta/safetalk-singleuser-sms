// Re-export shared types
export * from '../../../shared/types';

// Mobile-specific types
export interface NavigationProps {
  navigation: any;
  route: any;
}

export interface MessageBubbleProps {
  message: Message;
  isOutgoing: boolean;
  showTimestamp?: boolean;
}

export interface ResponseModalProps {
  visible: boolean;
  message: Message | null;
  responseOptions: ResponseOptions | null;
  onSelectResponse: (option: number) => void;
  onCustomResponse: (text: string) => void;
  onClose: () => void;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  error: string | null;
}

export interface ChatState {
  messages: Message[];
  loading: boolean;
  error: string | null;
  selectedMessage: Message | null;
  showResponseModal: boolean;
}

export interface KeyboardAwareProps {
  keyboardVerticalOffset?: number;
  enableOnAndroid?: boolean;
}

export interface FlashMessageProps {
  message: string;
  type: 'success' | 'warning' | 'danger' | 'info';
  duration?: number;
}

// Navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Chat: undefined;
  Settings: undefined;
};

export type AuthStackParamList = {
  Welcome: undefined;
  PhoneVerification: undefined;
  CodeVerification: { phoneNumber: string };
};

export type MainTabParamList = {
  Chat: undefined;
  Settings: undefined;
};

// Form types
export interface PhoneVerificationForm {
  phoneNumber: string;
}

export interface CodeVerificationForm {
  code: string;
}

export interface MessageInputForm {
  text: string;
}

// API response wrappers for mobile
export interface MobileAPIResponse<T = any> extends APIResponse<T> {
  timestamp: string;
}

// Storage keys
export enum StorageKeys {
  USER_DATA = '@safetalk_user',
  AUTH_TOKEN = '@safetalk_token',
  CHAT_HISTORY = '@safetalk_chat_history',
  SETTINGS = '@safetalk_settings',
}

// App settings
export interface AppSettings {
  notifications: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  darkMode: boolean;
  fontSize: 'small' | 'medium' | 'large';
}