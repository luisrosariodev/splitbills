// Importamos las herramientas de React Native que necesitamos
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

// Importamos el tipo de prop que nos da React Navigation
// Este prop "navigation" es el que nos permite movernos entre pantallas
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Definimos los nombres y parámetros de todas las pantallas de la app
// Por ahora ninguna pantalla recibe parámetros, por eso es "undefined"
type RootStackParamList = {
  Home: undefined;
  CreateSplit: undefined;
};

// Definimos el tipo del prop "navigation" específico para HomeScreen
type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

// El prop "navigation" nos lo da automáticamente React Navigation
type Props = {
  navigation: HomeScreenNavigationProp;
};

export default function HomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SplitBills</Text>
      <Text style={styles.subtitle}>Divide cuentas fácilmente</Text>

      {/* Al tocar el botón, navegamos a la pantalla CreateSplit */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('CreateSplit')}
      >
        <Text style={styles.buttonText}>+ Nuevo Split</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 48,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});