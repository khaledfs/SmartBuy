import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet, Alert,
  Image, TouchableOpacity, ScrollView
} from 'react-native';
import api from '../services/api';
import { jwtDecode } from 'jwt-decode';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';

export default function GroupManagerScreen() {
  const [groups, setGroups] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [usernameToAdd, setUsernameToAdd] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const defaultAvatar = 'https://cdn-icons-png.flaticon.com/512/847/847969.png';

  useEffect(() => {
    const init = async () => {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      const decoded = jwtDecode(token);
      setCurrentUserId(decoded.id);
      fetchMyGroups();
    };
    init();
  }, []);

  const fetchMyGroups = async () => {
    try {
      const res = await api.get('/groups/my');
      setGroups(res.data);
    } catch (err) {
      console.error('Fetch groups error:', err);
      Alert.alert('Error', 'Failed to fetch groups');
    }
  };

  const createGroup = async () => {
    if (!groupName.trim()) return Alert.alert('Group name required');
    try {
      await api.post('/groups', { name: groupName });
      setGroupName('');
      fetchMyGroups();
    } catch (err) {
      console.error('Failed to create group:', err);
      Alert.alert('Error creating group');
    }
  };

  const addUserToGroup = async () => {
    if (!usernameToAdd || !selectedGroupId) return;
    try {
      await api.post(`/groups/${selectedGroupId}/addUser`, { username: usernameToAdd });
      setUsernameToAdd('');
      fetchMyGroups();
    } catch (err) {
      Alert.alert('Failed to add user');
    }
  };

  const handleRemove = async (groupId, memberId) => {
    try {
      await api.patch(`/groups/${groupId}/removeUser`, { userId: memberId });
      fetchMyGroups();
    } catch (err) {
      Alert.alert('Failed to remove user');
    }
  };

  const handleLeave = async (groupId) => {
    try {
      await api.post(`/groups/${groupId}/leave`);
      fetchMyGroups();
    } catch (err) {
      Alert.alert('Cannot leave group');
    }
  };

  const handleDelete = async (groupId) => {
    Alert.alert('Delete group?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/groups/${groupId}`);
            fetchMyGroups();
          } catch (err) {
            Alert.alert('Delete failed');
          }
        },
      },
    ]);
  };

  const renderGroup = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.row}>
        <Image source={{ uri: item.admin?.profilePicUrl || defaultAvatar }} style={styles.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.groupTitle}>{item.name}</Text>
          <Text style={styles.adminLabel}>Admin: {item.admin?.username}</Text>
        </View>
        {String(item.admin._id) === String(currentUserId) ? (
          <TouchableOpacity onPress={() => handleDelete(item._id)}>
            <Icon name="trash-outline" size={22} color="red" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => handleLeave(item._id)}>
            <Icon name="exit-outline" size={22} color="#555" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal contentContainerStyle={styles.membersRow}>
        {item.members?.map((m) => (
          <View key={m._id} style={styles.memberWrapper}>
            <Image source={{ uri: m.profilePicUrl || defaultAvatar }} style={styles.memberAvatar} />
            {String(item.admin._id) === String(currentUserId) && m._id !== currentUserId && (
              <TouchableOpacity onPress={() => handleRemove(item._id, m._id)} style={styles.removeBadge}>
                <Text style={{ fontSize: 10, color: 'white' }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        {String(item.admin._id) === String(currentUserId) && (
          <TouchableOpacity style={styles.addMemberBtn} onPress={() => setSelectedGroupId(item._id)}>
            <Icon name="person-add" size={18} />
          </TouchableOpacity>
        )}
      </ScrollView>

      {item._id === selectedGroupId && (
        <View style={styles.addUserRow}>
          <TextInput
            placeholder="Username to add"
            value={usernameToAdd}
            onChangeText={setUsernameToAdd}
            style={styles.input}
          />
          <TouchableOpacity onPress={addUserToGroup} style={styles.confirmBtn}>
            <Text style={styles.confirmText}>Add</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>My Groups</Text>

      <FlatList
        data={groups}
        keyExtractor={(item) => item._id}
        renderItem={renderGroup}
        scrollEnabled={false}
        ListEmptyComponent={<Text style={{ textAlign: 'center' }}>No groups yet.</Text>}
      />

     
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  card: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  groupTitle: { fontSize: 16, fontWeight: '600' },
  adminLabel: { fontSize: 13, color: '#555' },
  membersRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center' },
  memberWrapper: { marginRight: 10, position: 'relative' },
  memberAvatar: { width: 28, height: 28, borderRadius: 14 },
  removeBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: 'red',
    borderRadius: 8,
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  addMemberBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addUserRow: { flexDirection: 'row', marginTop: 10, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    borderRadius: 6,
  },
  confirmBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: 10,
  },
  confirmText: { color: 'white', fontWeight: '600' },
  createBox: { marginTop: 20 },
  createBtn: {
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 6,
    marginTop: 8,
    alignItems: 'center',
  },
  createBtnText: { color: 'white', fontWeight: 'bold' },
});
