import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ¡Recuerda poner aquí la URL que te dio localtunnel!
const API_URL = 'https://libreria-api-4lr3.onrender.com'; 

export const loginUser = async (username: string, password: string) => {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, 
      new URLSearchParams({
        username: username,
        password: password,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Error al iniciar sesión');
  }
};

// Nueva función para traer los productos
// Nueva función para traer los productos
export const getProductos = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    console.log("Token recuperado:", token); // <--- ESTA LÍNEA NOS DIRÁ QUÉ PASA
    
    if (!token) {
      throw new Error("No hay token. Debes iniciar sesión primero.");
    }

    const response = await axios.get(`${API_URL}/productos/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Error al obtener productos');
  }
};
// Buscar producto por código de barras
export const buscarProductoPorCodigo = async (codigo: string) => {
  try {
    const token = await AsyncStorage.getItem('token');
    const response = await axios.get(`${API_URL}/productos/${codigo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error: any) {
    // Si el error es 404, significa que no existe
    if (error.response?.status === 404) {
      return null; 
    }
    throw new Error(error.response?.data?.detail || 'Error al buscar producto');
  }
};
// Crear un nuevo producto
export const crearProducto = async (productoData: any) => {
  try {
    const token = await AsyncStorage.getItem('token');
    const response = await axios.post(`${API_URL}/productos/`, productoData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Error al crear el producto');
  }
};

// Actualizar un producto existente
export const actualizarProducto = async (id: number, productoData: any) => {
  try {
    const token = await AsyncStorage.getItem('token');
    const response = await axios.put(`${API_URL}/productos/${id}`, productoData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Error al actualizar el producto');
  }
};

// Registrar una venta
export const registrarVenta = async (ventaData: any) => {
  try {
    const token = await AsyncStorage.getItem('token');
    const response = await axios.post(`${API_URL}/ventas/`, ventaData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Error al registrar la venta');
  }
};

// Obtener historial de ventas
export const getHistorialVentas = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    const response = await axios.get(`${API_URL}/ventas/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Error al obtener el historial');
  }
};