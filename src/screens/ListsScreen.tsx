import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, TextInput, View } from 'react-native';
import { addList, useStore } from '../store';
import { R, S, T, MIN_TOUCH, useColors } from '../theme';
import { BottomSheet, Badge, Button, Card, Divider, IconButton, LargeHeader, Row, Screen, SectionTitle, Txt } from '../ui/kit';

export default function ListsScreen({ navigation }: any) {
  const c = useColors();
  const lists = useStore((s) => s.lists);
  const entries = useStore((s) => s.entries);
  const watched = useStore((s) => s.watched);
  const defaultListId = useStore((s) => s.settings.defaultListId);
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState('');

  const counts = useMemo(() => {
    const m = new Map<string, { total: number; fresh: number }>();
    for (const e of entries) {
      const cur = m.get(e.listId) || { total: 0, fresh: 0 };
      cur.total++;
      if (e.exportedAt === null) cur.fresh++;
      m.set(e.listId, cur);
    }
    return m;
  }, [entries]);

  const matched = watched.filter((w) => w.status === 'matched').length;
  const todo = watched.filter((w) => w.status === 'todo').length;

  function create() {
    const n = name.trim();
    if (!n) return;
    if (lists.some((l) => l.name.toLowerCase() === n.toLowerCase())) {
      Alert.alert('That list already exists', 'Pick a different name.');
      return;
    }
    addList(n);
    setName('');
    setNewOpen(false);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: S[8] }}>
        <LargeHeader
          title="Lists"
          right={<IconButton name="add" label="New list" onPress={() => setNewOpen(true)} tone="accent" />}
        />

        <SectionTitle>Your lists</SectionTitle>
        <Card style={{ marginHorizontal: S[4], padding: 0, overflow: 'hidden' }}>
          {lists.map((l, i) => {
            const cnt = counts.get(l.id) || { total: 0, fresh: 0 };
            return (
              <View key={l.id}>
                {i > 0 ? <Divider /> : null}
                <Row
                  icon="albums-outline"
                  title={l.name}
                  subtitle={
                    cnt.total === 0
                      ? 'Empty'
                      : cnt.total + (cnt.total === 1 ? ' anime' : ' anime') + (cnt.fresh ? ' · ' + cnt.fresh + ' not exported' : '')
                  }
                  right={
                    l.id === defaultListId ? <Badge label="Default" tone="accent" /> : undefined
                  }
                  onPress={() => navigation.navigate('ListDetail', { listId: l.id })}
                />
              </View>
            );
          })}
        </Card>

        <SectionTitle>Watched</SectionTitle>
        <Card style={{ marginHorizontal: S[4], padding: 0, overflow: 'hidden' }}>
          <Row
            icon="eye-outline"
            title="Watched list"
            subtitle={
              watched.length === 0
                ? 'Import your own list to get "you already watched this" warnings'
                : matched + ' of ' + watched.length + ' matched' + (todo ? ' · ' + todo + ' waiting' : '')
            }
            onPress={() => navigation.navigate('Watched')}
          />
        </Card>

        <View style={{ marginHorizontal: S[4], marginTop: S[5] }}>
          <Button label="Export to notepad" icon="share-outline" kind="secondary" onPress={() => navigation.navigate('Export')} />
        </View>
      </ScrollView>

      <BottomSheet visible={newOpen} onClose={() => setNewOpen(false)} title="New list">
        <View style={{ backgroundColor: c.surfaceAlt, borderRadius: R.md, paddingHorizontal: S[3] }}>
          <TextInput
            accessibilityLabel="List name"
            value={name}
            onChangeText={setName}
            placeholder="For example: Favourites"
            placeholderTextColor={c.textFaint}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={create}
            style={[T.body, { color: c.text, minHeight: MIN_TOUCH }]}
          />
        </View>
        <View style={{ marginTop: S[3] }}>
          <Button label="Create list" onPress={create} disabled={!name.trim()} />
        </View>
        <Txt variant="footnote" tone="dim" style={{ marginTop: S[3] }}>
          You can rename or delete a list later from its menu.
        </Txt>
      </BottomSheet>
    </Screen>
  );
}
