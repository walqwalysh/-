import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { EmptyState, IconCircle } from "@/components/accounting-ui";
import { AccountCategory, categories, categoryMeta, formatAmount, useAccounting } from "@/lib/accounting";

export default function ReportsScreen() {
  const { category } = useLocalSearchParams<{ category?: AccountCategory }>();
  const { state, summary, netIncome } = useAccounting();
  const highlighted = category && categories.includes(category) ? category : undefined;
  const hasEntries = state.entries.length > 0;
  const categoryCounts = state.entries.reduce<Record<AccountCategory, number>>((counts, entry) => { counts[entry.category] += 1; return counts; }, { asset: 0, liability: 0, equity: 0, revenue: 0, expense: 0 });
  return (
    <ScreenContainer className="px-4" containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}><Text style={styles.eyebrow}>تحليل مالي</Text><Text style={styles.title}>التقارير</Text></View>
        {!hasEntries ? <View style={styles.emptyCard}><EmptyState icon="assessment" title="التقارير تنتظر بياناتك" description="لا توجد بيانات مالية لعرضها بعد. ستظهر التقارير التفصيلية فور تسجيل الحركات." /></View> : null}
        <View style={styles.positionCard}><View style={styles.positionTop}><IconCircle icon="analytics" color="#FFFFFF" background="rgba(255,255,255,0.16)" /><View style={styles.positionCopy}><Text style={styles.positionLabel}>نتيجة قائمة الدخل</Text><Text style={styles.positionValue}>{formatAmount(netIncome, state.currency)}</Text></View></View><Text style={styles.positionHint}>الإيرادات ناقص المصروفات</Text></View>
        <Text style={styles.sectionTitle}>تفاصيل القوائم المالية</Text>
        <View style={styles.reportList}>
          {categories.map((item) => {
            const meta = categoryMeta[item];
            const isHighlighted = item === highlighted;
            return <View key={item} style={[styles.reportCard, isHighlighted && { borderColor: meta.color, borderWidth: 1.5 }]}><IconCircle icon={meta.icon as "account-balance-wallet"} color={meta.color} background={meta.softColor} /><View style={styles.reportCopy}><Text style={styles.reportName}>{meta.label}</Text><Text style={styles.reportDescription}>{meta.description} · {categoryCounts[item].toLocaleString("ar-LY")} حركة</Text></View><Text style={[styles.reportAmount, { color: meta.color }]}>{formatAmount(summary[item], state.currency)}</Text></View>;
          })}
        </View>
        <View style={styles.note}><MaterialIcons name="info-outline" size={18} color="#154C79" /><Text style={styles.noteText}>تعرض هذه القوائم الحركات التي أدخلتها فقط؛ لا توجد أرصدة أو قيود مضافة تلقائياً.</Text></View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 25, paddingTop: 10 }, header: { alignItems: "flex-end", gap: 2, marginBottom: 2 }, eyebrow: { color: "#65737E", fontSize: 12, fontWeight: "600", writingDirection: "rtl" }, title: { color: "#14212B", fontSize: 26, fontWeight: "800", lineHeight: 35, writingDirection: "rtl" }, emptyCard: { backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 20, borderWidth: 1 },
  positionCard: { backgroundColor: "#154C79", borderRadius: 22, padding: 18 }, positionTop: { alignItems: "center", flexDirection: "row", gap: 12 }, positionCopy: { alignItems: "flex-end", flex: 1 }, positionLabel: { color: "#DCEAF7", fontSize: 13, fontWeight: "600", writingDirection: "rtl" }, positionValue: { color: "#FFFFFF", fontSize: 25, fontWeight: "800", lineHeight: 36, writingDirection: "rtl" }, positionHint: { color: "#DCEAF7", fontSize: 12, marginTop: 13, textAlign: "right", writingDirection: "rtl" },
  sectionTitle: { color: "#14212B", fontSize: 18, fontWeight: "800", marginTop: 4, textAlign: "right", writingDirection: "rtl" }, reportList: { gap: 9 }, reportCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 18, borderWidth: 1, flexDirection: "row-reverse", gap: 12, padding: 14 }, reportCopy: { alignItems: "flex-end", flex: 1 }, reportName: { color: "#14212B", fontSize: 16, fontWeight: "700", writingDirection: "rtl" }, reportDescription: { color: "#65737E", fontSize: 12, marginTop: 3, writingDirection: "rtl" }, reportAmount: { fontSize: 13, fontWeight: "800", writingDirection: "rtl" }, note: { alignItems: "flex-start", backgroundColor: "#EAF3FA", borderRadius: 14, flexDirection: "row-reverse", gap: 8, padding: 13 }, noteText: { color: "#154C79", flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 18, textAlign: "right", writingDirection: "rtl" },
});
