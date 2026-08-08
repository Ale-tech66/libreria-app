import axios from 'axios';

// ¡SÚPER IMPORTANTE! Cambia esta IP por la IP local de tu PC en tu red Wi-Fi.
// (Para saber tu IP en Linux, abre una terminal y escribe: hostname -I)
const API_URL = 'hclear
ttps://legal-lies-sing.loca.lt'; 

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