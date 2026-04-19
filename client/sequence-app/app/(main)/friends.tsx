import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useFriendsStore } from '@/stores/friendsStore';
import { Background } from '@/components/ui/Background';
import { HeaderBar } from '@/components/ui/HeaderBar';
import { Card } from '@/components/ui/Card';
import { AvatarBubble } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { colors, spacing, fontSize, fontWeight, radius } from '@/theme';
import { TextInput } from 'react-native';

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
          <Text style={styles.searchIcon}>🔍</Text>
        </TouchableOpacity>
      } />

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

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Friends Tab */}
        {activeTab === 'friends' && (
          friendsStore.friends.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>👥</Text>
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
                  {friend.hasBeatImpossibleBot && <Text style={styles.badgeImpossible}>💀</Text>}
                </View>
              </Card>
            ))
          )
        )}

        {/* Requests Tab */}
        {activeTab === 'requests' && (
          friendsStore.friendRequests.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📭</Text>
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
                      <Text style={styles.acceptButtonText}>✓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectButton} onPress={() => handleRejectRequest(request.userId)}>
                      <Text style={styles.rejectButtonText}>✗</Text>
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
              <Text style={styles.emptyEmoji}>🔍</Text>
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
                    <Text style={styles.friendsText}>Friends ✓</Text>
                  )}
                </View>
              </Card>
            ))
          )
        )}
      </ScrollView>
    </Background>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  searchIcon: { fontSize: 20 },
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
  friendCard: { padding: spacing.md, marginBottom: spacing.sm },
  friendRow: { flexDirection: 'row', alignItems: 'center' },
  friendInfo: { flex: 1, marginLeft: spacing.md },
  friendName: { color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold as any },
  friendUsername: { color: colors.textTertiary, fontSize: fontSize.sm },
  badgeImpossible: { fontSize: 16 },
  requestButtons: { flexDirection: 'row', gap: spacing.sm },
  acceptButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.success + '25',
    alignItems: 'center', justifyContent: 'center',
  },
  acceptButtonText: { color: colors.success, fontSize: 18, fontWeight: fontWeight.bold as any },
  rejectButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.error + '25',
    alignItems: 'center', justifyContent: 'center',
  },
  rejectButtonText: { color: colors.error, fontSize: 16, fontWeight: fontWeight.bold as any },
  emptyState: { alignItems: 'center', paddingVertical: spacing.huge },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.semibold as any },
  emptySubtext: { color: colors.textTertiary, fontSize: fontSize.base, marginTop: spacing.sm, textAlign: 'center' },
  loadingText: { color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.xl },
  pendingText: { color: colors.warning, fontSize: fontSize.sm, fontWeight: fontWeight.medium as any },
  friendsText: { color: colors.success, fontSize: fontSize.sm, fontWeight: fontWeight.medium as any },
});