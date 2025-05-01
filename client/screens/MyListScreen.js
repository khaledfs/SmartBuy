// client/screens/MyListScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Button,
  Alert,
  Image,
  Modal,
  TextInput,
  SafeAreaView,
} from 'react-native';
import api from '../services/api';
import Icon from 'react-native-vector-icons/Ionicons';
import { Checkbox } from 'react-native-paper';

const ICONS = {
  Broom: 'https://img.icons8.com/?size=100&id=116707&format=png&color=000000',
  Detergent: 'https://img.icons8.com/?size=100&id=3YZRvSb66SaF&format=png&color=000000',
  Sponge: 'https://img.icons8.com/?size=100&id=uibV0dBxFsJa&format=png&color=000000',
  'Glass Cleaner': 'https://img.icons8.com/?size=100&id=fvKgFVN2XKu1&format=png&color=000000',
  Chicken: 'https://img.icons8.com/?size=100&id=101707&format=png&color=000000',
  Salmon: 'https://img.icons8.com/?size=100&id=RqlLQZrW8PFf&format=png&color=000000',
  Beef: 'https://img.icons8.com/?size=100&id=70448&format=png&color=000000',
  Shrimp: 'https://img.icons8.com/?size=100&id=rm2ULHn0Cvt9&format=png&color=000000',
  Milk: 'https://img.icons8.com/?size=100&id=NjN1tSA0Isfp&format=png&color=000000',
  Eggs: 'https://img.icons8.com/?size=100&id=80533&format=png&color=000000',
  Yogurt: 'https://img.icons8.com/?size=100&id=yBiUcz9I4Ypl&format=png&color=000000',
  Cheese: 'https://img.icons8.com/?size=100&id=LSRddz1lzJP7&format=png&color=000000',
};

export default function MyListScreen({ navigation, route }) {
  // initial items and parent updater
  const { items: initialItems, setItems: updateParentItems } = route.params;

  const [items, setItems] = useState(initialItems || []);
  const [selected, setSelected] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [listName, setListName] = useState('');

  const handleToggle = (id) => {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const selectAll = () => {
    const allSelected = {};
    items.forEach(item => { allSelected[item._id] = true; });
    setSelected(allSelected);
  };

  const handleDeleteSelected = () => {
    const toDelete = Object.keys(selected).filter(id => selected[id]);
    if (!toDelete.length) return;

    Alert.alert(
      'Delete Items',
      `Are you sure you want to delete ${toDelete.length} item(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              // delete each on server
              for (let id of toDelete) {
                await api.delete(`/list/${id}`);
              }
              // update both local and parent state
              const updated = items.filter(item => !toDelete.includes(item._id));
              setItems(updated);
              updateParentItems(updated);
              setSelected({});
            } catch (err) {
              console.error('Delete error:', err.message);
            }
          }
        }
      ]
    );
  };

  const handleSaveList = async () => {
    if (!listName.trim()) {
      Alert.alert('Invalid Name', 'Please enter a valid list name.');
      return;
    }
    try {
      await api.post('/lists', { name: listName.trim(), items: items.map(i => i._id) });
      setModalVisible(false);
      // List saved; stay on this screen and see updated list
    } catch (err) {
      console.error('Save list error:', err.message);
      Alert.alert('Error', 'Could not save list. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>🧾 My Shopping List</Text>
        <View style={styles.iconRow}>
          {Object.values(selected).some(Boolean) && (
            <>
              <TouchableOpacity onPress={selectAll} style={styles.selectAllBtn}>
                <Text style={styles.selectAllText}>Select All</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDeleteSelected} style={{ marginLeft: 8 }}>
                <Icon name="trash-outline" size={26} color="red" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={item => item._id}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <Checkbox
              status={selected[item._id] ? 'checked' : 'unchecked'}
              onPress={() => handleToggle(item._id)}
            />
            <Image source={{ uri: ICONS[item.name] }} style={styles.itemIcon} />
            <Text style={styles.itemText}>{item.name}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No items in your list.</Text>}
      />

      <View style={styles.footer}>
        <Button title="Save List" onPress={() => setModalVisible(true)} />
        <View style={{ height: 10 }} />
        <Button title="Rename List" color="#FF9800" onPress={() => {/* implement rename later */}} />
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter List Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="List Name"
              value={listName}
              onChangeText={setListName}
            />
            <View style={styles.modalButtons}>
              <Button title="Cancel" onPress={() => setModalVisible(false)} />
              <Button title="Save" onPress={handleSaveList} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 24, fontWeight: 'bold' },
  iconRow: { flexDirection: 'row', alignItems: 'center' },
  selectAllBtn: { backgroundColor: '#d3d3d3', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  selectAllText: { color: '#fff', fontWeight: 'bold' },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, backgroundColor: '#f0f0f0', marginBottom: 6, paddingHorizontal: 10, borderRadius: 6 },
  itemIcon: { width: 30, height: 30, marginHorizontal: 5 },
  itemText: { fontSize: 18, flex: 1, marginLeft: 10 },
  empty: { textAlign: 'center', marginTop: 20, fontStyle: 'italic', color: '#888' },
  footer: { marginTop: 20 },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { width: '80%', backgroundColor: '#fff', borderRadius: 8, padding: 20 },
  modalTitle: { fontSize: 18, marginBottom: 10, textAlign: 'center' },
  modalInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-around' },
});
