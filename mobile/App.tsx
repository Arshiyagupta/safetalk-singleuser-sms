import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar, Platform } from 'react-native';
import FlashMessage from 'react-native-flash-message';

import AuthScreen from './src/screens/AuthScreen';
import ChatScreen from './src/screens/ChatScreen';
import { COLORS } from './src/styles/colors';
import { RootStackParamList } from './src/types';

const Stack = createStackNavigator<RootStackParamList>();

const App: React.FC = () => {
  useEffect(() => {
    // Set status bar style
    if (Platform.OS === 'ios') {
      StatusBar.setBarStyle('dark-content');
    }
  }, []);

  return (
    <>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={COLORS.screenBackground}
        translucent={false}
      />
      
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Auth"
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: COLORS.screenBackground },
            gestureEnabled: true,
            gestureDirection: 'horizontal',
          }}
        >
          <Stack.Screen 
            name="Auth" 
            component={AuthScreen}
            options={{
              animationTypeForReplace: 'push',
            }}
          />
          <Stack.Screen 
            name="Main" 
            component={ChatScreen}
            options={{
              gestureEnabled: false, // Prevent swipe back from main screen
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>

      <FlashMessage 
        position="top"
        style={{
          paddingTop: Platform.OS === 'ios' ? 50 : 25,
        }}
      />
    </>
  );
};

export default App;