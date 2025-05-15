// client/screens/ShoppingList.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Alert,
  TextInput,
  Button,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import Icon from 'react-native-vector-icons/Ionicons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ICON_SIZE = 80;
const ICON_CONTAINER_WIDTH = SCREEN_WIDTH / 3 - 30; // ~3 per row
const LABEL_FONT_SIZE = 14;

export default function ShoppingList({ navigation, route }) {
  const { newBasket, listId, listName } = route.params || {};
  const [item, setItem] = useState('');
  const [items, setItems] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
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
          source={{ uri: 'https://img.icons8.com/?size=100&id=arrojWw9F5j5&format=png&color=000000' }}
          style={{ width: 24, height: 24 }}
        />
      </TouchableOpacity>
    )
  });
}, [navigation]);

  useEffect(() => {
    const init = async () => {
      const token = await AsyncStorage.getItem('token');
      if (!token) return navigation.replace('Login');

      // fetch full product list (with price)
      const { data: s } = await api.get('/suggestions');
      setSuggestions(s);

      // decide which list to load
      if (newBasket) {
        setItems([]);
      } else if (listId) {
        const { data: list } = await api.get(`/lists/${listId}`);
        setItems(list.items);
      } else {
        const { data: lst } = await api.get('/list');
        setItems(lst);
      }
    };
    init();
  }, [newBasket, listId, navigation]);
const handleAddItem = async (name) => {
  const product = suggestions.find(p => p.name.en === name);
  if (!product) return;

  try {
    const res = await api.post('/list', {
      name: product.name.en,
      icon: product.icon.light,
      productId: product._id
    });

    const newItem = res.data;
    const updated = [newItem, ...items];
    setItems(updated);

    // ✅ Auto-save if editing an existing list
    if (listId) {
      await api.patch(`/lists/${listId}`, {
        name: listName || 'Unnamed List',
        items: updated.map(i => i._id)
      });
    }
  } catch (error) {
    console.error('Add + save error:', error.message);
  }
};


  const handleDeleteItem = async (id) => {
    try {
      await api.delete(`/list/${id}`);
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
    // group by category and filter by search term
    const grouped = suggestions.reduce((acc, suggestion) => {
      const nameLower = suggestion.name?.en?.toLowerCase();
      if (!nameLower) return acc;
      if (!nameLower.startsWith(item.toLowerCase())) return acc;
      if (!acc[suggestion.category]) acc[suggestion.category] = [];
      acc[suggestion.category].push(suggestion);
      return acc;
    }, {});

    return Object.entries(grouped).map(([category, prods]) => (
      <View key={category} style={styles.card}>
        <Text style={styles.cardTitle}>{category}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        >
          {prods.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={styles.iconContainer}
              onPress={() => handleAddItem(p.name.en)}
            >
              <Image source={{ uri: p.icon.light }} style={styles.icon} />
              <Text style={styles.iconLabel} numberOfLines={1}>
                {p.name.en}
              </Text>
              <Text style={styles.priceLabel}>
                ₪{p.price?.toFixed(2) ?? '–'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    ));
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>
          {listName ? `Editing: ${listName}` : 'Shopping List'}
        </Text>
        <TouchableOpacity
          style={styles.basketIcon}
          onPress={() =>
            navigation.navigate('MyList', {
              listId,
              listName,
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
        placeholder="Search items..."
        value={item}
        onChangeText={setItem}
        autoComplete="off"
        autoCorrect={false}
      />

      <ScrollView style={styles.suggestionArea}>
        <Text style={styles.subtitle}>Suggestions</Text>
        {renderGroupedSuggestions()}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Back to Main Screen"
          onPress={() => navigation.navigate('Main')}
        />
        <View style={{ marginTop: 10 }} />
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
    marginBottom: 10,
  },
  title: { fontSize: 24, fontWeight: 'bold' },
  input: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
  },
  suggestionArea: { flex: 1, marginBottom: 10 },
  subtitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  card: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  horizontalList: {
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: ICON_CONTAINER_WIDTH,
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: 8,
    marginBottom: 6,
  },
  iconLabel: {
    fontSize: LABEL_FONT_SIZE,
    textAlign: 'center',
  },
  priceLabel: {
    marginTop: 2,
    fontSize: LABEL_FONT_SIZE,
    fontWeight: '600',
    color: '#333',
  },
  basketIcon: { padding: 8, position: 'relative' },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'red',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  footer: { marginTop: 6 },
});
