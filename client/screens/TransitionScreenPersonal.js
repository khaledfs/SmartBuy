import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';

export default function TransitionScreenPersonal({ navigation }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('MyList');
    }, 2500); // Adjust duration to match animation
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <LottieView
        source={require('../assets/animations/beforeShopping.json')}
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