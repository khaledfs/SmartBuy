import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, StyleSheet, SafeAreaView, Alert, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import productsData from '../assets/products.json';
import { Swipeable } from 'react-native-gesture-handler';
import { registerListUpdates, joinRoom } from '../services/socketEvents';
import { useIsFocused } from '@react-navigation/native';
import { formatPrice } from '../utils/priceFormatter';

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/100?text=No+Image';
const DELETE_MSG_DURATION = 4000;

const useProductJson = () => {
  const loadProducts = async () => productsData;
  return { loadProducts, loading: false, error: null };
};

export default function GroupSharedListScreen({ route, navigation }) {
  const { groupId, currentUserId, groupCreatorId, currentUserName } = route.params || {};
  const [summary, setSummary] = useState({ currentList: [], lastBought: [], tripCount: 0, currentTripNumber: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('current'); // 'current' or 'lastBought'
  const [showTripHistory, setShowTripHistory] = useState(false);
  const [tripHistory, setTripHistory] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const isFocused = useIsFocused();
  const { loadProducts: loadProductJson } = useProductJson();
  const [deletedMessages, setDeletedMessages] = useState([]); // [{id, text, fadeAnim}]

  useEffect(() => {
    if (!groupId) return;
    
    console.log('👥 Joining group room:', groupId);
    joinRoom(groupId);
    
    fetchSummary();
    
    const unsubscribe = registerListUpdates((data) => {
      console.log('📢 List update received in GroupSharedListScreen:', data);
      console.log('🔄 Refreshing group list...');
      fetchSummary();
    });
    
    return () => {
      console.log('👥 Leaving group room:', groupId);
      unsubscribe && unsubscribe();
    };
  }, [groupId, isFocused]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      console.log('📥 Fetching group list summary for groupId:', groupId);
      const response = await api.get(`/groups/${groupId}/list/summary`);
      console.log('📥 Received summary data:', {
        currentListCount: response.data.currentList?.length || 0,
        lastBoughtCount: response.data.lastBought?.length || 0,
        tripCount: response.data.tripCount || 0,
        currentTripNumber: response.data.currentTripNumber || 0
      });
      setSummary(response.data);
    } catch (err) {
      console.error('❌ Error fetching group list summary:', err);
      Alert.alert('Error', 'Failed to fetch group list summary');
      setSummary({ currentList: [], lastBought: [], tripCount: 0, currentTripNumber: 0 });
    } finally {
      setLoading(false);
    }
  };

  const fetchTripHistory = async () => {
    try {
      const response = await api.get(`/groups/${groupId}/trips`);
      setTripHistory(response.data);
    } catch (err) {
      console.error('❌ Error fetching trip history:', err);
      Alert.alert('Error', 'Failed to fetch trip history');
    }
  };

  const fetchTripItems = async (tripId) => {
    try {
      const response = await api.get(`/groups/${groupId}/trips/${tripId}`);
      setSelectedTrip(response.data);
      setShowTripHistory(false);
    } catch (err) {
      console.error('❌ Error fetching trip items:', err);
      Alert.alert('Error', 'Failed to fetch trip items');
    }
  };

  const handleCompare = () => {
    const products = summary.currentList
      .filter(item => item && item.name) // Only filter for valid items with names
      .map(item => ({
        barcode: item.barcode || '', // Allow empty barcodes
        name: item.name,
        quantity: item.quantity || 1,
        image: item.img || item.icon // Add the image field
      }));
    
    console.log(`🛒 Compare: ${products.length} products for group ${groupId}`);
    
    navigation.navigate('WhereToBuy', {
      products,
      tripType: 'group',
      groupId,
    });
  };

  const removeItem = async (item) => {
    if (deletedMessages.some(m => m.id === (item._id || item.id || item.productId))) return;
    try {
      const res = await api.delete(`/groups/${groupId}/list/items/${item._id || item.id || item.productId}`);
      // Show deleted message
      const deletedBy = currentUserName || 'You';
      const deletedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const text = `${item.name} was deleted by ${deletedBy} at ${deletedAt}`;
      const fadeAnim = new Animated.Value(1);
      setDeletedMessages(msgs => [...msgs, { id: item._id || item.id || item.productId, text, fadeAnim }]);
      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }).start(() => {
          setDeletedMessages(msgs => msgs.filter(m => m.id !== (item._id || item.id || item.productId)));
        });
      }, DELETE_MSG_DURATION);
      fetchSummary(); // Refresh list after delete
    } catch (err) {
      Alert.alert('Error', 'Failed to remove item');
    }
  };

  const renderRightActions = (item) => (
    <TouchableOpacity style={styles.deleteAction} onPress={() => removeItem(item)}>
      <Ionicons name="trash" size={28} color="#fff" />
    </TouchableOpacity>
  );

  const renderItemCard = ({ item }) => {
    // For purchase history (lastBought), show who purchased it
    // For current list, show who added it
    const isPurchaseHistory = activeTab === 'lastBought' || selectedTrip;
    
    let displayName = 'Unknown';
    let displayText = '';
    let displayTime = '';
    
    if (isPurchaseHistory) {
      // Purchase history - show who purchased
      displayName = item.user && (item.user.username || item.user.name) ? (item.user.username || item.user.name) : 'Unknown';
      displayText = `Purchased by ${displayName}`;
      displayTime = item.boughtAt ? new Date(item.boughtAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : '';
    } else {
      // Current list - show who added
      displayName = item.addedBy && (item.addedBy.username || item.addedBy.name) ? (item.addedBy.username || item.addedBy.name) : 'Unknown';
      displayText = `Added by ${displayName}`;
      displayTime = item.createdAt ? new Date(item.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : '';
    }
    
    const imageSrc = item.img || item.icon;
    return (
      <Swipeable renderRightActions={() => renderRightActions(item)}>
        <View style={styles.rowCard}>
          <Image
            source={imageSrc && typeof imageSrc === 'string' && (imageSrc.startsWith('http') || imageSrc.startsWith('data:image/'))
              ? { uri: imageSrc }
              : { uri: PLACEHOLDER_IMAGE }}
            style={styles.rowImage}
            resizeMode="cover"
          />
          <View style={styles.rowContent}>
            <Text style={styles.rowProductName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.rowMeta} numberOfLines={1}>{displayText}{displayTime ? ` at ${displayTime}` : ''}</Text>
          </View>
        </View>
      </Swipeable>
    );
  };

  const activeItems = activeTab === 'current' ? summary.currentList : (selectedTrip ? selectedTrip.items : summary.lastBought);
  const lastStore = selectedTrip ? selectedTrip.trip.store : summary.lastStore;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <View style={{ padding: 20, paddingBottom: 0 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#2E7D32', marginBottom: 16 }}>Group Shared List</Text>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabCard, activeTab === 'current' && styles.activeTab]}
            onPress={() => {
              setActiveTab('current');
              setSelectedTrip(null);
              setShowTripHistory(false);
            }}
          >
            <Text style={styles.tabTitle}>CURRENT LIST</Text>
            <Text style={styles.tabCount}>{summary.currentList.length}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabCard, activeTab === 'lastBought' && styles.activeTab]}
            onPress={() => {
              setActiveTab('lastBought');
              setSelectedTrip(null);
              setShowTripHistory(false);
            }}
          >
            <Text style={styles.tabTitle}>LAST BOUGHT</Text>
            <Text style={styles.tabCount}>
              {selectedTrip ? selectedTrip.trip.tripNumber : summary.currentTripNumber || 0}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: '#2E7D32', fontWeight: 'bold', marginBottom: 8, marginTop: 8 }}>
          Trips completed: {summary.tripCount}
        </Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 8 }}>
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={{ marginTop: 16, color: '#888' }}>Loading...</Text>
          </View>
        ) : activeItems.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="cart-outline" size={80} color="#2E7D32" style={{ marginBottom: 20 }} />
            <Text style={{ fontSize: 18, color: '#888', marginBottom: 20 }}>
              {activeTab === 'current' ? 'No items in current list' : 'No last trip yet'}
            </Text>
          </View>
        ) : (
          <>
            {activeTab === 'lastBought' && (
              <>
                {!showTripHistory && !selectedTrip && (
                  <TouchableOpacity 
                    style={styles.viewHistoryButton}
                    onPress={() => {
                      fetchTripHistory();
                      setShowTripHistory(true);
                    }}
                  >
                    <Text style={styles.viewHistoryButtonText}>View Trip History</Text>
                  </TouchableOpacity>
                )}
                
                {showTripHistory && (
                  <View style={styles.tripHistoryContainer}>
                    <TouchableOpacity 
                      style={styles.backButton}
                      onPress={() => setShowTripHistory(false)}
                    >
                      <Text style={styles.backButtonText}>← Back to Current Trip</Text>
                    </TouchableOpacity>
                    
                    <FlatList
                      data={tripHistory}
                      renderItem={({ item }) => (
                        <TouchableOpacity 
                          style={styles.tripCard}
                          onPress={() => fetchTripItems(item._id)}
                        >
                          <Text style={styles.tripNumber}>Trip {item.tripNumber}</Text>
                          <Text style={styles.tripDate}>
                            {new Date(item.completedAt).toLocaleDateString()}
                          </Text>
                          <Text style={styles.tripStore}>{item.store?.branch || 'Unknown Store'}</Text>
                          <Text style={styles.tripItems}>{item.itemCount} items</Text>
                          {item.totalSpent > 0 && (
                            <Text style={styles.tripTotal}>{formatPrice(item.totalSpent)}</Text>
                          )}
                        </TouchableOpacity>
                      )}
                      keyExtractor={(item) => item._id}
                      numColumns={2}
                      contentContainerStyle={{ paddingBottom: 60 }}
                    />
                  </View>
                )}
                
                {selectedTrip && (
                  <View style={styles.tripHistoryContainer}>
                    <TouchableOpacity 
                      style={styles.backButton}
                      onPress={() => {
                        setSelectedTrip(null);
                        setShowTripHistory(true);
                      }}
                    >
                      <Text style={styles.backButtonText}>← Back to Trip History</Text>
                    </TouchableOpacity>
                    
                    <View style={styles.tripInfo}>
                      <Text style={styles.tripTitle}>Trip {selectedTrip.trip.tripNumber}</Text>
                      <Text style={styles.tripDate}>
                        {new Date(selectedTrip.trip.completedAt).toLocaleDateString()}
                      </Text>
                    </View>
                    
                    {lastStore && (
                      <View style={{ backgroundColor: '#E3F2FD', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                        <Text style={{ color: '#1976D2', fontWeight: 'bold' }}>Store: {lastStore.branch}</Text>
                        <Text style={{ color: '#1976D2' }}>Address: {lastStore.address}</Text>
                        {lastStore.totalPrice && <Text style={{ color: '#1976D2' }}>Total Price: {formatPrice(lastStore.totalPrice)}</Text>}
                      </View>
                    )}
                    
                    <FlatList
                      data={activeItems}
                      renderItem={renderItemCard}
                      keyExtractor={(item, idx) => `${item._id || item.id || item.productId || item.product}_${idx}`}
                      numColumns={1}
                      contentContainerStyle={{ paddingBottom: 60 }}
                    />
                  </View>
                )}
                
                {!showTripHistory && !selectedTrip && lastStore && (
                  <View style={{ backgroundColor: '#E3F2FD', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                    <Text style={{ color: '#1976D2', fontWeight: 'bold' }}>Store: {lastStore.branch}</Text>
                    <Text style={{ color: '#1976D2' }}>Address: {lastStore.address}</Text>
                    {lastStore.totalPrice && <Text style={{ color: '#1976D2' }}>Total Price: {formatPrice(lastStore.totalPrice)}</Text>}
                  </View>
                )}
                
                {!showTripHistory && !selectedTrip && (
                  <FlatList
                    data={activeItems}
                    renderItem={renderItemCard}
                    keyExtractor={(item, idx) => `${item._id || item.id || item.productId || item.product}_${idx}`}
                    numColumns={1}
                    contentContainerStyle={{ paddingBottom: 60 }}
                  />
                )}
              </>
            )}
            
            {activeTab === 'current' && (
              <FlatList
                data={activeItems}
                renderItem={renderItemCard}
                keyExtractor={(item, idx) => `${item._id || item.id || item.productId || item.product}_${idx}`}
                numColumns={1}
                contentContainerStyle={{ paddingBottom: 60 }}
              />
            )}
          </>
        )}
        {deletedMessages.map(msg => (
          <Animated.View key={msg.id} style={[styles.deletedMsg, { opacity: msg.fadeAnim, position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100 }]}>
            <Text style={styles.deletedMsgText}>{msg.text}</Text>
          </Animated.View>
        ))}
      </View>
      {currentUserId === groupCreatorId && summary.currentList.length > 0 && (
        <TouchableOpacity style={styles.compareButton} onPress={handleCompare}>
          <Text style={styles.compareButtonText}>Compare</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    alignItems: 'center',
    margin: 6,
    padding: 12,
    flex: 1,
    minWidth: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginBottom: 10,
    marginTop: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  itemQty: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: 'bold',
    marginTop: 4,
  },
  compareButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    margin: 20,
    marginBottom: 32,
  },
  compareButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    marginVertical: 6,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  rowImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 16,
  },
  viewHistoryButton: {
    backgroundColor: '#1976D2',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  viewHistoryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  tripHistoryContainer: {
    flex: 1,
  },
  backButton: {
    padding: 12,
    marginBottom: 16,
  },
  backButtonText: {
    color: '#1976D2',
    fontWeight: 'bold',
    fontSize: 16,
  },
  tripCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 6,
    flex: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  tripNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 4,
  },
  tripDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  tripStore: {
    fontSize: 14,
    color: '#1976D2',
    marginBottom: 4,
  },
  tripItems: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  tripTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  tripInfo: {
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  tripTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 4,
  },
  rowContent: {
    flex: 1,
    justifyContent: 'center',
  },
  rowProductName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  rowMeta: {
    fontSize: 13,
    color: '#888',
  },
  deleteAction: {
    backgroundColor: '#FF5252',
    width: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
  },
  deletedMsg: {
    backgroundColor: '#FFEBEE',
    padding: 10,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  deletedMsgText: {
    color: '#D32F2F',
    fontSize: 14,
    textAlign: 'center',
  },
}); 