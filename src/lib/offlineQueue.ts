import AsyncStorage from '@react-native-async-storage/async-storage';
import { Person, Item } from '../types';

const QUEUE_KEY = 'splitbills_offline_queue_v1';

export type QueuedSplit = {
  id: string;
  title: string;
  people: Person[];
  items: Item[];
  tipAmount: number;
  taxAmount: number;
  queuedAt: number;
};

export const getQueue = async (): Promise<QueuedSplit[]> => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const addToQueue = async (
  title: string,
  people: Person[],
  items: Item[],
  tipAmount: number,
  taxAmount: number,
): Promise<QueuedSplit> => {
  const queue = await getQueue();
  const entry: QueuedSplit = {
    id: Date.now().toString(),
    title, people, items, tipAmount, taxAmount,
    queuedAt: Date.now(),
  };
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...queue, entry]));
  return entry;
};

export const removeFromQueue = async (id: string): Promise<void> => {
  const queue = await getQueue();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.filter((q) => q.id !== id)));
};

export const getQueueCount = async (): Promise<number> => {
  const queue = await getQueue();
  return queue.length;
};
