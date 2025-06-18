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
import { joinRoom, registerListUpdates } from '../services/socketEvents';

export default function MyListScreen({ navigation, route }) {
  const {
    listId,
    listName: initialName,
    items: parentItems,
    setItems: updateParentItems,
    onDelete,
    location,
  } = route.params || {};

  const [rawItems, setRawItems] = useState(parentItems || []);
  const [suggestions, setSuggestions] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [listName, setListName] = useState(initialName || '');
  const [locationCity, setLocationCity] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('locationName')
      .then(city => setLocationCity(city || ''))
      .catch(() => {});
  }, []);

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
      .then(res => setSuggestions(res.data?.suggestions || []))
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

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      if (listId) {
        try {
          const { data } = await api.get(`/lists/${listId}`);
          setRawItems(data.items);
        } catch (err) {
          console.error('refresh list error:', err);
        }
      }
    });
    return unsubscribe;
  }, [navigation, listId]);

  useEffect(() => {
    if (listId) {
      joinRoom(listId);
    }
  }, [listId]);

  useEffect(() => {
    const unsubscribe = registerListUpdates(() => {
      if (listId) {
        api.get(`/lists/${listId}`)
          .then(res => setRawItems(res.data.items))
          .catch(err => console.error('Socket update failed:', err));
      }
    });
    return unsubscribe;
  }, [listId]);

  const groupedItems = useMemo(() => {
    const m = {};
    rawItems.forEach(it => {
      if (!m[it.name]) {
        const sug = suggestions.find(s => it.name.includes(s.name) || s.name.includes(it.name));
        m[it.name] = {
          name: it.name,
          icon: it.icon || it.img,
          quantity: it.quantity || 1,
          ids: [it._id],
        };
      } else {
        m[it.name].quantity += it.quantity || 1;
        m[it.name].ids.push(it._id);
      }
    });
    return Object.values(m);
  }, [rawItems, suggestions]);

  const updateQuantity = async (itemId, newQuantity, currentQuantity) => {
    try {
      const change = newQuantity - currentQuantity;
      const res = await api.patch(`/list/item/${itemId}/quantity`, { change });
      const { data } = await api.get(`/lists/${listId}`);
      setRawItems(data.items);
    } catch (err) {
      console.error('Update quantity error:', err?.response?.data || err.message);
    }
  };

  const handleIncrement = async (group) => {
    try {
      await handleAddItem(group.name);  
    } catch (err) {
      console.error('Increment via add failed:', err);
    }
  };

  const handleDecrement = async (group) => {
    const name = group.name;
    const product = suggestions.find(p => p.name === name);
    if (!product) return;

    try {
      const existingItem = rawItems.find(i => i.name === name);
      if (!existingItem) return;

      if (existingItem.quantity === 1) {
        await api.delete(`/list/item/${existingItem._id}`);
        setRawItems(prev => prev.filter(i => i._id !== existingItem._id));
      } else {
        const res = await api.patch(`/list/item/${existingItem._id}/quantity`, { change: -1 });
        const updatedItem = res.data;
        setRawItems(prev =>
          prev.map(i => (i._id === existingItem._id ? updatedItem : i))
        );
      }
    } catch (err) {
      console.error('Decrement via inverse-add failed:', err);
    }
  };

  const handleAddItem = async (name) => {
    const product = suggestions.find(p => p.name === name);
    if (!product) return;

    try {
      let res;
      if (listId) {
        res = await api.post(`/lists/${listId}/items`, {
          name: product.name,
          icon: product.img,
          productId: product._id
        });
      } else {
        res = await api.post('/list', {
          name: product.name,
          icon: product.img,
          productId: product._id
        });
      }

      const newItem = res.data;
      setRawItems(prev => [...prev, newItem]);

    } catch (error) {
      console.error('Add + save error:', error?.response?.data || error.message);
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

  const handleMarkAsBought = async (group) => {
    try {
      const itemId = group.ids[0];
      await api.post(`/list/item/${itemId}/buy`);
      setRawItems(prev => prev.filter(i => i._id !== itemId));
    } catch (err) {
      console.error('❌ Failed to mark as bought:', err?.response?.data || err.message);
    }
  };

  const renderSwipeActions = (group) => (
    <TouchableOpacity
      style={{ backgroundColor: 'red', justifyContent: 'center', alignItems: 'center', width: 70 }}
      onPress={async () => {
        try {
          for (let id of group.ids) {
            if (onDelete) await onDelete(id);
            else await api.delete(`/list/item/${id}`);
          }
          const { data } = await api.get(`/lists/${listId}`);
          setRawItems(data.items);
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
        keyExtractor={(g) => g.ids[0]}
        extraData={rawItems}
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
                <TouchableOpacity onPress={() => handleMarkAsBought(g)} style={styles.buyBtn}>
                  <Icon name="checkmark-done-outline" size={20} color="#fff" />
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

      {listId && (
        <View style={{ marginTop: 12 }}>
          <Button
  title="📍 Where To Buy"
  onPress={() => {
    if (!locationCity || rawItems.length === 0) {
      console.warn('⚠️ Missing location or items in route params');
      Alert.alert('Missing Data', 'Ensure your location and list items are loaded');
      return;
    }
    console.log('🚀 Navigating with locationCity:', locationCity, 'Items:', rawItems.length);

    navigation.navigate('WhereToBuy', {
      listId,
      listName,
      items: rawItems,
      locationCity   // ← 🔥 Pass it explicitly!
    });
  }}
  color="#007AFF"
/>

        </View>
      )}

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
  buyBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 6,
  },
});
