import { FlatList, StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { EmptyState, IconCircle } from "@/components/accounting-ui";
import { categoryMeta, formatAmount, useAccounting } from "@/lib/accounting";

export default function EntriesScreen() {
  const { state } = useAccounting();
  const accountsById = new Map(state.accounts.map((item) => [item.id, item]));
  return (
    <ScreenContainer className="px-4" containerClassName="bg-background">
      <View style={styles.header}><Text style={styles.eyebrow}>سجل البيانات</Text><Text style={styles.title}>القيود والحركات</Text></View>
      <FlatList data={state.entries} keyExtractor={(item) => item.id} showsVerticalScrollIndicator={false} contentContainerStyle={state.entries.length ? styles.list : styles.emptyList} ListEmptyComponent={<EmptyState icon="receipt-long" title="لا توجد حركات مسجلة" description="عند إضافة أول حركة مالية، ستظهر هنا مع تفاصيلها وتاريخها." />} renderItem={({ item }) => { const meta = categoryMeta[item.category]; const account = accountsById.get(item.accountId); return <View style={styles.entryCard}><IconCircle icon={meta.icon as "account-balance-wallet"} color={meta.color} background={meta.softColor} /><View style={styles.entryCopy}><Text style={styles.entryName}>{account?.name ?? "حساب محذوف"}</Text><Text style={styles.entryNote}>{item.note || meta.label}</Text><Text style={styles.entryDate}>{new Intl.DateTimeFormat("ar-LY", { dateStyle: "medium" }).format(new Date(item.date))}</Text></View><Text style={[styles.entryAmount, { color: meta.color }]}>{formatAmount(item.amount, state.currency)}</Text></View>; }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "flex-end", gap: 2, marginBottom: 15, paddingTop: 10 }, eyebrow: { color: "#65737E", fontSize: 12, fontWeight: "600", writingDirection: "rtl" }, title: { color: "#14212B", fontSize: 26, fontWeight: "800", lineHeight: 35, writingDirection: "rtl" }, list: { gap: 10, paddingBottom: 20 }, emptyList: { flexGrow: 1, justifyContent: "center", paddingBottom: 80 }, entryCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 18, borderWidth: 1, flexDirection: "row-reverse", gap: 12, padding: 14 }, entryCopy: { alignItems: "flex-end", flex: 1 }, entryName: { color: "#14212B", fontSize: 16, fontWeight: "700", writingDirection: "rtl" }, entryNote: { color: "#65737E", fontSize: 12, marginTop: 2, writingDirection: "rtl" }, entryDate: { color: "#98A5AE", fontSize: 11, marginTop: 4, writingDirection: "rtl" }, entryAmount: { fontSize: 13, fontWeight: "800", writingDirection: "rtl" },
});
