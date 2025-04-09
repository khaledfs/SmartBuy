import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Icon from 'react-native-vector-icons/Ionicons';

const API_URL = 'http://10.0.2.2:3000/api/list';
const SUGGESTIONS_API = 'http://10.0.2.2:3000/api/suggestions';

export default function ShoppingList({ navigation }) {
  const [item, setItem] = useState('');
  const [items, setItems] = useState([]);
  const [suggestions, setSuggestions] = useState([]);

  const fetchItems = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return navigation.replace('Login');
      const res = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(res.data);
    } catch (error) {
      console.error('Fetch error:', error.message);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const res = await axios.get(SUGGESTIONS_API);
      setSuggestions(res.data);
    } catch (err) {
      console.error('Suggestions fetch error:', err.message);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchSuggestions();
  }, []);

  const handleAddItem = async () => {
    if (!item.trim()) return;
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await axios.post(
        API_URL,
        { name: item },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setItems([res.data, ...items]);
      setItem('');
    } catch (error) {
      console.error('Add error:', error.message);
    }
  };

  const handleDeleteItem = async (id) => {
    try {
      const token = await AsyncStorage.getItem('token');
      await axios.delete(`${API_URL}/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(items.filter((i) => i._id !== id));
    } catch (error) {
      console.error('Delete error:', error.message);
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    navigation.replace('Login');
  };

  const renderGroupedSuggestions = () => {
    const grouped = suggestions.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});

    return Object.entries(grouped).map(([category, items]) => (
      <View key={category} style={styles.card}>
        <Text style={styles.cardTitle}>{category}</Text>
        <View style={styles.iconRow}>
          {items.map((item) => (
            <TouchableOpacity key={item.key} style={styles.iconContainer} onPress={() => setItem(item.name.en)}>
              <Image source={{ uri: item.icon.light }} style={styles.icon} />
              <Text style={styles.iconLabel}>{item.name.en}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    ));
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Shopping List</Text>
        <TouchableOpacity
          style={styles.basketIcon}
          onPress={() =>
            navigation.navigate('MyList', {
              items,
              setItems,
              onDelete: handleDeleteItem,
            })
          }
        >
          <Icon name="cart-outline" size={28} />
          {items.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{items.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Add an item..."
        value={item}
        onChangeText={setItem}
        autoComplete="off"
        autoCorrect={false}
      />

      <Button title="ADD" onPress={handleAddItem} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
        <Text style={styles.subtitle}>Suggestions</Text>
        {renderGroupedSuggestions()}
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Back to Main Screen" onPress={() => navigation.navigate('Main')} />
        <Button title="Logout" onPress={logout} color="red" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  subtitle: { fontSize: 20, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  input: {
    borderColor: '#ccc',
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  footer: { marginTop: 6 },
  card: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 10,
    marginRight: 12,
    marginBottom: 20,
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  iconContainer: { alignItems: 'center', width: 80, marginBottom: 12 },
  icon: { width: 40, height: 40, marginBottom: 4 },
  iconLabel: { fontSize: 12, textAlign: 'center' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  basketIcon: {
    padding: 8,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'red',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
