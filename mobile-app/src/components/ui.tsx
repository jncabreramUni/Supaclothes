import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View, type TextInputProps, type TextProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, typography, useTheme } from '../theme';

type Tone = 'normal' | 'muted' | 'accent' | 'error' | 'warning' | 'white';

export function Copy({ tone = 'normal', size = 14, strong = false, style, ...props }:
  TextProps & { tone?: Tone; size?: number; strong?: boolean }) {
  const { colors, textScale } = useTheme();
  const fontSize = size * textScale;
  return <Text {...props} style={[
    { color: tone === 'normal' ? colors.ink : colors[tone], fontFamily: strong ? typography.bold : typography.regular,
      fontSize, lineHeight: Math.ceil(fontSize * 1.4) },
    style,
  ]} />;
}

export function Screen({ children, refresh, refreshing = false, centered = false, modal = false }: {
  children: ReactNode;
  refresh?: () => void;
  refreshing?: boolean;
  centered?: boolean;
  modal?: boolean;
}) {
  const { colors, isDark } = useTheme();
  return (
    <SafeAreaView edges={centered || modal ? ['top', 'bottom', 'left', 'right'] : ['bottom', 'left', 'right']}
      style={[styles.screen, { backgroundColor: colors.canvas }]}>
      {centered && !isDark && (
        <LinearGradient colors={[colors.loginTint, colors.canvas]} locations={[0, 0.46]}
          style={StyleSheet.absoluteFill} />
      )}
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={centered || modal ? 0 : 70}>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.content, centered && styles.centered]}
          refreshControl={refresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh}
            tintColor={colors.accent} colors={[colors.primary]} /> : undefined}>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function FormModal({ title, children, onClose, busy }: {
  title: string; children: ReactNode; onClose: () => void; busy: boolean;
}) {
  const { isDark } = useTheme();
  return (
    <Modal animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Screen modal>
        <Card title={title}>
          {children}
          <Button label="Cancelar" kind="secondary" disabled={busy} onPress={onClose} />
        </Card>
      </Screen>
    </Modal>
  );
}

export function Card({ children, title, login = false }: { children: ReactNode; title?: string; login?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { borderColor: colors.line, backgroundColor: colors.surface },
      login && { borderRadius: radius.login }]}>
      {title && <Copy accessibilityRole="header" size={19} strong>{title}</Copy>}
      {children}
    </View>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'admin' | 'danger';

export function Button({ label, onPress, kind = 'primary', disabled = false, busy = false }: {
  label: string; onPress: () => void; kind?: ButtonKind; disabled?: boolean; busy?: boolean;
}) {
  const { colors } = useTheme();
  const secondary = kind === 'secondary';
  const fill = { primary: colors.primary, secondary: colors.surface, admin: colors.navy, danger: colors.dangerButton };
  const pressedFill = { primary: colors.primaryPressed, secondary: colors.secondaryPressed,
    admin: colors.adminPressed, danger: colors.dangerPressed };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress}
      style={({ pressed }) => [styles.button, {
        backgroundColor: pressed ? pressedFill[kind] : fill[kind],
        borderColor: secondary ? colors.line : 'transparent', opacity: disabled ? 0.52 : 1,
      }]}>
      {busy ? <ActivityIndicator color={secondary ? colors.accent : colors.white} />
        : <Copy size={13} strong tone={secondary ? 'normal' : 'white'} style={styles.buttonLabel}>{label}</Copy>}
    </Pressable>
  );
}

export function Field({ label, style, ...props }: TextInputProps & { label: string }) {
  const { colors, textScale } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Copy size={13} strong>{label}</Copy>
      <TextInput {...props} accessibilityLabel={props.accessibilityLabel ?? label}
        placeholderTextColor={colors.muted}
        onFocus={event => { setFocused(true); props.onFocus?.(event); }}
        onBlur={event => { setFocused(false); props.onBlur?.(event); }}
        style={[styles.input, {
          backgroundColor: colors.input, color: colors.ink, borderColor: focused ? colors.focus : colors.inputLine,
          fontSize: 16 * textScale,
        }, style]} />
    </View>
  );
}

export function Notice({ message, error = false }: { message: string; error?: boolean }) {
  const { colors } = useTheme();
  return (
    <View accessibilityLiveRegion={error ? 'assertive' : 'polite'}
      style={[styles.notice, { backgroundColor: error ? colors.errorSurface : colors.successSurface }]}>
      <Copy tone={error ? 'error' : 'accent'}>{message}</Copy>
    </View>
  );
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={styles.loading}>
      <ActivityIndicator color={colors.accent} />
      <Copy tone="muted">{label}</Copy>
    </View>
  );
}

export function ListRow({ children, onPress, selected = false }: {
  children: ReactNode; onPress?: () => void; selected?: boolean;
}) {
  const { colors } = useTheme();
  const border = { borderTopColor: colors.line };
  if (!onPress) return <View style={[styles.row, border]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
      style={({ pressed }) => [styles.row, border, {
        backgroundColor: pressed || selected ? colors.successSurface : 'transparent',
      }]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 18, gap: 16, width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 32 },
  centered: { flexGrow: 1, justifyContent: 'center', maxWidth: 460 },
  card: { padding: 18, gap: 12, borderRadius: radius.card, borderWidth: 1 },
  button: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1,
    borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  buttonLabel: { textAlign: 'center' },
  field: { gap: 6 },
  input: { minHeight: 44, paddingVertical: 9, paddingHorizontal: 12, borderWidth: 1,
    borderRadius: radius.field, fontFamily: typography.regular },
  notice: { padding: 12, borderRadius: radius.button },
  loading: { padding: 14, gap: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  row: { borderTopWidth: StyleSheet.hairlineWidth, gap: 2, paddingVertical: 10, paddingHorizontal: 4 },
});
