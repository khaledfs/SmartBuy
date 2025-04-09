import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';

const COLLECTIONS = {
  'Cleaning Equipment': [
    { label: 'Broom', icon: 'https://img.icons8.com/?size=100&id=116707&format=png' },
    { label: 'Detergent', icon: 'https://img.icons8.com/?size=100&id=3YZRvSb66SaF&format=png' },
  ],
  'Meat & Fish': [
    { label: 'Chicken', icon: 'https://img.icons8.com/?size=100&id=101707&format=png' },
    { label: 'Salmon', icon: 'https://img.icons8.com/?size=100&id=RqlLQZrW8PFf&format=png' },
  ],
  'Milk & Eggs': [
    { label: 'Milk', icon: 'https://img.icons8.com/?size=100&id=NjN1tSA0Isfp&format=png' },
    { label: 'Eggs', icon: 'https://img.icons8.com/?size=100&id=80533&format=png' },
  ],
};

export default function ShoppingListMain({ navigation }) {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🧺 Choose a Collection</Text>
      {Object.entries(COLLECTIONS).map(([category, items]) => (
        <TouchableOpacity
          key={category}
          style={styles.card}
          onPress={() => navigation.navigate('CollectionProducts', { category, products: items })}
        >
          <Text style={styles.cardTitle}>{category}</Text>
          <View style={styles.iconRow}>
            {items.map(({ label, icon }) => (
              <View key={label} style={styles.iconContainer}>
                <Image source={{ uri: icon }} style={styles.icon} />
                <Text style={styles.iconLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  card: {
    backgroundColor: '#f2f2f2',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap' },
  iconContainer: { alignItems: 'center', width: 80, marginRight: 12, marginBottom: 12 },
  icon: { width: 40, height: 40, marginBottom: 4 },
  iconLabel: { fontSize: 12, textAlign: 'center' },
});
