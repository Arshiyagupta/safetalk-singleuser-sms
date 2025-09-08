import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS } from '../styles/colors';
import apiService from '../services/apiService';

interface AuthScreenProps {
  navigation: any;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ navigation }) => {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugCode, setDebugCode] = useState<string | null>(null);

  useEffect(() => {
    checkExistingAuth();
  }, []);

  const checkExistingAuth = async () => {
    try {
      const token = await apiService.getStoredToken();
      const user = await apiService.getStoredUser();
      
      if (token && user) {
        navigation.replace('Main');
      }
    } catch (error) {
      console.error('Error checking existing auth:', error);
    }
  };

  const formatPhoneNumber = (text: string) => {
    // Remove all non-numeric characters
    const cleaned = text.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX for US numbers
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    }
  };

  const handlePhoneNumberChange = (text: string) => {
    const formatted = formatPhoneNumber(text);
    setPhoneNumber(formatted);
  };

  const handleSendCode = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    // Convert formatted phone number back to plain format
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    
    try {
      const response = await apiService.sendVerificationCode(`+1${cleanPhone}`);
      
      if (response.success) {
        setStep('code');
        setDebugCode(response.debugCode || null);
        
        if (response.debugCode) {
          Alert.alert(
            'Development Mode', 
            `Verification code: ${response.debugCode}`,
            [{ text: 'OK' }]
          );
        }
      } else {
        Alert.alert('Error', response.error || 'Failed to send verification code');
      }
    } catch (error) {
      console.error('Error sending verification code:', error);
      Alert.alert('Error', 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    if (verificationCode.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const response = await apiService.verifyPhone(`+1${cleanPhone}`, verificationCode);
      
      if (response.success && response.data) {
        Alert.alert('Success', 'Phone number verified successfully', [
          {
            text: 'Continue',
            onPress: () => navigation.replace('Main')
          }
        ]);
      } else {
        Alert.alert('Error', response.error || 'Invalid verification code');
      }
    } catch (error) {
      console.error('Error verifying code:', error);
      Alert.alert('Error', 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToPhone = () => {
    setStep('phone');
    setVerificationCode('');
    setDebugCode(null);
  };

  const renderPhoneStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Welcome to SafeTalk</Text>
      <Text style={styles.subtitle}>
        Enter your phone number to get started
      </Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Phone Number</Text>
        <View style={styles.phoneInputContainer}>
          <Text style={styles.countryCode}>+1</Text>
          <TextInput
            style={styles.phoneInput}
            value={phoneNumber}
            onChangeText={handlePhoneNumberChange}
            placeholder="(555) 123-4567"
            placeholderTextColor={COLORS.inputPlaceholder}
            keyboardType="phone-pad"
            maxLength={14} // (XXX) XXX-XXXX
            autoFocus
          />
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.primaryButton,
          !phoneNumber.trim() && styles.primaryButtonDisabled
        ]}
        onPress={handleSendCode}
        disabled={!phoneNumber.trim() || loading}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.primaryButtonText,
          !phoneNumber.trim() && styles.primaryButtonTextDisabled
        ]}>
          {loading ? 'Sending...' : 'Send Code'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        We'll send you a verification code via SMS
      </Text>
    </View>
  );

  const renderCodeStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Verify Your Phone</Text>
      <Text style={styles.subtitle}>
        Enter the 6-digit code sent to{'\n'}
        <Text style={styles.phoneDisplay}>+1 {phoneNumber}</Text>
      </Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Verification Code</Text>
        <TextInput
          style={styles.codeInput}
          value={verificationCode}
          onChangeText={setVerificationCode}
          placeholder="123456"
          placeholderTextColor={COLORS.inputPlaceholder}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          textAlign="center"
        />
      </View>

      {debugCode && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>
            Development Mode - Code: {debugCode}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.primaryButton,
          !verificationCode.trim() && styles.primaryButtonDisabled
        ]}
        onPress={handleVerifyCode}
        disabled={!verificationCode.trim() || loading}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.primaryButtonText,
          !verificationCode.trim() && styles.primaryButtonTextDisabled
        ]}>
          {loading ? 'Verifying...' : 'Verify'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={handleBackToPhone}
        disabled={loading}
        activeOpacity={0.7}
      >
        <Text style={styles.secondaryButtonText}>
          Change Phone Number
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={handleSendCode}
        disabled={loading}
        activeOpacity={0.7}
      >
        <Text style={styles.linkButtonText}>
          Resend Code
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>🛡️</Text>
          <Text style={styles.appName}>SafeTalk</Text>
        </View>

        {step === 'phone' ? renderPhoneStep() : renderCodeStep()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 60,
  },
  logoText: {
    fontSize: 48,
    marginBottom: 8,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primaryText,
  },
  stepContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primaryText,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.secondaryText,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
  },
  phoneDisplay: {
    fontWeight: '600',
    color: COLORS.primaryText,
  },
  inputContainer: {
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primaryText,
    marginBottom: 8,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  countryCode: {
    fontSize: 16,
    color: COLORS.primaryText,
    fontWeight: '500',
    marginRight: 8,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.primaryText,
    height: '100%',
  },
  codeInput: {
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    fontSize: 18,
    color: COLORS.primaryText,
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  primaryButton: {
    backgroundColor: COLORS.success,
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonDisabled: {
    backgroundColor: COLORS.divider,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.messageText,
  },
  primaryButtonTextDisabled: {
    color: COLORS.secondaryText,
  },
  secondaryButton: {
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.primaryText,
  },
  linkButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkButtonText: {
    fontSize: 16,
    color: COLORS.info,
    textDecorationLine: 'underline',
  },
  disclaimer: {
    fontSize: 14,
    color: COLORS.secondaryText,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
  debugContainer: {
    backgroundColor: COLORS.warning,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  debugText: {
    fontSize: 14,
    color: COLORS.screenBackground,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default AuthScreen;