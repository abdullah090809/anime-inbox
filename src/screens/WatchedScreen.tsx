// Your own watched list: import a .txt file, match titles to MyAnimeList, fix the ones that did not match.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Anime, WatchedItem } from '../types';
import { patchWatched, useStore } from '../store';
import { importWatchedFile, matchWatched } from '../services/watched';
import { displayName } from '../services/match';
import { ratingText } from '../services/lookup';
import { R, S, useColors } from '../theme';
import { Badge, Button, Card, Chip, ChipRow, EmptyState, NavHeader, Screen, Txt } from '../ui/kit';
import { FindSheet, SearchField } from '../ui/anime';
import { toast } from '../ui/toast';

type Filter = 'all' | 'unmatched' | 'matched';

async function keepAwake(on: boolean) {
  try {
    const k = require('expo-keep-awake');
    if (on) await k.activateKeepAwakeAsync('watched-match');
    else await k.deactivateKeepAwake('watched-match');
  } catch {
    // optional
  }
}

export default function WatchedScreen({ navigation }: any) {
  const c = useColors();
  const watched = useStore((s) => s.watched);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');
  const [fixing, setFixing] = useState<WatchedItem | null>(null);
  const stop = useRef(false);

  useEffect(() => {
    return () => {
      stop.current = true;
      void keepAwake(false);
    };
  }, []);

  const counts = useMemo(() => {
    let matched = 0;
    let unmatched = 0;
    let todo = 0;
    for (const w of watched) {
      if (w.status === 'matched') matched++;
      else if (w.status === 'unmatched') unmatched++;
      else todo++;
    }
    return { matched, unmatched, todo };
  }, [watched]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return watched.filter((w) => {
      if (filter === 'matched' && w.status !== 'matched') return false;
      if (filter === 'unmatched' && w.status === 'matched') return false;
      if (!needle) return true;
      return w.name.toLowerCase().includes(needle) || (w.anime ? displayName(w.anime).toLowerCase().includes(needle) : false);
    });
  }, [watched, filter, q]);

  function startMatching() {
    if (running) return;
    stop.current = false;
    setError('');
    setRunning(true);
    void keepAwake(true);
    matchWatched(
      () => stop.current,
      (done, total) => setProgress({ done, total }),
    )
      .catch((e: any) => setError((e && e.message) || "Couldn't finish matching."))
      .finally(() => {
        setRunning(false);
        void keepAwake(false);
      });
  }

  async function doImport() {
    try {
      const sum = await importWatchedFile();
      if (!sum) return;
      const msg =
        sum.added + ' new, ' + sum.updated + ' rating' + (sum.updated === 1 ? '' : 's') + ' updated, ' + sum.same + ' already there.';
      if (sum.added > 0) {
        Alert.alert('Imported ' + sum.total + ' titles', msg + '\n\nMatch the new ones to MyAnimeList now? It takes about a second per title, so keep the screen on.', [
          { text: 'Later', style: 'cancel' },
          { text: 'Match now', onPress: startMatching },
        ]);
      } else {
        Alert.alert('Imported', msg);
      }
    } catch {
      Alert.alert("Couldn't read that file", 'Pick a .txt file with lines like "1. Name (4/5)".');
    }
  }

  function pickFix(a: Anime) {
    if (!fixing) return;
    patchWatched(fixing.id, { status: 'matched', malId: a.malId, anime: a });
    setFixing(null);
    toast('Matched');
  }

  const header = (
    <View>
      <View style={{ paddingHorizontal: S[4], paddingBottom: S[3] }}>
        <Card>
          <Txt variant="headline">
            {watched.length ? watched.length + ' titles' : 'No list imported yet'}
          </Txt>
          <Txt variant="footnote" tone="dim" style={{ marginTop: 2 }}>
            {watched.length
              ? counts.matched + ' matched · ' + counts.unmatched + ' need a look · ' + counts.todo + ' waiting'
              : 'Import a .txt file with lines like "1. Attack on Titan (4.5/5)".'}
          </Txt>
          {running ? (
            <View style={{ marginTop: S[3] }}>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
                <View
                  style={{
                    height: 8,
                    width: (progress.total ? Math.round((progress.done / progress.total) * 100) : 0) + '%',
                    backgroundColor: c.accent,
                  }}
                />
              </View>
              <Txt variant="footnote" tone="dim" style={{ marginTop: S[1] }}>
                {'Matching ' + progress.done + ' of ' + progress.total + '. Keep the app open.'}
              </Txt>
            </View>
          ) : null}
          {error ? (
            <Txt variant="footnote" tone="danger" style={{ marginTop: S[2] }}>
              {error}
            </Txt>
          ) : null}
          <View style={{ flexDirection: 'row', marginTop: S[4] }}>
            <Button label="Import .txt" icon="document-text-outline" kind="secondary" onPress={doImport} style={{ flex: 1, marginRight: S[2] }} disabled={running} />
            {running ? (
              <Button label="Stop" kind="danger" onPress={() => (stop.current = true)} style={{ flex: 1 }} />
            ) : counts.todo > 0 ? (
              <Button label={(progress.done ? 'Resume' : 'Match') + ' (' + counts.todo + ')'} icon="sync-outline" onPress={startMatching} style={{ flex: 1 }} />
            ) : null}
          </View>
          <Txt variant="footnote" tone="faint" style={{ marginTop: S[3] }}>
            Importing again later only adds new titles and updates changed ratings. Nothing is removed.
          </Txt>
        </Card>
      </View>
      {watched.length ? (
        <>
          <ChipRow>
            <Chip label={'All ' + watched.length} selected={filter === 'all'} onPress={() => setFilter('all')} />
            <Chip label={'Need a look ' + (counts.unmatched + counts.todo)} selected={filter === 'unmatched'} onPress={() => setFilter('unmatched')} />
            <Chip label={'Matched ' + counts.matched} selected={filter === 'matched'} onPress={() => setFilter('matched')} />
          </ChipRow>
          <View style={{ paddingHorizontal: S[4], paddingVertical: S[3] }}>
            <SearchField label="Search the watched list" value={q} onChangeText={setQ} placeholder="Search your watched list" />
          </View>
        </>
      ) : null}
    </View>
  );

  return (
    <Screen>
      <NavHeader title="Watched list" onBack={() => navigation.goBack()} />
      <FlatList
        data={shown}
        keyExtractor={(w) => w.id}
        contentContainerStyle={{ paddingBottom: S[8] }}
        ListHeaderComponent={header}
        ListEmptyComponent={
          watched.length ? (
            <EmptyState icon="search-outline" title="Nothing here" body="Try another filter or search." />
          ) : (
            <EmptyState
              icon="eye-outline"
              title="Know what you've watched"
              body={'When a screenshot names something on this list, the app warns you: "Watched · 4.5/5".'}
            />
          )
        }
        renderItem={({ item }) => {
          const needs = item.status !== 'matched';
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.name + (needs ? ', needs matching. Tap to fix.' : '')}
              disabled={!needs}
              onPress={() => setFixing(item)}
              android_ripple={{ color: c.accentSoft }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: c.surface,
                borderRadius: R.lg,
                borderWidth: 1,
                borderColor: c.border,
                padding: S[3],
                marginHorizontal: S[4],
                marginBottom: S[2],
                minHeight: 56,
              }}
            >
              <View style={{ flex: 1 }}>
                <Txt variant="body" numberOfLines={2}>
                  {item.name}
                </Txt>
                {item.anime && displayName(item.anime).toLowerCase() !== item.name.toLowerCase() ? (
                  <Txt variant="footnote" tone="dim" numberOfLines={1}>
                    {'MAL: ' + displayName(item.anime)}
                  </Txt>
                ) : null}
                {item.status === 'unmatched' ? <Badge label="Not matched – tap to fix" tone="warn" /> : null}
                {item.status === 'todo' ? <Badge label="Waiting to match" tone="neutral" /> : null}
              </View>
              {item.rating !== null ? (
                <Txt variant="callout" tone="accent" style={{ fontWeight: '600', marginLeft: S[2] }}>
                  {ratingText(item.rating)}
                </Txt>
              ) : null}
              {needs ? <Ionicons name="chevron-forward" size={18} color={c.textFaint} style={{ marginLeft: S[2] }} /> : null}
            </Pressable>
          );
        }}
      />
      <FindSheet
        visible={!!fixing}
        onClose={() => setFixing(null)}
        initialQuery={fixing ? fixing.name : ''}
        onPick={pickFix}
        title="Match this title"
      />
    </Screen>
  );
}
