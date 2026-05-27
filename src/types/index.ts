// Aquí definimos la "forma" de los datos que usará la app
// TypeScript usa estos tipos para avisarte si cometes un error

// Una persona en el split
export type Person = {
  id: string;   // identificador único
  name: string; // nombre de la persona
};

// Un item de la cuenta (plato, bebida, etc.)
export type Item = {
  id: string;    // identificador único
  name: string;  // nombre del item (ej: "Pizza")
  price: number; // precio del item (ej: 12.99)
};