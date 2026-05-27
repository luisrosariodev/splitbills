// Importamos useState para manejar el estado de la pantalla
import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,      // campo de texto para escribir
  TouchableOpacity,
  FlatList,       // lista eficiente para mostrar muchos items
  KeyboardAvoidingView, // evita que el teclado tape el input
  Platform,       // detecta si es iOS o Android
} from 'react-native';

export default function CreateSplitScreen() {
  // Estado para el texto que el usuario está escribiendo
  const [inputName, setInputName] = useState('');

  // Estado para la lista de personas agregadas
  // Empieza vacía []
  const [people, setPeople] = useState<string[]>([]);

  // Función para agregar una persona a la lista
  const addPerson = () => {
    // No agregar si el input está vacío
    if (inputName.trim() === '') return;

    // Agregamos el nombre a la lista existente
    setPeople([...people, inputName.trim()]);

    // Limpiamos el input para el siguiente nombre
    setInputName('');
  };

  return (
    // KeyboardAvoidingView sube el contenido cuando aparece el teclado
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Text style={styles.title}>¿Quiénes dividen?</Text>

      {/* Sección para agregar personas */}
      <View style={styles.inputRow}>
        {/* Campo de texto donde el usuario escribe el nombre */}
        <TextInput
          style={styles.input}
          placeholder="Nombre de persona"
          value={inputName}
          onChangeText={setInputName} // actualiza inputName en cada letra
          onSubmitEditing={addPerson} // permite agregar con el botón "return"
        />

        {/* Botón para agregar la persona */}
        <TouchableOpacity style={styles.addButton} onPress={addPerson}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de personas agregadas */}
      <FlatList
        data={people}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={styles.personItem}>
            <Text style={styles.personName}>{item}</Text>
          </View>
        )}
        ListEmptyComponent={
          // Mensaje cuando la lista está vacía
          <Text style={styles.emptyText}>Agrega personas para comenzar</Text>
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 10,
  },
  inputRow: {
    flexDirection: 'row', // pone el input y el botón en la misma fila
    marginBottom: 20,
    gap: 10,
  },
  input: {
    flex: 1, // el input ocupa todo el espacio disponible
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: '#007AFF',
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  personItem: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    marginBottom: 10,
  },
  personName: {
    fontSize: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 16,
  },
});