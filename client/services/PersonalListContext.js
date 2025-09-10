import React, { createContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PersonalListContext = createContext();

// מפתחות שמורים ב-AsyncStorage
const KEYS = {
  PERSONAL_LIST: 'sb.personalList',
  LAST_BOUGHT: 'sb.lastBought',
  LAST_STORE: 'sb.lastStore',
  TRIP_HISTORY: 'sb.tripHistory',
  SELECTED_TRIP_ID: 'sb.selectedTripId', // רק מזהה, לא את כל האובייקט
};

// עוזרים בטוחים ל-JSON
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
    // אפשר לשקול Toast/log
  }
};

// שכפול אייטמים כדי להגן על היסטוריה
const cloneItems = (items) => (Array.isArray(items) ? items.map(i => ({ ...i })) : []);

export const PersonalListProvider = ({ children }) => {
  const [personalList, setPersonalList] = useState([]);      // העגלה הנוכחית
  const [lastBought, setLastBought] = useState([]);          // מסע אחרון - פריטים שנקנו
  const [lastStore, setLastStore] = useState(null);          // מסע אחרון - חנות
  const [tripHistory, setTripHistory] = useState([]);        // היסטוריית מסעות
  const [selectedTrip, setSelectedTrip] = useState(null);    // מסע מוצג

  // כדי שלא נשמור לפני שסיימנו לטעון
  const hydratedRef = useRef(false);

  // --- טעינה ראשונית מהאחסון ---
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

  // --- שמירה אוטומטית כשסטייט משתנה ---
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

  // --- לוגיקה עסקית ---
  const completeTrip = (storeInfo, boughtProducts = null) => {
    const moving = boughtProducts?.length ? cloneItems(boughtProducts) : cloneItems(personalList);

    const tripData = {
      id: global.crypto?.randomUUID?.() ?? Date.now().toString(), // עדיף uuid אם קיים
      store: storeInfo || null,
      items: moving,
      completedAt: new Date().toISOString(),
      tripNumber: tripHistory.length + 1,
    };

    setTripHistory(prev => [tripData, ...prev]);
    setLastBought(moving);
    setLastStore(storeInfo || null);

    if (boughtProducts?.length) {
      const boughtIds = new Set(boughtProducts.map(p => p.id));
      setPersonalList(prev => prev.filter(p => !boughtIds.has(p.id)));
    } else {
      setPersonalList([]);
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
