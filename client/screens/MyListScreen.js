// client/screens/MyListScreen.js
import React, { useContext, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, SafeAreaView, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PersonalListContext from '../services/PersonalListContext';
import { PersonalListProvider } from '../services/PersonalListContext';

const CARD_MARGIN = 12;

export default function MyListScreen({ navigation }) {
  const { 
    personalList, 
    setPersonalList, 
    lastBought, 
    lastStore, 
    tripHistory, 
    selectedTrip,
    selectTrip,
    clearSelectedTrip
  } = useContext(PersonalListProvider._context || require('../services/PersonalListContext').default);
  
  const [activeTab, setActiveTab] = useState('current'); // 'current' or 'lastBought'
  const [showTripHistory, setShowTripHistory] = useState(false);
  
  const items = personalList || [];
  const lastBoughtItems = lastBought || [];
  const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/100?text=No+Image';

  // Handler for Compare Prices button
  const handleComparePrices = () => {
    const products = items.map(item => ({
      barcode: item.barcode || '',
      name: item.name,
      quantity: item.quantity || 1,
      image: item.img || item.icon, // Add the image field like group trip
      img: item.img || item.icon, // Also preserve the img field for consistency
      icon: item.img || item.icon // Also preserve the icon field
    }));
    navigation.navigate('WhereToBuy', {
      source: 'personal',
      products,
      tripType: 'personal',
    });
  };

  // Increase quantity
  const increaseQty = (item) => {
    setPersonalList(list => list.map(p =>
      (p._id === item._id || p.name === item.name)
        ? { ...p, quantity: (p.quantity || 1) + 1 }
        : p
    ));
  };

  // Decrease quantity (remove if 0)
  const decreaseQty = (item) => {
    setPersonalList(list => {
      return list
        .map(p =>
          (p._id === item._id || p.name === item.name)
            ? { ...p, quantity: (p.quantity || 1) - 1 }
            : p
        )
        .filter(p => (p.quantity || 1) > 0);
    });
  };

  // Remove item
  const removeItem = (item) => {
    setPersonalList(list => list.filter(p => !(p._id === item._id || p.name === item.name)));
  };

  // Render each item in the personal list as a card (with controls)
  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => removeItem(item)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="trash" size={22} color="#FF6B6B" />
      </TouchableOpacity>
      <Image
        source={{ uri: item.img && (item.img.startsWith('http') || item.img.startsWith('data:image/')) ? item.img : PLACEHOLDER_IMAGE }}
        style={styles.image}
        resizeMode="cover"
      />
      <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
      <View style={styles.qtyRow}>
        <TouchableOpacity
          style={styles.qtyButton}
          onPress={() => decreaseQty(item)}
        >
          <Ionicons name="remove" size={22} color="#2E7D32" />
        </TouchableOpacity>
        <Text style={styles.qtyText}>x{item.quantity || 1}</Text>
        <TouchableOpacity
          style={styles.qtyButton}
          onPress={() => increaseQty(item)}
        >
          <Ionicons name="add" size={22} color="#2E7D32" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render each item in the last bought list as a simplified card (read-only)
  const renderItem2 = ({ item }) => (
    <View style={styles.card}>
      <Image
        source={{ uri: item.img && (item.img.startsWith('http') || item.img.startsWith('data:image/')) ? item.img : PLACEHOLDER_IMAGE }}
        style={styles.image}
        resizeMode="cover"
      />
      <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
    </View>
  );

  // Render trip history item
  const renderTripHistoryItem = ({ item }) => {
    const tripDate = new Date(item.completedAt).toLocaleDateString();
    const tripTime = new Date(item.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    return (
      <TouchableOpacity 
        style={[styles.tripCard, selectedTrip?.id === item.id && styles.selectedTripCard]}
        onPress={() => selectTrip(item.id)}
      >
        <View style={styles.tripHeader}>
          <Text style={styles.tripTitle}>Trip #{item.tripNumber}</Text>
          <Text style={styles.tripDate}>{tripDate} at {tripTime}</Text>
        </View>
        {item.store && (
          <Text style={styles.tripStore}>
            {item.store.branch || item.store.storeName} - {item.items.length} items
          </Text>
        )}
        {item.store?.totalPrice && (
          <Text style={styles.tripPrice}>Total: ₪{item.store.totalPrice}</Text>
        )}
      </TouchableOpacity>
    );
  };

  // Empty state UI
  const renderEmptyState = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 }}>
      <Ionicons name="cart-outline" size={80} color="#2E7D32" style={{ marginBottom: 20 }} />
      <Text style={{ fontSize: 18, color: '#888', marginBottom: 20 }}>Your personal list is empty!</Text>
      <TouchableOpacity
        style={{
          backgroundColor: '#B2F2D7', // light green
          paddingVertical: 16,
          paddingHorizontal: 32,
          borderRadius: 8,
          opacity: 0.6,
        }}
        disabled={true}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>Compare Prices</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <View style={{ padding: 20, paddingBottom: 0 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#2E7D32', marginBottom: 16 }}>My List</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <TouchableOpacity
            style={[styles.tabCard, activeTab === 'current' && styles.activeTab]}
            onPress={() => setActiveTab('current')}
          >
            <Text style={styles.tabTitle}>CURRENT LIST</Text>
            <Text style={styles.tabCount}>{items.length}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabCard, activeTab === 'lastBought' && styles.activeTab]}
            onPress={() => setActiveTab('lastBought')}
          >
            <Text style={styles.tabTitle}>LAST BOUGHT</Text>
            <Text style={styles.tabCount}>{lastBoughtItems.length}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 8 }}>
        {activeTab === 'current' ? (
          items.length === 0 ? (
            renderEmptyState()
          ) : (
            <>
              <FlatList
                key={'grid-3'}
                data={items}
                renderItem={renderItem}
                keyExtractor={(item, idx) => `${item._id || item.id || item.name}_${idx}`}
                numColumns={3}
                contentContainerStyle={{ paddingBottom: 60, paddingHorizontal: CARD_MARGIN }}
              />
              <View style={{ alignItems: 'center', marginTop: 24, marginBottom: 16 }}>
                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={styles.selectItemsButton}
                    onPress={() => navigation.navigate('Main')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.buttonText}>Select Items</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.compareButton}
                    onPress={handleComparePrices}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.buttonText}>Compare</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )
        ) : (
          lastBoughtItems.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="cart-outline" size={80} color="#2E7D32" style={{ marginBottom: 20 }} />
              <Text style={{ fontSize: 18, color: '#888', marginBottom: 20 }}>No last trip yet</Text>
            </View>
          ) : (
            <>
              {/* Trip History Button */}
              {tripHistory.length > 1 && (
                <View style={{ marginBottom: 10 }}>
                  <TouchableOpacity
                    style={styles.tripHistoryButton}
                    onPress={() => setShowTripHistory(!showTripHistory)}
                  >
                    <Ionicons name={showTripHistory ? "chevron-up" : "chevron-down"} size={20} color="#2E7D32" />
                    <Text style={styles.tripHistoryButtonText}>
                      {showTripHistory ? 'Hide Trip History' : `Show Trip History (${tripHistory.length} trips)`}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Trip History List */}
              {showTripHistory && tripHistory.length > 0 && (
                <View style={{ marginBottom: 10 }}>
                  <FlatList
                    data={tripHistory}
                    renderItem={renderTripHistoryItem}
                    keyExtractor={(item) => item.id}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 8 }}
                  />
                  {selectedTrip && (
                    <TouchableOpacity
                      style={styles.clearTripButton}
                      onPress={clearSelectedTrip}
                    >
                      <Text style={styles.clearTripButtonText}>Show Most Recent Trip</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Store Info */}
              {lastStore && (
                <View style={{ backgroundColor: '#E3F2FD', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                  <Text style={{ color: '#1976D2', fontWeight: 'bold' }}>
                    Store: {lastStore.branch || lastStore.storeName}
                  </Text>
                  <Text style={{ color: '#1976D2' }}>
                    Address: {lastStore.address}
                  </Text>
                  {lastStore.totalPrice && (
                    <Text style={{ color: '#1976D2' }}>
                      Total Price: ₪{lastStore.totalPrice}
                    </Text>
                  )}
                  {selectedTrip && (
                    <Text style={{ color: '#1976D2', fontStyle: 'italic' }}>
                      Trip #{selectedTrip.tripNumber} - {new Date(selectedTrip.completedAt).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              )}

              {/* Items List */}
              <FlatList
                key={'last-bought'}
                data={lastBoughtItems}
                renderItem={renderItem2}
                keyExtractor={(item, idx) => `${item._id || item.id || item.name}_${idx}`}
                numColumns={3}
                contentContainerStyle={{ paddingBottom: 60, paddingHorizontal: CARD_MARGIN }}
              />
            </>
          )
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    alignItems: 'center',
    margin: CARD_MARGIN / 2,
    padding: 16,
    flex: 1,
    minWidth: 0,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    position: 'relative',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
    backgroundColor: '#F9EAEA',
    borderRadius: 16,
    padding: 4,
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginBottom: 10,
    marginTop: 8,
  },
  productName: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  qtyButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#E8F5E9',
    marginHorizontal: 4,
  },
  qtyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    minWidth: 28,
    textAlign: 'center',
  },
  tabCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    elevation: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeTab: {
    borderColor: '#2E7D32',
    backgroundColor: '#E8F5E9',
  },
  tabTitle: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#2E7D32',
    marginBottom: 4,
  },
  tabCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 10,
  },
  selectItemsButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  compareButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    textAlign: 'center',
  },
  tripCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginRight: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    minWidth: 150,
  },
  selectedTripCard: {
    borderColor: '#2E7D32',
    borderWidth: 2,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tripTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#333',
  },
  tripDate: {
    fontSize: 12,
    color: '#666',
  },
  tripStore: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  tripPrice: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#1976D2',
  },
  tripHistoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2F7',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  tripHistoryButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  clearTripButton: {
    backgroundColor: '#FFE0E0',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 10,
  },
  clearTripButtonText: {
    color: '#D32F2F',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
