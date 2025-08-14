import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import PersonalListContext from '../services/PersonalListContext';

const StoreDetailScreen = ({ route, navigation }) => {
  const { store, products, tripType, groupId, currentUserId, groupCreatorId } = route.params || {};
  const { completeTrip } = React.useContext(PersonalListContext);

  // Helper to get product details from barcode
  const getProductByBarcode = (barcode) => {
    return products.find(p => p.barcode === barcode);
  };

  // Get store icon based on store name
  const getStoreIcon = (storeName) => {
    const name = storeName?.toLowerCase() || '';
    if (name.includes('shufersal') || name.includes('שופרסל')) return 'storefront';
    if (name.includes('rami') || name.includes('רמי')) return 'business';
    if (name.includes('coop') || name.includes('קואופ')) return 'home';
    if (name.includes('victory') || name.includes('ויקטורי')) return 'star';
    if (name.includes('yohananof') || name.includes('יוחננוף')) return 'leaf';
    return 'storefront'; // default icon
  };

  // Separate real and estimated prices
  const realPrices = store.realPrices || {};
  const estimatedPrices = store.estimatedPrices || {};
  const itemPrices = store.itemPrices || {};
  
  // All products should now have prices (real or estimated)
  const allProducts = products;
  
  // Use the backend-calculated totals and counts
  const realPriceCount = store.realPriceCount || Object.keys(realPrices).length;
  const estimatedPriceCount = store.estimatedPriceCount || Object.keys(estimatedPrices).length;
  const realPriceTotal = store.realPriceTotal || Object.values(realPrices).reduce((sum, price) => sum + price, 0);
  const estimatedPriceTotal = store.estimatedPriceTotal || Object.values(estimatedPrices).reduce((sum, price) => sum + price, 0);
  const totalPrice = store.totalPrice || realPriceTotal; // Only real prices for total

  const handleBuy = async () => {
    console.log('Buy button pressed', { tripType, store });
    if (tripType === 'group' && groupId) {
      try {
        // Get the products that were actually found/bought from this store
        const foundBarcodes = store.foundBarcodes || [];
        const boughtProducts = products.filter(p => foundBarcodes.includes(p.barcode));
        
        console.log('Products to mark as bought:', boughtProducts.map(p => p.name));
        console.log('Products that will be lost:', products.filter(p => !foundBarcodes.includes(p.barcode)).map(p => p.name));
        
        // Get the scraped product details (including images) from the store data
        const boughtProductsWithDetails = boughtProducts.map(p => {
          const scrapedDetails = store.productDetails?.[p.barcode];
          return {
            _id: p._id,
            barcode: p.barcode,
            name: scrapedDetails?.name || p.name,
            quantity: p.quantity || 1,
            img: scrapedDetails?.img || p.img,
            icon: scrapedDetails?.icon || p.icon,
            productId: p.productId || p.product || null
          };
        });
        
        await api.post(`/groups/${groupId}/list/complete-trip`, {
          store: {
            branch: store.branch,
            address: store.address,
            totalPrice: store.totalPrice ?? store.price ?? null,
          },
          boughtProducts: boughtProductsWithDetails
        });
        // Navigate back to group list with success
        navigation.navigate('GroupSharedList', { groupId });
      } catch (err) {
        Alert.alert('Error', 'Failed to complete group trip');
      }
    } else if (tripType === 'personal') {
      console.log('Personal trip buy logic triggered');
      try {
        // Get the products that were actually found/bought from this store
        const foundBarcodes = store.foundBarcodes || [];
        const boughtProducts = products.filter(p => foundBarcodes.includes(p.barcode));
        
        console.log('Personal trip - Products to mark as bought:', boughtProducts.map(p => p.name));
        console.log('Personal trip - Products that will be lost:', products.filter(p => !foundBarcodes.includes(p.barcode)).map(p => p.name));
        
        completeTrip({
          branch: store.branch || store.storeName,
          address: store.address,
          totalPrice: store.totalPrice ?? store.price ?? null,
        }, boughtProducts);
        console.log('Navigating to TransitionScreenPersonal');
        navigation.replace('TransitionScreenPersonal');
      } catch (err) {
        console.log('Error in personal trip buy logic:', err);
        Alert.alert('Error', 'Failed to complete personal trip');
      }
    } else {
      console.log('Unknown or missing tripType:', tripType);
      Alert.alert('Error', 'Unknown or missing trip type.');
    }
  };

  const renderItemCard = (product) => {
    // Get the actual product image and details from store data if available
    const productDetails = store.productDetails?.[product.barcode];
    const displayName = productDetails?.name || product.name;
    const displayImage = productDetails?.img || product.image || product.img || product.icon;
    const displayPrice = itemPrices[product.barcode] || 0;
    const isEstimated = estimatedPrices[product.barcode] || productDetails?.isEstimated;
    
    return (
      <View key={product.barcode} style={[styles.itemCard, isEstimated && styles.estimatedItemCard]}>
        <Image 
          source={displayImage ? { uri: displayImage } : require('../assets/favicon.png')} 
          style={[styles.itemImage, isEstimated && styles.estimatedImage]} 
        />
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, isEstimated && styles.estimatedText]} numberOfLines={2}>
            {displayName}
          </Text>
          <View style={styles.priceContainer}>
            <Text style={[
              styles.itemPrice, 
              isEstimated && { color: '#ff9800', fontWeight: 'bold' } // Orange for estimated prices
            ]}>
              ₪{displayPrice}
            </Text>
            {isEstimated && (
              <Text style={styles.estimatedLabel}>מחיר משוער</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Store Information Card */}
      <View style={styles.storeInfoCard}>
        <View style={styles.storeHeader}>
          <View style={styles.storeIconContainer}>
            <Ionicons 
              name={getStoreIcon(store.branch)} 
              size={40} 
              color="#1976D2" 
            />
          </View>
          <View style={styles.storeDetails}>
            <Text style={styles.storeName}>{store.branch}</Text>
            <Text style={styles.storeAddress}>{store.address}</Text>
            <Text style={styles.storeTotal}>מחיר אמיתי: ₪{store.totalPrice || 'N/A'}</Text>
            {store.distance !== null && store.distance !== undefined && (
              <Text style={styles.storeDistance}>מרחק: {store.distance} ק"מ</Text>
            )}
          </View>
        </View>
      </View>

      {/* All Products Card */}
      <View style={styles.itemsCard}>
        <Text style={styles.cardTitle}>כל המוצרים</Text>
        <Text style={styles.itemsCount}>
          {allProducts.length} מוצרים ({realPriceCount} מחירים אמיתיים, {estimatedPriceCount} מחירים משוערים)
        </Text>
        {allProducts.length > 0 ? (
          <>
            <ScrollView style={styles.itemsList}>
              {allProducts.map(product => renderItemCard(product))}
            </ScrollView>
            <View style={styles.totalSection}>
              <Text style={styles.totalText}>סה"כ מחירים אמיתיים: ₪{totalPrice.toFixed(2)}</Text>
              {estimatedPriceTotal > 0 && (
                <Text style={styles.estimatedTotalText}>
                  מחירים משוערים נוספים: ₪{estimatedPriceTotal.toFixed(2)}
                </Text>
              )}
            </View>
          </>
        ) : (
          <Text style={styles.noItemsText}>לא נמצאו מוצרים</Text>
        )}
      </View>

      {/* Buy Button */}
      {(tripType === 'group' && groupId) || tripType === 'personal' ? (
        <TouchableOpacity style={styles.buyButton} onPress={handleBuy}>
          <Text style={styles.buyButtonText}>Buy from this Store</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  storeInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  storeDetails: {
    flex: 1,
  },
  storeName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  storeAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  storeTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 2,
  },
  storeDistance: {
    fontSize: 14,
    color: '#888',
  },
  itemsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  itemsCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  itemsList: {
    maxHeight: 300,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  estimatedItemCard: {
    backgroundColor: '#fff8e1', // Light orange background for estimated items
    borderWidth: 1,
    borderColor: '#ffb74d', // Orange border
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 12,
  },
  estimatedImage: {
    opacity: 0.8, // Slightly dimmed for estimated items
  },
  itemInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
  },
  estimatedText: {
    color: '#ff9800', // Orange text for estimated items
  },
  estimatedLabel: {
    fontSize: 10,
    color: '#ff9800',
    fontStyle: 'italic',
    marginTop: 2,
  },
  totalSection: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
    marginTop: 8,
  },
  totalText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    textAlign: 'right',
  },
  realTotalText: {
    fontSize: 12,
    color: '#4CAF50',
    textAlign: 'right',
    fontWeight: '600',
    marginTop: 4,
  },
  estimatedTotalText: {
    fontSize: 12,
    color: '#ff9800',
    textAlign: 'right',
    fontStyle: 'italic',
    marginTop: 4,
  },
  noItemsText: {
    fontSize: 14,
    color: '#b71c1c',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  allFoundText: {
    fontSize: 14,
    color: '#388e3c',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  buyButton: {
    backgroundColor: '#1976D2',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  buyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default StoreDetailScreen; 