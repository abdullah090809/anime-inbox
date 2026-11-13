import React, { useState } from 'react';
import { Alert, Linking, ScrollView, TextInput, View } from 'react-native';
import { resetAll, setSettings, useStore } from '../store';
import { applyToastSetting } from '../services/files';
import { sceneUsed } from '../services/inbox';
import { requestNotifyPermission } from '../services/notify';
import { syncBackgroundRegistration } from '../services/background';
import type { ThemeMode } from '../types';
import { R, S, T, MIN_TOUCH, useColors } from '../theme';
import { Button, Card, Chip, Divider, LargeHeader, Row, Screen, SectionTitle, SwitchRow, Txt } from '../ui/kit';
import { toast } from '../ui/toast';

export default function SettingsScreen({ navigation }: any) {
  const c = useColors();
  const s = useStore((st) => st.settings);
  const lists = useStore((st) => st.lists);
  const [key, setKey] = useState(s.traceKey);
  const used = sceneUsed();

  async function toggleNotify(on: boolean) {
    if (!on) {
      setSettings({ notifyOnReady: false });
      return;
    }
    // explain first, then ask Android
    Alert.alert(
      'Tell me when screenshots are ready?',
      'Android will ask for permission to show notifications. The app only notifies you when shared screenshots have been read and are waiting for your review.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Continue',
          onPress: async () => {
            const ok = await requestNotifyPermission();
            if (ok) setSettings({ notifyOnReady: true });
            else
              Alert.alert('Notifications are off', 'You can allow them in your phone settings, then turn this on again.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open settings', onPress: () => void Linking.openSettings() },
              ]);
          },
        },
      ],
    );
  }

  function toggleBackground(on: boolean) {
    setSettings({ backgroundProcessing: on });
    void syncBackgroundRegistration(on);
  }

  function toggleToast(on: boolean) {
    setSettings({ toastOnShare: on });
    void applyToastSetting(on);
  }

  function confirmReset() {
    Alert.alert(
      'Delete all app data?',
      'This removes your lists, watched list, inbox and settings from this app. Your gallery is not touched. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            await resetAll();
            setKey('');
            toast('All app data deleted');
          },
        },
      ],
    );
  }

  const themes: { v: ThemeMode; label: string }[] = [
    { v: 'system', label: 'System' },
    { v: 'light', label: 'Light' },
    { v: 'dark', label: 'Dark' },
  ];

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: S[8] }} keyboardShouldPersistTaps="handled">
        <LargeHeader title="Settings" />

        <SectionTitle>Appearance</SectionTitle>
        <Card style={{ marginHorizontal: S[4] }}>
          <View style={{ flexDirection: 'row' }}>
            {themes.map((t) => (
              <Chip key={t.v} label={t.label} selected={s.theme === t.v} onPress={() => setSettings({ theme: t.v })} />
            ))}
          </View>
        </Card>

        <SectionTitle>Sharing</SectionTitle>
        <Card style={{ marginHorizontal: S[4], padding: 0, overflow: 'hidden' }}>
          <SwitchRow
            icon="chatbubble-ellipses-outline"
            title={'Show "Saved" message when I share'}
            subtitle="A short message at the bottom of the screen"
            value={s.toastOnShare}
            onValueChange={toggleToast}
          />
          <Divider />
          <SwitchRow
            icon="image-outline"
            title="Keep a small thumbnail"
            subtitle="Saved with each anime so you remember where you found it"
            value={s.keepThumbnails}
            onValueChange={(v) => setSettings({ keepThumbnails: v })}
          />
        </Card>

        <SectionTitle>Identifying</SectionTitle>
        <Card style={{ marginHorizontal: S[4], padding: 0, overflow: 'hidden' }}>
          <SwitchRow
            icon="film-outline"
            title="Try the scene if no name is found"
            subtitle="Sends the screenshot picture to trace.moe as a last resort"
            value={s.autoScene}
            onValueChange={(v) => setSettings({ autoScene: v })}
          />
          <Divider />
          <SwitchRow
            icon="warning-outline"
            title="Include adult titles"
            subtitle="Off by default in search results"
            value={s.includeAdult}
            onValueChange={(v) => setSettings({ includeAdult: v })}
          />
          <Divider />
          <View style={{ padding: S[4] }}>
            <Txt variant="body">trace.moe API key (optional)</Txt>
            <Txt variant="footnote" tone="dim" style={{ marginTop: 2 }}>
              {'Scene searches used this month: ' + used + '. The free limit is small (about 100 a month), so add your own key if you use scene search a lot.'}
            </Txt>
            <View style={{ backgroundColor: c.surfaceAlt, borderRadius: R.md, paddingHorizontal: S[3], marginTop: S[3] }}>
              <TextInput
                accessibilityLabel="trace.moe API key"
                value={key}
                onChangeText={setKey}
                onEndEditing={() => setSettings({ traceKey: key.trim() })}
                onBlur={() => setSettings({ traceKey: key.trim() })}
                placeholder="Paste key"
                placeholderTextColor={c.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
                style={[T.body, { color: c.text, minHeight: MIN_TOUCH }]}
              />
            </View>
          </View>
        </Card>

        <SectionTitle>Background</SectionTitle>
        <Card style={{ marginHorizontal: S[4], padding: 0, overflow: 'hidden' }}>
          <SwitchRow
            icon="sync-outline"
            title="Process shared screenshots in the background"
            subtitle="Android decides when: about every 15 minutes at best. Anything left is processed when you open the app."
            value={s.backgroundProcessing}
            onValueChange={toggleBackground}
          />
          <Divider />
          <SwitchRow
            icon="notifications-outline"
            title="Notify me when they are ready"
            subtitle="One notification per batch"
            value={s.notifyOnReady}
            onValueChange={toggleNotify}
          />
        </Card>

        <SectionTitle>Lists</SectionTitle>
        <Card style={{ marginHorizontal: S[4] }}>
          <Txt variant="body">Default list for new anime</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: S[3] }}>
            {lists.map((l) => (
              <View key={l.id} style={{ marginBottom: S[2] }}>
                <Chip label={l.name} selected={l.id === s.defaultListId} onPress={() => setSettings({ defaultListId: l.id })} />
              </View>
            ))}
          </View>
        </Card>
        <Card style={{ marginHorizontal: S[4], marginTop: S[3], padding: 0, overflow: 'hidden' }}>
          <Row icon="eye-outline" title="Watched list" subtitle="Import and match your own list" onPress={() => navigation.navigate('Watched')} />
        </Card>

        <SectionTitle>Data</SectionTitle>
        <Card style={{ marginHorizontal: S[4], padding: 0, overflow: 'hidden' }}>
          <Row icon="trash-outline" title="Delete all app data" subtitle="Your gallery is not touched" danger onPress={confirmReset} />
        </Card>

        <View style={{ paddingHorizontal: S[5], paddingTop: S[5] }}>
          <Txt variant="footnote" tone="faint" style={{ textAlign: 'center' }}>
            Anime Inbox 1.0. Anime details from MyAnimeList (through Jikan). Scene search by trace.moe. Text is read on your phone.
          </Txt>
        </View>
      </ScrollView>
    </Screen>
  );
}
