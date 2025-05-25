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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MainScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [createGroupModalVisible, setCreateGroupModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

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

  return (
    <SafeAreaView style={styles.container}>

      <Text style={styles.subtitle}>👥 My Groups</Text>
      <FlatList
        data={groups}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('ShoppingList', {
                listId: item.list?._id,
                listName: `${item.name}'s Shared List`,
              })
            }
          >
            <Text style={styles.groupItem}>• {item.name}</Text>
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
          onPress={() => setIsEditing((prev) => !prev)}
        >
          <Icon name="create-outline" size={24} color="#fff" />
          <Text style={styles.navButtonText}>{isEditing ? 'Cancel' : 'Edit'}</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingBottom: 70, backgroundColor: '#f9f9f9' },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#2E7D32',
  },
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
  },
});
