import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator, SafeAreaView, Modal, TextInput } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { Swipeable } from 'react-native-gesture-handler';

export default function GroupDetailScreen({ route, navigation }) {
  const { groupId } = route.params;
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMember, setNewMember] = useState('');
  const [adding, setAdding] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [ownerTransferMode, setOwnerTransferMode] = useState(false);

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const res = await api.get(`/groups/${groupId}`);
        setGroup(res.data);
      } catch (err) {
        Alert.alert('Error', 'Failed to fetch group details');
        setGroup(null);
      } finally {
        setLoading(false);
      }
    };
    fetchGroup();
    // Get current user id
    AsyncStorage.getItem('token').then(token => {
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setCurrentUserId(payload.id);
      }
    });
  }, [groupId]);

  const isOwner = group && group.members.some(m => m.role === 'owner' && m.user?._id === currentUserId);
  const isAdmin = group && group.members.some(m => m.role === 'admin' && m.user?._id === currentUserId);

  const handleAddMember = async () => {
    if (!newMember.trim()) return;
    setAdding(true);
    try {
      // Call backend to add member (reuse group join logic or create a new endpoint)
      const res = await api.post(`/groups/${groupId}/addMember`, { identifier: newMember.trim() });
      setGroup(res.data);
      setShowAddModal(false);
      setNewMember('');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to add member');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!isOwner && !isAdmin) return;
    if (userId === currentUserId) return; // Don't allow self-remove here
    try {
      await api.patch(`/groups/${groupId}/removeUser`, { userId });
      // Refresh group
      const res = await api.get(`/groups/${groupId}`);
      setGroup(res.data);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleLeaveGroup = async () => {
    if (isOwner) {
      setOwnerTransferMode(true);
      Alert.alert('Owner Transfer', 'You are the owner. Double-tap a member to transfer ownership before leaving.');
      return;
    }
    try {
      await api.post(`/groups/${groupId}/leave`);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to leave group');
    }
  };

  const handleTransferOwnership = async (userId) => {
    try {
      await api.patch(`/groups/${groupId}/changeRole`, { userId, newRole: 'owner' });
      setOwnerTransferMode(false);
      // After transfer, leave group
      await api.post(`/groups/${groupId}/leave`);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to transfer ownership');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  if (!group) {
    return (
      <View style={styles.centered}>
        <Text>Group not found.</Text>
      </View>
    );
  }

  const renderMemberChip = ({ item }) => {
    const isCurrentOwner = item.role === 'owner';
    const isCurrentAdmin = item.role === 'admin';
    const isMe = item.user?._id === currentUserId;
    return (
      <Swipeable
        renderRightActions={() =>
          (isOwner || isAdmin) && !isCurrentOwner && !isMe ? (
            <TouchableOpacity
              style={styles.deleteAction}
              onPress={() => handleRemoveMember(item.user._id)}
            >
              <Icon name="trash" size={24} color="#fff" />
            </TouchableOpacity>
          ) : null
        }
        onSwipeableRightOpen={() => {
          if ((isOwner || isAdmin) && !isCurrentOwner && !isMe) handleRemoveMember(item.user._id);
        }}
      >
        <TouchableOpacity
          style={[styles.memberChip, ownerTransferMode && !isCurrentOwner ? styles.transferable : null]}
          onPress={() => {}}
          onLongPress={() => {
            if (ownerTransferMode && !isCurrentOwner && !isMe) handleTransferOwnership(item.user._id);
          }}
        >
          <Icon name="person-circle" size={22} color={isCurrentOwner ? '#FFD700' : isCurrentAdmin ? '#4ECDC4' : '#888'} style={{ marginRight: 6 }} />
          <Text style={styles.memberChipText}>{item.user?.username || item.user || item.name || item}</Text>
          {isCurrentOwner && <Text style={styles.roleBadge}>Owner</Text>}
          {isCurrentAdmin && !isCurrentOwner && <Text style={styles.roleBadge}>Admin</Text>}
          {isMe && <Text style={styles.roleBadge}>You</Text>}
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{group.name}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.sectionTitle}>Members</Text>
        <FlatList
          data={group.members}
          keyExtractor={item => item.user?._id || item.user || item._id || item}
          renderItem={renderMemberChip}
          horizontal
          style={{ marginBottom: 20 }}
        />
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionButton} onPress={() => setShowAddModal(true)}>
            <Icon name="person-add" size={22} color="#2E7D32" />
            <Text style={styles.actionButtonText}>Add Members</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleLeaveGroup}>
            <Icon name="exit" size={22} color="#FF6B6B" />
            <Text style={styles.actionButtonText}>Leave Group</Text>
          </TouchableOpacity>
        </View>
        {/* Smart Suggestions Button */}
        <TouchableOpacity style={[styles.openListButton, { backgroundColor: '#2E7D32', marginTop: 12 }]} onPress={() => navigation.navigate('GroupSharedList', { groupId: group._id })}>
          <Icon name="list" size={22} color="#fff" />
          <Text style={styles.openListButtonText}>Open Shared List</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.openListButton, { backgroundColor: '#45B7D1', marginTop: 12 }]} onPress={() => navigation.navigate('SmartSuggestions', { groupId: group._id })}>
          <Icon name="bulb" size={22} color="#fff" />
          <Text style={styles.openListButtonText}>Smart Suggestions</Text>
        </TouchableOpacity>
      </View>
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Member</Text>
            <TextInput
              placeholder="Enter username/email/phone"
              value={newMember}
              onChangeText={setNewMember}
              style={styles.input}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddModal(false)} disabled={adding}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handleAddMember} disabled={adding}>
                <Text style={styles.confirmText}>{adding ? 'Adding...' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#2E7D32',
    paddingTop: 50,
    paddingBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 50,
    zIndex: 2,
    padding: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  body: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#2E7D32',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  memberName: {
    fontSize: 16,
    color: '#333',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  openListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 30,
  },
  openListButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
    borderRadius: 15,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  memberChipText: {
    fontSize: 14,
    color: '#333',
    marginRight: 5,
  },
  roleBadge: {
    backgroundColor: '#FFD700',
    color: '#333',
    fontSize: 12,
    fontWeight: 'bold',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 5,
    marginLeft: 5,
  },
  deleteAction: {
    backgroundColor: '#FF6B6B',
    width: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
  },
  transferable: {
    backgroundColor: '#4ECDC4',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 25,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#2E7D32',
  },
  input: {
    width: '100%',
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 20,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  cancelButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
  },
  cancelText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
  },
  confirmText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
}); 