import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Linking, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Entry } from '../types';
import { deleteEntry, deleteList, renameList, setSettings, updateEntry, useStore } from '../store';
import { cleanupThumb } from '../services/inbox';
import { ratingText } from '../services/lookup';
import { R, S, T, MIN_TOUCH, useColors } from '../theme';
import { Badge, BottomSheet, Button, Chip, EmptyState, IconButton, NavHeader, Poster, Row, Screen, Txt } from '../ui/kit';
import { AnimeNames, SearchField, metaLine } from '../ui/anime';
import { displayName } from '../services/match';
import { toast } from '../ui/toast';

function EntrySheet({ entryId, onClose }: { entryId: string | null; onClose: () => void }) {
  const c = useColors();
  const entry = useStore((s) => s.entries.find((e) => e.id === entryId));
  const lists = useStore((s) => s.lists);
  if (!entry) return <BottomSheet visible={false} onClose={onClose} title="" children={null} />;
  const a = entry.anime;
  const rating = entry.userRating;

  function setRating(r: number | null) {
    updateEntry(entry!.id, { userRating: r === null ? null : Math.max(0, Math.min(5, Math.round(r * 2) / 2)) });
  }

  function remove() {
    Alert.alert('Delete this anime?', displayName(a) + ' will be removed from your list.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const thumb = entry!.thumb;
          deleteEntry(entry!.id);
          await cleanupThumb(thumb);
          onClose();
        },
      },
    ]);
  }

  function move(listId: string) {
    updateEntry(entry!.id, { listId });
    toast('Moved');
  }

  return (
    <BottomSheet visible={!!entryId} onClose={onClose} title="Details">
      <View style={{ flexDirection: 'row' }}>
        <Poster url={a.posterUrl} width={84} />
        <View style={{ flex: 1, marginLeft: S[4] }}>
          <AnimeNames anime={a} lines={4} />
          <Txt variant="footnote" tone="dim" style={{ marginTop: S[1] }}>
            {[a.year ? String(a.year) : '', a.episodes ? a.episodes + ' episodes' : ''].filter(Boolean).join(' · ')}
          </Txt>
        </View>
      </View>

      <Txt variant="caption" tone="dim" style={{ marginTop: S[5], textTransform: 'uppercase', letterSpacing: 0.8 }}>
        Your rating
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: S[2] }}>
        <IconButton name="remove-circle-outline" label="Lower rating" onPress={() => setRating((rating === null ? 3 : rating) - 0.5)} tone="accent" />
        <View style={{ minWidth: 96, alignItems: 'center' }}>
          <Txt variant="title">{rating === null ? 'Not rated' : ratingText(rating)}</Txt>
        </View>
        <IconButton name="add-circle-outline" label="Raise rating" onPress={() => setRating((rating === null ? 3 : rating) + 0.5)} tone="accent" />
        {rating !== null ? (
          <View style={{ marginLeft: S[2] }}>
            <Button label="Clear" kind="ghost" onPress={() => setRating(null)} />
          </View>
        ) : null}
      </View>

      <Txt variant="caption" tone="dim" style={{ marginTop: S[4], textTransform: 'uppercase', letterSpacing: 0.8 }}>
        List
      </Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: S[2], marginHorizontal: -S[1] }}>
        {lists.map((l) => (
          <Chip key={l.id} label={l.name} selected={l.id === entry.listId} onPress={() => move(l.id)} />
        ))}
      </ScrollView>

      {entry.thumb ? (
        <View style={{ marginTop: S[4] }}>
          <Txt variant="caption" tone="dim" style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: S[2] }}>
            Where you found it
          </Txt>
          <Image source={{ uri: entry.thumb }} accessibilityIgnoresInvertColors style={{ width: 120, height: 180, borderRadius: R.md, backgroundColor: c.surfaceAlt }} resizeMode="cover" />
        </View>
      ) : null}

      <View style={{ marginTop: S[5] }}>
        <Button
          label="Open on MyAnimeList"
          icon="open-outline"
          kind="secondary"
          onPress={() => Linking.openURL('https://myanimelist.net/anime/' + a.malId)}
          style={{ marginBottom: S[2] }}
        />
        <Button label="Delete" icon="trash-outline" kind="danger" onPress={remove} />
      </View>
    </BottomSheet>
  );
}

export default function ListDetailScreen({ navigation, route }: any) {
  const c = useColors();
  const listId: string = route.params.listId;
  const list = useStore((s) => s.lists.find((l) => l.id === listId));
  const lists = useStore((s) => s.lists);
  const entries = useStore((s) => s.entries);
  const defaultListId = useStore((s) => s.settings.defaultListId);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [name, setName] = useState(list ? list.name : '');

  useEffect(() => {
    if (!list) navigation.goBack();
  }, [list]);
  useEffect(() => {
    if (list) setName(list.name);
  }, [list ? list.name : '']);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries
      .filter((e) => e.listId === listId)
      .filter((e) => {
        if (!needle) return true;
        const a = e.anime;
        return [a.title, a.titleEnglish || '', a.titleJapanese || '', a.genres.join(' ')].join(' ').toLowerCase().includes(needle);
      })
      .sort((a, b) => b.addedAt - a.addedAt);
  }, [entries, listId, q]);

  if (!list) return <Screen />;

  function confirmDelete() {
    const n = entries.filter((e) => e.listId === listId).length;
    Alert.alert(
      'Delete "' + list!.name + '"?',
      n ? 'The ' + n + ' anime in it will be removed too.' : 'This list is empty.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete list',
          style: 'destructive',
          onPress: () => {
            setMenu(false);
            deleteList(listId);
            navigation.goBack();
          },
        },
      ],
    );
  }

  const header = (
    <View>
      <View style={{ paddingHorizontal: S[4], paddingTop: S[1], paddingBottom: S[3] }}>
        <SearchField label="Search this list" value={q} onChangeText={setQ} placeholder="Search this list" />
      </View>
    </View>
  );

  return (
    <Screen>
      <NavHeader
        title={list.name}
        onBack={() => navigation.goBack()}
        right={
          <>
            <IconButton name="share-outline" label="Export this list" onPress={() => navigation.navigate('Export', { listId })} tone="accent" />
            <IconButton name="ellipsis-vertical" label="List options" onPress={() => setMenu(true)} />
          </>
        }
      />
      <FlatList
        data={items}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingBottom: S[8] }}
        ListHeaderComponent={entries.some((e) => e.listId === listId) ? header : null}
        ListEmptyComponent={
          entries.some((e) => e.listId === listId) ? (
            <EmptyState icon="search-outline" title="No matches" body="Try a different word." />
          ) : (
            <EmptyState
              icon="albums-outline"
              title="Nothing here yet"
              body="Approve anime from your inbox and they'll show up in this list."
              action={<Button label="Go to inbox" onPress={() => navigation.navigate('Tabs', { screen: 'Inbox' })} />}
            />
          )
        }
        renderItem={({ item }: { item: Entry }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={displayName(item.anime)}
            onPress={() => setOpenId(item.id)}
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
            <Poster url={item.anime.posterUrl} width={56} />
            <View style={{ flex: 1, marginLeft: S[3], justifyContent: 'center' }}>
              <AnimeNames anime={item.anime} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {item.userRating !== null ? <Badge label={'Your rating ' + ratingText(item.userRating)} tone="accent" icon="star" /> : null}
                {item.exportedAt !== null ? <Badge label="Exported" tone="neutral" icon="checkmark" /> : null}
              </View>
            </View>
          </Pressable>
        )}
      />

      <EntrySheet entryId={openId} onClose={() => setOpenId(null)} />

      <BottomSheet visible={menu} onClose={() => setMenu(false)} title="List options">
        <Txt variant="caption" tone="dim" style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: S[2] }}>
          Name
        </Txt>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, backgroundColor: c.surfaceAlt, borderRadius: R.md, paddingHorizontal: S[3], marginRight: S[2] }}>
            <TextInput
              accessibilityLabel="List name"
              value={name}
              onChangeText={setName}
              placeholderTextColor={c.textFaint}
              style={[T.body, { color: c.text, minHeight: MIN_TOUCH }]}
            />
          </View>
          <Button
            label="Save"
            kind="secondary"
            disabled={!name.trim() || name.trim() === list.name}
            onPress={() => {
              renameList(listId, name);
              toast('Renamed');
            }}
          />
        </View>
        <View style={{ marginTop: S[3], marginHorizontal: -S[5] }}>
          {defaultListId !== listId ? (
            <Row
              icon="star-outline"
              title="Make this the default list"
              subtitle="New anime are added here unless you pick another list"
              onPress={() => {
                setSettings({ defaultListId: listId });
                toast('Default list changed');
              }}
            />
          ) : (
            <Row icon="star" title="This is the default list" subtitle="New anime are added here" />
          )}
          {lists.length > 1 ? <Row icon="trash-outline" title="Delete this list" danger onPress={confirmDelete} /> : null}
        </View>
      </BottomSheet>
    </Screen>
  );
}
