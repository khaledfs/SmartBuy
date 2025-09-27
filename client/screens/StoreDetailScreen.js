import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet, Alert, Linking, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import PersonalListContext from '../services/PersonalListContext';

const StoreDetailScreen = ({ route, navigation }) => {
  const { store, products, tripType, groupId } = route.params || {};
  const { completeTrip } = React.useContext(PersonalListContext);


// State for navigation sheet
  const [navSheetVisible, setNavSheetVisible] = React.useState(false);

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
  const positiveBarcodes = Object.entries(itemPrices)
          .filter(([_, price]) => parseFloat(price) > 0)
          .map(([bc]) => bc);
  // Use the backend-calculated totals and counts
  const realPriceCount = store.realPriceCount || Object.keys(realPrices).length;
  const realPriceTotal = store.realPriceTotal || Object.values(realPrices).reduce((sum, price) => sum + price, 0);
  const totalPrice = store.totalPrice || realPriceTotal; // Only real prices for total

//  Navigation functions
  const openInAppleMaps = async (address) => {
    const enc = encodeURIComponent(address);
    const url = `http://maps.apple.com/?daddr=${enc}&dirflg=d`;
    await Linking.openURL(url);
  };

  const openInGoogleMaps = async (address) => {
    const enc = encodeURIComponent(address);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${enc}&travelmode=driving`;
    await Linking.openURL(url);
  };

  const openInWaze = async (address) => {
    const enc = encodeURIComponent(address);
    const scheme = `waze://?q=${enc}&navigate=yes`;
    const fallback = `https://waze.com/ul?q=${enc}&navigate=yes`;
    const can = await Linking.canOpenURL(scheme);
    await Linking.openURL(can ? scheme : fallback);
  };

  const onPressNavigate = () => setNavSheetVisible(true);


  const handleBuy = async () => {
    console.log('Buy button pressed', { tripType, store });

    if (tripType === 'group' && groupId) {
      try {
        const itemPrices =
          (store.itemPrices && typeof store.itemPrices === 'object')
            ? Object.entries(store.itemPrices).reduce((acc, [bc, price]) => {
              const n = parseFloat(price);
              if (!isNaN(n)) acc[bc] = n;
              return acc;
            }, {})
            : (store.productDetails
              ? Object.entries(store.productDetails).reduce((acc, [bc, d]) => {
                const n = parseFloat(d?.price);
                if (!isNaN(n)) acc[bc] = n;
                return acc;
              }, {})
              : {});

        const positiveBarcodes = Object.entries(itemPrices)
          .filter(([_, price]) => parseFloat(price) > 0)
          .map(([bc]) => bc);

        const foundBarcodes = Array.isArray(store.foundBarcodes) ? store.foundBarcodes : [];
        const barcodesBought = positiveBarcodes.length ? positiveBarcodes : foundBarcodes;

        const boughtProducts = products
          .filter(p => barcodesBought.includes(p.barcode))
          .map(p => {
            const scraped = store.productDetails?.[p.barcode];
            return {
              _id: p._id,
              barcode: p.barcode,
              name: scraped?.name || p.name,
              quantity: p.quantity || 1,
              img: scraped?.img || p.img || p.icon,
              icon: scraped?.icon || p.icon || p.img,
              productId: p.productId || p.product || null,
            };
          });

        await api.post(`/groups/${groupId}/list/complete-trip`, {
          store: {
            branch: store.branch || store.storeName,
            address: store.address,
            itemPrices,
            totalPrice: store.totalPrice ?? store.price ?? null,
          },
          boughtProducts,
        });

        navigation.pop(2);
      } catch (err) {
        Alert.alert('Error', 'Failed to complete group trip');
      }
    } else if (tripType === 'personal') {
      try {
        const itemPrices = (store.itemPrices && typeof store.itemPrices === 'object') ? store.itemPrices : {};
        const positiveBarcodes = Object.entries(itemPrices)
          .filter(([_, price]) => parseFloat(price) > 0)
          .map(([bc]) => bc);

        const foundBarcodes = Array.isArray(store.foundBarcodes) ? store.foundBarcodes : [];
        const barcodesBought = positiveBarcodes.length ? positiveBarcodes : foundBarcodes;

        const boughtProducts = products.filter(p => barcodesBought.includes(p.barcode))
          .map(p => ({ ...p, img: p.image || p.img || p.icon, icon: p.image || p.img || p.icon }));

        completeTrip({
          branch: store.branch || store.storeName,
          address: store.address,
          totalPrice: store.totalPrice ?? store.price ?? null,
        }, boughtProducts);

        navigation.replace('beforeShopping');
      } catch (err) {
        console.log('Error in personal trip buy logic:', err);
        Alert.alert('Error', 'Failed to complete personal trip');
      }
    } else {
      Alert.alert('Error', 'Unknown or missing trip type.');
    }
  };

  const renderItemCard = (product, index) => {
    const productDetails = store.productDetails?.[product.barcode];
    const displayName = productDetails?.name || product.name;
    const displayImage = productDetails?.img || product.image || product.img || product.icon;
    const displayPrice = itemPrices[product.barcode] || '--';
    const isEstimated = estimatedPrices[product.barcode] || productDetails?.isEstimated;

    return (
      <View key={index} style={[styles.itemCard, isEstimated && styles.estimatedItemCard]}>
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
              isEstimated && { color: '#ff9800', fontWeight: 'bold' }
            ]}>
              {displayPrice === '--' ? displayPrice : `₪${displayPrice}`}
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
            <Text style={styles.storeTotal}>מחיר : ₪{store.totalPrice.toFixed(2) || 'N/A'}</Text>
            {store.distance !== null && store.distance !== undefined && (
              <Text style={styles.storeDistance}>מרחק: {store.distance} ק"מ</Text>
            )}
          </View>
        </View>

        {/* Navigation Button */}
        <TouchableOpacity style={styles.navButton} onPress={onPressNavigate}>
          <Ionicons name="navigate" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* All Products Card */}
      <View style={styles.itemsCard}>
        <Text style={styles.cardTitle}>המוצרים שנמצאו</Text>
        <Text style={styles.itemsCount}>
          {positiveBarcodes.length} מוצרים
        </Text>
        {allProducts.length > 0 ? (
          <>
            <ScrollView style={styles.itemsList}>
              {allProducts.map((product, index) => renderItemCard(product, index))}
            </ScrollView>
            <View style={styles.totalSection}>
              <Text style={styles.totalText}>סה"כ : ₪{totalPrice.toFixed(2)}</Text>
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

      {/* Navigation Options Modal */}
      <Modal
        visible={navSheetVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setNavSheetVisible(false)}
      >
        <View style={styles.navSheetOverlay}>
          <View style={styles.navSheet}>
            <Text style={styles.navSheetTitle}>Choose application</Text>

            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={styles.navOption}
                onPress={async () => {
                  setNavSheetVisible(false);
                  try { await openInAppleMaps(store.address); } catch { }
                }}
              >
                <Text style={styles.navOptionText}>Maps</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.navOption}
              onPress={async () => {
                setNavSheetVisible(false);
                try { await openInGoogleMaps(store.address); } catch { }
              }}
            >
              <Text style={styles.navOptionText}>Google Maps</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navOption}
              onPress={async () => {
                setNavSheetVisible(false);
                try { await openInWaze(store.address); } catch { }
              }}
            >
              <Text style={styles.navOptionText}>Waze</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navCancel}
              onPress={() => setNavSheetVisible(false)}
            >
              <Ionicons name="close" size={18} color="#444" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    position: 'relative',
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

  navButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: '#1976D2',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    backgroundColor: '#fff8e1',
    borderWidth: 1,
    borderColor: '#ffb74d',
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 12,
  },
  estimatedImage: { opacity: 0.8 },
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
  priceContainer: { alignItems: 'flex-end' },
  itemPrice: { fontSize: 14, fontWeight: '600', color: '#1976D2' },
  estimatedText: { color: '#ff9800' },
  estimatedLabel: { fontSize: 10, color: '#ff9800', fontStyle: 'italic', marginTop: 2 },
  totalSection: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
    marginTop: 8,
  },
  totalText: { fontSize: 16, fontWeight: 'bold', color: '#1976D2', textAlign: 'right' },
  noItemsText: { fontSize: 14, color: '#b71c1c', textAlign: 'center', fontStyle: 'italic' },

  buyButton: {
    backgroundColor: '#1976D2',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  buyButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // ↙️ סגנונות לחלונית הבחירה
  navSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  navSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  navSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  navOption: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e6e6e6',
  },
  navOptionText: { fontSize: 16, color: '#222' },
  navCancel: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 6,
    padding: 8,
  },
});

export default StoreDetailScreen;
