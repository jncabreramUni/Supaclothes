import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ApiError, apiUrl, errorMessage } from '../../api/client';
import { useSession } from '../../auth/session';
import { Button, Card, Copy, Field, Notice, Screen } from '../../components/ui';
import { useTheme } from '../../theme';

export default function LoginScreen() {
  const { signIn } = useSession();
  const { colors } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [admin, setAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  async function submit() {
    if (submitting.current) return;
    if (!username.trim() || !password) {
      setError('Ingresa tu usuario y tu contraseña.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await signIn({ username: username.trim(), password }, admin);
    } catch (cause) {
      const credentialsRejected = cause instanceof ApiError && [401, 403].includes(cause.status);
      setError(credentialsRejected
        ? admin ? 'Credenciales incorrectas o cuenta sin acceso administrativo.' : 'Usuario o contraseña incorrectos.'
        : errorMessage(cause));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <Screen centered>
      <Card login>
        <View style={[styles.mark, { backgroundColor: admin ? colors.navy : colors.brand }]}>
          <Copy size={24} tone="white" strong>S</Copy>
        </View>
        <Copy accessibilityRole="header" size={30} strong>SupaClothes</Copy>
        <Copy tone="muted">{admin ? 'Acceso administrativo' : 'Accede a la gestión de tu tienda'}</Copy>
        {!apiUrl && <Notice error message="Configura EXPO_PUBLIC_API_URL en .env.local para conectar con Spring Boot." />}
        <Field label="Usuario" autoCapitalize="none" autoCorrect={false} autoComplete="username"
          value={username} onChangeText={setUsername} editable={!busy} />
        <Field label="Contraseña" secureTextEntry autoComplete="current-password" autoCapitalize="none"
          value={password} onChangeText={setPassword} onSubmitEditing={() => void submit()} editable={!busy} />
        {error !== '' && <Notice error message={error} />}
        <Button label="Ingresar" kind={admin ? 'admin' : 'primary'} busy={busy} onPress={() => void submit()} />
        <Button label={admin ? 'Volver al acceso general' : 'Acceso administrativo'} kind="secondary" disabled={busy}
          onPress={() => { setAdmin(!admin); setError(''); }} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mark: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
});
