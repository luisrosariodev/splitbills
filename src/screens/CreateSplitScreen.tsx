// Importamos useState y useMemo para manejar estado y cálculos
import { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Linking, // herramienta para abrir apps externas como WhatsApp
} from 'react-native';

// Importamos los tipos que definimos en src/types/index.ts
import { Person, Item } from '../types';

export default function CreateSplitScreen() {

  // ---- ESTADO DE PERSONAS ----
  // inputName → lo que el usuario está escribiendo en el campo de texto
  const [personInput, setPersonInput] = useState('');
  // people → la lista de personas agregadas
  const [people, setPeople] = useState<Person[]>([]);

  // ---- ESTADO DE ITEMS ----
  // los dos inputs del formulario de items
  const [itemNameInput, setItemNameInput] = useState('');
  const [itemPriceInput, setItemPriceInput] = useState('');
  // items → la lista de items de la cuenta
  const [items, setItems] = useState<Item[]>([]);

  // ---- FUNCIÓN: Agregar persona ----
  const addPerson = () => {
    // No hacemos nada si el input está vacío
    if (personInput.trim() === '') return;

    // Creamos una nueva persona con un ID único
    const newPerson: Person = {
      id: Date.now().toString(), // Date.now() genera un número único basado en la hora
      name: personInput.trim(),
    };

    // Agregamos la persona al array existente con spread operator
    setPeople([...people, newPerson]);

    // Limpiamos el input
    setPersonInput('');
  };

  // ---- FUNCIÓN: Agregar item ----
  const addItem = () => {
    if (itemNameInput.trim() === '') return;
    // parseFloat convierte el string del input a número decimal
    if (isNaN(parseFloat(itemPriceInput))) return;

    const newItem: Item = {
      id: Date.now().toString(),
      name: itemNameInput.trim(),
      price: parseFloat(itemPriceInput),
      assignedTo: [], // empieza sin asignar a nadie
    };

    setItems([...items, newItem]);
    setItemNameInput('');
    setItemPriceInput('');
  };

  // ---- FUNCIÓN: Asignar/desasignar persona a un item ----
  const toggleAssignment = (itemId: string, personId: string) => {
    // map recorre todos los items y retorna un array nuevo
    setItems(items.map((item) => {
      // Si no es el item que tocamos, lo dejamos igual
      if (item.id !== itemId) return item;

      const alreadyAssigned = item.assignedTo.includes(personId);

      return {
        ...item, // copiamos todas las propiedades del item
        assignedTo: alreadyAssigned
          ? item.assignedTo.filter((id) => id !== personId) // quita la persona
          : [...item.assignedTo, personId],                 // agrega la persona
      };
    }));
  };

  // ---- CÁLCULO: Total general ----
  // useMemo solo recalcula cuando "items" cambia
  const total = useMemo(() => {
    // reduce recorre el array y acumula un resultado
    return items.reduce((sum, item) => sum + item.price, 0);
  }, [items]);

  // ---- CÁLCULO: Total por persona ----
  // Se recalcula cuando "people" o "items" cambian
  const summary = useMemo(() => {
    return people.map((person) => {
      const personTotal = items.reduce((sum, item) => {
        // Si esta persona no está en el item, no suma nada
        if (!item.assignedTo.includes(person.id)) return sum;
        // Si está, divide el precio entre todos los asignados
        return sum + item.price / item.assignedTo.length;
      }, 0);

      return { person, total: personTotal };
    });
  }, [people, items]);

  // ---- FUNCIÓN: Compartir por WhatsApp ----
  const shareOnWhatsApp = () => {
    // Construimos el mensaje línea por línea
    let message = '🍽️ *Resumen de la cuenta*\n\n';

    // Agregamos el total de cada persona
    summary.forEach(({ person, total: personTotal }) => {
      message += `👤 ${person.name}: $${personTotal.toFixed(2)}\n`;
    });

    // Agregamos el total general
    message += `\n💰 *Total: $${total.toFixed(2)}*`;

    // encodeURIComponent convierte el texto para que funcione en una URL
    const encoded = encodeURIComponent(message);
    const url = `whatsapp://send?text=${encoded}`;

    // Verificamos si WhatsApp está instalado antes de abrir
    // En el simulador no está instalado, por eso verificamos primero
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        // WhatsApp está instalado → abrimos con el mensaje
        Linking.openURL(url);
      } else {
        // WhatsApp no está instalado → mostramos un alert
        alert('WhatsApp no está instalado en este dispositivo');
      }
    });
  };

  return (
    // ScrollView envuelve todo el contenido para permitir hacer scroll
    // contentContainerStyle agrega padding al contenido (no al scroll en sí)
    // keyboardShouldPersistTaps="handled" cierra el teclado al tocar fuera
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >

        {/* ---- SECCIÓN PERSONAS ---- */}
        <Text style={styles.sectionTitle}>👥 Personas</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Nombre"
            value={personInput}
            onChangeText={setPersonInput}
            onSubmitEditing={addPerson} // agregar al presionar "return"
          />
          <TouchableOpacity style={styles.addButton} onPress={addPerson}>
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Chips de personas agregadas */}
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
          {/* Input nombre del item - ocupa más espacio (flex: 2) */}
          <TextInput
            style={[styles.input, { flex: 2 }]}
            placeholder="Item (ej: Pizza)"
            value={itemNameInput}
            onChangeText={setItemNameInput}
          />
          {/* Input precio - ocupa menos espacio (flex: 1) */}
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="$0.00"
            value={itemPriceInput}
            onChangeText={setItemPriceInput}
            keyboardType="decimal-pad" // teclado numérico con decimales
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

            {/* Chips de personas - tocables para asignar/desasignar */}
            <View style={styles.chipsRow}>
              {people.map((person) => {
                // Verificamos si esta persona ya está asignada a este item
                const isAssigned = item.assignedTo.includes(person.id);
                return (
                  <TouchableOpacity
                    key={person.id}
                    style={[
                      styles.chip,
                      isAssigned && styles.chipSelected, // cambia estilo si está asignado
                    ]}
                    onPress={() => toggleAssignment(item.id, person.id)}
                  >
                    <Text style={[
                      styles.chipText,
                      isAssigned && styles.chipTextSelected,
                    ]}>
                      {person.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {/* ---- RESUMEN (solo aparece si hay personas) ---- */}
        {summary.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>💰 Resumen</Text>

            {/* Total por persona */}
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

            {/* Botón de WhatsApp */}
            <TouchableOpacity style={styles.whatsappButton} onPress={shareOnWhatsApp}>
              <Text style={styles.whatsappButtonText}>📲 Compartir por WhatsApp</Text>
            </TouchableOpacity>
          </>
        )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 60, // espacio extra al final para que nada quede tapado
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
    marginBottom: 12,
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
  whatsappButton: {
    backgroundColor: '#25D366', // verde oficial de WhatsApp
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 40,
  },
  whatsappButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});