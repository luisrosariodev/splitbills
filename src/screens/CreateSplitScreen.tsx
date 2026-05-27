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
  ScrollView,
} from 'react-native';
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
      id: Date.now().toString(),
      name: personInput.trim(),
    };
    setPeople([...people, newPerson]);
    setPersonInput('');
  };

  // Agrega un item a la lista, sin asignar a nadie todavía
  const addItem = () => {
    if (itemNameInput.trim() === '') return;
    if (isNaN(parseFloat(itemPriceInput))) return;
    const newItem: Item = {
      id: Date.now().toString(),
      name: itemNameInput.trim(),
      price: parseFloat(itemPriceInput),
      assignedTo: [], // empieza sin asignar
    };
    setItems([...items, newItem]);
    setItemNameInput('');
    setItemPriceInput('');
  };

  // Asigna o desasigna una persona a un item
  // Si ya está asignada → la quita. Si no está → la agrega
  const toggleAssignment = (itemId: string, personId: string) => {
    setItems(items.map((item) => {
      if (item.id !== itemId) return item; // no es este item, no cambia

      const alreadyAssigned = item.assignedTo.includes(personId);

      return {
        ...item,
        assignedTo: alreadyAssigned
          ? item.assignedTo.filter((id) => id !== personId) // quita la persona
          : [...item.assignedTo, personId], // agrega la persona
      };
    }));
  };

  // Calcula el total general
  const total = useMemo(() => {
    return items.reduce((sum, item) => sum + item.price, 0);
  }, [items]);

  // Calcula cuánto debe cada persona
  // Si un item tiene 3 personas asignadas → cada una paga 1/3 del precio
  const summary = useMemo(() => {
    return people.map((person) => {
      const personTotal = items.reduce((sum, item) => {
        if (!item.assignedTo.includes(person.id)) return sum;
        // dividimos el precio entre todos los asignados
        return sum + item.price / item.assignedTo.length;
      }, 0);

      return { person, total: personTotal };
    });
  }, [people, items]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false}>

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

        {/* Chips de personas */}
        <View style={styles.chipsRow}>
          {people.map((person) => (
            <View key={person.id} style={styles.chip}>
              <Text style={styles.chipText}>{person.name}</Text>
            </View>
          ))}
        </View>

        {/* ---- SECCIÓN ITEMS ---- */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>🍽️ Items</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 2 }]}
            placeholder="Item (ej: Pizza)"
            value={itemNameInput}
            onChangeText={setItemNameInput}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="$0.00"
            value={itemPriceInput}
            onChangeText={setItemPriceInput}
            keyboardType="decimal-pad"
          />
          <TouchableOpacity style={styles.addButton} onPress={addItem}>
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Lista de items con asignación de personas */}
        {items.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            {/* Nombre y precio del item */}
            <View style={styles.itemHeader}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
            </View>

            {/* Botones para asignar personas al item */}
            <View style={styles.chipsRow}>
              {people.map((person) => {
                const isAssigned = item.assignedTo.includes(person.id);
                return (
                  <TouchableOpacity
                    key={person.id}
                    style={[styles.chip, isAssigned && styles.chipSelected]}
                    onPress={() => toggleAssignment(item.id, person.id)}
                  >
                    <Text style={[styles.chipText, isAssigned && styles.chipTextSelected]}>
                      {person.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {/* ---- RESUMEN ---- */}
        {summary.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>💰 Resumen</Text>
            {summary.map(({ person, total: personTotal }) => (
              <View key={person.id} style={styles.summaryRow}>
                <Text style={styles.summaryName}>{person.name}</Text>
                <Text style={styles.summaryAmount}>${personTotal.toFixed(2)}</Text>
              </View>
            ))}

            {/* Total general */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
            </View>
          </>
        )}

      </ScrollView>
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
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipSelected: {
    backgroundColor: '#007AFF', // azul cuando está seleccionado
  },
  chipText: {
    color: '#333',
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#fff', // blanco cuando está seleccionado
  },
  itemCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    marginBottom: 8,
  },
  summaryName: {
    fontSize: 16,
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 32,
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