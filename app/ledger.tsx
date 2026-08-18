import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { EmptyState, IconCircle } from "@/components/accounting-ui";
import { ScreenContainer } from "@/components/screen-container";
import { calculateGeneralLedger, type GeneralLedgerLine } from "@/lib/accounting-calculations";
import { formatAmount, useAccounting } from "@/lib/accounting";

export default function LedgerScreen() {
  const { state } = useAccounting();
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>();
  const ledger = useMemo(
    () => calculateGeneralLedger(
      state.accounts,
      state.journalEntries.map((entry) => ({ id: entry.id, date: entry.date, description: entry.description, reference: entry.documentReference, lines: entry.lines })),
    ),
    [state.accounts, state.journalEntries],
  );
  const selectedAccount = state.accounts.find((account) => account.id === selectedAccountId);
  const lines = selectedAccountId ? ledger[selectedAccountId] ?? [] : [];

  return (
    <ScreenContainer className="px-4" containerClassName="bg-background">
      <FlatList
        data={lines}
        keyExtractor={(item) => `${item.journalId}-${item.accountId}`}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.header}><View style={styles.headerCopy}><Text style={styles.eyebrow}>تقارير تفصيلية</Text><Text style={styles.title}>دفتر الأستاذ</Text><Text style={styles.subtitle}>حركات القيود المتوازنة فقط، مرتبة بحسب تاريخ القيد.</Text></View><IconCircle icon="menu-book" color="#154C79" background="#E4F1F9" size={48} /></View>
            {state.accounts.length > 0 ? <FlatList
              horizontal
              inverted
              data={state.accounts}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.accountSelector}
              renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => setSelectedAccountId(item.id)} style={({ pressed }) => [styles.accountChip, selectedAccountId === item.id && styles.accountChipActive, pressed && styles.pressed]}><Text style={[styles.accountChipCode, selectedAccountId === item.id && styles.accountChipTextActive]}>{item.code}</Text><Text numberOfLines={1} style={[styles.accountChipName, selectedAccountId === item.id && styles.accountChipTextActive]}>{item.name}</Text></Pressable>}
            /> : null}
            {selectedAccount ? <View style={styles.summaryCard}><View style={styles.summaryCopy}><Text style={styles.summaryLabel}>الحساب المحدد</Text><Text style={styles.summaryTitle}>{selectedAccount.name}</Text><Text style={styles.summaryHint}>{lines.length.toLocaleString("ar-LY")} حركة ظاهرة في دفتر الأستاذ</Text></View><View style={styles.summaryBalance}><Text style={styles.summaryBalanceLabel}>الرصيد الجاري</Text><Text style={styles.summaryBalanceValue}>{formatAmount(lines.at(-1)?.runningDebit ?? -(lines.at(-1)?.runningCredit ?? 0), state.currency)}</Text></View></View> : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            {state.accounts.length === 0 ? <EmptyState icon="account-balance" title="دليل الحسابات فارغ" description="أضف حساباً أولاً، ثم سجّل قيداً مزدوجاً متوازناً لتظهر حركته هنا." /> : !selectedAccount ? <EmptyState icon="touch-app" title="اختر حساباً" description="اختر حساباً من الشريط أعلاه لعرض حركاته التفصيلية." /> : <EmptyState icon="receipt-long" title="لا توجد حركات لهذا الحساب" description="لم يُسجّل أي قيد متوازن على هذا الحساب بعد." />}
          </View>
        }
        renderItem={({ item }) => <LedgerRow line={item} currency={state.currency} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={selectedAccount ? <View style={styles.note}><MaterialIcons name="verified" size={18} color="#168A63" /><Text style={styles.noteText}>يُستبعد أي قيد غير متوازن من دفتر الأستاذ حتى يُصحّح في مصدره.</Text></View> : null}
      />
    </ScreenContainer>
  );
}

function LedgerRow({ line, currency }: { line: GeneralLedgerLine; currency: string }) {
  return <View style={styles.row}><View style={styles.rowMain}><Text style={styles.rowDate}>{line.date}</Text><Text style={styles.rowDescription}>{line.description}</Text>{line.reference ? <Text style={styles.rowReference}>مرجع: {line.reference}</Text> : null}</View><View style={styles.amounts}><Text style={styles.debit}>{line.debit ? formatAmount(line.debit, currency) : "—"}</Text><Text style={styles.credit}>{line.credit ? formatAmount(line.credit, currency) : "—"}</Text></View><View style={styles.running}><Text style={styles.runningLabel}>الرصيد</Text><Text style={styles.runningValue}>{line.runningDebit ? formatAmount(line.runningDebit, currency) : formatAmount(line.runningCredit, currency)}</Text><Text style={styles.runningSide}>{line.runningDebit ? "مدين" : line.runningCredit ? "دائن" : "—"}</Text></View></View>;
}

const styles = StyleSheet.create({
  content: { gap: 10, paddingBottom: 28, paddingTop: 10 }, headerContent: { gap: 12 }, header: { alignItems: "center", flexDirection: "row-reverse", gap: 12 }, headerCopy: { alignItems: "flex-end", flex: 1 }, eyebrow: { color: "#65737E", fontSize: 12, fontWeight: "700", writingDirection: "rtl" }, title: { color: "#14212B", fontSize: 26, fontWeight: "800", lineHeight: 34, writingDirection: "rtl" }, subtitle: { color: "#65737E", fontSize: 12, lineHeight: 18, marginTop: 2, textAlign: "right", writingDirection: "rtl" }, accountSelector: { gap: 8, paddingVertical: 2 }, accountChip: { backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 14, borderWidth: 1, maxWidth: 160, minHeight: 58, paddingHorizontal: 12, paddingVertical: 9 }, accountChipActive: { backgroundColor: "#154C79", borderColor: "#154C79" }, accountChipCode: { color: "#65737E", fontSize: 10, fontWeight: "800", writingDirection: "ltr" }, accountChipName: { color: "#33454F", fontSize: 12, fontWeight: "700", marginTop: 3, textAlign: "right", writingDirection: "rtl" }, accountChipTextActive: { color: "#FFFFFF" }, summaryCard: { alignItems: "center", backgroundColor: "#EAF3FA", borderRadius: 18, flexDirection: "row-reverse", gap: 12, padding: 14 }, summaryCopy: { alignItems: "flex-end", flex: 1 }, summaryLabel: { color: "#557085", fontSize: 11, fontWeight: "700", writingDirection: "rtl" }, summaryTitle: { color: "#154C79", fontSize: 16, fontWeight: "800", marginTop: 2, writingDirection: "rtl" }, summaryHint: { color: "#557085", fontSize: 11, marginTop: 3, writingDirection: "rtl" }, summaryBalance: { alignItems: "flex-start" }, summaryBalanceLabel: { color: "#557085", fontSize: 10, fontWeight: "700", writingDirection: "rtl" }, summaryBalanceValue: { color: "#154C79", fontSize: 13, fontWeight: "800", marginTop: 3, writingDirection: "rtl" }, emptyCard: { backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 20, borderWidth: 1, marginTop: 8 }, row: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 16, borderWidth: 1, flexDirection: "row-reverse", gap: 10, padding: 12 }, rowMain: { alignItems: "flex-end", flex: 1 }, rowDate: { color: "#65737E", fontSize: 10, fontWeight: "700", writingDirection: "ltr" }, rowDescription: { color: "#14212B", fontSize: 13, fontWeight: "700", marginTop: 2, textAlign: "right", writingDirection: "rtl" }, rowReference: { color: "#65737E", fontSize: 10, marginTop: 2, textAlign: "right", writingDirection: "rtl" }, amounts: { alignItems: "flex-end", width: 86 }, debit: { color: "#168A63", fontSize: 11, fontWeight: "800", writingDirection: "rtl" }, credit: { color: "#C44747", fontSize: 11, fontWeight: "800", marginTop: 3, writingDirection: "rtl" }, running: { alignItems: "flex-end", width: 84 }, runningLabel: { color: "#65737E", fontSize: 9, fontWeight: "700", writingDirection: "rtl" }, runningValue: { color: "#14212B", fontSize: 11, fontWeight: "800", marginTop: 2, writingDirection: "rtl" }, runningSide: { color: "#65737E", fontSize: 9, marginTop: 2, writingDirection: "rtl" }, separator: { height: 0 }, note: { alignItems: "flex-start", backgroundColor: "#E7F6EF", borderRadius: 14, flexDirection: "row-reverse", gap: 8, marginTop: 6, padding: 12 }, noteText: { color: "#168A63", flex: 1, fontSize: 11, fontWeight: "600", lineHeight: 17, textAlign: "right", writingDirection: "rtl" }, pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
