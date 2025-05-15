// client/screens/MainScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Image,
  TextInput,
  SafeAreaView,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import Icon from 'react-native-vector-icons/Ionicons';

export default function MainScreen({ navigation }) {
  const [lists, setLists] = useState([]);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [listToRename, setListToRename] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const fetchLists = async () => {
    try {
      const res = await api.get('/lists');
      setLists(res.data);
    } catch (err) {
      console.error('Fetch lists error:', err);
    }
  };
useEffect(() => {
  navigation.setOptions({
    headerRight: () => (
      <TouchableOpacity
        onPress={() => {
          Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Logout',
                style: 'destructive',
                onPress: async () => {
                  await AsyncStorage.removeItem('token');
                  navigation.replace('Login');
                }
              }
            ]
          );
        }}
        style={{ marginRight: 16 }}
      >
        <Image
          source={{ uri: 'https://img.icons8.com/?size=100&id=67651&format=png&color=000000' }}
          style={{ width: 24, height: 24 }}
        />
      </TouchableOpacity>
    )
  });
}, [navigation]);

  // Check auth and initial load
  useEffect(() => {
    const checkSession = async () => {
      const token = await AsyncStorage.getItem('token');
      if (!token) navigation.replace('Login');
      else fetchLists();
    };
    checkSession();
  }, []);

  // Re-fetch on focus
  useEffect(() => navigation.addListener('focus', fetchLists), [navigation]);

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    navigation.replace('Login');
  };

  const openRenameModal = (list) => {
    setListToRename(list);
    setRenameName(list.name);
    setRenameModalVisible(true);
  };

  const handleRename = async () => {
    if (!renameName.trim()) return Alert.alert('Invalid Name', 'Please enter a valid list name.');
    try {
      await api.patch(`/lists/${listToRename._id}`, { name: renameName.trim() });
      setRenameModalVisible(false);
      fetchLists();
    } catch (err) {
      console.error('Rename error:', err);
      Alert.alert('Error', 'Could not rename list. Please try again.');
    }
  };

  const handleEditList = (list) => {
  setIsEditing(false);
  navigation.navigate('ShoppingList', {
    listId: list._id,
    listName: list.name,
  });
};

const handleDeleteList = (id) => {
    Alert.alert(
      'Delete List',
      'Are you sure you want to delete this list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/lists/${id}`);
              // drop it locally
              setLists(ls => ls.filter(l => l._id !== id));
            } catch (err) {
              console.error('Delete list error:', err);
              Alert.alert('Error', 'Couldn’t delete list. Try again.');
            }
          }
        }
      ]
    );
  };
  

  const renderItem = ({ item }) => (
    <View style={styles.listRow}>
      {isEditing ? (
        <>
          {/* Tapping the name enters item-editing */}
          <TouchableOpacity onPress={() => handleEditList(item)} style={styles.listButton}>
            <Text style={styles.item}>• {item.name}</Text>
          </TouchableOpacity>
  
          {/* Only in edit mode: delete icon */}
          <TouchableOpacity
            onPress={() => handleDeleteList(item._id)}
            style={styles.iconButton}
          >
            <Icon name="trash-outline" size={20} color="red" />
          </TouchableOpacity>
        </>
      ) : (
        <>
          {/* Normal mode: just display name + rename icon */}
          <Text style={styles.item}>- {item.name}</Text>
          <TouchableOpacity
            onPress={() => openRenameModal(item)}
            style={styles.iconButton}
          >
            <Icon name="create-outline" size={20} color="#666" />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
  

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Smart Buy</Text>

      <View style={styles.buttonRow}>
      <TouchableOpacity
          style={styles.button}
          onPress={() => {
            // just reset edit mode and open a brand‐new basket
            setIsEditing(false);
            navigation.navigate('ShoppingList', { newBasket: true });
          }}
        >
          <Text style={styles.buttonText}>CREATE LIST</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, isEditing && styles.buttonActive]}
          onPress={() => setIsEditing(prev => !prev)}
        >
          <Text style={styles.buttonText}>{isEditing ? 'CANCEL EDIT' : 'EDIT LIST'}</Text>
        </TouchableOpacity>
      </View>

      {isEditing && <Text style={styles.helperText}>Tap a list to edit its items</Text>}

      <Text style={styles.subtitle}>Existing Lists</Text>
      <FlatList
        data={lists}
        keyExtractor={item => item._id}
        renderItem={renderItem}
      />

      <Text style={styles.subtitle}>Previous Shoppings</Text>
      <FlatList
        data={[{ id: '3', name: 'Last Week' }, { id: '4', name: '2 Weeks Ago' }]}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <Text style={styles.item}>- {item.name}</Text>}
      />

      

      {/* Rename List Modal */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rename List</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="New List Name"
              value={renameName}
              onChangeText={setRenameName}
            />
            <View style={styles.modalButtons}>
              <Button title="Cancel" onPress={() => setRenameModalVisible(false)} />
              <Button title="Save" onPress={handleRename} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  subtitle: { fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
  helperText: { textAlign: 'center', marginBottom: 10, color: '#888' },
  item: { fontSize: 16, flex: 1 },
  iconButton: {marginHorizontal: 6},
  listRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  listButton: { flex: 1 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  button: { backgroundColor: '#2196F3', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6 },
  buttonActive: { backgroundColor: '#1976D2' },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { width: '80%', backgroundColor: '#fff', borderRadius: 8, padding: 20 },
  modalTitle: { fontSize: 18, marginBottom: 10, textAlign: 'center' },
  modalInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-around' },
});
