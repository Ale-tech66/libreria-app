import { api, getErrorMessage } from './client';
import { User, UserUpdatePayload } from '../types';

export async function getUsuarios(): Promise<User[]> {
  try {
    const response = await api.get<User[]>('/auth/users');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Error al obtener usuarios'));
  }
}

export async function crearUsuario(
  username: string,
  password: string,
  rol: User['rol']
): Promise<User> {
  try {
    const response = await api.post<User>('/auth/register', { username, password, rol });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Error al crear el usuario'));
  }
}

export async function actualizarUsuario(
  id: number,
  update: UserUpdatePayload
): Promise<User> {
  try {
    const response = await api.put<User>(`/auth/users/${id}`, update);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Error al actualizar el usuario'));
  }
}