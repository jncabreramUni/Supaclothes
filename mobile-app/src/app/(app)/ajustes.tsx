import { useSession } from '../../auth/session';
import { Button, Card, Copy, ListRow, Notice, Screen } from '../../components/ui';
import { useAction } from '../../components/use-action';
import { usePreferences, type ColorMode, type TextSize } from '../../preferences';

const themes: { mode: ColorMode; label: string }[] = [
  { mode: 'system', label: 'Usar tema del dispositivo' },
  { mode: 'light', label: 'Claro' },
  { mode: 'dark', label: 'Oscuro' },
];
const sizes: { size: TextSize; label: string }[] = [
  { size: 'normal', label: 'Normal' },
  { size: 'large', label: 'Grande' },
  { size: 'extraLarge', label: 'Extra grande' },
];

export default function SettingsScreen() {
  const { session, signOut } = useSession();
  const preferences = usePreferences();
  const action = useAction();

  return (
    <Screen>
      <Card title="Perfil">
        <Copy strong>{session?.fullName}</Copy>
        <Copy tone="muted">{session?.username}</Copy>
      </Card>
      <Card title="Tema">
        {themes.map(({ mode, label }) => (
          <ListRow key={mode} selected={preferences.colorMode === mode}
            onPress={action.busy ? undefined : () => void action.run(() => preferences.save({ colorMode: mode }))}>
            <Copy strong={preferences.colorMode === mode}>{label}</Copy>
          </ListRow>
        ))}
      </Card>
      <Card title="Tamaño de texto">
        {sizes.map(({ size, label }) => (
          <ListRow key={size} selected={preferences.textSize === size}
            onPress={action.busy ? undefined : () => void action.run(() => preferences.save({ textSize: size }))}>
            <Copy strong={preferences.textSize === size}>{label}</Copy>
          </ListRow>
        ))}
      </Card>
      {action.error !== '' && <Notice message={action.error} error />}
      <Button label="Cerrar sesión" kind="secondary" busy={action.busy} onPress={() => void action.run(signOut)} />
    </Screen>
  );
}
