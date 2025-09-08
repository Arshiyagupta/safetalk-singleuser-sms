import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ResponseOptions as ResponseOptionsType } from '../types';
import { COLORS } from '../styles/colors';

interface ResponseOptionsProps {
  responseOptions: ResponseOptionsType;
  onSelectResponse: (option: number) => void;
  onCustomResponse: (text: string) => void;
  onClose: () => void;
}

const ResponseOptions: React.FC<ResponseOptionsProps> = ({
  responseOptions,
  onSelectResponse,
  onCustomResponse,
  onClose,
}) => {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [customText, setCustomText] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleOptionSelect = (optionNumber: number) => {
    setSelectedOption(optionNumber);
    setShowCustomInput(false);
    setCustomText('');
  };

  const handleCustomEdit = () => {
    setShowCustomInput(true);
    setSelectedOption(null);
    
    // Pre-fill with selected option text if any
    if (selectedOption) {
      const optionText = selectedOption === 1 ? responseOptions.option1 :
                        selectedOption === 2 ? responseOptions.option2 :
                        responseOptions.option3;
      setCustomText(optionText);
    }
  };

  const handleSend = () => {
    if (showCustomInput && customText.trim()) {
      onCustomResponse(customText.trim());
    } else if (selectedOption) {
      onSelectResponse(selectedOption);
    }
  };

  const canSend = selectedOption || (showCustomInput && customText.trim());

  const getOptionText = (optionNumber: number): string => {
    switch (optionNumber) {
      case 1: return responseOptions.option1;
      case 2: return responseOptions.option2;
      case 3: return responseOptions.option3;
      default: return '';
    }
  };

  const renderOption = (optionNumber: number) => {
    const isSelected = selectedOption === optionNumber;
    const optionText = getOptionText(optionNumber);
    
    return (
      <TouchableOpacity
        key={optionNumber}
        style={[
          styles.optionButton,
          isSelected && styles.selectedOptionButton
        ]}
        onPress={() => handleOptionSelect(optionNumber)}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.optionText,
          isSelected && styles.selectedOptionText
        ]}>
          {optionText}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose your response:</Text>
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.optionsContainer} showsVerticalScrollIndicator={false}>
          {[1, 2, 3].map(renderOption)}
          
          <TouchableOpacity
            style={styles.editButton}
            onPress={handleCustomEdit}
            activeOpacity={0.7}
          >
            <Text style={styles.editButtonText}>
              ✏️ Write custom response
            </Text>
          </TouchableOpacity>

          {showCustomInput && (
            <View style={styles.customInputContainer}>
              <TextInput
                style={styles.customInput}
                value={customText}
                onChangeText={setCustomText}
                placeholder="Type your response..."
                placeholderTextColor={COLORS.inputPlaceholder}
                multiline
                maxLength={500}
                autoFocus
              />
              <Text style={styles.characterCount}>
                {customText.length}/500
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.sendButton,
              !canSend && styles.sendButtonDisabled
            ]}
            onPress={handleSend}
            disabled={!canSend}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.sendButtonText,
              !canSend && styles.sendButtonTextDisabled
            ]}>
              Send
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: COLORS.screenBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primaryText,
  },
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: COLORS.secondaryText,
    fontWeight: '300',
  },
  optionsContainer: {
    padding: 20,
  },
  optionButton: {
    backgroundColor: COLORS.optionButton,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedOptionButton: {
    backgroundColor: COLORS.selectedOption,
    borderColor: COLORS.selectedOption,
  },
  optionText: {
    fontSize: 16,
    color: COLORS.optionButtonText,
    lineHeight: 22,
  },
  selectedOptionText: {
    color: COLORS.selectedOptionText,
    fontWeight: '500',
  },
  editButton: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderStyle: 'dashed',
  },
  editButtonText: {
    fontSize: 16,
    color: COLORS.secondaryText,
    textAlign: 'center',
  },
  customInputContainer: {
    marginTop: 16,
  },
  customInput: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.primaryText,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    textAlign: 'right',
    fontSize: 12,
    color: COLORS.secondaryText,
    marginTop: 4,
    marginRight: 4,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: COLORS.inputBackground,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  cancelButtonText: {
    fontSize: 16,
    color: COLORS.secondaryText,
    fontWeight: '500',
  },
  sendButton: {
    flex: 1,
    backgroundColor: COLORS.success,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.divider,
    opacity: COLORS.OPACITY?.disabled || 0.5,
  },
  sendButtonText: {
    fontSize: 16,
    color: COLORS.messageText,
    fontWeight: '600',
  },
  sendButtonTextDisabled: {
    color: COLORS.secondaryText,
  },
});

export default ResponseOptions;