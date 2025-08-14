import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import LottieView from 'lottie-react-native';

export default function TransitionScreenGroup({ navigation, route }) {
  const { groupId } = route.params || {};
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('GroupSharedList', { groupId });
    }, 2500); // Match animation duration
    return () => clearTimeout(timer);
  }, [navigation, groupId]);

  return (
    <View style={styles.container}>
      <LottieView
        source={require('../assets/animations/beforeShopping.json')}
        autoPlay
        loop={false}
        style={styles.animation}
      />
      <Text style={styles.text}>Hurray! Group Trip Complete!</Text>
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
  text: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1976D2',
    marginTop: 24,
  },
}); 