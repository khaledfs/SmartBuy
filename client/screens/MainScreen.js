import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  SafeAreaView,
  Alert,
  Button,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { joinRoom, registerGroupUpdates } from '../services/socketEvents';

export default function MainScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState([]);
  const [createGroupModalVisible, setCreateGroupModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [locationName, setLocationName] = useState(null);
  const [editLocationVisible, setEditLocationVisible] = useState(false);
  const [manualLocation, setManualLocation] = useState('');

  useEffect(() => {
    const fetchLocationName = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is required.');
        return;
      }
      const { coords } = await Location.getCurrentPositionAsync({});
      const [place] = await Location.reverseGeocodeAsync({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      if (place) {
        const city = place.city || place.region || place.name;
        const country = place.country || '';
        setLocationName(`${city}, ${country}`);
      }
    };
    fetchLocationName();
  }, []);

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    navigation.replace('Login');
  };

  const fetchGroups = async () => {
    try {
      const res = await api.get('/groups/my');
      setGroups(res.data);
    } catch (err) {
      console.error('Fetch groups error:', err);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      const token = await AsyncStorage.getItem('token');
      if (!token) navigation.replace('Login');
      else fetchGroups();
    };
    checkSession();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchGroups);
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => {
            Alert.alert('Logout', 'Are you sure you want to logout?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Logout',
                style: 'destructive',
                onPress: logout,
              },
            ]);
          }}
          style={{ marginRight: 16 }}
        >
          <Icon name="log-out-outline" size={34} color="#000" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    groups.forEach((group) => joinRoom(group._id));
  }, [groups]);

  useEffect(() => {
    const unsubscribe = registerGroupUpdates(fetchGroups);
    return unsubscribe;
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {locationName && (
        <Text style={{ textAlign: 'center', color: '#666', marginBottom: 10 }}>
          📍 Your Location: {locationName}
        </Text>
      )}

      <Text style={styles.subtitle}>👥 My Groups</Text>
      <FlatList
        data={groups}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
  <TouchableOpacity
    style={styles.groupCard}
    onPress={() =>
      navigation.navigate('ShoppingList', {
        listId: item.list?._id,
        listName: `${item.name}'s Shared List`,
      })
    }
  >
    <View style={styles.groupCardLeft}>
      <Icon name="people-outline" size={28} color="#2E7D32" style={{ marginRight: 12 }} />
      <Text style={styles.groupCardName}>{item.name}</Text>
    </View>
    <Icon name="chevron-forward" size={20} color="#888" />
  </TouchableOpacity>
)}

        ListEmptyComponent={
          <Text style={styles.item}>You don't belong to any group yet.</Text>
        }
      />

      {/* Bottom Navigation Bar */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setCreateGroupModalVisible(true)}
        >
          <Icon name="add-circle" size={24} color="#fff" />
          <Text style={styles.navButtonText}>Create</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setEditLocationVisible(true)}
        >
          <Icon name="location-outline" size={24} color="#fff" />
          <Text style={styles.navButtonText}>Location</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('GroupManager')}
        >
          <Icon name="people-circle-outline" size={24} color="#fff" />
          <Text style={styles.navButtonText}>Groups</Text>
        </TouchableOpacity>
      </View>

      {/* Create Group Modal */}
      <Modal
        visible={createGroupModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateGroupModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Group</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Group Name"
              value={newGroupName}
              onChangeText={setNewGroupName}
            />
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => setCreateGroupModalVisible(false)}
              />
              <Button
                title="Create"
                onPress={async () => {
                  if (!newGroupName.trim()) {
                    Alert.alert('Enter a group name');
                    return;
                  }
                  try {
                    await api.post('/groups', { name: newGroupName.trim() });
                    setNewGroupName('');
                    setCreateGroupModalVisible(false);
                    fetchGroups();
                  } catch (err) {
                    console.error('Group create error:', err);
                    Alert.alert('Error creating group');
                  }
                }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Location Modal */}
      <Modal
        visible={editLocationVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditLocationVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Location</Text>
            <Button
              title="📍 Use Current Location"
              onPress={async () => {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                  Alert.alert('Permission Denied', 'Location access is required.');
                  return;
                }
                const { coords } = await Location.getCurrentPositionAsync({});
                const [place] = await Location.reverseGeocodeAsync(coords);
                const city = place.city || place.region || place.name;
                const country = place.country || '';
                setLocationName(`${city}, ${country}`);
                setEditLocationVisible(false);
              }}
            />
            <Text style={{ marginVertical: 10, textAlign: 'center' }}>OR</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter location manually"
              value={manualLocation}
              onChangeText={setManualLocation}
            />
            <View style={styles.modalButtons}>
              <Button title="Cancel" onPress={() => setEditLocationVisible(false)} />
              <Button
                title="Set"
                onPress={async () => {
                  try {
                    const results = await Location.geocodeAsync(manualLocation.trim());
                    if (results.length === 0) {
                      Alert.alert('Invalid Location', 'Please enter a real city or address.');
                      return;
                    }
                    const { latitude, longitude } = results[0];
                    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
                    const city = place.city || place.region || place.name;
                    const country = place.country || '';
                    setLocationName(`${city}, ${country}`);
                    setEditLocationVisible(false);
                  } catch (err) {
                    Alert.alert('Error', 'Unable to validate location.');
                    console.error(err);
                  }
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingBottom: 70, backgroundColor: '#f9f9f9' },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
    color: '#444',
  },
  item: { fontSize: 16, color: '#333' },
  groupItem: { fontSize: 16, color: '#1565C0', marginBottom: 6 },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  navButton: { alignItems: 'center', justifyContent: 'center' },
  navButtonText: { color: '#fff', fontSize: 12, marginTop: 2 },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    marginBottom: 10,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },groupCard: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: '#fff',
  padding: 16,
  marginBottom: 10,
  borderRadius: 12,
  elevation: 2, // for Android shadow
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 3,
},

groupCardLeft: {
  flexDirection: 'row',
  alignItems: 'center',
},

groupCardName: {
  fontSize: 16,
  fontWeight: '600',
  color: '#333',
},

});
