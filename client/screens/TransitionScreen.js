import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TransitionScreen({ navigation }) {
  useEffect(() => {
    const checkAndNavigate = async () => {
      let loginType = 'back';
      const justSignedUp = await AsyncStorage.getItem('justSignedUp');
      if (justSignedUp) {
        loginType = 'new';
        await AsyncStorage.removeItem('justSignedUp');
      }
      navigation.replace('Main', { loginType });
    };
    const timer = setTimeout(() => {
      checkAndNavigate();
    }, 2500); // or your animation duration
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <LottieView
        source={require('../assets/animations/beforeMain.json')} // use your desired animation here
        autoPlay
        loop={false}
        style={styles.animation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  animation: {
    width: 300,
    height: 300,
  },
});
