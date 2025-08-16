import React, { useState } from 'react';
import {
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  Image, 
  ScrollView,
  StatusBar,
  Dimensions,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeSocketAfterLogin } from '../services/socket';

const { width, height } = Dimensions.get('window');

const MAROON = '#800020';
const GOLD = '#FFD700';

export default function SignupScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profilePicUrl, setProfilePicUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({
    username: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });

  const handleImagePick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setProfilePicUrl(uri);
    }
  };

  const validateForm = () => {
    const newErrors = { username: '', phone: '', password: '', confirmPassword: '' };
    let isValid = true;

    if (!username.trim()) {
      newErrors.username = 'Username is required';
      isValid = false;
    } else if (username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
      isValid = false;
    }

    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
      isValid = false;
    }
    // Temporarily allow any phone number for development/testing
    // else if (!/^05\d{8}$/.test(phone)) {
    //   newErrors.phone = 'Please enter a valid Israeli phone number (05XXXXXXXX)';
    //   isValid = false;
    // }

    if (!password) {
      newErrors.password = 'Password is required';
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    const payload = { username, phone, password, profilePicUrl };

    try {
      const response = await api.post('/auth/signup', payload);
      const { token } = response.data;
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('justSignedUp', 'true');
      
      // Initialize socket after successful signup
      await initializeSocketAfterLogin();
      
      navigation.reset({
        index: 0,
        routes: [{ name: 'beforeMain' }], // Go to transition screen
      });
    } catch (error) {
      console.log('Signup error:', error.response?.data || error.message);
      const msg = error.response?.data?.message || 'Something went wrong. Please try again.';
      Alert.alert('Signup Failed', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar backgroundColor={MAROON} barStyle="light-content" />
      
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={GOLD} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Account</Text>
        </View>

        {/* Profile Picture */}
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={handleImagePick} style={styles.profilePicContainer}>
            <Image
              source={{ 
                uri: profilePicUrl || 'https://cdn-icons-png.flaticon.com/512/847/847969.png' 
              }}
              style={styles.profilePic}
            />
            <View style={styles.cameraIcon}>
              <Ionicons name="camera" size={20} color={MAROON} />
            </View>
          </TouchableOpacity>
          <Text style={styles.picHint}>Tap to choose profile picture</Text>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" style={styles.inputIcon} />
            <TextInput
              placeholder="Username"
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
            <Ionicons name="call-outline" style={styles.inputIcon} />
            <TextInput
              placeholder="Phone Number (05XXXXXXXX)"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                setErrors(prev => ({ ...prev, phone: '' }));
              }}
              style={[styles.input, errors.phone ? styles.inputError : null]}
            />
          </View>
          {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}

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

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" style={styles.inputIcon} />
            <TextInput
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setErrors(prev => ({ ...prev, confirmPassword: '' }));
              }}
              style={[styles.input, errors.confirmPassword ? styles.inputError : null]}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>
          {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}

          <TouchableOpacity 
            style={[styles.signupButton, isLoading ? styles.signupButtonDisabled : null]}
            onPress={handleSignup}
            disabled={isLoading}
          >
            <Text style={styles.signupButtonText}>
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.loginLink}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginText}>
              Already have an account? <Text style={styles.loginTextBold}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MAROON,
  },
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: MAROON,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: height * 0.08,
    paddingBottom: 20,
    backgroundColor: MAROON,
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: GOLD,
    flex: 1,
    textAlign: 'center',
    letterSpacing: 1,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profilePicContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: GOLD,
  },
  profilePic: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: GOLD,
    borderRadius: 12,
    padding: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  picHint: {
    fontSize: 13,
    color: '#F8EDEB',
    opacity: 0.9,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 30,
    paddingTop: 30,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: '#F8EDEB',
    paddingHorizontal: 10,
  },
  inputIcon: {
    fontSize: 20,
    color: MAROON,
    marginRight: 8,
  },
  input: {
    flex: 1,
    padding: 10,
    fontSize: 16,
    color: MAROON,
    backgroundColor: 'transparent',
  },
  inputError: {
    borderColor: '#B00020',
  },
  errorText: {
    color: '#B00020',
    fontSize: 13,
    marginBottom: 8,
    marginLeft: 8,
  },
  signupButton: {
    backgroundColor: GOLD,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  signupButtonDisabled: {
    backgroundColor: '#E0C97F',
  },
  signupButtonText: {
    color: MAROON,
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  loginLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  loginText: {
    color: MAROON,
    fontSize: 15,
  },
  loginTextBold: {
    color: GOLD,
    fontWeight: 'bold',
  },
});
