import React, { useEffect, useState, useCallback, useContext, createContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  SafeAreaView,
  Alert,
  Image,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  ScrollView,
} from 'react-native';
import { PersonalListProvider } from '../services/PersonalListContext';

import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { joinRoom, registerGroupUpdates } from '../services/socketEvents';
import { useFocusEffect } from '@react-navigation/native';
import { apiEventEmitter } from '../services/api';
import jwt_decode from 'jwt-decode';
import { useFonts } from 'expo-font';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import PersonalListContext from '../services/PersonalListContext';

const { width, height } = Dimensions.get('window');

export default function MainScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState([]);
  const [locationName, setLocationName] = useState(null);
  const [editLocationVisible, setEditLocationVisible] = useState(false);
  const [manualLocation, setManualLocation] = useState('');
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userName, setUserName] = useState('');
  const [userNameLoading, setUserNameLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [userLists, setUserLists] = useState([]);
  const [welcomeType, setWelcomeType] = useState('back'); // 'back' or 'new'
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [compareModalVisible, setCompareModalVisible] = useState(false);
  const [compareResults, setCompareResults] = useState([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareCity, setCompareCity] = useState('');
  const [tripTypeModalVisible, setTripTypeModalVisible] = useState(false);

  const { personalList, setPersonalList, lastBought, lastStore } = useContext(PersonalListProvider._context || require('../services/PersonalListContext').default);

  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
  });

  useEffect(() => {
    const fetchLocationName = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is required.');
        return;
      }
      const { coords } = await Location.getCurrentPositionAsync({});
      const [place] = await Location.reverseGeocodeAsync({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      if (place) {
        const city = place.city || place.region || place.name;
        const country = place.country || '';
        const fullLocation = `${city}, ${country}`;
        setLocationName(fullLocation);
        await AsyncStorage.setItem('locationName', city);
      }
    };
    fetchLocationName();
  }, []);

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    navigation.replace('Login');
  };

  const fetchGroups = async () => {
    // Group fetching logic for future milestones
  };

  useEffect(() => {
    const checkSession = async () => {
      const token = await AsyncStorage.getItem('token');
      if (!token) navigation.replace('Login');
      else fetchGroups();
    };
    checkSession();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchGroups);
    return unsubscribe;
  }, [navigation]);

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
                onPress: logout,
              },
            ]);
          }}
          style={styles.logoutButton}
        >
          <Ionicons name="log-out-outline" size={24} color="#2E7D32" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    groups.forEach((group) => joinRoom(group._id));
  }, [groups]);

  useEffect(() => {
    const unsubscribe = registerGroupUpdates(fetchGroups);
    return unsubscribe;
  }, []);

  // Fetch user name for welcome message
  useEffect(() => {
    const getUserName = async () => {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        try {
          const decoded = jwt_decode(token);
          setUserName(decoded.username || 'User');
        } catch (e) {
          setUserName('User');
        }
      } else {
        setUserName('User');
      }
      setUserNameLoading(false);
    };
    getUserName();
  }, []);

  // Server-side search functionality
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  // Debounced search to avoid excessive API calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim() === '') {
        // Reset to normal pagination when search is cleared
        setFilteredProducts(products);
        setSearchResults([]);
        // Reset pagination state
        setOffset(products.length);
        setHasMore(true);
        console.log('🔍 Search cleared, reset to pagination mode');
      } else {
        performSearch(searchTerm);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm, products]);

  const performSearch = async (query) => {
    try {
      setSearchLoading(true);
      console.log('🔍 Searching for:', query);
      
      // Search the ENTIRE database without pagination limits for search
      // Use a higher limit to get more comprehensive search results
      const response = await api.get(`/products?q=${encodeURIComponent(query)}&limit=500`);
      const searchResults = response.data || [];
      
      console.log('🔍 Search results:', searchResults.length, 'products found');
      
      // Filter to only show products with valid images
      const validResults = searchResults.filter(product => {
        const img = product.img || product.image;
        return img && img !== '' && img !== 'https://via.placeholder.com/100' && img !== 'null';
      });
      
      console.log('🔍 Valid results after image filtering:', validResults.length, 'products');
      
      setSearchResults(validResults);
      setFilteredProducts(validResults);
      setSearchLoading(false);
    } catch (error) {
      console.error('Error searching products:', error);
      setSearchLoading(false);
      // Fallback to client-side filtering if server search fails
      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  };

  // Fetch products from /api/products on mount - OPTIMIZED for performance
  const fetchProducts = useCallback(async (reset = false) => {
    // Don't fetch more products if we're currently searching
    if (searchTerm.trim()) {
      return;
    }
    
    setIsLoading(true);
    try {
      console.log('📦 Fetching products:', reset ? 'initial' : 'pagination', 'offset:', reset ? 0 : offset);
      
      // Fetch products with pagination
      const res = await api.get(`/products?limit=20&offset=${reset ? 0 : offset}`);
      const products = res.data || [];
      
      console.log('📦 Received products:', products.length);
      
      // Filter to only show products with valid images (same as ALL card)
      const validProducts = products.filter(product => {
        const img = product.img || product.image;
        return img && img !== '' && img !== 'https://via.placeholder.com/100' && img !== 'null';
      });
      
      console.log('📦 Valid products:', validProducts.length);
      
      if (reset) {
        setProducts(validProducts);
        setFilteredProducts(validProducts);
        setOffset(20);
        setHasMore(validProducts.length === 20);
        console.log('📦 Reset: loaded', validProducts.length, 'products, hasMore:', validProducts.length === 20);
      } else {
        setProducts(prev => [...prev, ...validProducts]);
        setFilteredProducts(prev => [...prev, ...validProducts]);
        setOffset(prev => prev + 20);
        setHasMore(validProducts.length === 20);
        console.log('📦 Pagination: added', validProducts.length, 'products, total:', products.length + validProducts.length, 'hasMore:', validProducts.length === 20);
      }
    } catch (err) {
      console.error('❌ Error fetching products:', err);
      setHasMore(false);
    }
    setIsLoading(false);
  }, [offset, searchTerm]);

  // On mount, fetch first 20 products
  useEffect(() => {
    fetchProducts(true);
  }, []);

  // On scroll to end, fetch more products (Instagram-style infinite scroll)
  const handleEndReached = () => {
    console.log('📜 End reached - isLoading:', isLoading, 'hasMore:', hasMore, 'searchTerm:', searchTerm.trim());
    
    // Only fetch more if not searching and not already loading
    if (!isLoading && hasMore && !searchTerm.trim()) {
      console.log('📜 Fetching more products...');
      fetchProducts();
    } else if (searchTerm.trim()) {
      console.log('📜 Skipping pagination - currently searching');
    } else if (isLoading) {
      console.log('📜 Skipping pagination - already loading');
    } else if (!hasMore) {
      console.log('📜 Skipping pagination - no more products');
    }
  };

  const handleAddToCart = async (product) => {
    try {
      let targetListId = null;

      if (userLists.length > 0) {
        targetListId = userLists[0]._id;
      } else {
        // Create a default list if none exists
        const response = await api.post('/lists', { name: 'My Shopping List' });
        targetListId = response.data._id;
        // Refresh user lists
        const res = await api.get('/lists');
        setUserLists(res.data || []);
      }

      await addProductToList(product, targetListId);
      showToast(`${product.name} added!`);
      navigation.navigate('MyList', { listId: targetListId });
    } catch (err) {
      console.error('Error adding product:', err);
      Alert.alert('Error', 'Failed to add product. Please try again.');
    }
  };

  const addProductToList = async (product, listId) => {
    try {
      await api.post(`/lists/${listId}/items`, {
        name: product.name,
        icon: product.img,
        productId: product._id,
      });

      // Show a quick success feedback instead of alert
      // showToast(`${product.name} added!`); // This is now handled in handleAddToCart

    } catch (err) {
      console.error('Error adding product to list:', err);
      showToast('Failed to add product');
    }
  };

  // Toast notification system
  const [toast, setToast] = useState({ visible: false, message: '' });

  const showToast = (message) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast({ visible: false, message: '' }), 2000);
  };

  // Add product to personal list
  const addToPersonalList = (product) => {
    setPersonalList(prev => {
      // Check if product already exists (by _id or name)
      const exists = prev.some(item => item._id === product._id || item.name === product.name);
      if (exists) {
        // If exists, increment quantity
        return prev.map(item =>
          (item._id === product._id || item.name === product.name)
            ? { ...item, quantity: (item.quantity || 1) + 1 }
            : item
        );
      } else {
        // If not, add new product with quantity 1
        return [...prev, { ...product, quantity: 1 }];
      }
    });
    showToast(`${product.name} added to My List!`);
  };

  const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/100?text=No+Image';
  const renderProductCard = ({ item }) => (
    <View style={styles.productCard}>

      <Image
        source={{ uri: item.img && (item.img.startsWith('http') || item.img.startsWith('data:image/')) ? item.img : PLACEHOLDER_IMAGE }}
        style={styles.productImage}
        resizeMode="cover"
      />
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => addToPersonalList(item)}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  useEffect(() => {
    // Listen for global logout event
    const handleLogout = () => logout();
    apiEventEmitter.on('logout', handleLogout);
    return () => {
      apiEventEmitter.off('logout', handleLogout);
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (navigation && navigation.getParam) {
        const type = navigation.getParam('loginType', 'back');
        setWelcomeType(type);
      } else if (navigation && navigation.route && navigation.route.params) {
        setWelcomeType(navigation.route.params.loginType || 'back');
      }
    }, [navigation])
  );

  if (!fontsLoaded) {
    return null; // Or a loading spinner
  }

  const handleComparePrices = async () => {
    setCompareModalVisible(true);
    setCompareLoading(true);
    try {
      let city = compareCity;
      if (!city) {
        // Try to get from locationName or prompt user
        city = locationName ? locationName.split(',')[0] : '';
        if (!city) {
          city = await new Promise(resolve => {
            Alert.prompt('Enter City', 'Enter your city (Hebrew supported):', resolve);
          });
        }
      }
      const barcodes = products.map(p => p.barcode).filter(Boolean);
      const res = await api.post('/compare', { city, barcodes });
      setCompareResults(res.data.slice(0, 5));
    } catch (err) {
      setCompareResults([]);
    }
    setCompareLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#2E7D32" barStyle="light-content" />

      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.welcomeSection}>
          <Text style={[styles.welcomeText, { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 38, color: '#4B2E83', letterSpacing: 1 }]}>Welcome</Text>
          {locationName && (
            <View style={styles.locationContainer}>
              <Ionicons name="location" size={16} color="#666" />
              <Text style={styles.locationText}>{locationName}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor="#999"
          />
          {searchLoading && (
            <ActivityIndicator size="small" color="#2E7D32" style={styles.searchLoading} />
          )}
          {searchTerm.length > 0 && !searchLoading && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Products Section */}
      <View style={styles.productsSection}>
        <Text style={styles.sectionTitle}>🛒 Suggested Products</Text>

        <FlatList
          data={filteredProducts}
          keyExtractor={(item, index) => item._id || index.toString()}
          renderItem={renderProductCard}
          numColumns={2}
          columnWrapperStyle={styles.productRow}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.productsList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {searchTerm.trim() ? (
                <>
                  <Ionicons name="search-outline" size={48} color="#CCC" />
                  <Text style={styles.emptyText}>No products found for "{searchTerm}"</Text>
                  <Text style={styles.emptySubtext}>Try a different search term</Text>
                </>
              ) : (
                <>
                  <Ionicons name="search-outline" size={48} color="#CCC" />
                  <Text style={styles.emptyText}>No products found</Text>
                  <Text style={styles.emptySubtext}>Try adjusting your search</Text>
                </>
              )}
            </View>
          }
          ListFooterComponent={
            isLoading && !searchTerm.trim() ? (
              <View style={styles.loadingFooter}>
                <ActivityIndicator size="small" color="#2E7D32" />
                <Text style={styles.loadingFooterText}>Loading more products...</Text>
              </View>
            ) : !hasMore && !searchTerm.trim() && filteredProducts.length > 0 ? (
              <View style={styles.endFooter}>
                <Text style={styles.endFooterText}>You've reached the end! 🎉</Text>
                <Text style={styles.endFooterSubtext}>All products loaded</Text>
              </View>
            ) : null
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          refreshing={isLoading && filteredProducts.length === 0}
          onRefresh={() => {
            console.log('🔄 Pull to refresh triggered');
            setOffset(0);
            setHasMore(true);
            fetchProducts(true);
          }}
        />
      </View>

      {/* Toast Notification */}
      {toast.visible && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('MyList')}
        >
          <Ionicons name="list" size={24} color="#2E7D32" />
          <Text style={styles.navButtonText}>My List</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('GroupList')}
        >
          <Ionicons name="people" size={24} color="#2E7D32" />
          <Text style={styles.navButtonText}>Groups</Text>
        </TouchableOpacity>



        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setTripTypeModalVisible(true)}
        >
          <Ionicons name="storefront" size={24} color="#2E7D32" />
          <Text style={styles.navButtonText}>Stores</Text>
        </TouchableOpacity>
      </View>


      {/* Removed Compare Prices button from home page as per user request */}

      {/* Trip Type Selection Modal */}
      <Modal 
        visible={tripTypeModalVisible} 
        animationType="slide" 
        transparent={true}
        onRequestClose={() => setTripTypeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.tripTypeModal}>
            <Text style={styles.modalTitle}>Choose Trip Type</Text>
            <Text style={styles.modalSubtitle}>Select how you want to compare store prices</Text>
            
            <TouchableOpacity 
              style={styles.tripOption}
              onPress={() => {
                setTripTypeModalVisible(false);
                navigation.navigate('MyList'); // Navigate to Personal List Page
              }}
            >
              <View style={styles.tripOptionIcon}>
                <Ionicons name="person" size={32} color="#1976D2" />
              </View>
              <Text style={styles.tripOptionText}>Personal Trip</Text>
              <Text style={styles.tripOptionSubtext}>Compare prices for your personal shopping list</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.tripOption}
              onPress={() => {
                setTripTypeModalVisible(false);
                navigation.navigate('GroupList'); // Navigate to Group List Page
              }}
            >
              <View style={styles.tripOptionIcon}>
                <Ionicons name="people" size={32} color="#4CAF50" />
              </View>
              <Text style={styles.tripOptionText}>Group Trip</Text>
              <Text style={styles.tripOptionSubtext}>Compare prices for group shopping</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setTripTypeModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    width: '100%',
  },
  header: {
    backgroundColor: '#2E7D32',
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: '5%',
    width: '100%',
  },
  welcomeSection: {
    alignItems: 'center',
    width: '100%',
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 14,
    color: '#E8F5E8',
    marginLeft: 4,
  },
  logoutButton: {
    padding: 8,
    marginRight: 16,
  },
  searchContainer: {
    paddingHorizontal: '5%',
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    width: '100%',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    width: '100%',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  searchLoading: {
    marginLeft: 10,
  },
  productsSection: {
    flex: 1,
    paddingHorizontal: '5%',
    width: '100%',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginVertical: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  productsList: {
    paddingBottom: 20,
    width: '100%',
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    // width: '100%', // Remove if causing layout issues
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    flex: 1,
    marginHorizontal: 4,
    marginVertical: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    alignItems: 'center',
    padding: 12,
    position: 'relative',
    height: 220, // Fixed height for alignment
  },
  heartIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
  },
  productImage: {
    width: 90,
    height: 90,
    borderRadius: 12,
    marginBottom: 10,
  },
  productInfo: {
    alignItems: 'center',
    width: '100%',
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  productPrice: {
    fontSize: 14,
    color: '#2E7D32',
    marginBottom: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#eee',
    paddingVertical: 10,
    width: '100%',
  },
  navButton: {
    alignItems: 'center',
    flex: 1,
  },
  navButtonText: {
    fontSize: 12,
    color: '#2E7D32',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  createButton: {
    backgroundColor: '#2E7D32',
  },
  cancelButtonText: {
    color: '#666',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  createButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: '#2E7D32',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    zIndex: 1000,
  },
  toastText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  compareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginVertical: 10,
    marginHorizontal: '5%',
    alignSelf: 'center',
  },
  compareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 20,
    alignItems: 'center',
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  storeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  storeAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  storeDistance: {
    fontSize: 14,
    color: '#1976D2',
    marginBottom: 4,
  },
  totalPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  closeButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tripTypeModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    width: '90%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  tripOption: {
    backgroundColor: '#F5F5F5',
    borderRadius: 15,
    padding: 20,
    marginVertical: 10,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  tripOptionIcon: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#E0F2F7',
  },
  tripOptionText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
    textAlign: 'center',
  },
  tripOptionSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  loadingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  loadingFooterText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  endFooter: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 16,
  },
  endFooterText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 4,
  },
  endFooterSubtext: {
    fontSize: 14,
    color: '#999',
  },
});
