import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, RefreshControl, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { PendingShot } from '../types';
import { reloadPending, useStore } from '../store';
import { finishShot, importFromGallery, ocrReady, processQueue, retryErrors, scanInbox } from '../services/inbox';
import { S, R, useColors } from '../theme';
import { Badge, Banner, Button, EmptyState, FadeIn, IconButton, LargeHeader, Screen, Txt } from '../ui/kit';
import { toast } from '../ui/toast';
import { displayName } from '../services/match';

function Step({ n, text }: { n: number; text: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: S[3] }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center', marginRight: S[3] }}>
        <Txt variant="caption" tone="accent">
          {n}
        </Txt>
      </View>
      <Txt variant="callout" tone="dim" style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

function ShotCard({ shot, onPress, onLongPress }: { shot: PendingShot; onPress: () => void; onLongPress: () => void }) {
  const c = useColors();
  const working = shot.status === 'queued' || shot.status === 'processing';
  const top = shot.candidates.slice(0, 2).map((x) => displayName(x.anime));
  const auto = shot.candidates.some((x) => x.selected);

  let title = '';
  let sub = '';
  if (working) {
    title = 'Reading screenshot…';
    sub = 'This takes a few seconds';
  } else if (shot.status === 'ready') {
    title = shot.candidates.length === 1 ? '1 possible anime' : shot.candidates.length + ' possible anime';
    sub = top.join('  ·  ');
  } else if (shot.status === 'nothing') {
    title = 'No anime name found';
    sub = 'Tap to pick the text yourself or identify the scene';
  } else {
    title = 'Something went wrong';
    sub = shot.error || 'Tap to open, or pull down to retry';
  }

  return (
    <FadeIn>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title + '. ' + sub}
        onPress={onPress}
        onLongPress={onLongPress}
        android_ripple={{ color: c.accentSoft }}
        style={{
          flexDirection: 'row',
          backgroundColor: c.surface,
          borderRadius: R.lg,
          borderWidth: 1,
          borderColor: c.border,
          padding: S[3],
          marginHorizontal: S[4],
          marginBottom: S[3],
          overflow: 'hidden',
        }}
      >
        <Image
          source={{ uri: shot.uri }}
          accessibilityIgnoresInvertColors
          style={{ width: 64, height: 96, borderRadius: R.sm + 2, backgroundColor: c.surfaceAlt }}
          resizeMode="cover"
        />
        <View style={{ flex: 1, marginLeft: S[3], justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {working ? <ActivityIndicator size="small" color={c.accentText} style={{ marginRight: S[2] }} /> : null}
            <Txt variant="headline" style={{ flexShrink: 1 }}>
              {title}
            </Txt>
          </View>
          <Txt variant="footnote" tone="dim" numberOfLines={2} style={{ marginTop: 2 }}>
            {sub}
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {shot.status === 'ready' && auto ? <Badge label="Ready to add" tone="success" icon="checkmark-circle" /> : null}
            {shot.status === 'ready' && !auto ? <Badge label="Needs a look" tone="warn" /> : null}
            {shot.status === 'nothing' ? <Badge label="Manual" tone="neutral" /> : null}
            {shot.status === 'error' ? <Badge label="Retry" tone="danger" /> : null}
          </View>
        </View>
        <View style={{ justifyContent: 'center' }}>
          <Ionicons name="chevron-forward" size={18} color={c.textFaint} />
        </View>
      </Pressable>
    </FadeIn>
  );
}

export default function InboxScreen({ navigation }: any) {
  const c = useColors();
  const pending = useStore((s) => s.pending);
  const sorted = useMemo(() => [...pending].sort((a, b) => b.addedAt - a.addedAt), [pending]);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await scanInbox();
      await retryErrors();
      await processQueue();
    } catch {
      // errors show on the cards
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Every time this tab is shown: pick up newly shared screenshots and process them.
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          await reloadPending();
          await scanInbox();
          await processQueue();
        } catch {
          // ignore - shown on the cards
        }
      })();
    }, []),
  );

  async function doImport() {
    try {
      const n = await importFromGallery();
      if (n > 0) {
        toast(n === 1 ? 'Added 1 screenshot' : 'Added ' + n + ' screenshots');
        void processQueue().catch(() => undefined);
      }
    } catch {
      Alert.alert("Couldn't open your gallery", 'Please try again.');
    }
  }

  function confirmRemove(shot: PendingShot) {
    Alert.alert('Remove from inbox?', "Removes the app's copy. Your gallery screenshot isn't touched.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void finishShot(shot.id) },
    ]);
  }

  const subtitle = sorted.length
    ? sorted.length === 1
      ? '1 screenshot to review'
      : sorted.length + ' screenshots to review'
    : undefined;

  return (
    <Screen>
      <FlatList
        data={sorted}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ paddingBottom: S[8] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accentText} colors={[c.accent]} />}
        ListHeaderComponent={
          <View>
            <LargeHeader
              title="Inbox"
              subtitle={subtitle}
              right={<IconButton name="images-outline" label="Import screenshots from gallery" onPress={doImport} tone="accent" />}
            />
            {!ocrReady() ? (
              <Banner tone="warn">
                <Txt variant="footnote" tone="warn">
                  Automatic text reading isn't available in this build, so every screenshot opens in manual mode. You can still tap the words yourself.
                </Txt>
              </Banner>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="file-tray-outline"
            title="Your inbox is empty"
            body="Screenshots you share to this app show up here, ready to review."
            action={<Button label="Import from gallery" icon="images-outline" kind="secondary" onPress={doImport} />}
          >
            <View style={{ alignSelf: 'stretch', marginTop: S[5] }}>
              <Step n={1} text="Take a screenshot of the comment or video." />
              <Step n={2} text={'Tap Share and choose "Anime Inbox". The app stays closed.'} />
              <Step n={3} text="Open the app later and approve what it found." />
            </View>
          </EmptyState>
        }
        renderItem={({ item }) => (
          <ShotCard
            shot={item}
            onPress={() => navigation.navigate('Review', { id: item.id })}
            onLongPress={() => confirmRemove(item)}
          />
        )}
      />
    </Screen>
  );
}
