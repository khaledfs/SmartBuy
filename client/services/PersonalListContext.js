import React, { createContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PersonalListContext = createContext();

const KEYS = {
  PERSONAL_LIST: 'sb.personalList',
  LAST_BOUGHT: 'sb.lastBought',
  LAST_STORE: 'sb.lastStore',
  TRIP_HISTORY: 'sb.tripHistory',
  SELECTED_TRIP_ID: 'sb.selectedTripId', 
};

const loadJSON = async (key, fallback) => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const saveJSON = async (key, value) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {

    // Ignore write errors
    }
};


export const PersonalListProvider = ({ children }) => {
  const [personalList, setPersonalList] = useState([]);  // The user's personal shopping list    
  const [lastBought, setLastBought] = useState([]);          // The items bought in the last completed trip
  const [lastStore, setLastStore] = useState(null);          // The store info of the last completed trip
  const [tripHistory, setTripHistory] = useState([]);        // History of completed trips
  const [selectedTrip, setSelectedTrip] = useState(null);    
// The currently selected trip from history (if any)
  const hydratedRef = useRef(false);

// To avoid saving to AsyncStorage before initial load
  useEffect(() => {
    (async () => {
      const [
        pl, lb, ls, th, selectedTripId 
      ] = await Promise.all([
        loadJSON(KEYS.PERSONAL_LIST, []),
        loadJSON(KEYS.LAST_BOUGHT, []),
        loadJSON(KEYS.LAST_STORE, null),
        loadJSON(KEYS.TRIP_HISTORY, []),
        AsyncStorage.getItem(KEYS.SELECTED_TRIP_ID),
      ]);

      setPersonalList(pl);
      setLastBought(lb);
      setLastStore(ls);
      setTripHistory(th);

      if (selectedTripId) {
        const tr = th.find(t => String(t.id) === String(selectedTripId));
        if (tr) setSelectedTrip(tr);
      }
      hydratedRef.current = true;
    })();
  }, []);

// Save to AsyncStorage on changes (after initial load)
  useEffect(() => {
    if (!hydratedRef.current) return;
    saveJSON(KEYS.PERSONAL_LIST, personalList);
  }, [personalList]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    saveJSON(KEYS.LAST_BOUGHT, lastBought);
  }, [lastBought]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    saveJSON(KEYS.LAST_STORE, lastStore);
  }, [lastStore]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    saveJSON(KEYS.TRIP_HISTORY, tripHistory);
  }, [tripHistory]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    AsyncStorage.setItem(KEYS.SELECTED_TRIP_ID, selectedTrip ? String(selectedTrip.id) : '');
  }, [selectedTrip]);

 // Helper: pick a stable key for comparison (prefer barcode)
const getKey = (p) => p?.barcode ?? p?._id ?? p?.id ?? p?.productId ?? p?.product ?? null;

const completeTrip = (storeInfo, boughtProducts = []) => {
  // 1) Derive the bought set (by barcode/key)
  const boughtKeys = new Set(
    (Array.isArray(boughtProducts) ? boughtProducts : [])
      .map(getKey)
      .filter(Boolean)
  );

  // 2) If caller forgot to pass boughtProducts, DO NOT nuke the list.
  //    Just leave items as-is (or you can early-return).
  const hadBought = boughtKeys.size > 0;

  // 3) What items to save as the trip’s “items” (last bought)
  //    If we have boughtProducts, use those; else keep it empty array.
  const moving = hadBought
    ? boughtProducts.map((p) => ({ ...p }))
    : [];

  const tripData = {
    id: global.crypto?.randomUUID?.() ?? Date.now().toString(),
    store: storeInfo || null,
    items: moving,
    completedAt: new Date().toISOString(),
    tripNumber: tripHistory.length + 1,
  };

  setTripHistory((prev) => [tripData, ...prev]);
  setLastBought(moving);
  setLastStore(storeInfo || null);

  // 4) Only remove actually bought items; keep non-found items in the list
  if (hadBought) {
    setPersonalList((prev) =>
      prev.filter((p) => !boughtKeys.has(getKey(p)))
    );
  } else {
    // No bought items reported → do NOT clear the list
    // (Optionally: show a toast/snackbar saying "No items were purchased")
    
  }
};

  const selectTrip = (tripId) => {
    const trip = tripHistory.find(t => String(t.id) === String(tripId));
    if (trip) {
      setSelectedTrip(trip);
      setLastBought(trip.items);
      setLastStore(trip.store);
    }
  };

  const clearSelectedTrip = () => {
    setSelectedTrip(null);
    if (tripHistory.length > 0) {
      setLastBought(tripHistory[0].items);
      setLastStore(tripHistory[0].store);
    } else {
      setLastBought([]);
      setLastStore(null);
    }
  };

  return (
    <PersonalListContext.Provider value={{
      personalList, setPersonalList,
      lastBought, setLastBought,
      lastStore, setLastStore,
      tripHistory, setTripHistory,
      selectedTrip, setSelectedTrip,
      completeTrip, selectTrip, clearSelectedTrip,
    }}>
      {children}
    </PersonalListContext.Provider>
  );
};

export default PersonalListContext;
