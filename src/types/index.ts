// Una persona en el split
export type Person = {
  id: string;
  name: string;
};

// Un item de la cuenta
export type Item = {
  id: string;
  name: string;
  price: number;
  // IDs de las personas que comparten este item
  // Puede ser una o varias personas
  assignedTo: string[];
};

// El resumen de cuánto debe cada persona
export type PersonSummary = {
  person: Person;
  total: number;
};