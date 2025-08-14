import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import api from '../services/api';

export default function ProductListScreen({ route, navigation }) {
  const { category } = route.params;
  const groupId = route?.params?.groupId || null;
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingAll, setAddingAll] = useState(false);

  useEffect(() => {
    setLoading(true);
    let url = `/suggestions/smart?type=${category}`;
    if (groupId) url += `&groupId=${groupId}`;
    api.get(url)
      .then(res => setProducts(res.data.suggestions || []))
      .catch(err => Alert.alert('Error', 'Failed to load suggestions'))
      .finally(() => setLoading(false));
  }, [category, groupId]);

  const handleAdd = async (product) => {
    try {
      if (groupId) {
        await api.post(`/groups/${groupId}/list/items`, {
          name: product.name,
          icon: product.img,
          productId: product._id || product.productId,
          barcode: product.barcode || '',
        });
        Alert.alert('Added', `${product.name} added to the shared group list!`);
      } else {
        await api.post('/list', {
          name: product.name,
          icon: product.img,
          productId: product._id || product.productId,
          barcode: product.barcode || '',
        });
        Alert.alert('Added', `${product.name} added to your list!`);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to add product');
    }
  };

  const handleAddAll = async () => {
    setAddingAll(true);
    try {
      if (groupId) {
        await Promise.all(products.map(product =>
          api.post(`/groups/${groupId}/list/items`, {
            name: product.name,
            icon: product.img,
            productId: product._id || product.productId,
          })
        ));
        Alert.alert('Added', 'All products added to the shared group list!');
      } else {
        await Promise.all(products.map(product =>
          api.post('/list', {
            name: product.name,
            icon: product.img,
            productId: product._id || product.productId,
          })
        ));
        Alert.alert('Added', 'All products added to your list!');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to add all products');
    }
    setAddingAll(false);
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#2E7D32" />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{category.toUpperCase()} Suggestions</Text>
      <TouchableOpacity style={styles.addAllButton} onPress={handleAddAll} disabled={addingAll}>
        <Text style={styles.addAllText}>{addingAll ? 'Adding...' : 'Add All'}</Text>
      </TouchableOpacity>
      <FlatList
        data={products}
        keyExtractor={(item, idx) => `${item.productId}_${idx}`}
        renderItem={({ item }) => (
          <View style={styles.productCard}>
            <Image source={{ uri: item.img }} style={styles.productImage} />
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.whySuggested}>{item.reason || item.type}</Text>
            </View>
            <TouchableOpacity style={styles.addButton} onPress={() => handleAdd(item)}>
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 20, paddingHorizontal: 12 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, color: '#2E7D32' },
  addAllButton: { backgroundColor: '#2E7D32', borderRadius: 8, padding: 10, alignItems: 'center', marginBottom: 12 },
  addAllText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  productCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  productImage: { width: 60, height: 60, borderRadius: 8, marginRight: 12 },
  productInfo: { flex: 1 },
  productName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  whySuggested: { fontSize: 13, color: '#888' },
  addButton: { backgroundColor: '#2E7D32', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 16 },
  addButtonText: { color: '#fff', fontWeight: 'bold' },
}); 