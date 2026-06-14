// Returns error string or null if valid

export const validateEmail = (email: string): string | null => {
  if (!email.trim()) return 'El email es requerido.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Email inválido.';
  if (email.length > 254) return 'Email demasiado largo.';
  return null;
};

export const validatePassword = (password: string): string | null => {
  if (!password) return 'La contraseña es requerida.';
  if (password.length < 8) return 'Mínimo 8 caracteres.';
  if (password.length > 128) return 'Contraseña demasiado larga.';
  return null;
};

export const validateDisplayName = (name: string): string | null => {
  if (!name.trim()) return 'El nombre es requerido.';
  if (name.trim().length > 80) return 'Máximo 80 caracteres.';
  return null;
};

export const validateSplitName = (name: string): string | null => {
  if (!name.trim()) return 'El nombre del divvi es requerido.';
  if (name.trim().length > 100) return 'Máximo 100 caracteres.';
  return null;
};

export const validateItemName = (name: string): string | null => {
  if (!name.trim()) return 'Nombre del item requerido.';
  if (name.trim().length > 100) return 'Máximo 100 caracteres.';
  return null;
};

export const validatePrice = (price: string): string | null => {
  const n = parseFloat(price);
  if (isNaN(n)) return 'Precio inválido.';
  if (n <= 0) return 'El precio debe ser mayor a cero.';
  if (n > 999999) return 'Precio demasiado alto.';
  return null;
};

// Strip control characters — prevents injection via text fields
export const sanitize = (text: string): string =>
  text.trim().replace(/[\x00-\x1F\x7F]/g, '');
