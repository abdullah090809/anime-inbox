// Small UI kit: text, buttons, chips, cards, headers, bottom sheet, empty state.
import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  Switch,
  Text,
  TextProps,
  View,
  ViewStyle,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MIN_TOUCH, R, S, T, useColors } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ---------- text ----------

type Tone = 'text' | 'dim' | 'faint' | 'accent' | 'success' | 'warn' | 'danger' | 'onAccent';

export function Txt({
  variant = 'body',
  tone = 'text',
  style,
  ...rest
}: TextProps & { variant?: keyof typeof T; tone?: Tone }) {
  const c = useColors();
  const color =
    tone === 'dim' ? c.textDim
    : tone === 'faint' ? c.textFaint
    : tone === 'accent' ? c.accentText
    : tone === 'success' ? c.success
    : tone === 'warn' ? c.warn
    : tone === 'danger' ? c.danger
    : tone === 'onAccent' ? c.onAccent
    : c.text;
  return <Text maxFontSizeMultiplier={1.6} {...rest} style={[T[variant], { color }, style]} />;
}

// ---------- layout ----------

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[{ flex: 1, backgroundColor: c.bg }, style]}>{children}</View>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View
      style={[
        { backgroundColor: c.surface, borderRadius: R.lg, borderWidth: 1, borderColor: c.border, padding: S[4] },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Divider() {
  const c = useColors();
  return <View style={{ height: 1, backgroundColor: c.border }} />;
}

export function SectionTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ paddingHorizontal: S[4], paddingTop: S[5], paddingBottom: S[2] }, style]}>
      <Txt variant="caption" tone="dim" style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {children}
      </Txt>
    </View>
  );
}

// ---------- headers ----------

export function LargeHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + S[3], paddingHorizontal: S[4], paddingBottom: S[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH }}>
        <View style={{ flex: 1 }}>
          <Txt variant="largeTitle" accessibilityRole="header">
            {title}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>{right}</View>
      </View>
      {subtitle ? (
        <Txt variant="callout" tone="dim" style={{ marginTop: S[1] }}>
          {subtitle}
        </Txt>
      ) : null}
    </View>
  );
}

export function NavHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const c = useColors();
  return (
    <View
      style={{
        paddingTop: insets.top,
        paddingHorizontal: S[1],
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: MIN_TOUCH + insets.top + S[2],
        backgroundColor: c.bg,
      }}
    >
      <IconButton name="chevron-back" label="Back" onPress={onBack} />
      <View style={{ flex: 1, paddingHorizontal: S[2] }}>
        <Txt variant="headline" numberOfLines={1} accessibilityRole="header">
          {title}
        </Txt>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>{right}</View>
    </View>
  );
}

// ---------- buttons ----------

export function IconButton({
  name,
  label,
  onPress,
  tone = 'text',
  disabled,
  badge,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  tone?: Tone;
  disabled?: boolean;
  badge?: number;
}) {
  const c = useColors();
  const color = tone === 'accent' ? c.accentText : tone === 'danger' ? c.danger : tone === 'dim' ? c.textDim : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      android_ripple={{ color: c.accentSoft, borderless: true, radius: 26 }}
      style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}
    >
      <Ionicons name={name} size={24} color={color} />
      {badge ? (
        <View
          style={{
            position: 'absolute',
            top: 6,
            right: 4,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: 9,
            backgroundColor: c.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: c.onAccent, fontSize: 11, fontWeight: '700' }}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const bg =
    kind === 'primary' ? c.accent : kind === 'secondary' ? c.surfaceAlt : kind === 'danger' ? c.dangerSoft : 'transparent';
  const fg =
    kind === 'primary' ? c.onAccent : kind === 'ghost' ? c.accentText : kind === 'danger' ? c.danger : c.text;
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={onPress}
      disabled={off}
      android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
      style={[
        {
          minHeight: MIN_TOUCH,
          borderRadius: R.lg - 2,
          paddingHorizontal: S[5],
          paddingVertical: S[2],
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.45 : 1,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={20} color={fg} style={{ marginRight: S[2] }} /> : null}
          <Text maxFontSizeMultiplier={1.4} style={[T.headline, { color: fg, textAlign: 'center', flexShrink: 1 }]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      android_ripple={{ color: c.accentSoft }}
      style={{
        minHeight: 40,
        paddingHorizontal: S[4],
        borderRadius: R.pill,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: selected ? c.accentSoft : c.surfaceAlt,
        borderWidth: 1,
        borderColor: selected ? c.accentText : 'transparent',
        marginRight: S[2],
        overflow: 'hidden',
      }}
    >
      {icon ? <Ionicons name={icon} size={16} color={selected ? c.accentText : c.textDim} style={{ marginRight: 6 }} /> : null}
      <Txt variant="callout" tone={selected ? 'accent' : 'text'} style={{ fontWeight: '600' }}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function Badge({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: 'neutral' | 'accent' | 'success' | 'warn' | 'danger';
  icon?: IconName;
}) {
  const c = useColors();
  const map = {
    neutral: { bg: c.surfaceAlt, fg: c.textDim },
    accent: { bg: c.accentSoft, fg: c.accentText },
    success: { bg: c.successSoft, fg: c.success },
    warn: { bg: c.warnSoft, fg: c.warn },
    danger: { bg: c.dangerSoft, fg: c.danger },
  }[tone];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: map.bg,
        borderRadius: R.pill,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginRight: S[2],
        marginTop: S[1],
        alignSelf: 'flex-start',
      }}
    >
      {icon ? <Ionicons name={icon} size={13} color={map.fg} style={{ marginRight: 4 }} /> : null}
      <Text maxFontSizeMultiplier={1.4} style={[T.caption, { color: map.fg }]}>
        {label}
      </Text>
    </View>
  );
}

// ---------- rows & controls ----------

export function Row({
  icon,
  title,
  subtitle,
  right,
  onPress,
  danger,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  const c = useColors();
  const body = (
    <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: S[4], paddingVertical: S[2] }}>
      {icon ? (
        <View style={{ width: 36, height: 36, borderRadius: R.md - 2, backgroundColor: danger ? c.dangerSoft : c.accentSoft, alignItems: 'center', justifyContent: 'center', marginRight: S[3] }}>
          <Ionicons name={icon} size={20} color={danger ? c.danger : c.accentText} />
        </View>
      ) : null}
      <View style={{ flex: 1, paddingRight: S[2] }}>
        <Txt variant="body" tone={danger ? 'danger' : 'text'}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="footnote" tone="dim" style={{ marginTop: 2 }}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right}
      {onPress && !right ? <Ionicons name="chevron-forward" size={18} color={c.textFaint} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} android_ripple={{ color: c.accentSoft }}>
      {body}
    </Pressable>
  );
}

export function SwitchRow({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const c = useColors();
  return (
    <Row
      icon={icon}
      title={title}
      subtitle={subtitle}
      onPress={() => onValueChange(!value)}
      right={
        <Switch
          value={value}
          onValueChange={onValueChange}
          accessibilityLabel={title}
          trackColor={{ false: c.border, true: c.accent }}
          thumbColor={'#FFFFFF'}
        />
      }
    />
  );
}

export function Checkbox({ checked, onPress, label }: { checked: boolean; onPress: () => void; label: string }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={onPress}
      hitSlop={6}
      style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          borderWidth: 2,
          borderColor: checked ? c.accent : c.textFaint,
          backgroundColor: checked ? c.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? <Ionicons name="checkmark" size={18} color={c.onAccent} /> : null}
      </View>
    </Pressable>
  );
}

// ---------- images ----------

export function Poster({ url, width = 56, radius = 10 }: { url: string | null; width?: number; radius?: number }) {
  const c = useColors();
  const height = Math.round(width * 1.45);
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        accessibilityIgnoresInvertColors
        style={{ width, height, borderRadius: radius, backgroundColor: c.surfaceAlt }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={{ width, height, borderRadius: radius, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="film-outline" size={Math.round(width * 0.4)} color={c.textFaint} />
    </View>
  );
}

// ---------- states ----------

export function FadeIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((r) => {
      if (!alive) return;
      setReduce(!!r);
      if (r) v.setValue(1);
      else Animated.timing(v, { toValue: 1, duration: 260, delay, useNativeDriver: true }).start();
    }).catch(() => v.setValue(1));
    return () => {
      alive = false;
    };
  }, []);
  return (
    <Animated.View
      style={[
        { opacity: v, transform: [{ translateY: reduce ? 0 : v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  children,
}: {
  icon: IconName;
  title: string;
  body?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const c = useColors();
  return (
    <FadeIn style={{ alignItems: 'center', paddingHorizontal: S[6], paddingTop: S[8], paddingBottom: S[6] }}>
      <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: S[5] }}>
        <Ionicons name={icon} size={38} color={c.accentText} />
      </View>
      <Txt variant="title" style={{ textAlign: 'center' }}>
        {title}
      </Txt>
      {body ? (
        <Txt variant="body" tone="dim" style={{ textAlign: 'center', marginTop: S[2] }}>
          {body}
        </Txt>
      ) : null}
      {children}
      {action ? <View style={{ marginTop: S[5], alignSelf: 'stretch' }}>{action}</View> : null}
    </FadeIn>
  );
}

export function Banner({ tone = 'warn', icon = 'alert-circle-outline', children }: { tone?: 'warn' | 'danger' | 'accent'; icon?: IconName; children: React.ReactNode }) {
  const c = useColors();
  const bg = tone === 'warn' ? c.warnSoft : tone === 'danger' ? c.dangerSoft : c.accentSoft;
  const fg = tone === 'warn' ? c.warn : tone === 'danger' ? c.danger : c.accentText;
  return (
    <View style={{ flexDirection: 'row', backgroundColor: bg, borderRadius: R.md, padding: S[3], marginHorizontal: S[4], marginBottom: S[3] }}>
      <Ionicons name={icon} size={20} color={fg} style={{ marginRight: S[2], marginTop: 1 }} />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

// ---------- bottom sheet ----------

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.overlay }} />
        <View
          style={{
            backgroundColor: c.surface,
            borderTopLeftRadius: R.xl,
            borderTopRightRadius: R.xl,
            maxHeight: '88%',
            paddingBottom: insets.bottom + S[3],
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: S[2] }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: c.border }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: S[5], paddingRight: S[1] }}>
            <View style={{ flex: 1 }}>
              <Txt variant="title" numberOfLines={1} accessibilityRole="header">
                {title}
              </Txt>
            </View>
            <IconButton name="close" label="Close" onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: S[5], paddingBottom: S[2] }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// A row of chips that scrolls sideways
export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: S[4], paddingVertical: S[1] }}>
      {children}
    </ScrollView>
  );
}
