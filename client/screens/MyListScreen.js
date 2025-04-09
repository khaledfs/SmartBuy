import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Button,
  Alert,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Icon from 'react-native-vector-icons/Ionicons';
import { Checkbox } from 'react-native-paper';

const API_URL = 'http://10.0.2.2:3000/api/list';

const ICONS = {
  Broom: 'https://img.icons8.com/?size=100&id=116707&format=png&color=000000',
  Detergent: 'https://img.icons8.com/?size=100&id=3YZRvSb66SaF&format=png&color=000000',
  Sponge: 'https://img.icons8.com/?size=100&id=uibV0dBxFsJa&format=png&color=000000',
  'Glass Cleaner': 'https://img.icons8.com/?size=100&id=fvKgFVN2XKu1&format=png&color=000000',
  Chicken: 'https://img.icons8.com/?size=100&id=101707&format=png&color=000000',
  Salmon: 'https://img.icons8.com/?size=100&id=RqlLQZrW8PFf&format=png&color=000000',
  Beef: 'https://img.icons8.com/?size=100&id=70448&format=png&color=000000',
  Shrimp: 'https://img.icons8.com/?size=100&id=rm2ULHn0Cvt9&format=png&color=000000',
  Milk: 'https://img.icons8.com/?size=100&id=NjN1tSA0Isfp&format=png&color=000000',
  Eggs: 'https://img.icons8.com/?size=100&id=80533&format=png&color=000000',
  Yogurt: 'https://img.icons8.com/?size=100&id=yBiUcz9I4Ypl&format=png&color=000000',
  Cheese: 'https://img.icons8.com/?size=100&id=LSRddz1lzJP7&format=png&color=000000',
};

export default function MyListScreen({ navigation, route }) {
  const { items: initialItems, setItems: updateParentItems, onDelete } = route.params;

  const [items, setItems] = useState(initialItems || []);
  const [selected, setSelected] = useState({});

  const handleToggle = (id) => {
    setSelected((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleDeleteSelected = async () => {
    const toDelete = Object.keys(selected).filter((id) => selected[id]);

    if (toDelete.length === 0) return;

    Alert.alert(
      'Delete Items',
      `Are you sure you want to delete ${toDelete.length} item(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              const updated = [...items];

              for (let id of toDelete) {
                await axios.delete(`${API_URL}/${id}`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
              }

              const newItems = items.filter((item) => !toDelete.includes(item._id));
              setItems(newItems);
              updateParentItems(newItems); // Update ShoppingList.js
              setSelected({});
            } catch (err) {
              console.error('Delete error:', err.message);
            }
          },
        },
      ]
    );
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>🧾 My Shopping List</Text>
        {Object.values(selected).some((v) => v) && (
          <TouchableOpacity onPress={handleDeleteSelected}>
            <Icon name="trash-outline" size={26} color="red" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <Checkbox
              status={selected[item._id] ? 'checked' : 'unchecked'}
              onPress={() => handleToggle(item._id)}
            />
            <Image
              source={{ uri: ICONS[item.name] }}
              style={styles.itemIcon}
              resizeMode="contain"
            />
            <Text style={styles.itemText}>{item.name}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No items in your list.</Text>}
      />

      <View style={styles.footer}>
        <Button title="Back to Main" onPress={() => navigation.navigate('Main')} />
        <Button title="Logout" color="red" onPress={logout} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    marginBottom: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  itemText: {
    fontSize: 18,
    flex: 1,
    marginLeft: 10,
  },
  itemIcon: {
    width: 30,
    height: 30,
    marginHorizontal: 5,
  },
  empty: { textAlign: 'center', marginTop: 20, fontStyle: 'italic', color: '#888' },
  footer: { marginTop: 20 },
});
