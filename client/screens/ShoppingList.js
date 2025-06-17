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
  Image,
  FlatList,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import Icon from 'react-native-vector-icons/Ionicons';
import { registerListUpdates, joinListRoom, emitListUpdate } from '../services/socketEvents';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ICON_SIZE = 80;
const ICON_CONTAINER_WIDTH = SCREEN_WIDTH / 3 - 30;
const LABEL_FONT_SIZE = 14;

export default function ShoppingList({ navigation, route }) {
  const { newBasket, listId, listName } = route.params || {};
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

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
                onPress: async () => {
                  await AsyncStorage.removeItem('token');
                  navigation.replace('Login');
                },
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

  const fetchSuggestions = async (reset = false) => {
    if (isLoading || (!hasMore && !reset)) return;
    setIsLoading(true);
    const nextPage = reset ? 1 : page;

    try {
      const res = await api.get('/suggestions', {
        params: { page: nextPage, limit: 30, q: search },
      });
      const newData = Array.isArray(res.data?.suggestions) ? res.data.suggestions : [];
      setSuggestions(prev => (reset ? newData : [...prev, ...newData]));
      setPage(nextPage + 1);
      setHasMore(newData.length >= 30);
    } catch (err) {
      console.error('Fetch suggestions error:', err.message);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const token = await AsyncStorage.getItem('token');
      if (!token) return navigation.replace('Login');

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
    fetchSuggestions(true);
  }, [newBasket, listId, navigation]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      fetchSuggestions(true);
    }, 500);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      if (listId) {
        try {
          const { data: list } = await api.get(`/lists/${listId}`);
          setItems(list.items);
        } catch (err) {
          console.error('Focus refresh error:', err);
        }
      }
    });
    return unsubscribe;
  }, [navigation, listId]);

  useEffect(() => {
    if (!listId) return;
    joinListRoom(listId);

    const unsubscribe = registerListUpdates(async ({ listId: updatedListId }) => {
      if (updatedListId === listId) {
        try {
          const { data: list } = await api.get(`/lists/${listId}`);
          setItems(list.items);
        } catch (err) {
          console.error('Socket refresh error:', err);
        }
      }
    });

    return unsubscribe;
  }, [listId]);

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
      setItems([newItem, ...items]);
      emitListUpdate(listId);

    } catch (error) {
      console.error('Add + save error:', error?.response?.data || error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{listName ? `Editing: ${listName}` : ''}</Text>
        <TouchableOpacity
          style={styles.basketIcon}
          onPress={() => navigation.navigate('MyList', { listId, listName })}
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
        value={search}
        onChangeText={setSearch}
        autoComplete="off"
        autoCorrect={false}
      />

      <FlatList
  data={suggestions}
  keyExtractor={(item, index) => `${item._id || item.barcode || index}`}
  numColumns={2}
  onEndReached={() => fetchSuggestions()}
  onEndReachedThreshold={0.5}
  contentContainerStyle={{ paddingBottom: 60 }}
  renderItem={({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleAddItem(item.name)}
    >
      <Image source={{ uri: item.img }} style={styles.cardImage} />
      <Text style={styles.cardLabel} numberOfLines={2}>{item.name}</Text>
    </TouchableOpacity>
  )}
  ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 40 }}>No suggestions found.</Text>}
/>


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
  iconContainer: {
    width: ICON_CONTAINER_WIDTH,
    alignItems: 'center',
    margin: 6,
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
  card: {
  width: SCREEN_WIDTH / 2 - 24,
  backgroundColor: '#f9f9f9',
  borderRadius: 12,
  padding: 10,
  margin: 6,
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#ddd',
},
cardImage: {
  width: 80,
  height: 80,
  marginBottom: 6,
  resizeMode: 'contain',
},
cardLabel: {
  fontSize: 14,
  textAlign: 'center',
  color: '#333',
},

});
