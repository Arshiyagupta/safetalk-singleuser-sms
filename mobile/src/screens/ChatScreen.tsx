import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import Modal from 'react-native-modal';
import { Message, ResponseOptions as ResponseOptionsType, User } from '../types';
import { COLORS } from '../styles/colors';
import MessageBubble from '../components/MessageBubble';
import ResponseOptions from '../components/ResponseOptions';
import apiService from '../services/apiService';

interface ChatScreenProps {
  navigation: any;
}

const ChatScreen: React.FC<ChatScreenProps> = ({ navigation }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [responseOptions, setResponseOptions] = useState<ResponseOptionsType | null>(null);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sendingResponse, setSendingResponse] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    initializeChat();
    
    // Set up polling for new messages (in production, use WebSocket or push notifications)
    const pollInterval = setInterval(loadMessages, 10000); // Poll every 10 seconds
    
    return () => clearInterval(pollInterval);
  }, []);

  const initializeChat = async () => {
    try {
      const storedUser = await apiService.getStoredUser();
      if (!storedUser) {
        navigation.replace('Auth');
        return;
      }
      
      setUser(storedUser);
      await loadMessages(storedUser);
    } catch (error) {
      console.error('Error initializing chat:', error);
      Alert.alert('Error', 'Failed to initialize chat');
    }
  };

  const loadMessages = async (currentUser?: User) => {
    try {
      const userToUse = currentUser || user;
      if (!userToUse) return;

      const response = await apiService.getUserMessages(userToUse.id, 50);
      
      if (response.success && response.data) {
        setMessages(response.data.reverse()); // Reverse to show newest at bottom
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadMessages();
  };

  const handleMessagePress = async (message: Message) => {
    // Only show response options for incoming messages
    if (message.direction !== 'incoming') return;

    try {
      const response = await apiService.getResponseOptions(message.id);
      
      if (response.success && response.data) {
        setSelectedMessage(message);
        setResponseOptions(response.data);
        setShowResponseModal(true);
      } else {
        Alert.alert('Error', 'No response options available for this message');
      }
    } catch (error) {
      console.error('Error getting response options:', error);
      Alert.alert('Error', 'Failed to load response options');
    }
  };

  const handleSelectResponse = async (optionNumber: number) => {
    if (!selectedMessage || !responseOptions) return;

    setSendingResponse(true);
    
    try {
      const response = await apiService.sendResponse(selectedMessage.id, {
        messageId: selectedMessage.id,
        selectedOption: optionNumber
      });

      if (response.success) {
        setShowResponseModal(false);
        setSelectedMessage(null);
        setResponseOptions(null);
        
        // Refresh messages to show the sent response
        await loadMessages();
        
        Alert.alert('Success', 'Response sent successfully');
      } else {
        Alert.alert('Error', response.error || 'Failed to send response');
      }
    } catch (error) {
      console.error('Error sending response:', error);
      Alert.alert('Error', 'Failed to send response');
    } finally {
      setSendingResponse(false);
    }
  };

  const handleCustomResponse = async (customText: string) => {
    if (!selectedMessage) return;

    setSendingResponse(true);
    
    try {
      const response = await apiService.sendResponse(selectedMessage.id, {
        messageId: selectedMessage.id,
        customResponse: customText
      });

      if (response.success) {
        setShowResponseModal(false);
        setSelectedMessage(null);
        setResponseOptions(null);
        
        // Refresh messages to show the sent response
        await loadMessages();
        
        Alert.alert('Success', 'Response sent successfully');
      } else {
        Alert.alert('Error', response.error || 'Failed to send response');
      }
    } catch (error) {
      console.error('Error sending custom response:', error);
      Alert.alert('Error', 'Failed to send response');
    } finally {
      setSendingResponse(false);
    }
  };

  const handleCloseModal = () => {
    setShowResponseModal(false);
    setSelectedMessage(null);
    setResponseOptions(null);
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <TouchableOpacity
      onPress={() => handleMessagePress(item)}
      disabled={item.direction === 'outgoing'}
      activeOpacity={item.direction === 'incoming' ? 0.7 : 1}
    >
      <MessageBubble 
        message={item} 
        isOutgoing={item.direction === 'outgoing'} 
      />
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity 
        onPress={() => navigation.goBack()} 
        style={styles.backButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.backButtonText}>←</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>SafeTalk</Text>
      <View style={styles.headerRight} />
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>No messages yet</Text>
      <Text style={styles.emptyStateText}>
        When your ex-partner sends a message, it will appear here after AI filtering.
      </Text>
    </View>
  );

  const renderFooter = () => (
    <View style={styles.footer}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={messageInput}
          onChangeText={setMessageInput}
          placeholder="Type your message..."
          placeholderTextColor={COLORS.inputPlaceholder}
          multiline
          maxLength={500}
        />
        <TouchableOpacity 
          style={[
            styles.sendButton,
            messageInput.trim() ? styles.sendButtonActive : null
          ]}
          disabled={!messageInput.trim()}
          onPress={() => {
            // TODO: Implement direct message sending
            Alert.alert('Info', 'Direct messaging coming soon. For now, respond to incoming messages.');
            setMessageInput('');
          }}
        >
          <Text style={styles.sendButtonText}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      
      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.messagesList}
          contentContainerStyle={messages.length === 0 ? styles.messagesListEmpty : styles.messagesListContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.secondaryText}
            />
          }
          ListEmptyComponent={!loading ? renderEmptyState : null}
          onContentSizeChange={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
        />
        
        {renderFooter()}
      </KeyboardAvoidingView>

      {/* Response Options Modal */}
      <Modal
        isVisible={showResponseModal}
        onBackdropPress={handleCloseModal}
        style={styles.modal}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        backdropOpacity={0.5}
        useNativeDriver
      >
        {responseOptions && (
          <ResponseOptions
            responseOptions={responseOptions}
            onSelectResponse={handleSelectResponse}
            onCustomResponse={handleCustomResponse}
            onClose={handleCloseModal}
          />
        )}
      </Modal>

      {/* Loading overlay */}
      {(loading || sendingResponse) && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>
            {loading ? 'Loading messages...' : 'Sending response...'}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.headerBackground,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.headerBorder,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: COLORS.primaryText,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.headerText,
  },
  headerRight: {
    width: 40, // Balance the back button
  },
  chatContainer: {
    flex: 1,
    backgroundColor: COLORS.chatBackground,
  },
  messagesList: {
    flex: 1,
  },
  messagesListContent: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  messagesListEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primaryText,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: COLORS.secondaryText,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    backgroundColor: COLORS.screenBackground,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.primaryText,
    maxHeight: 100,
    textAlignVertical: 'top',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.sendButton,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: COLORS.sendButtonActive,
  },
  sendButtonText: {
    fontSize: 18,
    color: COLORS.messageText,
    fontWeight: 'bold',
  },
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.messageText,
    fontSize: 16,
    marginTop: 16,
  },
});

export default ChatScreen;