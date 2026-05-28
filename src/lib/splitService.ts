// Guardar Split
// Importamos el cliente de Supabase que configuramos en src/supabase.ts
import supabaseClient from './supabase';

// Exportamos una función que recibe el título del split, las personas y los items, y los guarda en la base de datos
export const saveSplt = async (title: string, people: string[], items: { name: string; price: number; assignedTo: string[] }[]) => {

    // 1. Crear el split en la tabla "splits"
    const { data: splitData, error: splitError } = await supabaseClient
        .from('splits')       // tabla donde insertar
        .insert({ name: title })     // datos a insertar
        .select()               // devuelve el split recién creado (con su ID)
        .single();              // single() porque esperamos un solo resultado

    // Si hay un error al crear el split, lo lanzamos para manejarlo en la UI
    if (splitError) throw splitError;

    // 2. Crear las personas en la tabla "people", asociándolas al split recién creado
    const peopleToInsert = people.map((person) => ({
        split_id: splitData.id,     // usamos el ID que Supabase genera automáticamente
        name: person,
    }));

    const { error: peopleError } = await supabaseClient
        .from('people')
        .insert(peopleToInsert); // insertamos todas las personas de una vez

    if (peopleError) throw peopleError;

    // 3. Crear los items en la tabla "items", asociándolos al split
    const itemsToInsert = items.map((item) => ({
        split_id: splitData.id,
        name: item.name,
        price: item.price,
    }));

    // Usamos .select() para obtener los IDs de los items recién creados
    // Los necesitamos en el paso 4 para crear las asignaciones
    const { data: itemsData, error: itemsError } = await supabaseClient
        .from('items')
        .insert(itemsToInsert)
        .select();

    if (itemsError) throw itemsError;

    // 4. Crear las asignaciones en "item_assignments"
    // Para cada item, creamos una fila por cada persona asignada
    // Ejemplo: Pizza asignada a Luis y Maria → 2 filas en item_assignments
    const assignments = itemsData.flatMap((savedItem, index) => {
        // assignedTo tiene los IDs locales de las personas
        // los mapeamos al id real de Supabase
        return items[index].assignedTo.map((personId) => ({
            item_id: savedItem.id,
            person_id: personId,
        }));
    });

    // Solo insertamos si hay asignaciones
    if (assignments.length > 0) {
        const { error: assignmentError } = await supabaseClient
            .from('item_assignments')
            .insert(assignments);

        if (assignmentError) throw assignmentError;
    }

    return splitData; // devolvemos el split creado para usar su ID en la UI
};
