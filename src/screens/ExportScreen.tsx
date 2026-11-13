// Export: choose what to export, what to include, and copy it or share it as a .txt file for the notepad app.
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, Switch, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import type { ExportOptions } from '../types';
import { markExported, setSettings, useStore } from '../store';
import { formatEntries } from '../services/exporter';
import { CACHE, writeText } from '../services/files';
import { displayName } from '../services/match';
import { R, S, T, MIN_TOUCH, useColors } from '../theme';
import { Button, Card, Checkbox, Chip, ChipRow, NavHeader, Screen, SectionTitle, SwitchRow, Txt } from '../ui/kit';
import { toast } from '../ui/toast';

export default function ExportScreen({ navigation, route }: any) {
  const c = useColors();
  const lists = useStore((s) => s.lists);
  const entries = useStore((s) => s.entries);
  const opts = useStore((s) => s.settings.export);
  const [scope, setScope] = useState<string>((route.params && route.params.listId) || 'all');
  const [onlyNew, setOnlyNew] = useState(false);
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});
  const [startText, setStartText] = useState(String(opts.startAt));

  const visible = useMemo(
    () =>
      entries
        .filter((e) => (scope === 'all' || e.listId === scope) && (!onlyNew || e.exportedAt === null))
        .sort((a, b) => a.addedAt - b.addedAt),
    [entries, scope, onlyNew],
  );
  const chosen = useMemo(() => visible.filter((e) => !excluded[e.id]), [visible, excluded]);
  const text = useMemo(
    () => formatEntries(chosen.map((e) => ({ anime: e.anime, userRating: e.userRating })), opts),
    [chosen, opts],
  );

  const set = (patch: Partial<ExportOptions>) => setSettings({ export: { ...opts, ...patch } });

  function askMark(label: string) {
    if (!chosen.length) return;
    Alert.alert(label, 'Mark these ' + chosen.length + ' as exported? Next time you can show only the ones not exported yet.', [
      { text: 'Not now', style: 'cancel' },
      { text: 'Mark as exported', onPress: () => markExported(chosen.map((e) => e.id)) },
    ]);
  }

  async function copy() {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    toast('Copied ' + chosen.length + (chosen.length === 1 ? ' line' : ' lines'));
    askMark('Copied');
  }

  async function shareFile() {
    if (!text) return;
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Sharing isn't available on this phone");
        return;
      }
      const uri = CACHE + 'anime-list.txt';
      await writeText(uri, text + '\n');
      await Sharing.shareAsync(uri, { mimeType: 'text/plain', dialogTitle: 'Export anime list' });
      askMark('Shared');
    } catch {
      Alert.alert("Couldn't share the file", 'Please try again.');
    }
  }

  const sep = opts.separator;
  const fieldRows: { key: keyof ExportOptions; title: string; sub?: string }[] = [
    { key: 'english', title: 'English name', sub: 'Off = the original (romaji) title' },
    { key: 'japanese', title: 'Japanese name' },
    { key: 'rating', title: 'Rating', sub: 'Your rating, or the MAL score if you haven’t rated it' },
    { key: 'genres', title: 'Genres' },
    { key: 'year', title: 'Year' },
    { key: 'episodes', title: 'Episodes' },
    { key: 'link', title: 'MyAnimeList link' },
  ];

  return (
    <Screen>
      <NavHeader title="Export to notepad" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
        <SectionTitle>What to export</SectionTitle>
        <ChipRow>
          <Chip label="All lists" selected={scope === 'all'} onPress={() => { setScope('all'); setExcluded({}); }} />
          {lists.map((l) => (
            <Chip key={l.id} label={l.name} selected={scope === l.id} onPress={() => { setScope(l.id); setExcluded({}); }} />
          ))}
        </ChipRow>
        <Card style={{ marginHorizontal: S[4], marginTop: S[2], padding: 0, overflow: 'hidden' }}>
          <SwitchRow icon="funnel-outline" title="Only not exported yet" value={onlyNew} onValueChange={(v) => { setOnlyNew(v); setExcluded({}); }} />
        </Card>

        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S[4], paddingTop: S[4] }}>
          <Txt variant="callout" tone="dim" style={{ flex: 1 }}>
            {chosen.length + ' of ' + visible.length + ' selected'}
          </Txt>
          <Button label="All" kind="ghost" onPress={() => setExcluded({})} />
          <Button
            label="None"
            kind="ghost"
            onPress={() => {
              const ex: Record<string, boolean> = {};
              visible.forEach((e) => (ex[e.id] = true));
              setExcluded(ex);
            }}
          />
        </View>
        <Card style={{ marginHorizontal: S[4], padding: 0, maxHeight: 300, overflow: 'hidden' }}>
          {visible.length === 0 ? (
            <View style={{ padding: S[4] }}>
              <Txt variant="callout" tone="dim">
                Nothing to export here.
              </Txt>
            </View>
          ) : (
            <ScrollView nestedScrollEnabled>
              {visible.map((e) => (
                <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', paddingRight: S[3] }}>
                  <Checkbox
                    checked={!excluded[e.id]}
                    label={displayName(e.anime)}
                    onPress={() => setExcluded((p) => ({ ...p, [e.id]: !p[e.id] }))}
                  />
                  <Txt variant="callout" numberOfLines={1} style={{ flex: 1 }}>
                    {displayName(e.anime)}
                  </Txt>
                  {e.exportedAt !== null ? (
                    <Txt variant="caption" tone="faint">
                      exported
                    </Txt>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          )}
        </Card>

        <SectionTitle>What to include</SectionTitle>
        <Card style={{ marginHorizontal: S[4], padding: 0, overflow: 'hidden' }}>
          {fieldRows.map((f) => (
            <SwitchRow
              key={f.key}
              title={f.title}
              subtitle={f.sub}
              value={!!opts[f.key]}
              onValueChange={(v) => set({ [f.key]: v } as Partial<ExportOptions>)}
            />
          ))}
        </Card>

        <SectionTitle>Layout</SectionTitle>
        <Card style={{ marginHorizontal: S[4], padding: 0, overflow: 'hidden' }}>
          <SwitchRow title="Numbered lines" value={opts.numbered} onValueChange={(v) => set({ numbered: v })} />
          {opts.numbered ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S[4], paddingBottom: S[3] }}>
              <Txt variant="body" style={{ flex: 1 }}>
                Start numbering at
              </Txt>
              <View style={{ width: 96, backgroundColor: c.surfaceAlt, borderRadius: R.md, paddingHorizontal: S[3] }}>
                <TextInput
                  accessibilityLabel="Start numbering at"
                  value={startText}
                  onChangeText={(v) => {
                    const clean = v.replace(/[^0-9]/g, '');
                    setStartText(clean);
                    const n = parseInt(clean, 10);
                    set({ startAt: isNaN(n) ? 1 : n });
                  }}
                  keyboardType="number-pad"
                  style={[T.body, { color: c.text, minHeight: MIN_TOUCH, textAlign: 'center' }]}
                />
              </View>
            </View>
          ) : null}
          <View style={{ paddingHorizontal: S[4], paddingBottom: S[3] }}>
            <Txt variant="body" style={{ marginBottom: S[2] }}>
              Separator before genres and extras
            </Txt>
            <View style={{ flexDirection: 'row' }}>
              {[
                { label: 'Dash  –', v: ' – ' },
                { label: 'Pipe  |', v: ' | ' },
                { label: 'Comma  ,', v: ', ' },
              ].map((o) => (
                <Chip key={o.v} label={o.label} selected={sep === o.v} onPress={() => set({ separator: o.v })} />
              ))}
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S[4], paddingBottom: S[3] }}>
            <Txt variant="body" style={{ flex: 1 }}>
              Most genres to show
            </Txt>
            <Chip label="All" selected={opts.maxGenres === 0} onPress={() => set({ maxGenres: 0 })} />
            <Chip label="2" selected={opts.maxGenres === 2} onPress={() => set({ maxGenres: 2 })} />
            <Chip label="3" selected={opts.maxGenres === 3} onPress={() => set({ maxGenres: 3 })} />
          </View>
        </Card>

        <SectionTitle>Preview</SectionTitle>
        <Card style={{ marginHorizontal: S[4] }}>
          {text ? (
            <Txt
              selectable
              variant="callout"
              style={{ fontFamily: 'monospace', lineHeight: 22 }}
              accessibilityLabel="Export preview"
            >
              {text}
            </Txt>
          ) : (
            <Txt variant="callout" tone="dim">
              Select some anime to see the preview.
            </Txt>
          )}
        </Card>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: c.surface,
          borderTopWidth: 1,
          borderTopColor: c.border,
          padding: S[3],
          flexDirection: 'row',
        }}
      >
        <Button label="Copy" icon="copy-outline" onPress={copy} disabled={!chosen.length} style={{ flex: 1, marginRight: S[2] }} />
        <Button label="Share .txt" icon="document-text-outline" kind="secondary" onPress={shareFile} disabled={!chosen.length} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}
