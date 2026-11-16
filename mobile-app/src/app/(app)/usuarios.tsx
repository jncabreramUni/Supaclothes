import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import type { ApiRequest } from '../../api/client';
import { createUser, deactivateUser, getUsers } from '../../api/operations';
import { roleLabels } from '../../auth/permissions';
import { useSession } from '../../auth/session';
import { Button, Card, Copy, Field, FormModal, ListRow, Loading, Notice, Screen } from '../../components/ui';
import { useAction } from '../../components/use-action';
import { useResource } from '../../components/use-resource';
import type { Role, UserResponse } from '../../types/api';

const availableRoles: Role[] = ['VENDEDOR', 'BODEGA', 'ADMIN'];

export default function UsersScreen() {
  const { api, session } = useSession();
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const action = useAction();
  const users = useResource(useCallback((signal: AbortSignal) => getUsers(api, signal), [api]));

  function confirmDeactivate(user: UserResponse) {
    Alert.alert('Desactivar usuario', `${user.fullName} perderá el acceso a SupaClothes.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desactivar', style: 'destructive', onPress: () => void action.run(async () => {
        setMessage('');
        await deactivateUser(api, user.id);
        users.setData(current => current?.map(item => item.id === user.id ? { ...item, active: false } : item));
        setMessage(`Se desactivó a ${user.fullName}.`);
        users.reload();
      }) },
    ]);
  }

  if (session?.role !== 'ADMIN') return null;
  return (
    <Screen refresh={action.busy ? undefined : users.reload} refreshing={users.loading}>
      <Button label="Nuevo usuario" disabled={action.busy || users.loading} onPress={() => setShowForm(true)} />
      {message !== '' && <Notice message={message} />}
      {action.error !== '' && <Notice message={action.error} error />}
      <Card title="Usuarios registrados">
        {users.loading && !users.data && <Loading />}
        {users.error !== '' && <Notice message={users.error} error />}
        {users.error !== '' && <Button label="Reintentar" kind="secondary" onPress={users.reload} />}
        {users.data?.length === 0 && <Copy tone="muted">No hay usuarios registrados.</Copy>}
        {users.data?.map(user => (
          <ListRow key={user.id}>
            <Copy strong>{user.fullName}</Copy>
            <Copy tone="muted">{user.username} · {roleLabels[user.role] ?? user.role} · {user.active ? 'Activo' : 'Inactivo'}</Copy>
            {user.active && user.username !== session.username && (
              <Button label={`Desactivar a ${user.username}`} kind="danger" disabled={action.busy || users.loading}
                onPress={() => confirmDeactivate(user)} />
            )}
          </ListRow>
        ))}
      </Card>
      {showForm && <UserForm api={api} onClose={() => setShowForm(false)} onCreated={user => {
        users.setData(current => [...(current ?? []), user]);
        setMessage(`Usuario ${user.username} creado.`);
        setShowForm(false);
        users.reload();
      }} />}
    </Screen>
  );
}

function UserForm({ api, onClose, onCreated }: {
  api: ApiRequest; onClose: () => void; onCreated: (user: UserResponse) => void;
}) {
  const action = useAction();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [roleName, setRole] = useState<Role>('VENDEDOR');

  function save() {
    void action.run(async () => {
      if (!fullName.trim() || !username.trim() || !password.trim()) {
        throw new Error('Ingresa el nombre completo, el usuario y la contraseña.');
      }
      if (password.length < 6) throw new Error('La contraseña debe tener al menos seis caracteres.');
      onCreated(await createUser(api, { fullName: fullName.trim(), username: username.trim(), password, roleName }));
    });
  }

  return (
    <FormModal title="Registrar usuario" busy={action.busy} onClose={onClose}>
      <Field label="Nombre completo" value={fullName} autoCapitalize="words" maxLength={120}
        onChangeText={setFullName} editable={!action.busy} />
      <Field label="Usuario" value={username} autoCapitalize="none" autoCorrect={false} maxLength={50}
        onChangeText={setUsername} editable={!action.busy} />
      <Field label="Contraseña" value={password} secureTextEntry autoComplete="new-password" autoCapitalize="none"
        onChangeText={setPassword} editable={!action.busy} />
      <Copy strong>Rol</Copy>
      {availableRoles.map(role => (
        <ListRow key={role} selected={role === roleName} onPress={action.busy ? undefined : () => setRole(role)}>
          <Copy strong={role === roleName}>{roleLabels[role]}</Copy>
        </ListRow>
      ))}
      {action.error !== '' && <Notice message={action.error} error />}
      <Button label="Crear usuario" busy={action.busy} onPress={save} />
    </FormModal>
  );
}
