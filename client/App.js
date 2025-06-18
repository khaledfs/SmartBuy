// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MainScreen from './screens/MainScreen';
import ShoppingList from './screens/ShoppingList';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import MyListScreen from './screens/MyListScreen';
import TransitionScreen from './screens/TransitionScreen';
import TransitionScreen2 from './screens/TransitionScreen2';
import GroupManagerScreen from './screens/GroupManagerScreen';
import WhereToBuyScreen from './screens/WhereToBuyScreen';


const Stack = createStackNavigator();

export default function App() {
  return (
        <SafeAreaProvider>

    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }}/>
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="beforeMain" component={TransitionScreen} options={{ headerShown: false }}/>
        <Stack.Screen name="beforeShopping" component={TransitionScreen2} options={{ headerShown: false }}/>
        <Stack.Screen name="Main" component={MainScreen} options={{
    headerTitle: '🛒 Smart Buy',
    headerTitleAlign: 'center',
    headerTitleStyle: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#2E7D32',
    },
  }}/>
        <Stack.Screen name="ShoppingList" component={ShoppingList} />
        <Stack.Screen name="MyList" component={MyListScreen} />
        <Stack.Screen name="GroupManager" component={GroupManagerScreen} />
        <Stack.Screen name="WhereToBuy" component={WhereToBuyScreen} />
      </Stack.Navigator>
    </NavigationContainer>
        </SafeAreaProvider>

  );
}

