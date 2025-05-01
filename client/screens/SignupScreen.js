// client/screens/SignupScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import api from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SignupScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleSignup = async () => {
    const payload = { username, phone, password };
    console.log('Signing up with:', payload);

    try {
      const response = await api.post('/auth/signup', payload);
      const { token } = response.data;
      await AsyncStorage.setItem('token', token);
      Alert.alert('Signup Success', 'You have successfully signed up!');
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (error) {
      console.log('Signup error:', error.response?.data || error.message);
      const msg = error.response?.data?.message;
      if (msg === 'username already exists' || msg === 'phone already exists') {
        Alert.alert('Signup Failed', msg);
      } else {
        Alert.alert('Signup Failed', 'Something went wrong');
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📝 Sign Up</Text>
      <TextInput
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        style={styles.input}
      />
      <TextInput
        placeholder="Phone Number"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        style={styles.input}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />
      <Button title="Sign Up" onPress={handleSignup} />
      <Text
        style={styles.link}
        onPress={() => navigation.navigate('Login')}
      >
        Already have an account? Log in
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  input: {
    borderColor: '#ccc',
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  link: {
    marginTop: 20,
    color: 'blue',
    textAlign: 'center',
  },
});
