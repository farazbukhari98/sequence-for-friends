import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useFriendsStore } from '@/stores/friendsStore';
import { Background } from '@/components/ui/Background';
import { HeaderBar } from '@/components/ui/HeaderBar';
import { Card } from '@/components/ui/Card';
import { AvatarBubble } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { colors, spacing, fontSize, fontWeight, radius } from '@/theme';

export default function FriendsScreen() {
  const router = useRouter();
  const { user, sessionToken } = useAuthStore();
  const friendsStore = useFriendsStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [inviteRoomCode, setInviteRoomCode] = useState('');

  useEffect(() => {
    if (sessionToken) {
      friendsStore.loadFriends(sessionToken);
      friendsStore.loadFriendRequests(sessionToken);
    }
  }, [sessionToken]);

  const handleSearch = () => {
    if (sessionToken && searchQuery.trim()) {
      friendsStore.searchProfiles(sessionToken, searchQuery.trim());
      setActiveTab('search');
    }
  };

  const handleSendRequest = async (username: string) => {
    if (!sessionToken) return;
    const success = await friendsStore.sendFriendRequest(sessionToken, username);
    if (success) {
      Alert.alert('Request Sent', `Friend request sent to ${username}`);
    } else {
      Alert.alert('Error', 'Failed to send friend request');
    }
  };

  const handleAcceptRequest = async (userId: string) => {
    if (!sessionToken) return;
    await friendsStore.acceptFriendRequest(sessionToken, userId);
  };

  const handleRejectRequest = async (userId: string) => {
    if (!sessionToken) return;
    await friendsStore.rejectFriendRequest(sessionToken, userId);
  };

  const handleRemoveFriend = async (userId: string) => {
    if (!sessionToken) return;
    Alert.alert('Remove Friend', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => friendsStore.removeFriend(sessionToken, userId) },
    ]);
  };

  const handleViewProfile = (username: string) => {
    if (sessionToken) {
      friendsStore.loadFriendProfile(sessionToken, username);
    }
    // Navigate to friend profile
    router.push('/(main)/friend-profile');
  };

  return (
    <Background style={styles.container}>
      <HeaderBar title="Friends" onBack={() => router.back()} rightAction={
        <TouchableOpacity onPress={() => setActiveTab('search')}>
          <Ionicons name="search-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      } />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by username"
            placeholderTextColor={colors.textDisabled}
            autoCapitalize="none"
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['friends', 'requests', 'search'] as const).map((tab) => {
            const labels = { friends: 'Friends', requests: 'Requests', search: 'Search' };
            const counts = { friends: friendsStore.friends.length, requests: friendsStore.friendRequests.length, search: 0 };
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {labels[tab]}
                </Text>
                {counts[tab] > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{counts[tab]}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Friends Tab */}
        {activeTab === 'friends' && (
          friendsStore.friends.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={colors.textTertiary} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>No Friends Yet</Text>
              <Text style={styles.emptySubtext}>Search for players to add as friends</Text>
            </View>
          ) : (
            friendsStore.friends.map((friend) => (
              <Card key={friend.userId} style={styles.friendCard} onPress={() => handleViewProfile(friend.username)}>
                <View style={styles.friendRow}>
                  <AvatarBubble avatarId={friend.avatarId} avatarColor={friend.avatarColor} size={44} />
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{friend.displayName}</Text>
                    <Text style={styles.friendUsername}>@{friend.username}</Text>
                  </View>
                  {friend.hasBeatImpossibleBot && (
                    <Ionicons name="skull" size={18} color={colors.purple} />
                  )}
                </View>
              </Card>
            ))
          )
        )}

        {/* Requests Tab */}
        {activeTab === 'requests' && (
          friendsStore.friendRequests.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="mail-outline" size={48} color={colors.textTertiary} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>No Requests</Text>
              <Text style={styles.emptySubtext}>Incoming friend requests will appear here</Text>
            </View>
          ) : (
            friendsStore.friendRequests.map((request) => (
              <Card key={request.userId} style={styles.friendCard}>
                <View style={styles.friendRow}>
                  <AvatarBubble avatarId={request.avatarId} avatarColor={request.avatarColor} size={44} />
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{request.displayName}</Text>
                    <Text style={styles.friendUsername}>@{request.username}</Text>
                  </View>
                  <View style={styles.requestButtons}>
                    <TouchableOpacity style={styles.acceptButton} onPress={() => handleAcceptRequest(request.userId)}>
                      <Ionicons name="checkmark" size={20} color={colors.success} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectButton} onPress={() => handleRejectRequest(request.userId)}>
                      <Ionicons name="close" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            ))
          )
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          friendsStore.isSearching ? (
            <Text style={styles.loadingText}>Searching...</Text>
          ) : friendsStore.searchResults.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color={colors.textTertiary} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>Search for Players</Text>
              <Text style={styles.emptySubtext}>Type a username above to find players</Text>
            </View>
          ) : (
            friendsStore.searchResults.map((result) => (
              <Card key={result.id} style={styles.friendCard} onPress={() => handleViewProfile(result.username)}>
                <View style={styles.friendRow}>
                  <AvatarBubble avatarId={result.avatarId} avatarColor={result.avatarColor} size={44} />
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{result.displayName}</Text>
                    <Text style={styles.friendUsername}>@{result.username}</Text>
                  </View>
                  {result.friendStatus === 'none' && (
                    <Button
                      title="Add"
                      variant="primary"
                      size="small"
                      onPress={() => handleSendRequest(result.username)}
                    />
                  )}
                  {result.friendStatus === 'pending_sent' && (
                    <Text style={styles.pendingText}>Sent</Text>
                  )}
                  {result.friendStatus === 'friends' && (
                    <View style={styles.friendsStatus}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                      <Text style={styles.friendsText}>Friends</Text>
                    </View>
                  )}
                </View>
              </Card>
            ))
          )
        )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Background>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  searchInput: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: fontSize.base,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.cardBg,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium as any,
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: fontWeight.semibold as any,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: fontWeight.bold as any },
  scrollView: { flex: 1, paddingHorizontal: spacing.xl },
  scrollContent: { paddingBottom: spacing.huge },
  friendCard: { padding: spacing.md, marginBottom: spacing.sm },
  friendRow: { flexDirection: 'row', alignItems: 'center' },
  friendInfo: { flex: 1, marginLeft: spacing.md },
  friendName: { color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold as any },
  friendUsername: { color: colors.textTertiary, fontSize: fontSize.sm },
  requestButtons: { flexDirection: 'row', gap: spacing.sm },
  acceptButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.success + '25',
    alignItems: 'center', justifyContent: 'center',
  },
  rejectButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.error + '25',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyState: { alignItems: 'center', paddingVertical: spacing.huge },
  emptyIcon: { marginBottom: spacing.md },
  emptyTitle: { color: colors.textOnDark, fontSize: fontSize.lg, fontWeight: fontWeight.semibold as any },
  emptySubtext: { color: colors.textOnDarkTertiary, fontSize: fontSize.base, marginTop: spacing.sm, textAlign: 'center' },
  loadingText: { color: colors.textOnDarkSecondary, textAlign: 'center', paddingVertical: spacing.xl },
  pendingText: { color: colors.warning, fontSize: fontSize.sm, fontWeight: fontWeight.medium as any },
  friendsStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  friendsText: { color: colors.success, fontSize: fontSize.sm, fontWeight: fontWeight.medium as any },
});
