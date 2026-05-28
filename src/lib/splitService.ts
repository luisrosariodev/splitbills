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
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { error } = await supabaseClient
    .from('splits').delete().eq('id', splitId).eq('user_id', user.id);
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
    .select().single();
  if (splitError) throw splitError;

  const { data: savedPeople, error: peopleError } = await supabaseClient
    .from('people')
    .insert(people.map((p) => ({ split_id: splitData.id, name: p.name })))
    .select();
  if (peopleError) throw peopleError;

  const localToSupabaseId: Record<string, string> = {};
  people.forEach((p, i) => { localToSupabaseId[p.id] = savedPeople[i].id; });

  const { data: itemsData, error: itemsError } = await supabaseClient
    .from('items')
    .insert(items.map((item) => ({ split_id: splitData.id, name: item.name, price: item.price })))
    .select();
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
    .from('group_splits').select('split_id').eq('group_id', groupId);
  if (error) throw error;
  return Promise.all((data ?? []).map((gs) => getSplitDetail(gs.split_id)));
};

export const deleteGroup = async (groupId: string) => {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { error } = await supabaseClient
    .from('groups').delete().eq('id', groupId).eq('user_id', user.id);
  if (error) throw error;
};

// ── Profile ───────────────────────────────────────────────

export const getProfile = async () => {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { data, error } = await supabaseClient
    .from('profiles').select('display_name').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  return { email: user.email ?? '', displayName: data?.display_name ?? '' };
};

export const updateProfile = async (displayName: string) => {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { error } = await supabaseClient
    .from('profiles')
    .upsert({ user_id: user.id, display_name: displayName }, { onConflict: 'user_id' });
  if (error) throw error;
};

export const sendPasswordReset = async (email: string) => {
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
  if (error) throw error;
};

export const deleteAllUserData = async () => {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) throw new Error('No autenticado');
  // Delete groups, splits cascade-deletes people/items/assignments
  await supabaseClient.from('groups').delete().eq('user_id', user.id);
  await supabaseClient.from('splits').delete().eq('user_id', user.id);
  await supabaseClient.from('profiles').delete().eq('user_id', user.id);
  await supabaseClient.auth.signOut();
};

// ── Message builders ──────────────────────────────────────

export type SplitDetail = Awaited<ReturnType<typeof getSplitDetail>>;

export const buildSingleMessage = (split: SplitDetail, currency = '$'): string => {
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
      return s + Number(item.price) / item.item_assignments.length;
    }, 0);
    msg += `👤 *${person.name}* — ${fmt(personSubtotal * multiplier)}\n`;
    myItems.forEach((item) => {
      const assignedIds = item.item_assignments.map((a) => a.person_id);
      const share = Number(item.price) / assignedIds.length;
      const others = assignedIds.filter((id) => id !== person.id).map((id) => nameById[id]).filter(Boolean);
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

export const buildGroupMessage = (groupName: string, splits: SplitDetail[], currency = '$'): string => {
  const fmt = (n: number) => `${currency}${n.toFixed(2)}`;
  const personMap: Record<string, {
    displayName: string; total: number;
    splitData: Array<{ name: string; total: number; items: Array<{ name: string; share: number; sharedWith: string[] }> }>;
  }> = {};

  splits.forEach((split) => {
    const nameById: Record<string, string> = {};
    split.people.forEach((p) => { nameById[p.id] = p.name; });
    const subtotal = split.items.reduce((s, i) => s + Number(i.price), 0);
    const multiplier = subtotal > 0 ? (subtotal + Number(split.tip_amount ?? 0) + Number(split.tax_amount ?? 0)) / subtotal : 1;

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
        items.push({ name: item.name, share, sharedWith: assignedIds.filter((id) => id !== person.id).map((id) => nameById[id]).filter(Boolean) });
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
  msg += `*Total general: ${fmt(Object.values(personMap).reduce((s, p) => s + p.total, 0))}*`;
  return msg;
};

// ── PDF ───────────────────────────────────────────────────

export const generateSplitHTML = (split: SplitDetail, currency = '$'): string => {
  const fmt = (n: number) => `${currency}${n.toFixed(2)}`;
  const subtotal = split.items.reduce((s, i) => s + Number(i.price), 0);
  const tip = Number(split.tip_amount ?? 0);
  const tax = Number(split.tax_amount ?? 0);
  const grandTotal = subtotal + tip + tax;
  const multiplier = subtotal > 0 ? grandTotal / subtotal : 1;
  const nameById: Record<string, string> = {};
  split.people.forEach((p) => { nameById[p.id] = p.name; });
  const date = new Date(split.created_at).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });

  const personRows = split.people.map((person) => {
    const myItems = split.items.filter((item) => item.item_assignments.some((a) => a.person_id === person.id));
    if (myItems.length === 0) return '';
    const personSubtotal = myItems.reduce((s, item) => s + Number(item.price) / item.item_assignments.length, 0);
    const itemRows = myItems.map((item) => {
      const assignedIds = item.item_assignments.map((a) => a.person_id);
      const share = Number(item.price) / assignedIds.length;
      const others = assignedIds.filter((id) => id !== person.id).map((id) => nameById[id]).filter(Boolean);
      return `<div class="item-row"><span class="item-name">${item.name}${others.length > 0 ? ` <span class="shared">(con ${others.join(', ')})</span>` : ''}</span><span>${fmt(share)}</span></div>`;
    }).join('');
    return `<div class="person-block"><div class="person-header"><span class="person-name">${person.name}</span><span class="person-total">${fmt(personSubtotal * multiplier)}</span></div>${itemRows}</div>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, Helvetica, sans-serif; padding: 32px; color: #1C1C1E; font-size: 14px; }
    h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.8px; margin-bottom: 4px; }
    .date { color: #6C6C70; font-size: 13px; margin-bottom: 28px; }
    .section-label { font-size: 10px; font-weight: 600; color: #6C6C70; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 10px; margin-top: 24px; }
    .person-block { margin-bottom: 18px; padding: 14px; background: #F9F9FB; border-radius: 10px; }
    .person-header { display: flex; justify-content: space-between; font-weight: 700; font-size: 15px; margin-bottom: 8px; border-bottom: 1px solid #E5E5EA; padding-bottom: 8px; }
    .person-name { color: #1C1C1E; }
    .person-total { color: #007AFF; }
    .item-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: #3C3C43; }
    .item-name { flex: 1; margin-right: 8px; }
    .shared { color: #AEAEB2; font-size: 12px; }
    .breakdown { margin-top: 16px; padding-top: 12px; border-top: 1px solid #E5E5EA; }
    .breakdown-row { display: flex; justify-content: space-between; font-size: 13px; color: #6C6C70; padding: 3px 0; }
    .total-row { display: flex; justify-content: space-between; align-items: baseline; margin-top: 10px; padding-top: 10px; border-top: 2px solid #1C1C1E; }
    .total-label { font-size: 11px; font-weight: 600; color: #6C6C70; letter-spacing: 1px; text-transform: uppercase; }
    .total-amount { font-size: 28px; font-weight: 800; letter-spacing: -1px; }
    .footer { margin-top: 40px; font-size: 11px; color: #AEAEB2; text-align: center; }
  </style></head><body>
    <h1>${split.name}</h1>
    <div class="date">${date}</div>
    <div class="section-label">Resumen por persona</div>
    ${personRows}
    <div class="breakdown">
      <div class="breakdown-row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
      ${tip > 0 ? `<div class="breakdown-row"><span>Propina</span><span>+${fmt(tip)}</span></div>` : ''}
      ${tax > 0 ? `<div class="breakdown-row"><span>Impuesto</span><span>+${fmt(tax)}</span></div>` : ''}
    </div>
    <div class="total-row"><span class="total-label">Total</span><span class="total-amount">${fmt(grandTotal)}</span></div>
    <div class="footer">Generado con SplitBills</div>
  </body></html>`;
};
