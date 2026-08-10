import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { loginUser } from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import VentasModal from '../components/VentasModal';
import HistorialModal from '../components/HistorialModal';

export default function HomeScreen() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [isLogged, setIsLogged] = useState(false);
  const [showVentas, setShowVentas] = useState(false);
  const [showHistorial, setShowHistorial] = useState(false);
  const [rol, setRol] = useState('');

  useEffect(() => {
    checkLogin();
    const getRol = async () => {
      const savedRol = await AsyncStorage.getItem('rol');
      if (savedRol) setRol(savedRol);
    };
    getRol();
  }, []);

  const checkLogin = async () => {
    const token = await AsyncStorage.getItem('token');
    const savedRol = await AsyncStorage.getItem('rol');
    if (token) {
      setIsLogged(true);
      setRol(savedRol || '');
    }
  };

  const decodeBase64 = (value: string) => {
    if (typeof globalThis.atob === 'function') {
      return globalThis.atob(value);
    }

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let result = '';
    let buffer = 0;
    let bits = 0;

    for (let i = 0; i < value.length; i += 1) {
      const idx = chars.indexOf(value[i]);
      if (idx === -1) continue;
      buffer = (buffer << 6) | idx;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        result += String.fromCharCode((buffer >> bits) & 0xff);
      }
    }

    return result;
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const data = await loginUser(username, password);
      await AsyncStorage.setItem('token', data.access_token);
      
      const parts = data.access_token.split('.');
      const payload = parts.length >= 2 ? JSON.parse(decodeBase64(parts[1])) : { rol: '' };
      const rolValue = payload?.rol ?? '';
      await AsyncStorage.setItem('rol', rolValue);
      
      setIsLogged(true);
      setRol(rolValue);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    setIsLogged(false);
    setRol('');
  };

  if (isLogged) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>¡Bienvenido!</Text>
        <Text style={styles.subtitle}>Tu rol es: {rol}</Text>
        
        {(rol === 'admin' || rol === 'ventas') && (
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#28a745', marginTop: 20 }]} 
            onPress={() => setShowVentas(true)}
          >
            <Text style={styles.buttonText}>IR A PUNTO DE VENTA</Text>
          </TouchableOpacity>
        )}

        {rol === 'admin' && (
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#007bff', marginTop: 10 }]} 
            onPress={() => setShowHistorial(true)}
          >
            <Text style={styles.buttonText}>VER HISTORIAL DE VENTAS</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: '#dc3545', marginTop: 10 }]} 
          onPress={handleLogout}
        >
          <Text style={styles.buttonText}>CERRAR SESIÓN</Text>
        </TouchableOpacity>

        <VentasModal 
          visible={showVentas} 
          onClose={() => setShowVentas(false)} 
        />

        <HistorialModal 
          visible={showHistorial} 
          onClose={() => setShowHistorial(false)} 
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Librería App</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Usuario"
        value={username}
        onChangeText={setUsername}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>INGRESAR</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 20,
    color: '#666',
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  button: {
    width: '100%',
    height: 50,
    backgroundColor: '#007bff',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});