import supabaseClient from './supabase';
import { Person, Item } from '../types';
import { getQueue, removeFromQueue } from './offlineQueue';
import { notifyQueueSynced } from './notifications';

// ── Splits ────────────────────────────────────────────────

export const getSplits = async () => {
  const { data, error } = await supabaseClient
    .from('splits')
    .select('id, name, created_at, people(id, name), settlements(settled)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string; name: string; created_at: string;
    people: Array<{ id: string; name: string }>;
    settlements: Array<{ settled: boolean }>;
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

export const saveSplit = async (
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

export const updateSplit = async (
  splitId: string,
  title: string,
  people: Person[],
  items: Item[],
  tipAmount = 0,
  taxAmount = 0,
): Promise<void> => {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { error: updateErr } = await supabaseClient.from('splits')
    .update({ name: title, tip_amount: tipAmount, tax_amount: taxAmount })
    .eq('id', splitId).eq('user_id', user.id);
  if (updateErr) throw updateErr;

  // Get existing item IDs to delete their assignments first
  const { data: existingItems } = await supabaseClient
    .from('items').select('id').eq('split_id', splitId);
  const existingItemIds = (existingItems ?? []).map((i) => i.id);
  if (existingItemIds.length > 0) {
    await supabaseClient.from('item_assignments').delete().in('item_id', existingItemIds);
  }
  await supabaseClient.from('people').delete().eq('split_id', splitId);
  await supabaseClient.from('items').delete().eq('split_id', splitId);

  const { data: savedPeople, error: peopleErr } = await supabaseClient
    .from('people').insert(people.map((p) => ({ split_id: splitId, name: p.name }))).select();
  if (peopleErr) throw peopleErr;

  const localToDb: Record<string, string> = {};
  people.forEach((p, i) => { localToDb[p.id] = savedPeople[i].id; });

  const { data: savedItems, error: itemsErr } = await supabaseClient
    .from('items').insert(items.map((i) => ({ split_id: splitId, name: i.name, price: i.price }))).select();
  if (itemsErr) throw itemsErr;

  const assignments = savedItems.flatMap((savedItem, idx) =>
    items[idx].assignedTo
      .filter((lid) => localToDb[lid])
      .map((lid) => ({ item_id: savedItem.id, person_id: localToDb[lid] }))
  );
  if (assignments.length > 0) {
    const { error } = await supabaseClient.from('item_assignments').insert(assignments);
    if (error) throw error;
  }
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

export const updateSplitName = async (splitId: string, name: string): Promise<void> => {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { error } = await supabaseClient
    .from('splits').update({ name }).eq('id', splitId).eq('user_id', user.id);
  if (error) throw error;
};

export const getUserStats = async (): Promise<{ splitCount: number; totalEstimated: number }> => {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { data, error } = await supabaseClient
    .from('splits').select('tip_amount, tax_amount, items(price)').eq('user_id', user.id);
  if (error) throw error;
  const totalEstimated = (data ?? []).reduce((sum, s) => {
    const items = (s.items as Array<{ price: string }>) ?? [];
    return sum + items.reduce((s2, i) => s2 + Number(i.price), 0)
      + Number(s.tip_amount ?? 0) + Number(s.tax_amount ?? 0);
  }, 0);
  return { splitCount: (data ?? []).length, totalEstimated };
};

export const updatePassword = async (newPassword: string): Promise<void> => {
  const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
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

export const saveOcrReport = async (
  claudeItems: Array<{ name: string; price: number }>,
  finalItems: Array<{ name: string; price: number }>,
): Promise<void> => {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;
  const hadCorrections =
    claudeItems.length !== finalItems.length ||
    claudeItems.some((c, i) =>
      !finalItems[i] ||
      Math.abs(c.price - finalItems[i].price) > 0.01 ||
      c.name.trim().toLowerCase() !== finalItems[i].name.trim().toLowerCase()
    );
  await supabaseClient.from('ocr_reports').insert({
    user_id: user.id,
    claude_items: claudeItems,
    final_items: finalItems,
    claude_count: claudeItems.length,
    final_count: finalItems.length,
    had_corrections: hadCorrections,
  });
};

export const recordTermsAccepted = async (): Promise<void> => {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;
  await supabaseClient.from('profiles').upsert(
    { user_id: user.id, terms_accepted_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  );
};

export const deleteAllUserData = async () => {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) throw new Error('No autenticado');
  // Delete groups, splits cascade-deletes people/items/assignments
  await supabaseClient.from('ocr_reports').delete().eq('user_id', user.id);
  await supabaseClient.from('saved_contacts').delete().eq('user_id', user.id);
  await supabaseClient.from('groups').delete().eq('user_id', user.id);
  await supabaseClient.from('splits').delete().eq('user_id', user.id);
  await supabaseClient.from('profiles').delete().eq('user_id', user.id);
  await supabaseClient.auth.signOut();
};

// ── Recent people ─────────────────────────────────────────

export const getRecentPeople = async (): Promise<string[]> => {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return [];
  const { data: splits } = await supabaseClient
    .from('splits').select('id').eq('user_id', user.id)
    .order('created_at', { ascending: false }).limit(30);
  if (!splits || splits.length === 0) return [];
  const { data } = await supabaseClient
    .from('people').select('name').in('split_id', splits.map((s) => s.id));
  const counts: Record<string, number> = {};
  (data ?? []).forEach((p: any) => { counts[p.name] = (counts[p.name] ?? 0) + 1; });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
};

// ── Saved contacts ────────────────────────────────────────

export const getSavedContacts = async (): Promise<Array<{ id: string; name: string }>> => {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabaseClient
    .from('saved_contacts').select('id, name').eq('user_id', user.id).order('name');
  if (error) return [];
  return (data ?? []) as Array<{ id: string; name: string }>;
};

export const saveContact = async (name: string): Promise<void> => {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;
  await supabaseClient.from('saved_contacts').insert({ user_id: user.id, name: name.trim() });
};

export const deleteContact = async (id: string): Promise<void> => {
  await supabaseClient.from('saved_contacts').delete().eq('id', id);
};

// ── Settlements ────────────────────────────────────────────

export type Settlement = {
  id: string; split_id: string;
  payer_name: string; payee_name: string;
  amount: number; settled: boolean; settled_at: string | null; created_at: string;
};

export const getSettlements = async (splitId: string): Promise<Settlement[]> => {
  const { data, error } = await supabaseClient
    .from('settlements').select('*').eq('split_id', splitId).order('created_at');
  if (error) return [];
  return (data ?? []) as Settlement[];
};

export const createSettlement = async (
  splitId: string, payerName: string, payeeName: string, amount: number
): Promise<void> => {
  const { error } = await supabaseClient.from('settlements')
    .insert({ split_id: splitId, payer_name: payerName, payee_name: payeeName, amount });
  if (error) throw error;
};

export const markSettled = async (settlementId: string): Promise<void> => {
  const { error } = await supabaseClient.from('settlements')
    .update({ settled: true, settled_at: new Date().toISOString() }).eq('id', settlementId);
  if (error) throw error;
};

export const recordPayment = async (
  splitId: string, payerName: string, payeeName: string, amount: number
): Promise<string> => {
  const { data, error } = await supabaseClient.from('settlements')
    .insert({ split_id: splitId, payer_name: payerName, payee_name: payeeName, amount, settled: true, settled_at: new Date().toISOString() })
    .select('id').single();
  if (error) throw error;
  return data.id;
};

export const deleteSettlement = async (settlementId: string): Promise<void> => {
  const { error } = await supabaseClient.from('settlements').delete().eq('id', settlementId);
  if (error) throw error;
};

// ── Export history ────────────────────────────────────────

export const generateHistoryHTML = async (): Promise<string> => {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { data } = await supabaseClient
    .from('splits')
    .select('id, name, created_at, tip_amount, tax_amount, items(name, price)')
    .order('created_at', { ascending: false });

  const splits = data ?? [];
  const fmt = (n: number) => `$${Number(n).toFixed(2)}`;
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });

  const rows = splits.map((s: any) => {
    const subtotal = (s.items ?? []).reduce((sum: number, i: any) => sum + Number(i.price), 0);
    const total = subtotal + Number(s.tip_amount ?? 0) + Number(s.tax_amount ?? 0);
    return `<tr><td>${fmtDate(s.created_at)}</td><td>${s.name}</td><td>${(s.items ?? []).length}</td><td>${fmt(total)}</td></tr>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>
    body{font-family:system-ui,sans-serif;padding:24px;color:#160C2E}
    h1{font-size:22px;font-weight:800;margin-bottom:4px}
    p{color:#6A5D8C;font-size:13px;margin-bottom:20px}
    table{width:100%;border-collapse:collapse}
    th{text-align:left;font-size:11px;letter-spacing:1px;color:#6535E8;padding:8px 12px;border-bottom:2px solid #E6E0FF}
    td{padding:10px 12px;border-bottom:1px solid #E6E0FF;font-size:14px}
    tr:last-child td{border-bottom:none}
    .total{text-align:right;padding-top:16px;font-weight:700;font-size:15px}
  </style></head><body>
  <h1>Historial de divvis</h1>
  <p>Generado con divvi · rosariodev</p>
  <table>
    <thead><tr><th>FECHA</th><th>NOMBRE</th><th>ITEMS</th><th>TOTAL</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">${splits.length} divvi${splits.length !== 1 ? 's' : ''} en total</div>
  </body></html>`;
};

// ── Enhanced stats ─────────────────────────────────────────

export const getFullStats = async (): Promise<{
  splitCount: number;
  totalEstimated: number;
  thisMonth: number;
  lastMonth: number;
  topPeople: Array<{ name: string; count: number }>;
}> => {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { data, error } = await supabaseClient
    .from('splits')
    .select('created_at, tip_amount, tax_amount, items(price), people(name)')
    .eq('user_id', user.id);
  if (error) throw error;

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

  let totalEstimated = 0, thisMonth = 0, lastMonth = 0;
  const peopleCounts: Record<string, number> = {};

  (data ?? []).forEach((s: any) => {
    const subtotal = (s.items ?? []).reduce((sum: number, i: any) => sum + Number(i.price), 0);
    const total = subtotal + Number(s.tip_amount ?? 0) + Number(s.tax_amount ?? 0);
    totalEstimated += total;
    if (s.created_at >= thisMonthStart) thisMonth += total;
    else if (s.created_at >= lastMonthStart) lastMonth += total;
    (s.people ?? []).forEach((p: any) => {
      peopleCounts[p.name] = (peopleCounts[p.name] ?? 0) + 1;
    });
  });

  const topPeople = Object.entries(peopleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return { splitCount: (data ?? []).length, totalEstimated, thisMonth, lastMonth, topPeople };
};

// ── Message builders ──────────────────────────────────────

export type SplitDetail = Awaited<ReturnType<typeof getSplitDetail>>;

// paidAmounts: how much each person actually paid at the restaurant
// Returns optimized debt list: who owes who and how much
export const computeNetDebts = (
  detail: SplitDetail,
  paidAmounts: Record<string, number>,
): Array<{ debtor: string; creditor: string; amount: number }> => {
  const shares = computePersonShares(detail);
  const balances: Record<string, number> = {};
  shares.forEach(({ name, amount }) => {
    balances[name] = (paidAmounts[name] ?? 0) - amount;
  });

  const creditors = Object.entries(balances).filter(([, v]) => v > 0.005).map(([n, v]) => ({ name: n, amount: v }));
  const debtors = Object.entries(balances).filter(([, v]) => v < -0.005).map(([n, v]) => ({ name: n, amount: -v }));
  const debts: Array<{ debtor: string; creditor: string; amount: number }> = [];

  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const transfer = Math.min(creditors[ci].amount, debtors[di].amount);
    if (transfer > 0.005) debts.push({ debtor: debtors[di].name, creditor: creditors[ci].name, amount: transfer });
    creditors[ci].amount -= transfer;
    debtors[di].amount -= transfer;
    if (creditors[ci].amount < 0.005) ci++;
    if (debtors[di].amount < 0.005) di++;
  }
  return debts;
};

export const computePersonShares = (detail: SplitDetail): Array<{ name: string; amount: number }> => {
  const subtotal = detail.items.reduce((s, i) => s + Number(i.price), 0);
  const tip = Number(detail.tip_amount ?? 0);
  const tax = Number(detail.tax_amount ?? 0);
  const multiplier = subtotal > 0 ? (subtotal + tip + tax) / subtotal : 1;
  const nameById: Record<string, string> = {};
  detail.people.forEach((p) => { nameById[p.id] = p.name; });
  const shares: Record<string, number> = {};
  detail.people.forEach((p) => { shares[p.name] = 0; });
  detail.items.forEach((item) => {
    const assigned = item.item_assignments.map((a) => a.person_id);
    if (assigned.length === 0) return;
    const share = (Number(item.price) * multiplier) / assigned.length;
    assigned.forEach((pid) => {
      if (nameById[pid]) shares[nameById[pid]] = (shares[nameById[pid]] ?? 0) + share;
    });
  });
  return detail.people.map((p) => ({ name: p.name, amount: shares[p.name] ?? 0 }));
};

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

// ── Offline sync ──────────────────────────────────────────

export const syncOfflineQueue = async (): Promise<void> => {
  const queue = await getQueue();
  if (queue.length === 0) return;
  let synced = 0;
  for (const entry of queue) {
    try {
      await saveSplit(entry.title, entry.people, entry.items, entry.tipAmount, entry.taxAmount);
      await removeFromQueue(entry.id);
      synced++;
    } catch {
      break;
    }
  }
  if (synced > 0) await notifyQueueSynced(synced);
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
    <div class="footer">Generado con divvi · rosariodev</div>
  </body></html>`;
};
