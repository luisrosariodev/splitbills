import supabaseClient from './supabase';
import { Person, Item } from '../types';

// ── Splits ────────────────────────────────────────────────

export const getSplits = async () => {
  const { data, error } = await supabaseClient
    .from('splits')
    .select('id, name, created_at, people(id)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string; name: string; created_at: string; people: Array<{ id: string }>;
  }>;
};

export const getSplitDetail = async (splitId: string) => {
  const { data, error } = await supabaseClient
    .from('splits')
    .select(`
      id, name, created_at, tip_amount, tax_amount,
      people (id, name),
      items (id, name, price, item_assignments (person_id))
    `)
    .eq('id', splitId)
    .single();
  if (error) throw error;
  return data as {
    id: string; name: string; created_at: string;
    tip_amount: number; tax_amount: number;
    people: Array<{ id: string; name: string }>;
    items: Array<{
      id: string; name: string; price: number;
      item_assignments: Array<{ person_id: string }>;
    }>;
  };
};

export const deleteSplit = async (splitId: string) => {
  const { error } = await supabaseClient.from('splits').delete().eq('id', splitId);
  if (error) throw error;
};

export const saveSplt = async (
  title: string,
  people: Person[],
  items: Item[],
  tipAmount = 0,
  taxAmount = 0,
) => {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { data: splitData, error: splitError } = await supabaseClient
    .from('splits')
    .insert({ name: title, user_id: user.id, tip_amount: tipAmount, tax_amount: taxAmount })
    .select()
    .single();
  if (splitError) throw splitError;

  const peopleToInsert = people.map((p) => ({ split_id: splitData.id, name: p.name }));
  const { data: savedPeople, error: peopleError } = await supabaseClient
    .from('people').insert(peopleToInsert).select();
  if (peopleError) throw peopleError;

  const localToSupabaseId: Record<string, string> = {};
  people.forEach((p, i) => { localToSupabaseId[p.id] = savedPeople[i].id; });

  const itemsToInsert = items.map((item) => ({
    split_id: splitData.id, name: item.name, price: item.price,
  }));
  const { data: itemsData, error: itemsError } = await supabaseClient
    .from('items').insert(itemsToInsert).select();
  if (itemsError) throw itemsError;

  const assignments = itemsData.flatMap((savedItem, index) =>
    items[index].assignedTo
      .filter((localId) => localToSupabaseId[localId])
      .map((localId) => ({ item_id: savedItem.id, person_id: localToSupabaseId[localId] }))
  );
  if (assignments.length > 0) {
    const { error } = await supabaseClient.from('item_assignments').insert(assignments);
    if (error) throw error;
  }

  return splitData;
};

// ── Groups ────────────────────────────────────────────────

export const getGroups = async () => {
  const { data, error } = await supabaseClient
    .from('groups')
    .select('id, name, created_at, group_splits(split_id)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string; name: string; created_at: string;
    group_splits: Array<{ split_id: string }>;
  }>;
};

export const createGroup = async (name: string, splitIds: string[]) => {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { data: group, error: groupError } = await supabaseClient
    .from('groups').insert({ name, user_id: user.id }).select().single();
  if (groupError) throw groupError;

  const { error } = await supabaseClient
    .from('group_splits')
    .insert(splitIds.map((split_id) => ({ group_id: group.id, split_id })));
  if (error) throw error;

  return group as { id: string; name: string; created_at: string };
};

export const getGroupDetail = async (groupId: string) => {
  const { data, error } = await supabaseClient
    .from('group_splits')
    .select('split_id')
    .eq('group_id', groupId);
  if (error) throw error;

  const splits = await Promise.all((data ?? []).map((gs) => getSplitDetail(gs.split_id)));
  return splits;
};

export const deleteGroup = async (groupId: string) => {
  const { error } = await supabaseClient.from('groups').delete().eq('id', groupId);
  if (error) throw error;
};

// ── Message builders ──────────────────────────────────────

export type SplitDetail = Awaited<ReturnType<typeof getSplitDetail>>;

export const buildSingleMessage = (
  split: SplitDetail,
  currency = '$',
): string => {
  const fmt = (n: number) => `${currency}${n.toFixed(2)}`;
  const subtotal = split.items.reduce((s, i) => s + Number(i.price), 0);
  const tip = Number(split.tip_amount ?? 0);
  const tax = Number(split.tax_amount ?? 0);
  const grandTotal = subtotal + tip + tax;
  const multiplier = subtotal > 0 ? grandTotal / subtotal : 1;

  const nameById: Record<string, string> = {};
  split.people.forEach((p) => { nameById[p.id] = p.name; });

  let msg = `*${split.name}*\n\n`;

  split.people.forEach((person) => {
    const myItems = split.items.filter((item) =>
      item.item_assignments.some((a) => a.person_id === person.id)
    );
    if (myItems.length === 0) return;

    const personSubtotal = myItems.reduce((s, item) => {
      const count = item.item_assignments.length;
      return s + Number(item.price) / count;
    }, 0);

    msg += `👤 *${person.name}* — ${fmt(personSubtotal * multiplier)}\n`;
    myItems.forEach((item) => {
      const assignedIds = item.item_assignments.map((a) => a.person_id);
      const share = Number(item.price) / assignedIds.length;
      const others = assignedIds
        .filter((id) => id !== person.id)
        .map((id) => nameById[id])
        .filter(Boolean);
      const sharedStr = others.length > 0 ? ` (con ${others.join(', ')})` : '';
      msg += `  • ${item.name}${sharedStr}: ${fmt(share)}\n`;
    });
    msg += '\n';
  });

  if (tip > 0 || tax > 0) {
    msg += `Subtotal: ${fmt(subtotal)}\n`;
    if (tip > 0) msg += `Propina: +${fmt(tip)}\n`;
    if (tax > 0) msg += `Impuesto: +${fmt(tax)}\n`;
  }
  msg += `*Total: ${fmt(grandTotal)}*`;
  return msg;
};

export const buildGroupMessage = (
  groupName: string,
  splits: SplitDetail[],
  currency = '$',
): string => {
  const fmt = (n: number) => `${currency}${n.toFixed(2)}`;

  // Aggregate by person name (match across splits by lowercase name)
  const personMap: Record<string, {
    displayName: string;
    total: number;
    splitData: Array<{ name: string; total: number; items: Array<{ name: string; share: number; sharedWith: string[] }> }>;
  }> = {};

  splits.forEach((split) => {
    const nameById: Record<string, string> = {};
    split.people.forEach((p) => { nameById[p.id] = p.name; });

    const subtotal = split.items.reduce((s, i) => s + Number(i.price), 0);
    const tip = Number(split.tip_amount ?? 0);
    const tax = Number(split.tax_amount ?? 0);
    const grandTotal = subtotal + tip + tax;
    const multiplier = subtotal > 0 ? grandTotal / subtotal : 1;

    split.people.forEach((person) => {
      const key = person.name.toLowerCase().trim();
      if (!personMap[key]) personMap[key] = { displayName: person.name, total: 0, splitData: [] };

      let personSubtotal = 0;
      const items: Array<{ name: string; share: number; sharedWith: string[] }> = [];

      split.items.forEach((item) => {
        const assignedIds = item.item_assignments.map((a) => a.person_id);
        if (!assignedIds.includes(person.id)) return;
        const share = Number(item.price) / assignedIds.length;
        personSubtotal += share;
        const sharedWith = assignedIds
          .filter((id) => id !== person.id)
          .map((id) => nameById[id])
          .filter(Boolean);
        items.push({ name: item.name, share, sharedWith });
      });

      if (personSubtotal > 0) {
        const personTotal = personSubtotal * multiplier;
        personMap[key].total += personTotal;
        personMap[key].splitData.push({ name: split.name, total: personTotal, items });
      }
    });
  });

  let msg = `*${groupName}*\n\n`;

  Object.values(personMap).forEach(({ displayName, total, splitData }) => {
    msg += `👤 *${displayName}* — ${fmt(total)}\n`;
    splitData.forEach(({ name, total: splitTotal, items }) => {
      msg += `  📍 ${name}: ${fmt(splitTotal)}\n`;
      items.forEach(({ name: itemName, share, sharedWith }) => {
        const sharedStr = sharedWith.length > 0 ? ` (con ${sharedWith.join(', ')})` : '';
        msg += `     • ${itemName}${sharedStr}: ${fmt(share)}\n`;
      });
    });
    msg += '\n';
  });

  const grandTotal = Object.values(personMap).reduce((s, p) => s + p.total, 0);
  msg += `*Total general: ${fmt(grandTotal)}*`;
  return msg;
};
