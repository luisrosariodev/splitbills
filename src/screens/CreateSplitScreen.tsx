// Importamos useState para manejar el estado de la pantalla
// Importamos useMemo para memorizar cálculos
import { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SectionList, // lista que agrupa items en secciones
} from 'react-native';

// Importamos los tipos que definimos
import { Person, Item } from '../types';

export default function CreateSplitScreen() {
  // ---- ESTADO DE PERSONAS ----
  const [personInput, setPersonInput] = useState('');
  const [people, setPeople] = useState<Person[]>([]);

  // ---- ESTADO DE ITEMS ----
  const [itemNameInput, setItemNameInput] = useState('');
  const [itemPriceInput, setItemPriceInput] = useState('');
  const [items, setItems] = useState<Item[]>([]);

  // Agrega una persona a la lista
  const addPerson = () => {
    if (personInput.trim() === '') return;

    const newPerson: Person = {
      id: Date.now().toString(), // usamos la fecha como id único
      name: personInput.trim(),
    };

    setPeople([...people, newPerson]);
    setPersonInput('');
  };

  // Agrega un item a la lista
  const addItem = () => {
    // Validamos que haya nombre y precio válido
    if (itemNameInput.trim() === '') return;
    if (isNaN(parseFloat(itemPriceInput))) return;

    const newItem: Item = {
      id: Date.now().toString(),
      name: itemNameInput.trim(),
      price: parseFloat(itemPriceInput),
    };

    setItems([...items, newItem]);
    setItemNameInput('');
    setItemPriceInput('');
  };

    // Calcula el total sumando todos los precios
    // useMemo solo recalcula cuando "items" cambia
    const total = useMemo(() => {
        return items.reduce((sum, item) => sum + item.price, 0);
    }, [items]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ---- SECCIÓN PERSONAS ---- */}
      <Text style={styles.sectionTitle}>👥 Personas</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Nombre"
          value={personInput}
          onChangeText={setPersonInput}
          onSubmitEditing={addPerson}
        />
        <TouchableOpacity style={styles.addButton} onPress={addPerson}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de personas */}
      {people.map((person) => (
        <View key={person.id} style={styles.chip}>
          <Text style={styles.chipText}>{person.name}</Text>
        </View>
      ))}

      {/* ---- SECCIÓN ITEMS ---- */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>🍽️ Items</Text>

      <View style={styles.inputRow}>
        {/* Input del nombre del item */}
        <TextInput
          style={[styles.input, { flex: 2 }]}
          placeholder="Item (ej: Pizza)"
          value={itemNameInput}
          onChangeText={setItemNameInput}
        />
        {/* Input del precio */}
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="$0.00"
          value={itemPriceInput}
          onChangeText={setItemPriceInput}
          keyboardType="decimal-pad" // teclado numérico
        />
        <TouchableOpacity style={styles.addButton} onPress={addItem}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de items */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Agrega items de la cuenta</Text>
        }
      />
      {/* Total de la cuenta */}
        {items.length > 0 && (
        <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
        </View>
        )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  input: {
    flex: 1,
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
  chip: {
    backgroundColor: '#E8F0FE',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  chipText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    marginBottom: 8,
  },
  itemName: {
    fontSize: 16,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 20,
    fontSize: 16,
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    marginTop: 8,
    },
  totalLabel: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    },
  totalAmount: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    },
});