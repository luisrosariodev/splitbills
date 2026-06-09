import AsyncStorage from '@react-native-async-storage/async-storage';

const K = {
  currency: 'sb_currency',
  tipPreset: 'sb_tip_preset',
  biometric: 'sb_biometric',
};

export const getDefaultCurrency = async (): Promise<string> =>
  (await AsyncStorage.getItem(K.currency)) ?? '$';

export const setDefaultCurrency = async (v: string): Promise<void> =>
  AsyncStorage.setItem(K.currency, v);

export const getDefaultTip = async (): Promise<number> => {
  const v = await AsyncStorage.getItem(K.tipPreset);
  return v !== null ? parseInt(v, 10) : 0;
};

export const setDefaultTip = async (pct: number): Promise<void> =>
  AsyncStorage.setItem(K.tipPreset, pct.toString());

export const getBiometricEnabled = async (): Promise<boolean> =>
  (await AsyncStorage.getItem(K.biometric)) === '1';

export const setBiometricEnabled = async (enabled: boolean): Promise<void> =>
  AsyncStorage.setItem(K.biometric, enabled ? '1' : '0');
