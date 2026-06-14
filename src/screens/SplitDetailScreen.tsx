import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Linking, Alert, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../types/navigation';
import { getSplitDetail, buildSingleMessage, generateSplitHTML, computePersonShares } from '../lib/splitService';
import { getDefaultCurrency } from '../lib/settings';

type Props = NativeStackScreenProps<RootStackParamList, 'SplitDetail'>;

import { useColors } from '../lib/theme';
import { SkeletonCard } from '../components/SkeletonLoader';

type Detail = Awaited<ReturnType<typeof getSplitDetail>>;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });

export default function SplitDetailScreen({ route, navigation }: Props) {
  const C = useColors();
  const styles = makeStyles(C);
  const { splitId } = route.params;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(null);
  const [photoExpanded, setPhotoExpanded] = useState(false);
  const [currency, setCurrency] = useState('$');

  useEffect(() => {
    getDefaultCurrency().then((c) => setCurrency(c)).catch(() => {});
    getSplitDetail(splitId)
      .then((d) => { setDetail(d); navigation.setOptions({ title: d.name }); })
      .catch(() => setError('No se pudo cargar el divvi.'))
      .finally(() => setLoading(false));
    AsyncStorage.getItem(`receipt_photo_${splitId}`).then((uri) => {
      if (uri) setReceiptPhoto(uri);
    }).catch(() => {});
  }, [splitId]);

  const handleExportPdf = async () => {
    if (!detail) return;
    setExportingPdf(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: generateSplitHTML(detail) });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setPdfError('No se pudo exportar el PDF.');
      setTimeout(() => setPdfError(''), 3000);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleNavigateEdit = () => navigation.navigate('EditSplit', { splitId, splitName: detail?.name ?? route.params.splitName ?? '' });
  const handleNavigateSettlements = () => navigation.navigate('Settlements', { splitId, splitName: detail?.name ?? route.params.splitName ?? '' });
  const handleShareLink = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`https://api.whatsapp.com/send?text=${encodeURIComponent(
      `Mira este divvi en la app: divvi://split/${splitId}`
    )}`);
  };

  if (loading) {
    return (
      <View style={[styles.scroll, { padding: 16, gap: 12 }]}>
        <View style={{ height: 16, width: 120, backgroundColor: C.border, borderRadius: 6, opacity: 0.6 }} />
        <SkeletonCard rows={4} />
        <SkeletonCard rows={3} />
      </View>
    );
  }

  if (error || !detail) {
    return <View style={styles.center}><Text style={styles.errorText}>{error}</Text></View>;
  }

  const personMap: Record<string, string> = {};
  detail.people.forEach((p) => { personMap[p.id] = p.name; });

  const subtotal = detail.items.reduce((sum, item) => sum + Number(item.price), 0);
  const tip = Number(detail.tip_amount ?? 0);
  const tax = Number(detail.tax_amount ?? 0);
  const grandTotal = subtotal + tip + tax;
  const summary = computePersonShares(detail).map((s) => ({ name: s.name, total: s.amount }));

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.date}>{formatDate(detail.created_at)}</Text>

      {/* Receipt photo */}
      {receiptPhoto && (
        <Pressable onPress={() => setPhotoExpanded((p) => !p)} style={styles.photoWrap}>
          <Image
            source={{ uri: receiptPhoto }}
            style={[styles.receiptPhoto, photoExpanded && styles.receiptPhotoExpanded]}
            resizeMode="contain"
          />
          <Text style={styles.photoHint}>{photoExpanded ? 'Tocar para minimizar' : 'Tocar para ver recibo'}</Text>
        </Pressable>
      )}

      {/* Items */}
      <View style={styles.card}>
        <Text style={styles.label}>ITEMS</Text>
        {detail.items.map((item, idx) => {
          const assigned = item.item_assignments.map((a) => personMap[a.person_id]).filter(Boolean);
          return (
            <View key={item.id} style={[styles.itemRow, idx === 0 && styles.itemRowFirst]}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>{currency}{Number(item.price).toFixed(2)}</Text>
              </View>
              {assigned.length > 0 && (
                <Text style={styles.itemAssigned}>{assigned.join(', ')}</Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Resumen */}
      <View style={styles.card}>
        <Text style={styles.label}>RESUMEN</Text>
        {summary.map(({ name, total }, idx) => (
          <View
            key={name}
            style={[styles.summaryRow, idx === summary.length - 1 && styles.summaryRowLast]}
          >
            <Text style={styles.summaryName}>{name}</Text>
            <Text style={styles.summaryAmount}>{currency}{total.toFixed(2)}</Text>
          </View>
        ))}
        {(tip > 0 || tax > 0) && (
          <View style={styles.breakdownSection}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Subtotal</Text>
              <Text style={styles.breakdownValue}>{currency}{subtotal.toFixed(2)}</Text>
            </View>
            {tip > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Propina</Text>
                <Text style={styles.breakdownValue}>+{currency}{tip.toFixed(2)}</Text>
              </View>
            )}
            {tax > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Impuesto</Text>
                <Text style={styles.breakdownValue}>+{currency}{tax.toFixed(2)}</Text>
              </View>
            )}
          </View>
        )}
        <View style={styles.totalBlock}>
          <Text style={styles.totalLabel}>TOTAL</Text>
          <Text style={styles.totalAmount}>{currency}{grandTotal.toFixed(2)}</Text>
        </View>
      </View>

      {pdfError !== '' && <Text style={styles.inlineError}>{pdfError}</Text>}
      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [styles.whatsappBtn, pressed && styles.pressed]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Linking.openURL(`https://wa.me/?text=${encodeURIComponent(buildSingleMessage(detail))}`);
          }}
          accessibilityLabel="Compartir por WhatsApp"
          accessibilityRole="button"
        >
          <Text style={styles.whatsappBtnText}>WhatsApp</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.pdfBtn, exportingPdf && styles.btnDisabled, pressed && styles.pressed]}
          onPress={handleExportPdf}
          disabled={exportingPdf}
          accessibilityLabel="Exportar como PDF"
          accessibilityRole="button"
        >
          <Text style={styles.pdfBtnText}>{exportingPdf ? '...' : 'PDF'}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
          onPress={handleNavigateEdit}
          accessibilityLabel="Editar divvi"
          accessibilityRole="button"
        >
          <Text style={styles.editBtnText}>Editar</Text>
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
        onPress={handleShareLink}
      >
        <Text style={styles.linkBtnText}>Compartir enlace</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.settlementsBtn, pressed && styles.pressed]}
        onPress={handleNavigateSettlements}
        accessibilityLabel="Ver pagos"
        accessibilityRole="button"
      >
        <Text style={styles.settlementsBtnText}>Ver pagos</Text>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (C: ReturnType<typeof useColors>) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 60, gap: 12 },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: C.danger, fontSize: 15 },
  inlineError: { color: C.danger, fontSize: 13, textAlign: 'center', marginBottom: 4 },
  photoWrap: { backgroundColor: C.surface, borderRadius: 16, overflow: 'hidden', alignItems: 'center' },
  receiptPhoto: { width: '100%', height: 120 },
  receiptPhotoExpanded: { height: 400 },
  photoHint: { fontSize: 11, color: C.textDim, paddingVertical: 6 },
  date: { fontSize: 13, color: C.textSub, marginBottom: 4 },
  card: { backgroundColor: C.surface, borderRadius: 16, padding: 16 },
  label: { fontSize: 11, fontWeight: '600', color: C.textSub, letterSpacing: 0.8 },
  itemRow: { borderTopWidth: 1, borderTopColor: C.border, marginTop: 12, paddingTop: 12 },
  itemRowFirst: { marginTop: 14 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  itemName: { fontSize: 15, fontWeight: '600', color: C.text, flex: 1 },
  itemPrice: { fontSize: 15, fontWeight: '700', color: C.accent },
  itemAssigned: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  summaryRowLast: { borderBottomWidth: 0 },
  summaryName: { fontSize: 15, color: C.text },
  summaryAmount: { fontSize: 15, fontWeight: '600', color: C.text },
  totalBlock: {
    backgroundColor: C.accentDim,
    borderRadius: 14, paddingHorizontal: 18,
    paddingTop: 16, paddingBottom: 18,
    marginTop: 10,
    alignItems: 'center',
  },
  totalLabel: { fontSize: 10, fontWeight: '700', color: C.accentText, letterSpacing: 1.8, marginBottom: 4 },
  totalAmount: { fontSize: 42, fontWeight: '800', color: C.accent, letterSpacing: -2 },
  breakdownSection: { gap: 4, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border, marginTop: 4 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownLabel: { fontSize: 13, color: C.textSub },
  breakdownValue: { fontSize: 13, color: C.textSub, fontWeight: '500' },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  whatsappBtn: {
    flex: 2, backgroundColor: C.whatsapp, padding: 16,
    borderRadius: 14, alignItems: 'center',
    shadowColor: C.whatsapp,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22, shadowRadius: 8,
  },
  whatsappBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  pdfBtn: {
    flex: 1, backgroundColor: C.accent, padding: 16,
    borderRadius: 14, alignItems: 'center',
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22, shadowRadius: 8,
  },
  pdfBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  editBtn: {
    flex: 1, borderWidth: 1.5, borderColor: C.borderMid, padding: 16,
    borderRadius: 14, alignItems: 'center',
    backgroundColor: C.surface,
  },
  editBtnText: { color: C.text, fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.88 },

  linkBtn: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 14,
    padding: 14, alignItems: 'center',
  },
  linkBtnText: { color: C.textSec, fontSize: 14, fontWeight: '600' },
  settlementsBtn: {
    borderWidth: 1.5, borderColor: C.accent, padding: 16,
    borderRadius: 14, alignItems: 'center',
    backgroundColor: C.accentDim,
  },
  settlementsBtnText: { color: C.accent, fontSize: 15, fontWeight: '700' },
});
