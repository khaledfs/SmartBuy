import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { Swipeable } from 'react-native-gesture-handler';

export default function GroupDetailScreen({ route, navigation }) {
  const { groupId } = route.params;

  // ===== state (unchanged logic) =====
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMember, setNewMember] = useState('');
  const [adding, setAdding] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [ownerTransferMode, setOwnerTransferMode] = useState(false);

  // ===== effects (unchanged logic) =====
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

    // current user id (same logic; guarded)
    AsyncStorage.getItem('token').then((token) => {
      try {
        if (token) {
          const base64 = token.split('.')[1];
          const decoded = typeof atob === 'function'
            ? atob(base64)
            : JSON.parse(Buffer.from(base64, 'base64').toString('utf8')); // fallback if atob missing
          const payload = typeof decoded === 'string' ? JSON.parse(decoded) : decoded;
          setCurrentUserId(payload.id);
        }
      } catch {
        // ignore token parse errors
      }
    });
  }, [groupId]);

  // ===== helpers (no logic change) =====
  const idOf = (m) => m?.user?._id || m?.user || m?._id || String(m);
  const nameOf = (m) =>
    m?.user?.username || m?.user?.name || m?.user?.email || m?.name || String(m);

  const isOwner =
    group && group.members?.some((m) => m.role === 'owner' && (m.user?._id || m.user) === currentUserId);
  const isAdmin =
    group && group.members?.some((m) => m.role === 'admin' && (m.user?._id || m.user) === currentUserId);

  // Keep hook order stable: compute sortedMembers BEFORE any early returns
  const sortedMembers = useMemo(() => {
    const rank = (m) => {
      const id = idOf(m);
      if (id === currentUserId) return 0; // you first
      if (m.role === 'owner') return 1;
      if (m.role === 'admin') return 2;
      return 3;
    };
    const arr = [...(group?.members || [])];
    return arr.sort((a, b) => {
      const r = rank(a) - rank(b);
      if (r !== 0) return r;
      return nameOf(a).localeCompare(nameOf(b));
    });
  }, [group?.members, currentUserId]);

  // ===== early returns (UI only) =====
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

  // ===== actions (unchanged logic) =====
  const handleAddMember = async () => {
    if (!newMember.trim()) return;
    setAdding(true);
    try {
      const res = await api.post(`/groups/${groupId}/addMember`, { identifier: newMember.trim() });
      setGroup(res.data);
      setShowAddModal(false);
      setNewMember('');
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to add member');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!isOwner && !isAdmin) return;
    if (userId === currentUserId) return;
    try {
      await api.patch(`/groups/${groupId}/removeUser`, { userId });
      const res = await api.get(`/groups/${groupId}`);
      setGroup(res.data);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleLeaveGroup = async () => {
    if (isOwner) {
      setOwnerTransferMode(true);
      Alert.alert(
        'Owner Transfer',
        'You are the owner. Long-press a member to transfer ownership before leaving.'
      );
      return;
    }
    try {
      await api.post(`/groups/${groupId}/leave`);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to leave group');
    }
  };

  const handleTransferOwnership = async (userId) => {
    try {
      await api.patch(`/groups/${groupId}/changeRole`, { userId, newRole: 'owner' });
      setOwnerTransferMode(false);
      await api.post(`/groups/${groupId}/leave`);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to transfer ownership');
    }
  };

  // ===== UI bits (modern design) =====
  const canRemove = (m) => (isOwner || isAdmin) && m.role !== 'owner' && idOf(m) !== currentUserId;

  const RolePill = ({ role, isYou }) => {
    if (isYou) return <Text style={[styles.pill, styles.youPill]}>You</Text>;
    if (role === 'owner') return <Text style={[styles.pill, styles.ownerPill]}>Owner</Text>;
    if (role === 'admin') return <Text style={[styles.pill, styles.adminPill]}>Admin</Text>;
    return null;
  };

  const RightAction = () => (
    <View style={styles.rightAction}>
      <Icon name="trash" size={22} color="#fff" />
      <Text style={styles.rightActionText}>Remove</Text>
    </View>
  );

  const Avatar = ({ member }) => {
    const img = member?.user?.avatar;
    const label = (nameOf(member)?.[0] || '?').toUpperCase();
    return img ? (
      <Image source={{ uri: img }} style={styles.avatarImg} />
    ) : (
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{label}</Text>
      </View>
    );
  };

  const renderRow = ({ item }) => {
    const memberId = idOf(item);
    const you = memberId === currentUserId;

    return (
      <Swipeable
        renderRightActions={() => (canRemove(item) ? <RightAction /> : null)}
        onSwipeableRightOpen={() => {
          if (canRemove(item)) handleRemoveMember(memberId);
        }}
        overshootRight={false}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          style={[
            styles.rowCard,
            ownerTransferMode && !you && item.role !== 'owner' ? styles.transferableRow : null,
          ]}
          onLongPress={() => {
            if (ownerTransferMode && !you && item.role !== 'owner') handleTransferOwnership(memberId);
          }}
        >
          <Avatar member={item} />

          <View style={styles.rowCenter}>
            <View style={styles.rowTitleWrap}>
              {item.role === 'owner' ? (
                <Icon name="trophy" size={16} color="#F5C518" style={{ marginRight: 6 }} />
              ) : item.role === 'admin' ? (
                <Icon name="shield-checkmark" size={16} color="#4ECDC4" style={{ marginRight: 6 }} />
              ) : null}
              <Text style={styles.rowTitle} numberOfLines={1}>
                {nameOf(item)}
              </Text>
            </View>
            {item?.user?.email ? (
              <Text style={styles.rowSub} numberOfLines={1}>
                {item.user.email}
              </Text>
            ) : null}
          </View>

          <RolePill role={item.role} isYou={you} />
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.replace('GroupList')}>
          <Icon name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{group.name}</Text>
      </View>

      {/* Body */}
      <View style={styles.body}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Members</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
            <Icon name="person-add" size={18} color="#fff" />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={sortedMembers}
          keyExtractor={(item, idx) => idOf(item) || String(idx)}
          renderItem={renderRow}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        />

        <TouchableOpacity
          style={[styles.primaryCta, { backgroundColor: '#45B7D1' }]}
          onPress={() => navigation.navigate('SmartSuggestions', { groupId: group._id })}
        >
          <Icon name="bulb" size={20} color="#fff" />
          <Text style={styles.primaryCtaText}>Start Shopping</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryCta, { backgroundColor: '#2E7D32' }]}
          onPress={() => navigation.navigate('GroupSharedList', { groupId: group._id })}
        >
          <Icon name="list" size={20} color="#fff" />
          <Text style={styles.primaryCtaText}>Open Shared List</Text>
        </TouchableOpacity>

        <View style={styles.leaveRow}>
          <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGroup}>
            <Icon name="exit" size={18} color="#FF6B6B" />
            <Text style={styles.leaveText}>Leave Group</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Add member modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Member</Text>
            <TextInput
              placeholder="Enter username / email / phone"
              value={newMember}
              onChangeText={setNewMember}
              style={styles.input}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddModal(false)}
                disabled={adding}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleAddMember}
                disabled={adding}
              >
                <Text style={styles.confirmText}>{adding ? 'Adding…' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },

  header: {
    backgroundColor: '#2E7D32',
    paddingTop: 50,
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: { position: 'absolute', left: 20, top: 48, zIndex: 2, padding: 8 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },

  body: { flex: 1, paddingTop: 16 },

  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#2E7D32' },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  addButtonText: { color: '#fff', fontWeight: '700' },

  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F5E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: '#EEE',
  },
  avatarText: { color: '#2E7D32', fontWeight: '800', fontSize: 16 },

  rowCenter: { flex: 1 },
  rowTitleWrap: { flexDirection: 'row', alignItems: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#222', flexShrink: 1 },
  rowSub: { marginTop: 2, fontSize: 12, color: '#7A7A7A' },

  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    marginLeft: 10,
  },
  ownerPill: { backgroundColor: '#FFF3C4', color: '#6B5700' },
  adminPill: { backgroundColor: '#DFF7F2', color: '#0D6B5C' },
  youPill: { backgroundColor: '#E6F4EA', color: '#1E7A35' },

  rightAction: {
    width: 96,
    backgroundColor: '#FF6B6B',
    marginVertical: 4,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightActionText: { color: '#fff', fontWeight: '700', marginTop: 4 },

  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  primaryCtaText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  leaveRow: { alignItems: 'center', marginTop: 10, marginBottom: 24 },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF2F2',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  leaveText: { color: '#FF6B6B', fontWeight: '700' },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 24,
    width: '86%',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 22, fontWeight: '800', marginBottom: 16, color: '#2E7D32' },
  input: {
    width: '100%',
    height: 50,
    borderColor: '#E3E3E3',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  cancelButton: { backgroundColor: '#FF6B6B', paddingVertical: 12, paddingHorizontal: 22, borderRadius: 10 },
  cancelText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  confirmButton: { backgroundColor: '#2E7D32', paddingVertical: 12, paddingHorizontal: 22, borderRadius: 10 },
  confirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  transferableRow: { borderWidth: 1.5, borderColor: '#4ECDC4' },
});
