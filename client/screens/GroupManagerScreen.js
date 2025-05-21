// client/screens/GroupManagerScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  StyleSheet,
  Alert,
  Image,
  TouchableOpacity
} from 'react-native';

import api from '../services/api';
import jwtDecode from 'jwt-decode';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function GroupManagerScreen() {
  const [groups, setGroups] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [usernameToAdd, setUsernameToAdd] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const defaultAvatar = 'https://cdn-icons-png.flaticon.com/512/847/847969.png';

  // Load user ID from token first
 useEffect(() => {
  const init = async () => {
    
    const token = await AsyncStorage.getItem('token');
     
    if (!token) {
      console.warn('⚠️ No token found');
      return;
    }

    const decoded = jwtDecode(token);
    console.log("kokasdaosadasdas")
    console.log('🔓 Decoded token in GroupManager:', decoded);
    setCurrentUserId(decoded.id);
    if (!decoded?.id) {
        console.error('❌ Token decoded but missing id:', decoded);
        }

    // Wait until user ID is set before fetching groups
   
    fetchMyGroups();
  };

  init();
}, []);

  // Fetch groups once we know currentUserId
  useEffect(() => {
    if (currentUserId) {
      console.log('📥 Fetching groups for user:', currentUserId);
      fetchMyGroups();
    }
  }, [currentUserId]);

  const fetchMyGroups = async () => {
    try {
      const res = await api.get('/groups/my');
      setGroups(res.data);
    } catch (err) {
      console.error('Fetch groups error:', err);
      Alert.alert('Error fetching groups');
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
      Alert.alert('User added!');
      setUsernameToAdd('');
      fetchMyGroups();
    } catch (err) {
      console.error('Add user error:', err);
      Alert.alert('Failed to add user. Make sure the username is correct.');
    }
  };

  const handleRemoveMember = async (groupId, memberId) => {
    try {
      await api.patch(`/groups/${groupId}/removeUser`, { userId: memberId });
      fetchMyGroups();
    } catch (err) {
      console.error('Remove member error:', err);
      Alert.alert('Failed to remove member');
    }
  };

  const handleLeaveGroup = async (groupId) => {
    try {
      await api.post(`/groups/${groupId}/leave`);
      fetchMyGroups();
    } catch (err) {
      console.error('Leave group error:', err?.response?.data || err.message);
      Alert.alert('Failed to leave group');
    }
  };

  const handleDeleteGroup = async (groupId) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this group?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/groups/${groupId}`);
            fetchMyGroups();
          } catch (err) {
            console.error('Delete group error:', err);
            Alert.alert('Failed to delete group');
          }
        },
      },
    ]);
  };

  const renderGroup = ({ item }) => {
    console.log('Group admin:', item.admin._id, '| You:', currentUserId);

    return (
      <View style={styles.groupItem}>
        <Text style={styles.groupName}>{item.name}</Text>

        <View style={styles.adminRow}>
          <Image
            source={{ uri: item.admin?.profilePicUrl || defaultAvatar }}
            style={styles.adminPic}
          />
          <Text style={styles.adminText}>Admin: {item.admin?.username || 'Unknown'}</Text>
        </View>

        <View style={styles.memberRow}>
          {item.members?.map((m) => (
            <View key={m._id} style={{ alignItems: 'center', marginRight: 6 }}>
              <Image
                source={{ uri: m.profilePicUrl || defaultAvatar }}
                style={styles.memberPic}
              />
              {String(item.admin._id) === String(currentUserId) && m._id !== currentUserId && (
                <TouchableOpacity
                  onPress={() => handleRemoveMember(item._id, m._id)}
                  style={{ position: 'absolute', top: -4, right: -4 }}
                >
                  <Text style={{ fontSize: 10, color: 'red' }}>❌</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          {String(item.admin._id) === String(currentUserId) && (
            <TouchableOpacity
              style={styles.addMemberButton}
              onPress={() => setSelectedGroupId(item._id)}
            >
              <Text style={styles.addMemberText}>+</Text>
            </TouchableOpacity>
          )}
        </View>

        {item._id === selectedGroupId && (
          <View style={styles.adminControls}>
            <TextInput
              placeholder="Username to add"
              value={usernameToAdd}
              onChangeText={setUsernameToAdd}
              style={styles.input}
            />
            <Button title="Add Member" onPress={addUserToGroup} />
          </View>
        )}

        <View style={{ marginTop: 8 }}>
          {String(item.admin._id) === String(currentUserId) ? (
            <Button
              title="🗑 Delete Group"
              color="red"
              onPress={() => handleDeleteGroup(item._id)}
            />
          ) : (
            <Button
              title="🚪 Leave Group"
              onPress={() => handleLeaveGroup(item._id)}
            />
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Groups</Text>
      <FlatList
        data={groups}
        keyExtractor={(item) => item._id}
        renderItem={renderGroup}
        ListEmptyComponent={<Text>No groups found.</Text>}
      />
      <Text style={styles.subtitle}>Create New Group</Text>
      <TextInput
        placeholder="Group Name"
        value={groupName}
        onChangeText={setGroupName}
        style={styles.input}
      />
      <Button title="Create Group" onPress={createGroup} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10
  },
  subtitle: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '600'
  },
  input: {
    borderWidth: 1,
    padding: 8,
    marginVertical: 8,
    borderRadius: 5
  },
  groupItem: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#fdfdfd'
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8
  },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  adminPic: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8
  },
  adminText: {
    fontSize: 14,
    fontWeight: '500'
  },
  memberRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8
  },
  memberPic: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6
  },
  adminControls: {
    marginTop: 10
  },
  addMemberButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    marginBottom: 6
  },
  addMemberText: {
    fontSize: 14,
    fontWeight: 'bold'
  }
});
