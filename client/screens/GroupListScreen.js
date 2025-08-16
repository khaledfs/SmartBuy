import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, SafeAreaView, Alert, FlatList, Share } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { useFocusEffect } from '@react-navigation/native';
import { registerGroupNotifications } from '../services/socketEvents';
import Toast from 'react-native-toast-message';

const demoGroups = [
  {
    id: 'group1',
    name: 'Roommates',
    members: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }],
    lastActivity: '2h ago',
  },
  {
    id: 'group2',
    name: 'Family',
    members: [{ name: 'Mom' }, { name: 'Dad' }, { name: 'You' }, { name: 'Sis' }],
    lastActivity: 'Yesterday',
  },
];

export default function GroupListScreen({ navigation }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groups, setGroups] = useState([]); // Start empty, fetch from backend
  const [groupName, setGroupName] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [members, setMembers] = useState([]);
  const [creating, setCreating] = useState(false);

  // Fetch groups for the logged-in user
  const fetchGroups = async () => {
    try {
      const res = await api.get('/groups/my');
      setGroups(res.data || []);
    } catch (err) {
      setGroups([]);
    }
  };

  // OPTIMIZED: Single fetchGroups call on focus only
  useFocusEffect(
    React.useCallback(() => {
      fetchGroups();
    }, [])
  );

  // Handle real-time group notifications
  useEffect(() => {
    const unsubscribe = registerGroupNotifications((data) => {
      if (data.groupCreated) {
        // Show toast notification
        Toast.show({
          type: 'success',
          text1: 'New Group Created!',
          text2: `You've been added to a new group`,
          position: 'top',
          visibilityTime: 4000,
        });
        
        // Refresh groups list
        fetchGroups();
      } else if (data.memberAdded) {
        Toast.show({
          type: 'info',
          text1: 'New Member Added!',
          text2: 'A new member joined your group',
          position: 'top',
          visibilityTime: 3000,
        });
        
        // Refresh groups list
        fetchGroups();
      }
    });

    return () => unsubscribe();
  }, []);

  // Sort groups: new groups first, then by activity
  const sortedGroups = groups.sort((a, b) => {
    // New groups (created in last 24 hours) go first
    const aIsNew = new Date(a.createdAt || 0) > new Date(Date.now() - 24 * 60 * 60 * 1000);
    const bIsNew = new Date(b.createdAt || 0) > new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    if (aIsNew && !bIsNew) return -1;
    if (!aIsNew && bIsNew) return 1;
    
    // Then sort by last activity (most recent first)
    const aActivity = new Date(a.updatedAt || a.createdAt || 0);
    const bActivity = new Date(b.updatedAt || b.createdAt || 0);
    return bActivity - aActivity;
  });

  const handleAddMember = () => {
    if (memberInput.trim() && !members.includes(memberInput.trim())) {
      setMembers([...members, memberInput.trim()]);
      setMemberInput('');
    }
  };

  const handleRemoveMember = (member) => {
    setMembers(members.filter(m => m !== member));
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Group name is required');
      return;
    }
    setCreating(true);
    console.log('Attempting to create group:', groupName, members);
    console.log('Creating group with:', { name: groupName, members });
    try {
      const res = await api.post(
        '/groups',
        { name: groupName, members }
      );
      console.log('Group created successfully:', res.data);
      const newGroup = {
        id: res.data._id || res.data.id || Math.random().toString(),
        name: res.data.name,
        members: res.data.members?.map(m => ({ name: m.user?.username || m.user || m.name || m })) || [],
        lastActivity: 'Just now',
      };
      // Refresh the entire group list to get the latest data
      fetchGroups();
      setShowCreateModal(false);
      setGroupName('');
      setMembers([]);
      setMemberInput('');
    } catch (err) {
      console.log('Group creation error:', err.response?.data || err.message);
      const errorMsg = err.response?.data?.message || 'Failed to create group';
      if (errorMsg.includes('not found')) {
        Alert.alert(
          'User Not Found',
          `${errorMsg}\nWould you like to invite them to Smart Buy?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Invite',
              onPress: () => {
                Share.share({
                  message: 'Join me on Smart Buy! Download the app here: https://your-app-link.com'
                });
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Main')}>
          <Icon name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Group</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {groups.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Icon name="people-outline" size={80} color="#2E7D32" />
            </View>
            <Text style={styles.emptyTitle}>No Groups Yet</Text>
            <Text style={styles.emptyText}>
              Create your first group and add as many members as you like!
            </Text>
            <TouchableOpacity style={styles.createButton} onPress={() => setShowCreateModal(true)}>
              <Icon name="add" size={20} color="#fff" />
              <Text style={styles.createButtonText}>Create Group</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {sortedGroups.map((group, idx) => {
              const isNewGroup = new Date(group.createdAt || 0) > new Date(Date.now() - 24 * 60 * 60 * 1000);
              
              return (
                <TouchableOpacity
                  key={group.id || group._id}
                  style={[styles.groupCard, isNewGroup && styles.newGroupCard]}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('GroupDetail', { groupId: group.id || group._id })}
                >
                  <View style={styles.groupCardHeader}>
                    <Icon name="people" size={28} color="#2E7D32" style={{ marginRight: 10 }} />
                    <View style={styles.groupNameContainer}>
                      <Text style={styles.groupName}>{group.name}</Text>
                      {isNewGroup && (
                        <View style={styles.newGroupBadge}>
                          <Text style={styles.newGroupBadgeText}>NEW</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.groupCardInfoRow}>
                    <View style={styles.groupCardInfoItem}>
                      <Icon name="person-outline" size={18} color="#4ECDC4" />
                      <Text style={styles.memberCount}>{group.members.length} member{group.members.length !== 1 ? 's' : ''}</Text>
                    </View>
                    <View style={styles.groupCardInfoItem}>
                      <Icon name="time-outline" size={18} color="#FF6B6B" />
                      <Text style={styles.lastActivity}>
                        {isNewGroup ? 'Just created' : `Last edited ${group.lastActivity || 'recently'}`}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.createButton} onPress={() => setShowCreateModal(true)}>
              <Icon name="add" size={20} color="#fff" />
              <Text style={styles.createButtonText}>Create Group</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
      {/* Create Group Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Create Group</Text>
            <TextInput
              placeholder="Enter group name"
              value={groupName}
              onChangeText={setGroupName}
              style={styles.input}
              autoFocus
            />
            <View style={styles.addMembersSection}>
              <Text style={styles.addMembersLabel}>Add members by username/phone/email:</Text>
              <View style={styles.addMembersRow}>
                <TextInput
                  placeholder="Type and press Add"
                  value={memberInput}
                  onChangeText={setMemberInput}
                  style={styles.memberInput}
                  onSubmitEditing={handleAddMember}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.addMemberButton} onPress={handleAddMember}>
                  <Icon name="person-add-outline" size={22} color="#2E7D32" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={members}
                keyExtractor={item => item}
                horizontal
                renderItem={({ item }) => (
                  <View style={styles.memberChip}>
                    <Text style={styles.memberChipText}>{item}</Text>
                    <TouchableOpacity onPress={() => handleRemoveMember(item)}>
                      <Icon name="close-circle" size={18} color="#e74c3c" />
                    </TouchableOpacity>
                  </View>
                )}
                style={{ marginTop: 10 }}
                ListEmptyComponent={null}
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowCreateModal(false)} disabled={creating}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handleCreateGroup} disabled={creating}>
                <Text style={styles.confirmText}>{creating ? 'Creating...' : 'Create'}</Text>
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
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#fff',
    justifyContent: 'flex-start',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIconContainer: {
    marginBottom: 20,
    backgroundColor: '#E8F5E8',
    borderRadius: 50,
    padding: 20,
  },
  emptyTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignSelf: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  groupCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  groupNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  newGroupCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    backgroundColor: '#f8fff8',
  },
  newGroupBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  newGroupBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  memberCount: {
    fontSize: 14,
    color: '#666',
    marginLeft: 38,
  },
  groupCardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 20,
  },
  groupCardInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 18,
  },
  lastActivity: {
    fontSize: 14,
    color: '#888',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 18,
    textAlign: 'center',
  },
  input: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 15,
    padding: 18,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 18,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addMembersSection: {
    marginBottom: 18,
  },
  addMembersLabel: {
    fontSize: 16,
    color: '#555',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  addMembersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  memberInput: {
    flex: 1,
    paddingVertical: 0,
    paddingHorizontal: 10,
    fontSize: 16,
    color: '#333',
  },
  addMemberButton: {
    padding: 8,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 8,
    marginBottom: 8,
  },
  memberChipText: {
    fontSize: 14,
    color: '#333',
    marginRight: 5,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 15,
  },
  confirmButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingHorizontal: 25,
    paddingVertical: 12,
    flex: 1,
    alignItems: 'center',
  },
  confirmText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingHorizontal: 25,
    paddingVertical: 12,
    flex: 1,
    alignItems: 'center',
  },
  cancelText: {
    color: '#666',
    fontWeight: 'bold',
    fontSize: 16,
  },
}); 