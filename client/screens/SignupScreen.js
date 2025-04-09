import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';

export default function SignupScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleSignup = async () => {
    const payload = { username, phone, password };
    console.log('Signing up with:', payload);
  
    try {
      const response = await axios.post('http://10.0.2.2:3000/api/auth/signup', payload);
      console.log('Signup success:', response.data);
      Alert.alert('Signup Success', 'You have successfully signed up!');
      // You can also navigate to login screen here if you want
      // navigation.navigate('Login');
    } catch (error) {
      console.log('Signup error:', error.response?.data || error.message);
      if (error.response && error.response.data.message === 'Username already exists') {
        Alert.alert('Signup Failed', 'Username already exists');
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
      <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
        Already have an account? Log in
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  input: {borderColor: '#ccc',borderWidth: 1,padding: 10,marginBottom: 10,borderRadius: 5,},
  link: { marginTop: 20,color: 'blue',textAlign: 'center',
},
});
