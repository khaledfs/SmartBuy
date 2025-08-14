import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  Modal,
  BackHandler,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { registerListUpdates, registerSuggestionUpdates } from '../services/socketEvents';

const { width } = Dimensions.get('window');

const MAIN_TABS = [
  { key: 'all', name: 'All', icon: 'grid' },
  { key: 'smart', name: 'Smart Suggestions', icon: 'bulb' },
];

const SMART_SUB_TABS = [
  { key: 'recent', name: 'RECENT', icon: 'time', color: '#45B7D1' },
  { key: 'frequent', name: 'FREQUENT', icon: 'repeat', color: '#FF6B6B' },
  { key: 'favorite', name: 'FAVORITE', icon: 'heart', color: '#FFEAA7' },
];

// Helper to fetch and cache product.json
const useProductJson = () => {
  const cache = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadProducts = async () => {
    if (cache.current) return cache.current;
    setLoading(true);
    try {
      const response = await fetch(require('../assets/product.json'));
      const data = await response.json();
      cache.current = data;
      setLoading(false);
      return data;
    } catch (err) {
      setError(err);
      setLoading(false);
      return [];
    }
  };

  return { loadProducts, loading, error };
};

const SmartSuggestionsScreen = ({ navigation, route }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMainTab, setSelectedMainTab] = useState('all');
  const [selectedSmartTab, setSelectedSmartTab] = useState('recent');
  const [favorites, setFavorites] = useState(new Set());
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [favoriteItems, setFavoriteItems] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [addedItemsCount, setAddedItemsCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [loadedProductIds, setLoadedProductIds] = useState(new Set());
  // Add loading states for individual items
  const [addingItems, setAddingItems] = useState(new Set());
  const [addedItems, setAddedItems] = useState(new Set());
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const groupId = route?.params?.groupId || null;

  const { loadProducts: loadProductJson, loading: loadingProducts } = useProductJson();

  // Determine the current category based on selected tabs
  const getCurrentCategory = () => {
    if (selectedMainTab === 'all') return 'all';
    if (selectedMainTab === 'smart') return selectedSmartTab; // recent, frequent, or favorite
    return 'all'; // fallback
  };

  // Fetch initial count of items in group's shared list
  const fetchInitialCount = async () => {
    if (!groupId) {
      setAddedItemsCount(0);
      return;
    }
    try {
      console.log('🔄 Fetching initial count for group:', groupId);
      const response = await api.get(`/groups/${groupId}/list/items`);
      const items = response.data || [];
      console.log('📊 Total items in shared list:', items.length);
      setAddedItemsCount(items.length);
    } catch (error) {
      console.error('❌ Error fetching initial count:', error);
      // Silently handle errors - just set count to 0
      setAddedItemsCount(0);
    }
  };

  useEffect(() => {
    const currentCategory = getCurrentCategory();
    
    if (currentCategory === 'all') {
      setSuggestions([]);
      setFilteredSuggestions([]);
      setOffset(0);
      setHasMore(true);
      setLoadedProductIds(new Set());
      setSearchTerm('');
      fetchSmartSuggestions('all', 0, true);
    } else if (selectedMainTab === 'smart') {
      // Don't auto-fetch for smart tab, let user click sub-tabs
      setSuggestions([]);
      setFilteredSuggestions([]);
    }
  }, [groupId, selectedMainTab]); // Remove selectedSmartTab from dependencies

  // Fetch initial count when component mounts or groupId changes
  useEffect(() => {
    try {
      fetchInitialCount();
    } catch (error) {
      console.error('Error in fetchInitialCount useEffect:', error);
      setAddedItemsCount(0);
    }
  }, [groupId]);

  // Listen for real-time list updates to update badge count
  useEffect(() => {
    if (!groupId) return;
    
    const unsubscribeList = registerListUpdates((data) => {
      console.log('📢 List update received in SmartSuggestionsScreen:', data);
      console.log('🔄 Refreshing badge count due to list update...');
      // Refresh the count when list is updated by other users
      fetchInitialCount();
    });

    const unsubscribeSuggestions = registerSuggestionUpdates((data) => {
      console.log('📊 Suggestion update received in SmartSuggestionsScreen:', data);
      // Refresh suggestions when favorites/purchases are updated
      if (data.action === 'favoriteAdded' || data.action === 'favoriteRemoved' || data.action === 'productPurchased') {
        console.log('🔄 Refreshing suggestions due to suggestion update...');
        fetchSmartSuggestions();
      }
    });
    
    return () => {
      unsubscribeList && unsubscribeList();
      unsubscribeSuggestions && unsubscribeSuggestions();
    };
  }, [groupId]);

  // Debounce search term to avoid searching on every character
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Handle search filtering with debounced search term
  useEffect(() => {
    if (selectedMainTab === 'all') {
      if (debouncedSearchTerm.trim()) {
        // Search the database directly instead of filtering loaded items
        searchProducts(debouncedSearchTerm);
      } else {
        // Reset to normal pagination when search is cleared
        setFilteredSuggestions([]);
        // Don't reset suggestions - keep the loaded products for infinite scrolling
        // setSuggestions([]); // REMOVED - this was causing the issue
        setOffset(suggestions.length); // Set offset to current loaded count
        setHasMore(true);
        setLoadedProductIds(new Set(suggestions.map(p => p.productId || p._id)));
        console.log('🔍 ALL card: Search cleared, returning to pagination mode with', suggestions.length, 'loaded products');
      }
    }
  }, [debouncedSearchTerm, selectedMainTab]);

  // New function to search products directly from database
  const searchProducts = async (searchQuery) => {
    try {
      setLoading(true);
      setFilteredSuggestions([]);
      
      // Search the database directly using the existing products endpoint
      const response = await api.get(`/products?q=${encodeURIComponent(searchQuery)}&limit=100`);
      const searchResults = response.data || [];
      
      setFilteredSuggestions(searchResults);
      setLoading(false);
    } catch (error) {
      console.error('Error searching products:', error);
      setLoading(false);
      showToast('Failed to search products');
    }
  };

  // Handle back button press
  useEffect(() => {
    const backAction = () => {
      // Hierarchical navigation logic
      if (selectedMainTab === 'smart' && selectedSmartTab !== 'recent') {
        // If we're in a specific smart sub-tab (favorite, frequent), go back to recent
        setSelectedSmartTab('recent');
        setSuggestions([]);
        fetchSmartSuggestions('recent');
        return true; // Prevent default back action
      } else if (selectedMainTab === 'smart') {
        // If we're in smart tab (showing sub-tabs), go back to ALL tab
        setSelectedMainTab('all');
        setSelectedSmartTab('recent');
        setSuggestions([]);
        setOffset(0);
        setHasMore(true);
        fetchSmartSuggestions('all', 0, true);
        return true; // Prevent default back action
      } else if (selectedMainTab === 'all') {
        // If we're in ALL tab, go back to Group Detail
        return false; // Allow default back action (go to Group Detail)
      }
      return false; // Allow default back action
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [selectedMainTab, selectedSmartTab]);

  const fetchSmartSuggestions = async (category = 'all', customOffset = 0, reset = false) => {
    try {
      console.log('🔄 Fetching smart suggestions for category:', category, 'GroupId:', groupId);
      setLoading(true);
      
      // For ALL, use the exact same logic as MainScreen
      if (category === 'all') {
        // Don't fetch more products if we're currently searching
        if (searchTerm.trim()) {
          setLoading(false);
          return;
        }
        
        console.log('📦 ALL card: Fetching products:', reset ? 'initial' : 'pagination', 'offset:', reset ? 0 : customOffset);
        
        // Use the exact same API call as MainScreen
        const res = await api.get(`/products?limit=20&offset=${reset ? 0 : customOffset}`);
        const allProducts = res.data || [];
        
        console.log('📦 ALL card: Received products:', allProducts.length);
        
        // Filter to only show products with valid images (same as MainScreen)
        const validProducts = allProducts.filter(product => {
          const img = product.img || product.image;
          return img && img !== '' && img !== 'https://via.placeholder.com/100' && img !== 'null';
        });
        
        console.log('📦 ALL card: Valid products:', validProducts.length);
        
        if (reset) {
          setSuggestions(validProducts);
          setOffset(20);
          setHasMore(validProducts.length === 20);
          console.log('📦 ALL card: Reset: loaded', validProducts.length, 'products, hasMore:', validProducts.length === 20);
        } else {
          setSuggestions(prev => [...prev, ...validProducts]);
          setOffset(prev => prev + 20);
          setHasMore(validProducts.length === 20);
          console.log('📦 ALL card: Pagination: added', validProducts.length, 'products, total:', suggestions.length + validProducts.length, 'hasMore:', validProducts.length === 20);
        }
        
        setLoading(false);
        return;
      }
      // For smart cards, fetch only product IDs and then fetch details from backend - OPTIMIZED
      let type = category;
      if (["recent", "favorite", "frequent"].includes(type)) {
        const url = `/suggestions/smart?groupId=${groupId}&type=${type}&limit=20`; // Reduced from 50 to 20
        const response = await api.get(url);
        const suggestionsList = response.data.suggestions || [];
        
        // OPTIMIZED: Batch fetch product details instead of individual calls
        if (suggestionsList.length > 0) {
          const productIds = suggestionsList.map(s => s.productId).filter(Boolean);
          
          try {
            // Batch fetch all products at once
            const batchResponse = await api.post('/products/batch', { productIds });
            const productMap = new Map();
            
            if (batchResponse.data && Array.isArray(batchResponse.data)) {
              batchResponse.data.forEach(product => {
                productMap.set(product._id, product);
              });
            }
            
            // Merge product details with suggestions
            const productDetails = suggestionsList.map(s => {
              const product = productMap.get(s.productId);
              return product ? { ...product, ...s } : { productId: s.productId, name: 'Unknown Product', img: '', ...s };
            });
            
            setSuggestions(productDetails);
            
            if (type === 'favorite') {
              // For favorite tab, all items are favorites by definition
              const favoriteIds = new Set(productDetails.map(f => f.productId));
              console.log('💖 Setting favorites from server response:', favoriteIds);
              setFavorites(favoriteIds);
            } else {
              // For other tabs, check which items are favorited
              await loadFavoritesStatus(productDetails);
            }
          } catch (err) {
            // Silently handle batch fetch failure - this is expected behavior
            console.log('📦 Batch fetch not available, using individual calls (this is normal)');
            
            // Fallback to individual calls if batch fails
            const productDetails = await Promise.all(
              suggestionsList.slice(0, 10).map(async (s) => { // Limit to 10 for performance
                try {
                  const prodRes = await api.get(`/products/${s.productId}`);
                  return { ...prodRes.data, ...s };
                } catch (err) {
                  return { productId: s.productId, name: 'Unknown Product', img: '', ...s };
                }
              })
            );
            setSuggestions(productDetails);
          }
        } else {
          setSuggestions([]);
        }
        
        setLoading(false);
        return;
      }
    } catch (error) {
      console.error('Error fetching smart suggestions:', error);
      showToast('Failed to load smart suggestions');
    } finally {
      setLoading(false);
    }
  };

  // Load favorites status for all suggestions - OPTIMIZED VERSION
  const loadFavoritesStatus = async (suggestions) => {
    try {
      if (!groupId) {
        console.log('⚠️ No groupId available, skipping favorites status load');
        return;
      }

      // Only load favorites if we're on the favorite tab to improve performance
      if (selectedSmartTab !== 'favorite') {
        console.log('⏭️ Skipping favorites load - not on favorite tab');
        return;
      }

      const favoriteIds = new Set();
      for (const item of suggestions) {
        if (item.productId) {
          try {
            const response = await api.get(`/suggestions/favorites/check/${item.productId}?groupId=${groupId}`);
            if (response.data.isFavorited) {
              favoriteIds.add(item.productId);
            }
          } catch (error) {
            console.error(`❌ Error checking favorite status for product ${item.productId}:`, error);
            // Continue with other items even if one fails
          }
        }
      }
      setFavorites(favoriteIds);
    } catch (error) {
      console.error('Error loading favorites status:', error);
    }
  };

  // Toggle favorite status
  const toggleFavorite = async (productId) => {
    try {
      // Validate required parameters
      if (!productId) {
        console.error('❌ No productId provided to toggleFavorite');
        showToast('Invalid product ID');
        return;
      }

      if (!groupId) {
        console.error('❌ No groupId available for favorite toggle');
        showToast('Group context is required for favorites');
        return;
      }

      console.log('🔍 Toggle favorite:', productId, 'GroupId:', groupId);

      const isFavorited = favorites.has(productId);
      if (isFavorited) {
        const response = await api.post('/suggestions/favorites/remove', { productId, groupId });
        console.log('✅ Removed from favorites:', productId);
        
        setFavorites(prev => {
          const newSet = new Set(prev);
          newSet.delete(productId);
          return newSet;
        });
        
        // Remove item from suggestions list if we're on favorite tab
        if (selectedMainTab === 'smart' && selectedSmartTab === 'favorite') {
          setSuggestions(prev => prev.filter(item => item.productId !== productId && item._id !== productId));
        }
        
        showToast('Removed from favorites');
      } else {
        const response = await api.post('/suggestions/favorites/add', { productId, groupId });
        console.log('✅ Added to favorites:', productId);
        
        setFavorites(prev => {
          const newSet = new Set(prev);
          newSet.add(productId);
          return newSet;
        });
        showToast('Added to favorites');
      }
    } catch (error) {
      console.error('❌ Error toggling favorite:', error.message);
      
      // Provide more specific error messages
      if (error.response?.status === 400) {
        showToast(error.response.data?.message || 'Invalid request data');
      } else if (error.response?.status === 401) {
        showToast('Authentication required');
      } else if (error.response?.status === 500) {
        showToast('Server error - please try again');
      } else {
        showToast('Failed to update favorite status');
      }
    }
  };

  // Toast notification system
  const [toast, setToast] = useState({ visible: false, message: '' });
  
  const showToast = (message) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast({ visible: false, message: '' }), 2000);
  };

  const getCategoryIcon = (type) => {
    switch (type) {
      case 'frequent':
        return 'repeat';
      case 'recent':
        return 'time';
      case 'popular':
        return 'trending-up';
      case 'seasonal':
        return 'leaf';
      case 'favorite':
        return 'heart';
      default:
        return 'bulb';
    }
  };

  const getCategoryColor = (type) => {
    switch (type) {
      case 'frequent':
        return '#FF6B6B';
      case 'recent':
        return '#4ECDC4';
      case 'popular':
        return '#45B7D1';
      case 'seasonal':
        return '#96CEB4';
      case 'favorite':
        return '#FFEAA7';
      default:
        return '#DDA0DD';
    }
  };

  const getCategoryName = (type) => {
    switch (type) {
      case 'frequent':
        return 'Frequently Added';
      case 'recent':
        return 'Recently Added';
      case 'popular':
        return 'Popular';
      case 'seasonal':
        return 'Seasonal';
      case 'favorite':
        return 'Your Favorites';
      default:
        return 'Smart Pick';
    }
  };

  const renderSuggestion = ({ item, index }) => {
    const itemId = item.productId || item._id;
    const isAdding = addingItems.has(itemId);
    const wasAdded = addedItems.has(itemId);
    
    return (
      <TouchableOpacity 
        style={styles.suggestionItem}
        onPress={() => handleAddToCart(item)}
      >
        <View style={styles.productImageContainer}>
          <Image 
            source={{ uri: item.img || 'https://via.placeholder.com/60' }} 
            style={styles.productImage}
            resizeMode="cover"
          />
          <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.type) }]}> 
            <Ionicons name={getCategoryIcon(item.type)} size={12} color="#fff" />
          </View>
          {/* Cart indicator for favorites */}
          {item.type === 'favorite' && item.isInCart && (
            <View style={[styles.intelligentBadge, { backgroundColor: '#4CAF50' }]}> 
              <Ionicons name="checkmark-circle" size={10} color="#fff" />
            </View>
          )}
          {/* Intelligent indicators for frequent products */}
          {item.type === 'frequent' && (
            <>
              {item.isOverdue && (
                <View style={[styles.intelligentBadge, { backgroundColor: '#FF4444' }]}> 
                  <Ionicons name="alert-circle" size={10} color="#fff" />
                </View>
              )}
              {item.isDueSoon && !item.isOverdue && (
                <View style={[styles.intelligentBadge, { backgroundColor: '#FFA500' }]}> 
                  <Ionicons name="time" size={10} color="#fff" />
                </View>
              )}
              {item.confidence && item.confidence > 0.7 && (
                <View style={[styles.intelligentBadge, { backgroundColor: '#4CAF50' }]}> 
                  <Ionicons name="checkmark-circle" size={10} color="#fff" />
                </View>
              )}
            </>
          )}
        </View>
        <View style={styles.suggestionInfo}>
          <Text style={styles.suggestionName}>{item.name}</Text>
          {/* Show interaction details for favorites */}
          {item.type === 'favorite' && (
            <Text style={styles.suggestionReason}>
              {item.isFavorited && '❤️ Favorited '}
              {item.isPurchased && '🛒 Purchased '}
              {item.isAdded && '📝 Added to list '}
              {item.isInCart && `• In Cart: ${item.cartQuantity || 0}`}
              {item.totalInteractions > 1 && ` (${item.totalInteractions} interactions)`}
            </Text>
          )}
          {/* Show smart reason for recent */}
          {item.type === 'recent' && (
            <>
              <Text style={styles.suggestionReason}>
                Bought on {item.tripDate || 'Recent trip'}
              </Text>
              {item.quantity > 1 && (
                <Text style={styles.suggestionReason}>
                  Quantity: {item.quantity}
                </Text>
              )}
            </>
          )}
          {/* Show smart reason for frequent */}
          {item.type === 'frequent' && (
            <>
              <Text style={styles.suggestionReason}>
                Bought {item.frequency} time{item.frequency > 1 ? 's' : ''} in last 5 trips
              </Text>
              {item.favoriteCount > 0 && (
                <Text style={[styles.suggestionReason, { color: '#FF6B6B', fontWeight: 'bold' }]}>★ Favorited by group</Text>
              )}
            </>
          )}
        </View>
        {/* Action buttons with improved visual feedback */}
        <View style={styles.actionButtons}>
          {/* Heart Icon for Favorites */}
          <TouchableOpacity 
            style={styles.heartButton}
            onPress={() => toggleFavorite(item.productId || item._id)}
          >
            <Ionicons 
              name={favorites.has(item.productId || item._id) ? "heart" : "heart-outline"} 
              size={20} 
              color={favorites.has(item.productId || item._id) ? "#FF6B6B" : "#999"} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.rejectButton}
            onPress={() => handleRejectSuggestion(item)}
          >
            <Ionicons name="close" size={16} color="#FF6B6B" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.addButton,
              isAdding && styles.addButtonLoading,
              wasAdded && styles.addButtonSuccess
            ]}
            onPress={() => handleAddToCart(item)}
            disabled={isAdding}
          >
            {isAdding ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : wasAdded ? (
              <Ionicons name="checkmark" size={20} color="#fff" />
            ) : (
              <Ionicons name="add" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Add to group shared list only if groupId is present
  const handleAddToCart = async (item) => {
    if (!groupId) {
      showToast('You must be in a group to add to the shared list!');
      return;
    }
    
    const itemId = item.productId || item._id;
    
    // Prevent multiple clicks
    if (addingItems.has(itemId)) {
      return;
    }
    
    // Immediate optimistic updates for UI feedback
    setAddingItems(prev => new Set([...prev, itemId]));
    // Don't update count optimistically - wait for real update
    
    try {
      console.log('📤 Adding item to group shared list:', {
        groupId,
        itemName: item.name,
        productId: item.productId || item._id,
        barcode: item.barcode || ''
      });
      
      // Make the API call
      await api.post(`/groups/${groupId}/list/items`, {
        name: item.name,
        icon: item.img,
        productId: item.productId || item._id,
        barcode: item.barcode || '',
      });
      
      console.log('✅ Item added successfully to group shared list');
      
      // Success - show visual confirmation
      setAddingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      
      setAddedItems(prev => new Set([...prev, itemId]));
      
      // Refresh count to get accurate total
      fetchInitialCount();
      
      // Show success toast
      showToast(`${item.name} added to shared list!`);
      
      // Reset the success state after 2 seconds
      setTimeout(() => {
        setAddedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemId);
          return newSet;
        });
      }, 2000);
      
    } catch (error) {
      console.error('Error adding to shared list:', error);
      
      // Revert optimistic updates on error
      setAddingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      // Refresh count to get accurate total
      fetchInitialCount();
      
      showToast('Failed to add item to shared list');
    }
  };

  const handleRejectSuggestion = async (item) => {
    try {
      // Track the rejection for ML training
      await api.post('/rejections', {
        productId: item.productId,
        groupId: null // TODO: Get current group ID
      });
      
      // Remove from suggestions list
      setSuggestions(prev => prev.filter(s => s.productId !== item.productId));
      showToast(`${item.name} removed from suggestions`);
    } catch (error) {
      console.error('Error rejecting suggestion:', error);
      showToast('Failed to reject suggestion');
    }
  };

  const handleCardPress = (category) => {
    if (category === 'seasonal' || category === 'popular') {
      showToast('Feature coming soon!');
      return;
    }
    // Set the selected category and fetch data - stay within this screen
    setSelectedCategory(category);
    fetchSmartSuggestions(category, 0, true);
  };

  const renderSearchBar = () => {
    if (selectedMainTab !== 'all') return null;
    
    return (
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor="#999"
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={() => setSearchTerm('')}
            >
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderCategoryFilter = () => {
    const categories = MAIN_TABS;
    return (
      <View style={styles.tabBarContainer}>
        <FlatList
          horizontal
          data={categories}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.tabCard,
                selectedMainTab === item.key && styles.tabCardActive
              ]}
              onPress={() => {
                setSelectedMainTab(item.key);
                // Reset sub-tab to default when main tab changes
                setSelectedSmartTab('recent');
                // Clear suggestions when switching to smart tab
                if (item.key === 'smart') {
                  setSuggestions([]);
                  setFilteredSuggestions([]);
                }
              }}
              activeOpacity={0.85}
            >
              <Ionicons name={item.icon} size={22} color={selectedMainTab === item.key ? '#fff' : '#666'} style={{ marginRight: 8 }} />
              <Text style={[styles.tabCardText, selectedMainTab === item.key && { color: '#fff' }]}>{item.name}</Text>
            </TouchableOpacity>
          )}
          keyExtractor={item => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarList}
        />
      </View>
    );
  };

  const renderSmartSubCategoryFilter = () => {
    const categories = SMART_SUB_TABS;
    return (
      <View style={styles.tabBarContainer}>
        <FlatList
          horizontal
          data={categories}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.tabCard,
                selectedSmartTab === item.key && styles.tabCardActive
              ]}
              onPress={() => {
                setSelectedSmartTab(item.key);
                // Clear current suggestions and fetch new ones
                setSuggestions([]);
                setFilteredSuggestions([]);
                fetchSmartSuggestions(item.key);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name={item.icon} size={22} color={selectedSmartTab === item.key ? '#fff' : item.color} style={{ marginRight: 8 }} />
              <Text style={[styles.tabCardText, selectedSmartTab === item.key && { color: '#fff' }]}>{item.name}</Text>
            </TouchableOpacity>
          )}
          keyExtractor={item => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarList}
        />
      </View>
    );
  };

  // Infinite scroll for ALL card (Instagram-style)
  const handleEndReached = () => {
    console.log('📜 ALL card: End reached - loading:', loading, 'hasMore:', hasMore, 'searchTerm:', searchTerm.trim());
    
    // Only fetch more if we're on ALL tab, not searching, not already loading, and have more items
    if (selectedMainTab === 'all' && !loading && hasMore && !searchTerm.trim()) {
      console.log('📜 ALL card: Fetching more products...');
      fetchSmartSuggestions('all', offset, false);
    } else if (selectedMainTab !== 'all') {
      console.log('📜 ALL card: Skipping pagination - not on ALL tab');
    } else if (searchTerm.trim()) {
      console.log('📜 ALL card: Skipping pagination - currently searching');
    } else if (loading) {
      console.log('📜 ALL card: Skipping pagination - already loading');
    } else if (!hasMore) {
      console.log('📜 ALL card: Skipping pagination - no more products');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>Loading smart suggestions...</Text>
      </View>
    );
  }

  // Show empty state if no suggestions
  if (!loading && suggestions.length === 0) {
    if (selectedMainTab === 'all') {
      // Empty state for ALL tab
      return (
        <View style={styles.loadingContainer}>
          <Ionicons name="bulb-outline" size={48} color="#bbb" style={{ marginBottom: 12 }} />
          <Text style={styles.loadingText}>No products to show!</Text>
          <Text style={{ color: '#888', textAlign: 'center', marginTop: 8 }}>
            Try again later.
          </Text>
        </View>
      );
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Smart Suggestions</Text>
            <Text style={styles.subtitle}>Personalized recommendations just for you</Text>
          </View>
          <TouchableOpacity 
            style={styles.cartIconContainer}
            onPress={() => navigation.navigate('GroupSharedList', { groupId })}
          >
            <Ionicons name="list" size={24} color="#2E7D32" />
            {addedItemsCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{addedItemsCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
      {/* Render the horizontal tabbed category filter */}
      {renderCategoryFilter()}
      {/* Render search bar for ALL category */}
      {renderSearchBar()}
      {/* Render smart sub-category filter only when Smart Suggestions tab is selected */}
      {selectedMainTab === 'smart' && renderSmartSubCategoryFilter()}
      {/* Product suggestions list below the tabs */}
      <FlatList
        data={selectedMainTab === 'all' ? (searchTerm.trim() ? filteredSuggestions : suggestions) : suggestions}
        keyExtractor={(item, index) => `${item._id || item.productId}_${index}`}
        renderItem={renderSuggestion}
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        ListEmptyComponent={
          !loading && (
            <View style={styles.loadingContainer}>
              {selectedMainTab === 'smart' && selectedSmartTab === 'recent' ? (
                <>
                  <Ionicons name="time-outline" size={48} color="#bbb" style={{ marginBottom: 12 }} />
                  <Text style={styles.loadingText}>No recent trips yet!</Text>
                  <Text style={{ color: '#888', textAlign: 'center', marginTop: 8 }}>
                    Complete your first shopping trip to see recent items here.
                  </Text>
                </>
              ) : selectedMainTab === 'smart' && selectedSmartTab === 'favorite' ? (
                <>
                  <Ionicons name="heart-outline" size={48} color="#bbb" style={{ marginBottom: 12 }} />
                  <Text style={styles.loadingText}>No favorites yet!</Text>
                  <Text style={{ color: '#888', textAlign: 'center', marginTop: 8 }}>
                    Favorite items from the ALL card to see them here.
                  </Text>
                </>
              ) : selectedMainTab === 'smart' && selectedSmartTab === 'frequent' ? (
                <>
                  <Ionicons name="construct-outline" size={48} color="#bbb" style={{ marginBottom: 12 }} />
                  <Text style={styles.loadingText}>No frequent items yet!</Text>
                  <Text style={{ color: '#888', textAlign: 'center', marginTop: 8 }}>
                    Try adding more items to your shopping list to see frequent ones here.
                  </Text>
                </>
              ) : selectedMainTab === 'all' && searchTerm.trim() ? (
                <>
                  <Ionicons name="search-outline" size={48} color="#bbb" style={{ marginBottom: 12 }} />
                  <Text style={styles.loadingText}>No products found</Text>
                  <Text style={{ color: '#888', textAlign: 'center', marginTop: 8 }}>
                    Try a different search term.
                  </Text>
                </>
              ) : selectedMainTab === 'all' ? (
                <>
                  <Ionicons name="bulb-outline" size={48} color="#bbb" style={{ marginBottom: 12 }} />
                  <Text style={styles.loadingText}>No products to show!</Text>
                  <Text style={{ color: '#888', textAlign: 'center', marginTop: 8 }}>
                    Try again later.
                  </Text>
                </>
              ) : null}
            </View>
          )
        }
        
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loading && !searchTerm.trim() && selectedMainTab === 'all' ? (
            <View style={styles.loadingFooter}>
              <ActivityIndicator size="small" color="#2E7D32" />
              <Text style={styles.loadingFooterText}>Loading more products...</Text>
            </View>
          ) : null
        }
        refreshing={loading && suggestions.length === 0}
        onRefresh={() => {
          console.log('🔄 ALL card: Pull to refresh triggered');
          setOffset(0);
          setHasMore(true);
          fetchSmartSuggestions('all', 0, true);
        }}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 10,
        }}
      />
      {toast.visible && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  cartIconContainer: {
    position: 'relative',
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  cartBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    padding: 0,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    letterSpacing: 0.5,
  },
  categoryFilterContainer: {
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  categoryCard: {
    width: (width - 60) / 2,
    height: 120,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  categoryCardActive: {
    transform: [{ scale: 1.05 }],
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  categoryCardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  categoryCardText: {
    marginTop: 8,
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  listContainer: {
    padding: 15,
  },
  suggestionItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  productImageContainer: {
    position: 'relative',
    marginRight: 15,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  categoryBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  categoryText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  scoreText: {
    fontSize: 11,
    color: '#999',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rejectButton: {
    backgroundColor: '#fff',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  addButton: {
    backgroundColor: '#2E7D32',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonLoading: {
    backgroundColor: '#FF6B6B', // Red color for loading
  },
  addButtonSuccess: {
    backgroundColor: '#4CAF50', // Green color for success
  },
  heartButton: {
    padding: 5,
  },
  intelligentBadge: {
    position: 'absolute',
    top: -5,
    left: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  intelligentInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  intelligentText: {
    fontSize: 10,
    fontWeight: '500',
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
    textAlign: 'center',
    paddingHorizontal: 20,
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
  bigCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    marginVertical: 10,
    marginHorizontal: 16,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingLeft: 32,
  },
  cardText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
  suggestionInfo: {
    flex: 1,
    marginRight: 10,
  },
  suggestionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  suggestionReason: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  tabBarContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabBarList: {
    paddingHorizontal: 16,
  },
  tabCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tabCardActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  tabCardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
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

export default SmartSuggestionsScreen; 