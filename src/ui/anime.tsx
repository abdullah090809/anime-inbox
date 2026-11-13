// Anime-specific building blocks shared by several screens.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Anime } from '../types';
import { useStore } from '../store';
import { searchAnime } from '../services/jikan';
import { R, S, T, MIN_TOUCH, useColors } from '../theme';
import { BottomSheet, Button, Poster, Txt } from './kit';

export function metaLine(a: Anime): string {
  const parts: string[] = [];
  if (a.score !== null) parts.push('MAL ' + a.score.toFixed(1));
  if (a.genres.length) parts.push(a.genres.slice(0, 3).join(', '));
  if (a.year) parts.push(String(a.year));
  return parts.join('  ·  ');
}

export function AnimeNames({ anime, lines = 2 }: { anime: Anime; lines?: number }) {
  const main = anime.titleEnglish || anime.title;
  const alt = anime.titleJapanese && anime.titleJapanese !== main ? anime.titleJapanese : null;
  return (
    <View style={{ flex: 1 }}>
      <Txt variant="headline" numberOfLines={lines}>
        {main}
      </Txt>
      {alt ? (
        <Txt variant="footnote" tone="dim" numberOfLines={1} style={{ marginTop: 2 }}>
          {alt}
        </Txt>
      ) : null}
      {metaLine(anime) ? (
        <Txt variant="footnote" tone="dim" numberOfLines={2} style={{ marginTop: 2 }}>
          {metaLine(anime)}
        </Txt>
      ) : null}
    </View>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
  onSubmit,
  autoFocus,
  label,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  onSubmit?: () => void;
  autoFocus?: boolean;
  label: string;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: MIN_TOUCH,
        backgroundColor: c.surfaceAlt,
        borderRadius: R.md,
        paddingHorizontal: S[3],
      }}
    >
      <Ionicons name="search" size={18} color={c.textFaint} style={{ marginRight: S[2] }} />
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textFaint}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        autoFocus={autoFocus}
        autoCorrect={false}
        style={[T.body, { flex: 1, color: c.text, paddingVertical: S[2], minHeight: MIN_TOUCH - 4 }]}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear" onPress={() => onChangeText('')} hitSlop={10}>
          <Ionicons name="close-circle" size={20} color={c.textFaint} />
        </Pressable>
      ) : null}
    </View>
  );
}

// "Find anime": type or fix a name, search MyAnimeList, or open Google to look it up yourself.
export function FindSheet({
  visible,
  onClose,
  initialQuery,
  onPick,
  title = 'Find anime',
}: {
  visible: boolean;
  onClose: () => void;
  initialQuery: string;
  onPick: (a: Anime) => void;
  title?: string;
}) {
  const c = useColors();
  const adult = useStore((s) => s.settings.includeAdult);
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<Anime[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function run(text: string) {
    if (text.trim().length < 2) return;
    setLoading(true);
    setErr('');
    try {
      setResults(await searchAnime(text, { adult, limit: 8 }));
    } catch {
      setResults(null);
      setErr("Couldn't reach MyAnimeList. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (visible) {
      setQ(initialQuery);
      setResults(null);
      setErr('');
      if (initialQuery.trim().length > 1) void run(initialQuery);
    }
  }, [visible]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <SearchField
        label="Anime name"
        value={q}
        onChangeText={setQ}
        placeholder="Type or fix the name"
        onSubmit={() => run(q)}
        autoFocus={!initialQuery}
      />
      <View style={{ flexDirection: 'row', marginTop: S[3] }}>
        <Button label="Search" icon="search" onPress={() => run(q)} disabled={q.trim().length < 2} style={{ flex: 1, marginRight: S[2] }} />
        <Button
          label="Google"
          kind="secondary"
          icon="logo-google"
          onPress={() => Linking.openURL('https://www.google.com/search?q=' + encodeURIComponent(q.trim() + ' anime'))}
          disabled={q.trim().length < 2}
          style={{ flex: 1 }}
        />
      </View>
      <Txt variant="footnote" tone="dim" style={{ marginTop: S[2] }}>
        Not sure of the name? Google opens in your browser. Come back, fix the name above and search again.
      </Txt>

      <View style={{ marginTop: S[4] }}>
        {loading ? <ActivityIndicator color={c.accentText} style={{ marginVertical: S[5] }} /> : null}
        {err ? (
          <Txt variant="callout" tone="danger">
            {err}
          </Txt>
        ) : null}
        {results && !results.length && !loading ? (
          <Txt variant="callout" tone="dim">
            No results. Try fewer words, or look it up on Google.
          </Txt>
        ) : null}
        {(results || []).map((a) => (
          <Pressable
            key={a.malId}
            accessibilityRole="button"
            accessibilityLabel={'Pick ' + (a.titleEnglish || a.title)}
            onPress={() => onPick(a)}
            android_ripple={{ color: c.accentSoft }}
            style={{ flexDirection: 'row', paddingVertical: S[3], borderTopWidth: 1, borderTopColor: c.border }}
          >
            <Poster url={a.posterUrl} width={52} />
            <View style={{ flex: 1, marginLeft: S[3], justifyContent: 'center' }}>
              <AnimeNames anime={a} />
            </View>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}
