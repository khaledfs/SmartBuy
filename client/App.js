// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import MainScreen from './screens/MainScreen';
import ShoppingList from './screens/ShoppingList';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import MyListScreen from './screens/MyListScreen';
import TransitionScreen from './screens/TransitionScreen';
import TransitionScreen2 from './screens/TransitionScreen2';


const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }}/>
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="beforeMain" component={TransitionScreen} options={{ headerShown: false }}/>
        <Stack.Screen name="beforeShopping" component={TransitionScreen2} options={{ headerShown: false }}/>
        <Stack.Screen name="Main" component={MainScreen} />
        <Stack.Screen name="ShoppingList" component={ShoppingList} />
        <Stack.Screen name="MyList" component={MyListScreen} />

      </Stack.Navigator>
    </NavigationContainer>
  );
}

