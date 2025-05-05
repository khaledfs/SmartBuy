// client/screens/MyListScreen.js

import React, { useState, useEffect, useMemo } from 'react';
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

export default function MyListScreen({ navigation, route }) {
  const {
    listId,
    listName: initialName,
    items: parentItems,
    setItems: updateParentItems,
    onDelete,
  } = route.params || {};

  const [rawItems, setRawItems] = useState(parentItems || []);
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [listName, setListName] = useState(initialName || '');

  // load suggestion icons
  useEffect(() => {
    api.get('/suggestions')
      .then(res => setSuggestions(res.data))
      .catch(err => console.error(err));
  }, []);

  // if editing existing and no parentItems passed, fetch
  useEffect(() => {
    if (listId && !parentItems) {
      api.get(`/lists/${listId}`)
        .then(res => {
          setRawItems(res.data.items);
          setListName(res.data.name);
        })
        .catch(err => console.error(err));
    }
  }, [listId, parentItems]);

  // group duplicates by name
  const groupedItems = useMemo(() => {
    const m = {};
    rawItems.forEach(it => {
      if (!m[it.name]) {
        const sug = suggestions.find(s => s.name.en === it.name);
        m[it.name] = {
          name: it.name,
          icon: sug?.icon.light,
          count: 1,
          ids: [it._id],
        };
      } else {
        m[it.name].count++;
        m[it.name].ids.push(it._id);
      }
    });
    return Object.values(m);
  }, [rawItems, suggestions]);

  // toggle selection of a group
  const handleToggle = name => {
    setSelected(prev => ({ ...prev, [name]: !prev[name] }));
  };

  // select all
  const selectAll = () => {
    const all = {};
    groupedItems.forEach(g => (all[g.name] = true));
    setSelected(all);
  };

  // bulk delete selected
  const deleteSelected = () => {
    const toDelete = Object.keys(selected).filter(n => selected[n]);
    if (!toDelete.length) return;
    Alert.alert(
      'Delete Items',
      `Delete ${toDelete.length} group(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // delete each raw item
              for (let name of toDelete) {
                const grp = groupedItems.find(g => g.name === name);
                for (let id of grp.ids) {
                  if (onDelete) await onDelete(id);
                  else await api.delete(`/list/${id}`);
                }
              }
              // update state
              setRawItems(prev => prev.filter(i => !toDelete.includes(i.name)));
              setSelected({});
              if (updateParentItems) {
                updateParentItems(rawItems.filter(i => !toDelete.includes(i.name)));
              }
            } catch (err) {
              console.error(err);
            }
          },
        },
      ]
    );
  };

  // save or update list
  const handleSaveList = async () => {
    if (!listName.trim()) {
      Alert.alert('Invalid Name', 'Enter a valid list name.');
      return;
    }
    try {
      const payload = {
        name: listName.trim(),
        items: rawItems.map(i => i._id),
      };
      if (listId) await api.patch(`/lists/${listId}`, payload);
      else await api.post('/lists', payload);
      setModalVisible(false);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not save list.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header + bulk actions */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>
          {listId ? `Editing: ${listName}` : '🧾 My Shopping List'}
        </Text>
        {Object.values(selected).some(Boolean) && (
          <View style={styles.bulkRow}>
            <TouchableOpacity onPress={selectAll} style={styles.bulkBtn}>
              <Text style={styles.bulkText}>Select All</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={deleteSelected} style={styles.bulkBtn}>
              <Icon name="trash-outline" size={24} color="red" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Grouped list */}
      <FlatList
        data={groupedItems}
        keyExtractor={g => g.name}
        renderItem={({ item: g }) => (
          <View style={styles.itemRow}>
            <Checkbox
              status={selected[g.name] ? 'checked' : 'unchecked'}
              onPress={() => handleToggle(g.name)}
            />
            {g.icon && <Image source={{ uri: g.icon }} style={styles.icon} />}
            <Text style={styles.itemText}>{g.name}</Text>
            {g.count > 1 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>×{g.count}</Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No items.</Text>}
      />

      {/* Footer */}
      <View style={styles.footer}>
        <Button title="Save List" onPress={() => setModalVisible(true)} />
        <View style={{ height: 10 }} />
        <Button
          title="Rename List"
          color="#FF9800"
          onPress={() => setModalVisible(true)}
        />
      </View>

      {/* Rename/Save Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>List Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter name"
              value={listName}
              onChangeText={setListName}
            />
            <View style={styles.modalBtns}>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: { fontSize: 24, fontWeight: 'bold' },
  bulkRow: { flexDirection: 'row', alignItems: 'center' },
  bulkBtn: { marginLeft: 12 },
  bulkText: { color: '#2196F3', fontWeight: 'bold' },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderRadius: 6,
  },
  icon: { width: 40, height: 40, marginRight: 12, borderRadius: 4 },
  itemText: { fontSize: 18, flex: 1 },
  countBadge: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 12,
  },
  countText: { color: '#fff', fontWeight: 'bold' },

  empty: { textAlign: 'center', marginTop: 20, color: '#888' },

  footer: { marginTop: 20 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
  },
  modalTitle: { fontSize: 18, marginBottom: 10, textAlign: 'center' },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
  },
  modalBtns: { flexDirection: 'row', justifyContent: 'space-around' },
});
