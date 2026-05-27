// Herramienta que envuelve toda la app y habilita la navegación
import { NavigationContainer } from '@react-navigation/native';

// Crea un navegador tipo "pila" - como una pila de cartas, puedes agregar y quitar pantallas
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Nuestras pantallas
import HomeScreen from './src/screens/HomeScreen';
import CreateSplitScreen from './src/screens/CreateSplitScreen';

// Creamos el objeto Stack que va a conocer todas las pantallas de la app
const Stack = createNativeStackNavigator();

export default function App() {
  return (
    // NavigationContainer envuelve toda la app - sin esto la navegación no funciona
    <NavigationContainer>

      {/* Stack.Navigator administra qué pantalla mostrar en cada momento */}
      {/* initialRouteName le dice cuál pantalla mostrar primero */}
      <Stack.Navigator initialRouteName="Home">

        {/* Registramos cada pantalla con un nombre y su componente */}
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'SplitBills' }} />
        <Stack.Screen name="CreateSplit" component={CreateSplitScreen} options={{ title: 'Nuevo Split' }} />

      </Stack.Navigator>
    </NavigationContainer>
  );
}