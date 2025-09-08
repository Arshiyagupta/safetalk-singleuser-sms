import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Message } from '../types';
import { COLORS } from '../styles/colors';

interface MessageBubbleProps {
  message: Message;
  isOutgoing: boolean;
  showTimestamp?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOutgoing,
  showTimestamp = true,
}) => {
  const formatTimestamp = (createdAt: string): string => {
    const messageDate = new Date(createdAt);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60));
      return diffInMinutes < 1 ? 'now' : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  const bubbleStyle = [
    styles.bubble,
    isOutgoing ? styles.outgoingBubble : styles.incomingBubble,
  ];

  const containerStyle = [
    styles.container,
    isOutgoing ? styles.outgoingContainer : styles.incomingContainer,
  ];

  const textToDisplay = message.filteredText || message.originalText;

  return (
    <View style={containerStyle}>
      <View style={bubbleStyle}>
        <Text style={styles.messageText}>
          {textToDisplay}
        </Text>
      </View>
      {showTimestamp && (
        <Text style={[styles.timestamp, isOutgoing ? styles.outgoingTimestamp : styles.incomingTimestamp]}>
          {formatTimestamp(message.createdAt)}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    marginHorizontal: 16,
    maxWidth: Dimensions.get('window').width * 0.75,
  },
  outgoingContainer: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  incomingContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    minWidth: 60,
  },
  outgoingBubble: {
    backgroundColor: COLORS.outgoingMessage, // Green
    borderBottomRightRadius: 4,
  },
  incomingBubble: {
    backgroundColor: COLORS.incomingMessage, // Blue
    borderBottomLeftRadius: 4,
  },
  messageText: {
    color: COLORS.messageText, // White
    fontSize: 16,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.timestampText, // Gray
    marginTop: 4,
    marginHorizontal: 8,
  },
  outgoingTimestamp: {
    textAlign: 'right',
  },
  incomingTimestamp: {
    textAlign: 'left',
  },
});

export default MessageBubble;