// Review one screenshot: confirm what the app found, pick text yourself, or identify the scene.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import type { Anime, Candidate, OcrLine } from '../types';
import { addList, putPending, useStore } from '../store';
import { approveShot, finishShot, ocrReady, runScene, sceneUsed } from '../services/inbox';
import { SceneQuotaError } from '../services/tracemoe';
import { imageSize } from '../services/ocr';
import { entryKey, findWatched, indexEntries, indexWatched, ratingText } from '../services/lookup';
import { R, S, T, MIN_TOUCH, useColors } from '../theme';
import { Badge, BottomSheet, Button, Card, Checkbox, Chip, IconButton, NavHeader, Poster, Screen, Txt } from '../ui/kit';
import { AnimeNames, FindSheet } from '../ui/anime';
import { toast } from '../ui/toast';

type Mode = 'results' | 'text' | 'scene';
type Layout = { x: number; y: number; w: number; h: number; scale: number };
type Rect = { x: number; y: number; w: number; h: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ---------- the screenshot, with overlays on top ----------

function ImageStage({
  uri,
  iw,
  ih,
  height,
  children,
}: {
  uri: string;
  iw: number;
  ih: number;
  height: number;
  children?: (l: Layout) => React.ReactNode;
}) {
  const c = useColors();
  const [boxW, setBoxW] = useState(0);
  const layout = useMemo<Layout | null>(() => {
    if (!boxW || !iw || !ih) return null;
    const scale = Math.min(boxW / iw, height / ih);
    const w = iw * scale;
    const h = ih * scale;
    return { x: (boxW - w) / 2, y: (height - h) / 2, w, h, scale };
  }, [boxW, iw, ih, height]);
  return (
    <View
      onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}
      style={{ height, backgroundColor: c.isDark ? '#08090B' : '#E6E3EC' }}
    >
      <Image
        source={{ uri }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
        accessibilityLabel="The screenshot"
        style={StyleSheet.absoluteFillObject}
      />
      {layout && children ? children(layout) : null}
    </View>
  );
}

function TextOverlay({
  layout,
  lines,
  picked,
  onToggle,
}: {
  layout: Layout;
  lines: OcrLine[];
  picked: number[];
  onToggle: (i: number) => void;
}) {
  const c = useColors();
  return (
    <>
      {lines.map((l, i) => {
        const on = picked.includes(i);
        return (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={'Text: ' + l.text}
            accessibilityState={{ selected: on }}
            onPress={() => onToggle(i)}
            hitSlop={4}
            style={{
              position: 'absolute',
              left: layout.x + l.x * layout.scale - 2,
              top: layout.y + l.y * layout.scale - 2,
              width: l.w * layout.scale + 4,
              height: l.h * layout.scale + 4,
              borderWidth: 1.5,
              borderRadius: 4,
              borderColor: on ? c.accentText : 'rgba(255,255,255,0.75)',
              backgroundColor: on ? 'rgba(255,107,150,0.40)' : 'rgba(255,255,255,0.12)',
            }}
          />
        );
      })}
    </>
  );
}

function CropOverlay({
  layout,
  rect,
  onChange,
  onActive,
}: {
  layout: Layout;
  rect: Rect;
  onChange: (r: Rect) => void;
  onActive: (active: boolean) => void;
}) {
  const c = useColors();
  const rectRef = useRef(rect);
  rectRef.current = rect;
  const layRef = useRef(layout);
  layRef.current = layout;
  const cb = useRef({ onChange, onActive });
  cb.current = { onChange, onActive };
  const start = useRef<Rect>(rect);

  const move = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          start.current = rectRef.current;
          cb.current.onActive(true);
        },
        onPanResponderMove: (_e, g) => {
          const s = start.current;
          const L = layRef.current;
          cb.current.onChange({
            ...s,
            x: clamp(s.x + g.dx / L.w, 0, 1 - s.w),
            y: clamp(s.y + g.dy / L.h, 0, 1 - s.h),
          });
        },
        onPanResponderRelease: () => cb.current.onActive(false),
        onPanResponderTerminate: () => cb.current.onActive(false),
      }),
    [],
  );

  const resize = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          start.current = rectRef.current;
          cb.current.onActive(true);
        },
        onPanResponderMove: (_e, g) => {
          const s = start.current;
          const L = layRef.current;
          cb.current.onChange({
            ...s,
            w: clamp(s.w + g.dx / L.w, 0.12, 1 - s.x),
            h: clamp(s.h + g.dy / L.h, 0.08, 1 - s.y),
          });
        },
        onPanResponderRelease: () => cb.current.onActive(false),
        onPanResponderTerminate: () => cb.current.onActive(false),
      }),
    [],
  );

  return (
    <View
      {...move.panHandlers}
      accessibilityLabel="Scene selection box. Drag to move."
      style={{
        position: 'absolute',
        left: layout.x + rect.x * layout.w,
        top: layout.y + rect.y * layout.h,
        width: rect.w * layout.w,
        height: rect.h * layout.h,
        borderWidth: 2,
        borderColor: c.accentText,
        backgroundColor: 'rgba(255,107,150,0.14)',
        borderRadius: 4,
      }}
    >
      <View
        {...resize.panHandlers}
        accessibilityLabel="Resize handle"
        hitSlop={{ top: 14, left: 14, bottom: 14, right: 14 }}
        style={{
          position: 'absolute',
          right: -14,
          bottom: -14,
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: c.accent,
          borderWidth: 2,
          borderColor: '#FFFFFF',
        }}
      />
    </View>
  );
}

// ---------- small pieces ----------

function Segmented({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  const c = useColors();
  const opts: { key: Mode; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { key: 'results', label: 'Results', icon: 'sparkles-outline' },
    { key: 'text', label: 'Pick text', icon: 'text-outline' },
    { key: 'scene', label: 'Scene', icon: 'film-outline' },
  ];
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', backgroundColor: c.surfaceAlt, borderRadius: R.lg - 2, padding: 4, marginHorizontal: S[4], marginVertical: S[3] }}
    >
      {opts.map((o) => {
        const on = value === o.key;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: R.md,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              backgroundColor: on ? c.surface : 'transparent',
            }}
          >
            <Ionicons name={o.icon} size={16} color={on ? c.accentText : c.textDim} style={{ marginRight: 6 }} />
            <Txt variant="callout" tone={on ? 'accent' : 'dim'} style={{ fontWeight: '600' }}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

function CandidateCard({
  cand,
  checked,
  onToggle,
  inListName,
  watchedText,
}: {
  cand: Candidate;
  checked: boolean;
  onToggle: () => void;
  inListName: string | null;
  watchedText: string | null;
}) {
  const c = useColors();
  const pct = Math.round(cand.confidence * 100);
  const strong = cand.confidence >= 0.8;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={cand.anime.titleEnglish || cand.anime.title}
      onPress={onToggle}
      android_ripple={{ color: c.accentSoft }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.surface,
        borderRadius: R.lg,
        borderWidth: checked ? 2 : 1,
        borderColor: checked ? c.accent : c.border,
        paddingVertical: S[2],
        paddingRight: S[3],
        marginHorizontal: S[4],
        marginBottom: S[3],
        overflow: 'hidden',
      }}
    >
      <Checkbox checked={checked} onPress={onToggle} label={'Select ' + (cand.anime.titleEnglish || cand.anime.title)} />
      <Poster url={cand.anime.posterUrl} width={56} />
      <View style={{ flex: 1, marginLeft: S[3] }}>
        <AnimeNames anime={cand.anime} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cand.source === 'scene' ? (
            <Badge label={'Scene match ' + pct + '%'} tone={strong ? 'success' : 'warn'} icon="film-outline" />
          ) : cand.source === 'search' ? (
            <Badge label="You picked this" tone="accent" icon="search" />
          ) : (
            <Badge label={strong ? 'Strong text match' : 'Possible match'} tone={strong ? 'success' : 'warn'} />
          )}
          {inListName ? <Badge label={'Already in ' + inListName} tone="warn" icon="alert-circle-outline" /> : null}
          {watchedText ? <Badge label={watchedText} tone="accent" icon="eye-outline" /> : null}
        </View>
      </View>
    </Pressable>
  );
}

// ---------- the screen ----------

export default function ReviewScreen({ navigation, route }: any) {
  const id: string = route.params.id;
  const c = useColors();
  const win = useWindowDimensions();
  const shot = useStore((s) => s.pending.find((p) => p.id === id));
  const lists = useStore((s) => s.lists);
  const entries = useStore((s) => s.entries);
  const watched = useStore((s) => s.watched);
  const defaultListId = useStore((s) => s.settings.defaultListId);
  useStore((s) => s.settings.traceUsage); // re-render when the scene counter changes

  const [mode, setMode] = useState<Mode>('results');
  const [listId, setListId] = useState(defaultListId);
  const [sel, setSel] = useState<Record<number, boolean>>({});
  const [pickedIdx, setPickedIdx] = useState<number[]>([]);
  const [pickedText, setPickedText] = useState('');
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [listsOpen, setListsOpen] = useState(false);
  const [newList, setNewList] = useState('');
  const [rect, setRect] = useState<Rect>({ x: 0, y: 0, w: 1, h: 1 });
  const [dragging, setDragging] = useState(false);
  const [sceneBusy, setSceneBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const leaving = useRef(false);

  // image size (OCR fills it in; otherwise ask the image itself)
  useEffect(() => {
    if (!shot) return;
    if (shot.width && shot.height) {
      setDims({ w: shot.width, h: shot.height });
    } else {
      imageSize(shot.uri)
        .then((s) => setDims({ w: s.width, h: s.height }))
        .catch(() => undefined);
    }
  }, [shot ? shot.uri : '', shot ? shot.width : 0, shot ? shot.height : 0]);

  // pre-tick what the app is confident about; keep the person's own choices
  useEffect(() => {
    if (!shot) return;
    setSel((prev) => {
      const next = { ...prev };
      for (const cd of shot.candidates) if (!(cd.malId in next)) next[cd.malId] = cd.selected;
      return next;
    });
  }, [shot ? shot.candidates : null]);

  // screenshot removed elsewhere
  useEffect(() => {
    if (!shot && !leaving.current) navigation.goBack();
  }, [shot]);

  const entryIdx = useMemo(() => indexEntries(entries), [entries]);
  const watchedIdx = useMemo(() => indexWatched(watched), [watched]);
  const listName = (lists.find((l) => l.id === listId) || lists[0] || { name: 'list' }).name;

  if (!shot) return <Screen />;

  const candidates = shot.candidates;
  const chosen = candidates.filter((cd) => sel[cd.malId]);
  const addable = chosen.filter((cd) => !entryIdx.has(entryKey(listId, cd.malId)));
  const working = shot.status === 'queued' || shot.status === 'processing';
  const natural = dims.w ? (win.width * dims.h) / dims.w : 420;
  const stageHeight =
    mode === 'text' ? Math.max(260, natural) : mode === 'scene' ? Math.min(natural, win.height * 0.55) : Math.min(natural, win.height * 0.3);

  function toggleLine(i: number) {
    const next = pickedIdx.includes(i) ? pickedIdx.filter((x) => x !== i) : [...pickedIdx, i];
    setPickedIdx(next);
    const text = next
      .map((k) => shot!.lines[k])
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((l) => l.text)
      .join(' ');
    setPickedText(text);
  }

  function openFind(q: string) {
    setFindQuery(q);
    setFindOpen(true);
  }

  async function pickFromSearch(a: Anime) {
    const exists = shot!.candidates.some((x) => x.malId === a.malId);
    const cands: Candidate[] = exists
      ? shot!.candidates.map((x) => (x.malId === a.malId ? { ...x, selected: true } : x))
      : [...shot!.candidates, { malId: a.malId, anime: a, confidence: 1, source: 'search', selected: true }];
    await putPending({ ...shot!, candidates: cands, status: 'ready' });
    setSel((p) => ({ ...p, [a.malId]: true }));
    setFindOpen(false);
    setMode('results');
    toast('Added to the results');
  }

  async function approve() {
    setSaving(true);
    try {
      leaving.current = true;
      const r = await approveShot(id, listId, chosen);
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // haptics are optional
      }
      toast(
        r.added
          ? 'Added ' + r.added + ' to ' + listName + (r.skipped ? ' (' + r.skipped + ' already there)' : '')
          : 'Already in ' + listName,
      );
      navigation.goBack();
    } catch {
      leaving.current = false;
      setSaving(false);
      Alert.alert("Couldn't save", 'Please try again.');
    }
  }

  function notAnime() {
    Alert.alert('Not anime?', "This removes the app's copy of the screenshot. Your gallery screenshot isn't touched.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          leaving.current = true;
          await finishShot(id);
          navigation.goBack();
        },
      },
    ]);
  }

  async function shareShot() {
    try {
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(shot!.uri, { mimeType: 'image/*' });
    } catch {
      Alert.alert("Couldn't share the screenshot");
    }
  }

  async function doScene() {
    setSceneBusy(true);
    try {
      const whole = rect.w > 0.98 && rect.h > 0.98;
      const r = await runScene(id, whole ? undefined : rect);
      if (r.added > 0) {
        toast(r.added === 1 ? 'Found 1 scene match' : 'Found ' + r.added + ' scene matches');
        setMode('results');
      } else {
        Alert.alert('No scene match', 'Nothing matched well. Try a tighter box around the video, or pick the name from the text.');
      }
    } catch (e: any) {
      if (e instanceof SceneQuotaError) {
        Alert.alert(
          'Scene search limit reached',
          'The free monthly limit is used up. You can add your own trace.moe key in Settings, or pick the name from the text.',
        );
      } else {
        Alert.alert("Couldn't search the scene", (e && e.message) || 'Check your connection and try again.');
      }
    } finally {
      setSceneBusy(false);
    }
  }

  const presets: { label: string; r: Rect }[] = [
    { label: 'Whole image', r: { x: 0, y: 0, w: 1, h: 1 } },
    { label: 'Top half', r: { x: 0, y: 0.04, w: 1, h: 0.46 } },
    { label: 'Middle', r: { x: 0.05, y: 0.25, w: 0.9, h: 0.5 } },
  ];

  const addLabel = saving
    ? 'Saving…'
    : chosen.length === 0
      ? 'Select an anime to add'
      : addable.length === 0
        ? 'Already in ' + listName
        : 'Add ' + addable.length + ' to ' + listName;

  return (
    <Screen>
      <NavHeader
        title="Review"
        onBack={() => navigation.goBack()}
        right={
          <>
            <IconButton name="share-outline" label="Share or save this screenshot" onPress={shareShot} />
            <IconButton name="trash-outline" label="Not anime, remove" onPress={notAnime} tone="danger" />
          </>
        }
      />

      <ScrollView
        scrollEnabled={!dragging}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 150 }}
      >
        <Segmented value={mode} onChange={setMode} />

        {/* ---- Pick text: the editable box comes first so it stays visible ---- */}
        {mode === 'text' ? (
          <View style={{ marginHorizontal: S[4], marginBottom: S[3] }}>
            <Txt variant="footnote" tone="dim" style={{ marginBottom: S[2] }}>
              {shot.lines.length
                ? 'Tap the words that are the anime name. You can edit the text, then search.'
                : ocrReady()
                  ? 'No text was found in this screenshot. Type the name below.'
                  : 'Text reading is not available in this build. Type the name below.'}
            </Txt>
            <View style={{ backgroundColor: c.surfaceAlt, borderRadius: R.md, paddingHorizontal: S[3] }}>
              <TextInput
                accessibilityLabel="Anime name"
                value={pickedText}
                onChangeText={setPickedText}
                placeholder="Anime name"
                placeholderTextColor={c.textFaint}
                autoCorrect={false}
                style={[T.body, { color: c.text, minHeight: MIN_TOUCH, paddingVertical: S[2] }]}
              />
            </View>
            <View style={{ flexDirection: 'row', marginTop: S[2] }}>
              <Button
                label="Search"
                icon="search"
                onPress={() => openFind(pickedText)}
                disabled={pickedText.trim().length < 2}
                style={{ flex: 1, marginRight: S[2] }}
              />
              <Button
                label="Clear"
                kind="secondary"
                onPress={() => {
                  setPickedIdx([]);
                  setPickedText('');
                }}
                disabled={!pickedText && !pickedIdx.length}
              />
            </View>
          </View>
        ) : null}

        {/* ---- Scene: presets and the button ---- */}
        {mode === 'scene' ? (
          <View style={{ marginBottom: S[3] }}>
            <Txt variant="footnote" tone="dim" style={{ marginHorizontal: S[4], marginBottom: S[2] }}>
              Drag the box over the video part of the screenshot, then identify the scene. It is compared against an anime frame database, so it works best on clean scenes.
            </Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: S[4] }}>
              {presets.map((p) => (
                <Chip key={p.label} label={p.label} onPress={() => setRect(p.r)} />
              ))}
            </ScrollView>
            <View style={{ marginHorizontal: S[4], marginTop: S[3] }}>
              <Button label="Identify scene" icon="film-outline" onPress={doScene} loading={sceneBusy} />
              <Txt variant="footnote" tone="faint" style={{ marginTop: S[2] }}>
                {'The cropped picture is sent to trace.moe. Scene searches used this month: ' + sceneUsed() + '.'}
              </Txt>
            </View>
          </View>
        ) : null}

        <ImageStage uri={shot.uri} iw={dims.w} ih={dims.h} height={stageHeight}>
          {(layout) =>
            mode === 'text' ? (
              <TextOverlay layout={layout} lines={shot.lines} picked={pickedIdx} onToggle={toggleLine} />
            ) : mode === 'scene' ? (
              <CropOverlay layout={layout} rect={rect} onChange={setRect} onActive={setDragging} />
            ) : null
          }
        </ImageStage>

        {/* ---- Results ---- */}
        {mode === 'results' ? (
          <View style={{ paddingTop: S[4] }}>
            {working ? (
              <Card style={{ marginHorizontal: S[4], marginBottom: S[3], flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator color={c.accentText} style={{ marginRight: S[3] }} />
                <Txt variant="callout" tone="dim" style={{ flex: 1 }}>
                  {'Still reading this screenshot…'}
                </Txt>
              </Card>
            ) : null}

            {shot.status === 'error' && shot.error ? (
              <Card style={{ marginHorizontal: S[4], marginBottom: S[3] }}>
                <Txt variant="callout" tone="danger">
                  {shot.error}
                </Txt>
              </Card>
            ) : null}

            {candidates.map((cd) => {
              const inList = entryIdx.get(entryKey(listId, cd.malId));
              const w = findWatched(watchedIdx, cd.anime);
              return (
                <CandidateCard
                  key={cd.malId}
                  cand={cd}
                  checked={!!sel[cd.malId]}
                  onToggle={() => setSel((p) => ({ ...p, [cd.malId]: !p[cd.malId] }))}
                  inListName={inList ? listName : null}
                  watchedText={w ? 'Watched' + (w.rating !== null ? ' · ' + ratingText(w.rating) : '') : null}
                />
              );
            })}

            {!candidates.length && !working ? (
              <Card style={{ marginHorizontal: S[4], marginBottom: S[3] }}>
                <Txt variant="headline">No anime found yet</Txt>
                <Txt variant="callout" tone="dim" style={{ marginTop: S[1] }}>
                  {shot.ocrFailed
                    ? "The text in this screenshot couldn't be read automatically."
                    : "Nothing in the text matched an anime. The name may be in the video, or spelled differently."}
                </Txt>
                <View style={{ marginTop: S[4] }}>
                  <Button label="Pick text myself" icon="text-outline" kind="secondary" onPress={() => setMode('text')} style={{ marginBottom: S[2] }} />
                  <Button label="Identify the scene" icon="film-outline" kind="secondary" onPress={() => setMode('scene')} style={{ marginBottom: S[2] }} />
                  <Button label="Search by name" icon="search" kind="ghost" onPress={() => openFind('')} />
                </View>
              </Card>
            ) : null}

            {candidates.length > 0 ? (
              <View style={{ marginHorizontal: S[4] }}>
                <Button label="Search by name instead" icon="search" kind="ghost" onPress={() => openFind('')} />
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* ---- bottom bar ---- */}
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
          alignItems: 'center',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={'Save to list: ' + listName + '. Tap to change.'}
          onPress={() => setListsOpen(true)}
          style={{
            minHeight: MIN_TOUCH,
            maxWidth: '38%',
            borderRadius: R.lg - 2,
            backgroundColor: c.surfaceAlt,
            paddingHorizontal: S[3],
            flexDirection: 'row',
            alignItems: 'center',
            marginRight: S[2],
          }}
        >
          <Ionicons name="list" size={18} color={c.accentText} style={{ marginRight: 6 }} />
          <Txt variant="callout" numberOfLines={1} style={{ flexShrink: 1, fontWeight: '600' }}>
            {listName}
          </Txt>
        </Pressable>
        <Button
          label={addLabel}
          icon={saving ? undefined : 'add-circle-outline'}
          onPress={approve}
          disabled={saving || addable.length === 0}
          style={{ flex: 1 }}
        />
      </View>

      <FindSheet visible={findOpen} onClose={() => setFindOpen(false)} initialQuery={findQuery} onPick={pickFromSearch} />

      <BottomSheet visible={listsOpen} onClose={() => setListsOpen(false)} title="Save to list">
        {lists.map((l) => (
          <Pressable
            key={l.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: l.id === listId }}
            onPress={() => {
              setListId(l.id);
              setListsOpen(false);
            }}
            style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: c.border }}
          >
            <Txt variant="body" style={{ flex: 1 }}>
              {l.name}
            </Txt>
            {l.id === listId ? <Ionicons name="checkmark-circle" size={22} color={c.accentText} /> : null}
          </Pressable>
        ))}
        <View style={{ flexDirection: 'row', marginTop: S[4] }}>
          <View style={{ flex: 1, backgroundColor: c.surfaceAlt, borderRadius: R.md, paddingHorizontal: S[3], marginRight: S[2] }}>
            <TextInput
              accessibilityLabel="New list name"
              value={newList}
              onChangeText={setNewList}
              placeholder="New list name"
              placeholderTextColor={c.textFaint}
              style={[T.body, { color: c.text, minHeight: MIN_TOUCH }]}
            />
          </View>
          <Button
            label="Create"
            kind="secondary"
            disabled={!newList.trim()}
            onPress={() => {
              const l = addList(newList);
              setNewList('');
              setListId(l.id);
              setListsOpen(false);
            }}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}
