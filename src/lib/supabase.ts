// AsyncStorage es una libreria que guarda datos localmente en el telefono (como localStorage en web)
import AsyncStorage from '@react-native-async-storage/async-storage';

// createClient crea la conexion con Supabase usando la URL y la clave anónima
import { createClient } from '@supabase/supabase-js';

// Las credenciales vienen del archivo .env
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Creamos el cliente - este objeto es el "mensajero" entre app y supabase
// Lo exportamos para usarlo en toda la app y hacer consultas a la base de datos o autenticación
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export default supabaseClient;
