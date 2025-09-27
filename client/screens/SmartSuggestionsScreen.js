import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
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
  { key: 'SmartShop', name: 'SMARTSHOP', icon: 'bulb', color: '#FF6B6B' },
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

/** Memoized local-state search bar (only this re-renders while typing) */
const SearchBar = memo(function SearchBar({ onDebouncedChange, loading }) {
  const [text, setText] = useState('');

  useEffect(() => {
    const t = setTimeout(() => onDebouncedChange(text), 500);
    return () => clearTimeout(t);
  }, [text, onDebouncedChange]);

  return (
    <View style={styles.searchContainer}>
      <View style={styles.searchInputContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor="#999"
          value={text}
          onChangeText={setText}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {loading ? (
          <ActivityIndicator size="small" color="#2E7D32" />
        ) : text.length > 0 ? (
          <TouchableOpacity style={styles.clearButton} onPress={() => setText('')}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
});

const SmartSuggestionsScreen = ({ navigation, route }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedMainTab, setSelectedMainTab] = useState('all');
  const [selectedSmartTab, setSelectedSmartTab] = useState('recent');
  const [favorites, setFavorites] = useState(new Set());

  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [addedItemsCount, setAddedItemsCount] = useState(0);

  // 🔽 Only change here: use a debounced parent value & local SearchBar state
  const [query, setQuery] = useState('');             // debounced text from SearchBar
  const [searchLoading, setSearchLoading] = useState(false); // loading for search only
  const [searchVersion, setSearchVersion] = useState(0);     // bump to reset SearchBar input

  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [loadedProductIds, setLoadedProductIds] = useState(new Set());

  const [addingItems, setAddingItems] = useState(new Set());
  const [addedItems, setAddedItems] = useState(new Set());
  const [preloadedAllProducts, setPreloadedAllProducts] = useState([]);

  const groupId = route?.params?.groupId || null;

  const { loadProducts: loadProductJson, loading: loadingProducts } = useProductJson();

  // Determine the current category based on selected tabs
  const getCurrentCategory = () => {
    if (selectedMainTab === 'all') return 'all';
    if (selectedMainTab === 'smart') return selectedSmartTab; // recent, SmartShop, or favorite
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
      // Use preloaded products for instant loading if available
      if (preloadedAllProducts.length > 0 && suggestions.length === 0) {
        console.log('🚀 Using preloaded products for instant loading');
        setSuggestions(preloadedAllProducts);
        setOffset(30);
        setHasMore(preloadedAllProducts.length > 0);
        setFilteredSuggestions([]);
        setQuery('');
        setSearchVersion((v) => v + 1); // reset input
        setLoading(false);
      } else if (suggestions.length === 0) {
        setSuggestions([]);
        setFilteredSuggestions([]);
        setOffset(0);
        setHasMore(true);
        setLoadedProductIds(new Set());
        setQuery('');
        setSearchVersion((v) => v + 1); // reset input
        fetchSmartSuggestions('all', 0, true);
      }
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
      // Preload ALL products for faster switching
      preloadAllProducts();
    } catch (error) {
      console.error('Error in fetchInitialCount useEffect:', error);
      setAddedItemsCount(0);
    }
  }, [groupId]);

  // Preload ALL products for faster switching
  const preloadAllProducts = async () => {
    try {
      console.log('🚀 Preloading ALL products for faster switching...');
      const res = await api.get('/products?limit=30&offset=0');
      const allProducts = res.data || [];
      const validProducts = allProducts.filter(product => {
        const img = product.img || product.image;
        return img && img !== '' && img !== 'null';
      });
      setPreloadedAllProducts(validProducts);
      console.log('🚀 Preloaded', validProducts.length, 'products');
    } catch (error) {
      console.error('Error preloading products:', error);
    }
  };

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

  // 🔽 Replaces the old debouncedSearchTerm plumbing (search runs without global loading)
  useEffect(() => {
    if (selectedMainTab === 'all') {
      if (query.trim()) {
        searchProducts(query);
      } else {
        setFilteredSuggestions([]);
        setOffset(suggestions.length); // keep loaded count for pagination
        setHasMore(true);
        setLoadedProductIds(new Set(suggestions.map(p => p.productId || p._id)));
        console.log('🔍 ALL card: Search cleared, returning to pagination mode with', suggestions.length, 'loaded products');
      }
    }
  }, [query, selectedMainTab, suggestions]);

  // Search the database directly; do NOT flip global loading
  const searchProducts = async (searchQuery) => {
    try {
      setSearchLoading(true);
      setFilteredSuggestions([]);

      const response = await api.get(`/products?q=${encodeURIComponent(searchQuery)}&limit=100`);
      const searchResults = response.data || [];

      setFilteredSuggestions(searchResults);
    } catch (error) {
      console.error('Error searching products:', error);
      showToast('Failed to search products');
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle back button press
  useEffect(() => {
    const backAction = () => {
      // Hierarchical navigation logic
      if (selectedMainTab === 'smart' && selectedSmartTab !== 'recent') {
        setSelectedSmartTab('recent');
        setSuggestions([]);
        fetchSmartSuggestions('recent');
        return true;
      } else if (selectedMainTab === 'smart') {
        setSelectedMainTab('all');
        setSelectedSmartTab('recent');
        setSuggestions([]);
        setOffset(0);
        setHasMore(true);
        fetchSmartSuggestions('recent');
        return true;
      } else if (selectedMainTab === 'all') {
        selectedMainTab('smart') // (kept as-is)
        setSelectedSmartTab('recent');
        setSuggestions([]);
        fetchSmartSuggestions('recent');
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [selectedMainTab, selectedSmartTab]);

  const fetchSmartSuggestions = async (category = 'all', customOffset = 0, reset = false) => {
    try {
      console.log('🔄 Fetching smart suggestions for category:', category, 'GroupId:', groupId);

      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      if (category === 'all') {
        // don't paginate while searching
        if (query.trim()) {
          setLoading(false);
          setLoadingMore(false);
          return;
        }

        console.log('📦 ALL card: Fetching products:', reset ? 'initial' : 'pagination', 'offset:', reset ? 0 : customOffset);
        const res = await api.get(`/products?limit=30&offset=${reset ? 0 : customOffset}`);
        const allProducts = res.data || [];
        console.log('📦 ALL card: Received products:', allProducts.length);

        const validProducts = allProducts.filter(product => {
          const img = product.img || product.image;
          return img && img !== '' && img !== 'null';
        });
        console.log('📦 ALL card: Valid products:', validProducts.length);

        if (reset) {
          setSuggestions(validProducts);
          setOffset(30);
          setHasMore(validProducts.length > 0);
          console.log('📦 ALL card: Reset: loaded', validProducts.length, 'products, hasMore:', validProducts.length > 0);
          setLoading(false);
        } else {
          setSuggestions(prev => [...prev, ...validProducts]);
          setOffset(prev => prev + 30);
          setHasMore(validProducts.length > 0);
          console.log('📦 ALL card: Pagination: added', validProducts.length, 'products, total:', suggestions.length + validProducts.length, 'hasMore:', validProducts.length > 0);
          setLoadingMore(false);
        }

        return;
      }

      // smart tabs
      let type = category;
      if (["recent", "favorite", "SmartShop"].includes(type)) {
        const url = `/suggestions/smart?groupId=${groupId}&type=${type}&limit=20`;
        const response = await api.get(url);
        const suggestionsList = response.data.suggestions || [];

        if (suggestionsList.length > 0) {
          const productIds = suggestionsList.map(s => s.productId).filter(Boolean);

          try {
            const batchResponse = await api.post('/products/batch', { productIds });
            const productMap = new Map();

            if (batchResponse.data && Array.isArray(batchResponse.data)) {
              batchResponse.data.forEach(product => {
                productMap.set(product._id, product);
              });
            }

            const productDetails = suggestionsList.map(s => {
              const product = productMap.get(s.productId);
              return product ? { ...product, ...s } : { productId: s.productId, name: 'Unknown Product', img: '', ...s };
            });

            setSuggestions(productDetails);

            if (type === 'favorite') {
              const favoriteIds = new Set(productDetails.map(f => f.productId));
              console.log('💖 Setting favorites from server response:', favoriteIds);
              setFavorites(favoriteIds);
            } else {
              await loadFavoritesStatus(productDetails);
            }
          } catch (err) {
            console.log('📦 Batch fetch not available, using individual calls (this is normal)');
            const productDetails = await Promise.all(
              suggestionsList.slice(0, 10).map(async (s) => {
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
      setLoadingMore(false);
    }
  };

  // Load favorites status for all suggestions - OPTIMIZED VERSION
  const loadFavoritesStatus = async (suggestions) => {
    try {
      if (!groupId) {
        console.log('⚠️ No groupId available, skipping favorites status load');
        return;
      }

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
          }
        }
      }
      setFavorites(favoriteIds);
    } catch (error) {
      console.error('Error loading favorites status:', error);
    }
  };

  // Toggle favorite status - optimized to prevent page reload
  const toggleFavorite = async (productId) => {
    try {
      if (!productId) {
        showToast('Invalid product ID');
        return;
      }
      if (!groupId) {
        showToast('Group context is required for favorites');
        return;
      }

      console.log('🔍 Toggle favorite:', productId, 'GroupId:', groupId, 'Current favorites:', Array.from(favorites));
      const isFavorited = favorites.has(productId);

      setFavorites(prev => {
        const newSet = new Set(prev);
        if (isFavorited) newSet.delete(productId);
        else newSet.add(productId);
        return newSet;
      });

      if (isFavorited) {
        await api.post('/suggestions/favorites/remove', { productId, groupId });
        if (selectedMainTab === 'smart' && selectedSmartTab === 'favorite') {
          setSuggestions(prev => prev.filter(item => item.productId !== productId && item._id !== productId));
        }
        showToast('Removed from favorites');
      } else {
        await api.post('/suggestions/favorites/add', { productId, groupId });
        showToast('Added to favorites');
      }
    } catch (error) {
      console.error('❌ Error toggling favorite:', error?.message);
      // revert optimistic on error
      setFavorites(prev => {
        const ns = new Set(prev);
        if (ns.has(productId)) ns.delete(productId);
        else ns.add(productId);
        return ns;
      });
      showToast('Failed to update favorite status');
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
      case 'SmartShop':
        return 'bulb';
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
      case 'SmartShop':
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
      case 'SmartShop':
        return 'SmartShop Added';
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
    const isFavoritesPage = (selectedMainTab === 'smart' && selectedSmartTab === 'favorite') || (selectedMainTab === 'all');
    const isAdding = addingItems.has(itemId);
    const wasAdded = addedItems.has(itemId);

    return (
      <View style={styles.suggestionItem}>
        <View style={styles.productImageContainer}>
          <Image
            source={{ uri: item.img || 'https://via.placeholder.com/60' }}
            style={styles.productImage}
            resizeMode="cover"
          />
          <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.type) }]}>
            <Ionicons name={getCategoryIcon(item.type)} size={12} color="#fff" />
          </View>
          {item.type === 'favorite' && item.isInCart && (
            <View style={[styles.intelligentBadge, { backgroundColor: '#4CAF50' }]}>
              <Ionicons name="checkmark-circle" size={10} color="#fff" />
            </View>
          )}
          {item.type === 'SmartShop' && (
            <>
              {item.isOverdue && (
                <View style={[styles.intelligentBadge, { backgroundColor: '#FF4444' }]}>
                  <Ionicons name="alert-circle" size={20} color="#fff" />
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
          {item.type === 'favorite' && (
            <Text style={styles.suggestionReason}>
              {item.isFavorited && '❤️ Favorited '}
              {item.isPurchased && '🛒 Purchased '}
              {item.isAdded && '📝 Added to list '}
              {item.isInCart && `• In Cart: ${item.cartQuantity || 0}`}
              {item.totalInteractions > 1 && ` (${item.totalInteractions} interactions)`}
            </Text>
          )}
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
          {item.type === 'SmartShop' && (
            <>
             
              {item.lastBought && (
                <Text style={styles.suggestionMeta}>
                  Last bought: {new Date(item.lastBought).toLocaleDateString()}
                </Text>
              )}
              {item.favoriteCount > 0 && (
                <Text
                  style={[
                    styles.suggestionReason,
                    { color: '#FF6B6B', fontWeight: 'bold' }
                  ]}
                >
                  ★ Favorited by group
                </Text>
              )}
            </>
          )}
        </View>
        <View style={styles.actionButtons}>
          {isFavoritesPage && (
            <TouchableOpacity
              style={{
                padding: 10,
                backgroundColor: '#f0f0f0',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#ddd',
                marginRight: 8,
                minWidth: 40,
                minHeight: 40,
                justifyContent: 'center',
                alignItems: 'center'
              }}
              onPress={() => {
                const productId = item.productId || item._id;
                console.log('💖 Heart clicked for product:', productId, 'Current favorites:', Array.from(favorites));
                toggleFavorite(productId);
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <Ionicons
                name={favorites.has(item.productId || item._id) ? "heart" : "heart-outline"}
                size={20}
                color={favorites.has(item.productId || item._id) ? "#FF6B6B" : "#999"}
              />
            </TouchableOpacity>
          )}
          {(selectedMainTab !== 'all' && selectedSmartTab === 'SmartShop') && (
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={() => handleRejectSuggestion(item)}
            >
              <Ionicons name="close" size={16} color="#FF6B6B" />
            </TouchableOpacity>
          )}

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
      </View>
    );
  };

  // Add to group shared list only if groupId is present
  const handleAddToCart = async (item) => {
    if (!groupId) {
      showToast('You must be in a group to add to the shared list!');
      return;
    }

    const itemId = item.productId || item._id;

    if (addingItems.has(itemId)) {
      return;
    }

    setAddingItems(prev => new Set([...prev, itemId]));

    try {
      // 1. Fetch current items in group list
      const res = await api.get(`/groups/${groupId}/list/items`);
      const existing = res.data.find(
        i => (i.productId || i._id) === itemId || i.name === item.name
      );
      console.log('Existing item in group list:', existing);
      if (existing) {
        // 2. If exists, PATCH to increase quantity
        await api.patch(`/groups/${groupId}/list/items/${existing._id || existing.id || existing.productId}`, {
          quantity: (existing.quantity || 1) + 1,
          name: item.name,
          icon: item.img,
          productId: item.productId || item._id,
          barcode: item.barcode || '',
        });
        showToast(`${item.name} quantity increased!`);
      } else {
        // 3. If not, POST to add new item
        await api.post(`/groups/${groupId}/list/items`, {
          name: item.name,
          icon: item.img,
          productId: item.productId || item._id,
          barcode: item.barcode || '',
        });
        showToast(`${item.name} added to shared list!`);
      }

      setAddingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });

      setAddedItems(prev => new Set([...prev, itemId]));
      fetchInitialCount();

      setTimeout(() => {
        setAddedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemId);
          return newSet;
        });
      }, 2000);

    } catch (error) {
      console.error('Error adding to shared list:', error);

      setAddingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      fetchInitialCount();

      showToast('Failed to add item to shared list');
    }
  };

  const handleRejectSuggestion = async (item) => {
    const id = (item.productId || item._id)?.toString();
    if (!id) {
      showToast('Invalid product');
      return;
    }

    const prev = suggestions;
    setSuggestions(curr => curr.filter(s => (s.productId || s._id)?.toString() !== id));

    try {
      await api.post('/rejections', { productId: id, groupId, barcode: item.barcode || '' });
      showToast(`${item.name} removed from suggestions`);
    } catch (error) {
      console.error('Error rejecting suggestion:', error);
      setSuggestions(prev);
      showToast('Failed to reject suggestion');
    }
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
                setSelectedSmartTab('recent');
                if (item.key === 'smart') {
                  setSelectedSmartTab('recent');
                  setSuggestions([]);
                  setFilteredSuggestions([]);
                  setQuery('');
                  setSearchVersion((v) => v + 1); // reset search input
                  fetchSmartSuggestions('recent');
                } else {
                  // switching back to ALL
                  setFilteredSuggestions([]);
                  setQuery('');
                  setSearchVersion((v) => v + 1);
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

  // Infinite scroll for ALL card - continuous bottom loading only
  const handleEndReached = () => {
    console.log('📜 ALL card: End reached - loadingMore:', loadingMore, 'hasMore:', hasMore, 'query:', query.trim(), 'offset:', offset);
    if (selectedMainTab === 'all' && !loadingMore && hasMore && !query.trim()) {
      console.log('📜 ALL card: Loading fresh products from bottom...');
      fetchSmartSuggestions('all', offset, false);
    } else if (selectedMainTab !== 'all') {
      console.log('📜 ALL card: Skipping pagination - not on ALL tab');
    } else if (query.trim()) {
      console.log('📜 ALL card: Skipping pagination - currently searching');
    } else if (loadingMore) {
      console.log('📜 ALL card: Skipping pagination - already loading more');
    } else if (!hasMore) {
      console.log('📜 ALL card: No more products available');
    } else {
      console.log('📜 ALL card: Unknown condition - not loading more');
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

  if (!loading && suggestions.length === 0) {
    if (selectedMainTab === 'all') {
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
            <Text style={styles.title}>All & Suggestions</Text>
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

      {/* Tabs */}
      {renderCategoryFilter()}

      {/* Search (ALL only) – memoized with local state; only this and the list re-render on input */}
      {selectedMainTab === 'all' ? (
        <SearchBar
          key={searchVersion}
          onDebouncedChange={setQuery}
          loading={searchLoading}
        />
      ) : null}

      {/* Smart sub-tabs */}
      {selectedMainTab === 'smart' && renderSmartSubCategoryFilter()}

      {/* Product suggestions list */}
      <FlatList
        data={selectedMainTab === 'all' ? (query.trim() ? filteredSuggestions : suggestions) : suggestions}
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
              ) : selectedMainTab === 'smart' && selectedSmartTab === 'SmartShop' ? (
                <>
                  <Ionicons name="construct-outline" size={48} color="#bbb" style={{ marginBottom: 12 }} />
                  <Text style={styles.loadingText}>No SmartShop items yet!</Text>
                  <Text style={{ color: '#888', textAlign: 'center', marginTop: 8 }}>
                    Try adding more items to your shopping list to see SmartShop ones here.
                  </Text>
                </>
              ) : selectedMainTab === 'all' && query.trim() ? (
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
        refreshing={false}
        onRefresh={null}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore && !query.trim() && selectedMainTab === 'all' ? (
            <View style={styles.loadingFooter}>
              <ActivityIndicator size="small" color="#2E7D32" />
              <Text style={styles.loadingFooterText}>Loading new products...</Text>
            </View>
          ) : null
        }
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 10,
        }}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={10}
        getItemLayout={null}
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
