// Color scheme matching your existing Parenting Coordinator app
export const COLORS = {
  // Message bubbles - matching your screenshot
  outgoingMessage: '#4CAF50',    // Green for client messages (right side)
  incomingMessage: '#2196F3',    // Blue for ex messages (left side)
  
  // Background colors
  chatBackground: '#F5F5F5',     // Light gray background
  screenBackground: '#FFFFFF',   // White background for screens
  
  // Input styling
  inputBackground: '#FFFFFF',    // White input background
  inputBorder: '#E0E0E0',       // Light gray border
  inputPlaceholder: '#9E9E9E',   // Gray placeholder text
  
  // Text colors
  messageText: '#FFFFFF',        // White text on colored bubbles
  primaryText: '#212121',        // Dark text on light backgrounds
  secondaryText: '#757575',      // Gray secondary text
  timestampText: '#757575',      // Gray timestamp text
  
  // Button and action colors
  sendButton: '#9E9E9E',         // Gray send button
  sendButtonActive: '#4CAF50',   // Green when active
  
  // Header colors
  headerBackground: '#FFFFFF',   // White header
  headerText: '#212121',         // Dark header text
  headerBorder: '#E0E0E0',       // Light border
  
  // Status colors
  success: '#4CAF50',            // Green for success states
  warning: '#FF9800',            // Orange for warnings
  error: '#F44336',              // Red for errors
  info: '#2196F3',               // Blue for info
  
  // System colors
  divider: '#E0E0E0',           // Divider lines
  shadow: 'rgba(0, 0, 0, 0.1)', // Subtle shadows
  overlay: 'rgba(0, 0, 0, 0.5)', // Modal overlays
  
  // iOS specific colors
  systemBlue: '#007AFF',
  systemGreen: '#34C759',
  systemGray: '#8E8E93',
  
  // Response option colors
  optionButton: '#F5F5F5',      // Light gray for option buttons
  optionButtonText: '#212121',   // Dark text on option buttons
  selectedOption: '#4CAF50',     // Green for selected option
  selectedOptionText: '#FFFFFF', // White text on selected option
};

export const GRADIENTS = {
  // Subtle gradients for enhanced UI
  messageBubble: ['#4CAF50', '#45A049'], // Green gradient
  header: ['#FFFFFF', '#F8F8F8'],        // Subtle white gradient
};

export const OPACITY = {
  disabled: 0.5,
  pressed: 0.7,
  overlay: 0.8,
};

// Theme variants for future dark mode support
export const LIGHT_THEME = COLORS;

export const DARK_THEME = {
  ...COLORS,
  chatBackground: '#121212',
  screenBackground: '#1E1E1E',
  headerBackground: '#2D2D2D',
  primaryText: '#FFFFFF',
  secondaryText: '#B3B3B3',
  inputBackground: '#2D2D2D',
  inputBorder: '#404040',
  divider: '#404040',
};