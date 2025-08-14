import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  StyleSheet, 
  StatusBar,
  Image,
  Dimensions,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import jwtDecode from 'jwt-decode';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({
    username: '',
    password: ''
  });

  const handleLogin = async () => {
    // Clear previous errors
    setErrors({ username: '', password: '' });
    
    // Validation
    if (!username.trim()) {
      setErrors(prev => ({ ...prev, username: 'Username is required' }));
      return;
    }
    if (!password.trim()) {
      setErrors(prev => ({ ...prev, password: 'Password is required' }));
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await api.post('/auth/login', {
        identifier: username,
        password
      });
      
      const { token } = response.data;
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.removeItem('justSignedUp');
      navigation.reset({
        index: 0,
        routes: [{ name: 'beforeMain' }], // Go to transition screen
      });
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Login failed. Please try again.';
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    const checkToken = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          // Validate token by making a test API call
          const response = await api.get('/auth/verify', {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          // If we get here, token is valid
          if (response.status === 200) {
            navigation.reset({
              index: 0,
              routes: [{ name: 'beforeMain' }],
            });
          } else {
            // Token is invalid, remove it
            await AsyncStorage.removeItem('token');
          }
        }
      } catch (error) {
        // Token is invalid or expired, remove it
        console.log('Token validation failed:', error.message);
        await AsyncStorage.removeItem('token');
      }
    };
    checkToken();
  }, []);
  
  const MAROON = '#800020';
  const GOLD = '#FFD700';

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar backgroundColor="#2E7D32" barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Image 
          source={require('../assets/icon.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.appTitle}>Smart Buy</Text>
        <Text style={styles.subtitle}>Smart Shopping Made Easy</Text>
      </View>

      {/* Login Form */}
      <View style={styles.formContainer}>
        <Text style={styles.formTitle}>Welcome Back</Text>
        
        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" style={styles.inputIcon} />
          <TextInput
            placeholder="Username or Phone"
            value={username}
            onChangeText={(text) => {
              setUsername(text);
              setErrors(prev => ({ ...prev, username: '' }));
            }}
            style={[styles.input, errors.username ? styles.inputError : null]}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        {errors.username ? <Text style={styles.errorText}>{errors.username}</Text> : null}

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" style={styles.inputIcon} />
          <TextInput
            placeholder="Password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setErrors(prev => ({ ...prev, password: '' }));
            }}
            style={[styles.input, errors.password ? styles.inputError : null]}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>
        {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

        <TouchableOpacity 
          style={[styles.loginButton, isLoading ? styles.loginButtonDisabled : null]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          <Text style={styles.loginButtonText}>
            {isLoading ? 'Signing In...' : 'Sign In'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.signupLink}
          onPress={() => navigation.navigate('Signup')}
        >
          <Text style={styles.signupText}>
            Don't have an account? <Text style={styles.signupTextBold}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    alignItems: 'center',
    paddingTop: height * 0.1,
    paddingBottom: height * 0.05,
    backgroundColor: '#2E7D32',
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 10,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#E8F5E8',
    opacity: 0.9,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 40,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 30,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
    backgroundColor: '#FAFAFA',
  },
  inputIcon: {
    fontSize: 20,
    color: '#666',
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: '#333',
  },
  inputError: {
    borderColor: '#FF6B6B',
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    marginBottom: 10,
    marginLeft: 5,
  },
  loginButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 20,
    shadowColor: '#2E7D32',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loginButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  signupLink: {
    alignItems: 'center',
    marginTop: 10,
  },
  signupText: {
    fontSize: 16,
    color: '#666',
  },
  signupTextBold: {
    color: '#2E7D32',
    fontWeight: 'bold',
  },
});
