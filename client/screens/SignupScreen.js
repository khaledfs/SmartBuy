import React, { useState } from 'react';
import {
  View, Text, TextInput, Button, StyleSheet, Alert, Image, TouchableOpacity
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SignupScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profilePicUrl, setProfilePicUrl] = useState('');

  const handleImagePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setProfilePicUrl(uri);
    }
  };

  const handleSignup = async () => {
    if (password !== confirmPassword) {
      return Alert.alert('Password mismatch', 'Passwords do not match');
    }

    const payload = { username, phone, password, profilePicUrl };
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

      <TouchableOpacity onPress={handleImagePick}>
        <Image
          source={{ uri: profilePicUrl || 'https://cdn-icons-png.flaticon.com/512/847/847969.png' }}
          style={styles.profilePic}
        />
        <Text style={styles.picHint}>Tap to choose profile picture</Text>
      </TouchableOpacity>

      <TextInput placeholder="Username" value={username} onChangeText={setUsername} style={styles.input} />
      <TextInput placeholder="Phone Number" keyboardType="phone-pad" value={phone} onChangeText={setPhone} style={styles.input} />
      <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
      <TextInput placeholder="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry style={styles.input} />
      
      <Button title="Sign Up" onPress={handleSignup} />

      <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
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
  profilePic: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignSelf: 'center',
    marginBottom: 10,
  },
  picHint: {
    textAlign: 'center',
    marginBottom: 20,
    color: '#888',
    fontSize: 12,
  },
  link: {
    marginTop: 20,
    color: 'blue',
    textAlign: 'center',
  },
});
