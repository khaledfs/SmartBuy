// client/screens/MyListScreen.js

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Button,
  Alert,
  Image,
  Modal,
  TextInput,
  SafeAreaView,
} from 'react-native';
import LottieView from 'lottie-react-native';
import api from '../services/api';
import Icon from 'react-native-vector-icons/Ionicons';
import { Swipeable } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function MyListScreen({ navigation, route }) {
  const {
    listId,
    listName: initialName,
    items: parentItems,
    setItems: updateParentItems,
    onDelete,
  } = route.params || {};

  const [rawItems, setRawItems] = useState(parentItems || []);
  const [suggestions, setSuggestions] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [listName, setListName] = useState(initialName || '');

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
                  },
                },
              ]
            );
          }}
          style={{ marginRight: 16 }}
        >
                 <Icon name="log-out-outline" size={34} color="#000" />
          
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    api.get('/suggestions')
      .then(res => setSuggestions(res.data))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (listId && !parentItems) {
      api.get(`/lists/${listId}`)
        .then(res => {
          setRawItems(res.data.items);
          setListName(res.data.name);
        })
        .catch(err => console.error(err));
    }
  }, [listId, parentItems]);

  const groupedItems = useMemo(() => {
    const m = {};
    rawItems.forEach(it => {
      if (!m[it.name]) {
        const sug = suggestions.find(s => s.name.en === it.name);
        m[it.name] = {
          name: it.name,
          icon: sug?.icon.light,
          count: 1,
          quantity: it.quantity || 1,
          ids: [it._id],
        };
      } else {
        m[it.name].count++;
        m[it.name].quantity += it.quantity || 1;
        m[it.name].ids.push(it._id);
      }
    });
    return Object.values(m);
  }, [rawItems, suggestions]);

  const updateQuantity = async (itemId, newQuantity) => {
    try {
      const res = await api.patch(`/list/${itemId}`, { quantity: newQuantity });
      setRawItems(prev =>
        prev.map(i =>
          i._id === itemId ? { ...i, quantity: res.data.quantity } : i
        )
      );
    } catch (err) {
      console.error('Update quantity error:', err?.response?.data || err.message);
    }
  };

  const handleIncrement = (group) => {
    const targetId = group.ids[0];
    const current = rawItems.find(i => i._id === targetId);
    if (current) updateQuantity(targetId, current.quantity + 1);
  };

  const handleDecrement = (group) => {
    const targetId = group.ids[0];
    const current = rawItems.find(i => i._id === targetId);
    if (current?.quantity > 1) {
      updateQuantity(targetId, current.quantity - 1);
    }
  };

  const handleSaveList = async () => {
    if (!listName.trim()) {
      Alert.alert('Invalid Name', 'Enter a valid list name.');
      return;
    }
    try {
      const payload = {
        name: listName.trim(),
        items: rawItems.map(i => i._id),
      };
      if (listId) await api.patch(`/lists/${listId}`, payload);
      else await api.post('/lists', payload);
      setModalVisible(false);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not save list.');
    }
  };

  const renderSwipeActions = (group) => (
    <TouchableOpacity
      style={{ backgroundColor: 'red', justifyContent: 'center', alignItems: 'center', width: 70 }}
      onPress={async () => {
        try {
          for (let id of group.ids) {
            if (onDelete) await onDelete(id);
            else await api.delete(`/list/${id}`);
          }
          setRawItems(prev => prev.filter(i => !group.ids.includes(i._id)));
        } catch (err) {
          console.error('Swipe delete error:', err);
        }
      }}
    >
      <Icon name="trash-outline" size={24} color="#fff" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>
          {listId ? `Editing: ${listName}` : '🧾 My Shopping List'}
        </Text>
      </View>

      <FlatList
        data={groupedItems}
        keyExtractor={g => g.name}
        renderItem={({ item: g }) => (
          <Swipeable renderRightActions={() => renderSwipeActions(g)}>
            <View style={styles.itemRow}>
              {g.icon && <Image source={{ uri: g.icon }} style={styles.icon} />}
              <Text style={styles.itemText}>{g.name}</Text>
              <View style={styles.quantityControls}>
                <TouchableOpacity onPress={() => handleDecrement(g)} style={styles.qBtn}>
                  <Text style={styles.qBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.qCountText}>{g.quantity}</Text>
                <TouchableOpacity onPress={() => handleIncrement(g)} style={styles.qBtn}>
                  <Text style={styles.qBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Swipeable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <LottieView
              source={require('../assets/animations/grocery.json')}
              autoPlay
              loop
              style={styles.lottie}
            />
            <Text style={styles.emptyText}>Your list is empty</Text>
            <Text style={styles.emptySubtext}>Add something tasty 🥦🍞🥛</Text>
          </View>
        }
      />

      <View style={styles.footer}>
        {!listId && (
          <>
            <Button title="Save List" onPress={() => setModalVisible(true)} />
            <View style={{ height: 10 }} />
          </>
        )}
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>List Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter name"
              value={listName}
              onChangeText={setListName}
            />
            <View style={styles.modalBtns}>
              <Button title="Cancel" onPress={() => setModalVisible(false)} />
              <Button title="Save" onPress={handleSaveList} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: { fontSize: 24, fontWeight: 'bold' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderRadius: 6,
  },
  icon: { width: 40, height: 40, marginRight: 12, borderRadius: 4 },
  itemText: { fontSize: 18, flex: 1 },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  qBtn: {
    backgroundColor: '#eee',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  qBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  qCountText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  empty: { textAlign: 'center', marginTop: 20, color: '#888' },
  footer: { marginTop: 20 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
  },
  modalTitle: { fontSize: 18, marginBottom: 10, textAlign: 'center' },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
  },
  modalBtns: { flexDirection: 'row', justifyContent: 'space-around' },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  lottie: {
    width: 200,
    height: 200,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#555',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
});
