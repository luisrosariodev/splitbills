import { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView, ActivityIndicator,
  Pressable, Alert, RefreshControl, TextInput, Modal, Linking,
  LayoutAnimation, Platform, UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LAYOUT_SPRING = {
  duration: 280,
  create: { type: LayoutAnimation.Types.spring, property: LayoutAnimation.Properties.opacity, springDamping: 0.75 },
  update: { type: LayoutAnimation.Types.spring, springDamping: 0.75 },
  delete: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.opacity },
};
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../types/navigation';
import {
  getSplits, deleteSplit, getGroups, createGroup, deleteGroup,
  getGroupDetail, buildGroupMessage, getSplitDetail, buildSingleMessage,
  updateSplitName,
} from '../lib/splitService';
import { T as C } from '../lib/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;


type Split = { id: string; name: string; created_at: string; people: Array<{ id: string }> };
type Group = { id: string; name: string; created_at: string; group_splits: Array<{ split_id: string }> };

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
const isThisWeek = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 86400000;
  return diff < 7 && !isToday(iso);
};
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });

const groupByDate = (splits: Split[]) => {
  const today: Split[] = [], week: Split[] = [], older: Split[] = [];
  splits.forEach((s) => {
    if (isToday(s.created_at)) today.push(s);
    else if (isThisWeek(s.created_at)) week.push(s);
    else older.push(s);
  });
  return [
    ...(today.length ? [{ title: 'Hoy', data: today }] : []),
    ...(week.length ? [{ title: 'Esta semana', data: week }] : []),
    ...(older.length ? [{ title: 'Antes', data: older }] : []),
  ];
};

export default function HistoryScreen({ navigation }: Props) {
  const [splits, setSplits] = useState<Split[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Share loading
  const [sharingId, setSharingId] = useState<string | null>(null);

  // Rename modal
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Group modal
  const [showModal, setShowModal] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [grouping, setGrouping] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [s, g] = await Promise.all([getSplits(), getGroups()]);
      setSplits(s);
      setGroups(g);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  // Header updates for selection mode
  useEffect(() => {
    if (selectionMode) {
      navigation.setOptions({
        headerLeft: () => (
          <Pressable onPress={cancelSelection} hitSlop={12} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, marginLeft: 4 }]}>
            <Text style={{ color: C.accent, fontSize: 16, fontWeight: '500' }}>Cancelar</Text>
          </Pressable>
        ),
        title: selectedIds.size > 0 ? `${selectedIds.size} seleccionado${selectedIds.size > 1 ? 's' : ''}` : 'Seleccionar',
      });
    } else {
      navigation.setOptions({ headerLeft: undefined, title: 'Historial' });
    }
  }, [selectionMode, selectedIds.size]);

  const enterSelection = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  };

  const toggleSelect = (id: string) => {
    Haptics.selectionAsync();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleCreateGroup = async () => {
    if (!groupNameInput.trim() || selectedIds.size < 2) return;
    setGrouping(true);
    try {
      const ids = Array.from(selectedIds);
      const newGroup = await createGroup(groupNameInput.trim(), ids);
      const details = await getGroupDetail(newGroup.id);
      const msg = buildGroupMessage(groupNameInput.trim(), details);

      setShowModal(false);
      setGroupNameInput('');
      cancelSelection();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      load(true);
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`);
    } catch {
      Alert.alert('Error', 'No se pudo crear el grupo.');
    } finally {
      setGrouping(false);
    }
  };

  const handleShareSplit = async (split: Split) => {
    if (sharingId) return;
    setSharingId(split.id);
    try {
      const detail = await getSplitDetail(split.id);
      const msg = buildSingleMessage(detail);
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`);
    } catch {
      Alert.alert('Error', 'No se pudo cargar el split.');
    } finally {
      setSharingId(null);
    }
  };

  const handleLongPressSplit = (split: Split) => {
    if (selectionMode) { toggleSelect(split.id); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(split.name, undefined, [
      {
        text: 'Renombrar', onPress: () => {
          setRenameId(split.id);
          setRenameInput(split.name);
        },
      },
      { text: 'Seleccionar', onPress: () => enterSelection(split.id) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const handleRename = async () => {
    if (!renameId || !renameInput.trim()) return;
    setRenaming(true);
    try {
      await updateSplitName(renameId, renameInput.trim());
      setSplits((p) => p.map((s) => s.id === renameId ? { ...s, name: renameInput.trim() } : s));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRenameId(null);
    } catch {
      Alert.alert('Error', 'No se pudo renombrar.');
    } finally {
      setRenaming(false);
    }
  };

  const confirmDeleteSplit = (split: Split) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Eliminar split', `¿Eliminar "${split.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          try {
            await deleteSplit(split.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            LayoutAnimation.configureNext(LAYOUT_SPRING);
            setSplits((p) => p.filter((s) => s.id !== split.id));
          } catch { Alert.alert('Error', 'No se pudo eliminar.'); }
        },
      },
    ]);
  };

  const confirmDeleteGroup = (group: Group) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Eliminar grupo', `¿Eliminar "${group.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          try {
            await deleteGroup(group.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            LayoutAnimation.configureNext(LAYOUT_SPRING);
            setGroups((p) => p.filter((g) => g.id !== group.id));
          } catch { Alert.alert('Error', 'No se pudo eliminar.'); }
        },
      },
    ]);
  };

  const filteredSplits = splits.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));
  const filteredGroups = groups.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()));
  const sections = groupByDate(filteredSplits);
  const isEmpty = filteredSplits.length === 0 && filteredGroups.length === 0;

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={C.accent} /></View>;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isEmpty && styles.contentEmpty]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.accent} />}
      >
        {/* Search */}
        {(splits.length > 0 || groups.length > 0) && (
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar..."
            placeholderTextColor={C.textMuted}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        )}

        {/* Groups section */}
        {filteredGroups.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>GRUPOS</Text>
            <View style={styles.sectionCard}>
              {filteredGroups.map((group, idx) => (
                <View key={group.id}>
                  <Pressable
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                    onPress={() => navigation.navigate('GroupDetail', { groupId: group.id, groupName: group.name })}
                    onLongPress={() => confirmDeleteGroup(group)}
                  >
                    <View style={[styles.groupIconWrap]}>
                      <Text style={styles.groupInitial}>{group.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.rowMain}>
                      <Text style={styles.rowName}>{group.name}</Text>
                      <Text style={styles.rowMeta}>
                        {group.group_splits.length} splits · {formatDate(group.created_at)}
                      </Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Pressable onPress={() => confirmDeleteGroup(group)} hitSlop={12} style={({ pressed }) => [{ opacity: pressed ? 0.4 : 1 }]}>
                        <Text style={styles.deleteText}>×</Text>
                      </Pressable>
                      <Text style={styles.chevron}>›</Text>
                    </View>
                  </Pressable>
                  {idx < filteredGroups.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Individual splits by date */}
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.data.map((split, idx) => {
                const isSelected = selectedIds.has(split.id);
                return (
                  <View key={split.id}>
                    <Pressable
                      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, isSelected && styles.rowSelected]}
                      onPress={() => selectionMode ? toggleSelect(split.id) : navigation.navigate('SplitDetail', { splitId: split.id, splitName: split.name })}
                      onLongPress={() => handleLongPressSplit(split)}
                    >
                      {selectionMode ? (
                        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                          {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                      ) : (
                        <View style={[styles.avatar, { backgroundColor: C.accent + '18' }]}>
                          <Text style={styles.avatarText}>{split.name.charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                      <View style={styles.rowMain}>
                        <Text style={styles.rowName}>{split.name}</Text>
                        <Text style={styles.rowMeta}>
                          {split.people.length} {split.people.length === 1 ? 'persona' : 'personas'} · {formatDate(split.created_at)}
                        </Text>
                      </View>
                      {!selectionMode && (
                        <View style={styles.rowRight}>
                          <Pressable
                            onPress={() => handleShareSplit(split)}
                            hitSlop={12}
                            style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.5 }]}
                            disabled={sharingId === split.id}
                          >
                            <Text style={styles.shareBtnText}>
                              {sharingId === split.id ? '...' : 'WA'}
                            </Text>
                          </Pressable>
                          <Pressable onPress={() => confirmDeleteSplit(split)} hitSlop={12} style={({ pressed }) => [{ opacity: pressed ? 0.4 : 1 }]}>
                            <Text style={styles.deleteText}>×</Text>
                          </Pressable>
                          <Text style={styles.chevron}>›</Text>
                        </View>
                      )}
                    </Pressable>
                    {idx < section.data.length - 1 && <View style={styles.divider} />}
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        {isEmpty && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🧾</Text>
            <Text style={styles.emptyTitle}>{search ? 'Sin resultados' : 'Sin splits aun'}</Text>
            <Text style={styles.emptySubtitle}>
              {search ? `No hay splits con "${search}".` : 'Los splits guardados apareceran aqui.'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Floating action bar for selection mode */}
      {selectionMode && (
        <View style={styles.floatingBar}>
          <Text style={styles.floatingBarHint}>
            {selectedIds.size < 2 ? 'Selecciona 2+ splits para agrupar' : `${selectedIds.size} splits seleccionados`}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.groupBtn,
              selectedIds.size < 2 && styles.groupBtnDisabled,
              pressed && styles.btnPressed,
            ]}
            onPress={() => { if (selectedIds.size >= 2) setShowModal(true); }}
            disabled={selectedIds.size < 2}
          >
            <Text style={styles.groupBtnText}>Agrupar ({selectedIds.size})</Text>
          </Pressable>
        </View>
      )}

      {/* Rename modal */}
      <Modal visible={renameId !== null} transparent animationType="fade" onRequestClose={() => setRenameId(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setRenameId(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Renombrar split</Text>
            <TextInput
              style={styles.modalInput}
              value={renameInput}
              onChangeText={setRenameInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleRename}
              placeholderTextColor={C.textMuted}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [styles.modalCancelBtn, pressed && styles.btnPressed]}
                onPress={() => setRenameId(null)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalConfirmBtn,
                  (!renameInput.trim() || renaming) && styles.modalConfirmDisabled,
                  pressed && styles.btnPressed,
                ]}
                onPress={handleRename}
                disabled={!renameInput.trim() || renaming}
              >
                <Text style={styles.modalConfirmText}>{renaming ? 'Guardando...' : 'Guardar'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Group name modal */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Nombre del grupo</Text>
            <Text style={styles.modalSubtitle}>{selectedIds.size} splits seleccionados</Text>
            <TextInput
              style={styles.modalInput}
              placeholder='Ej: Rincón Weekend'
              placeholderTextColor={C.textMuted}
              value={groupNameInput}
              onChangeText={setGroupNameInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreateGroup}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [styles.modalCancelBtn, pressed && styles.btnPressed]}
                onPress={() => { setShowModal(false); setGroupNameInput(''); }}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalConfirmBtn,
                  (!groupNameInput.trim() || grouping) && styles.modalConfirmDisabled,
                  pressed && styles.btnPressed,
                ]}
                onPress={handleCreateGroup}
                disabled={!groupNameInput.trim() || grouping}
              >
                <Text style={styles.modalConfirmText}>
                  {grouping ? 'Creando...' : 'Crear grupo'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 120, gap: 4 },
  contentEmpty: { flex: 1 },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },

  searchInput: {
    backgroundColor: C.surface, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, color: C.text, marginBottom: 12,
  },

  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.textSub, letterSpacing: 0.2, marginBottom: 8, paddingHorizontal: 2 },
  sectionCard: { backgroundColor: C.surface, borderRadius: 16, overflow: 'hidden' },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  rowPressed: { backgroundColor: C.surfaceHigh },
  rowSelected: { backgroundColor: C.accent + '0A' },
  rowMain: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '600', color: C.text, marginBottom: 2 },
  rowMeta: { fontSize: 12, color: C.textMuted },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { height: 1, backgroundColor: C.border, marginLeft: 60 },

  avatar: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700', color: C.accent },

  groupIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.warningBg, alignItems: 'center', justifyContent: 'center' },
  groupInitial: { fontSize: 15, fontWeight: '700', color: C.warning },

  checkbox: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    borderColor: C.border, backgroundColor: C.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: C.accent, borderColor: C.accent },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },

  deleteText: { color: C.textMuted, fontSize: 20, lineHeight: 22 },
  chevron: { fontSize: 20, color: C.textMuted, fontWeight: '300' },

  shareBtn: {
    backgroundColor: C.whatsapp, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  shareBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: C.textMuted, textAlign: 'center', maxWidth: 240 },

  // Floating bar
  floatingBar: {
    position: 'absolute', bottom: 24, left: 16, right: 16,
    backgroundColor: C.surface, borderRadius: 18,
    padding: 16, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 8,
  },
  floatingBarHint: { fontSize: 13, color: C.textSub, textAlign: 'center' },
  groupBtn: { backgroundColor: C.accent, padding: 14, borderRadius: 12, alignItems: 'center' },
  groupBtnDisabled: { backgroundColor: C.textMuted },
  groupBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnPressed: { transform: [{ scale: 0.97 }], opacity: 0.88 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: C.surface, borderRadius: 20,
    padding: 24, width: '100%', gap: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  modalSubtitle: { fontSize: 13, color: C.textMuted, marginBottom: 6 },
  modalInput: {
    borderWidth: 1, borderColor: C.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, color: C.text, backgroundColor: '#F9F9FB',
    marginBottom: 8,
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1, padding: 13, borderRadius: 12, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  modalCancelText: { color: C.textSub, fontWeight: '600', fontSize: 15 },
  modalConfirmBtn: { flex: 1, padding: 13, borderRadius: 12, alignItems: 'center', backgroundColor: C.accent },
  modalConfirmDisabled: { backgroundColor: C.textMuted },
  modalConfirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
