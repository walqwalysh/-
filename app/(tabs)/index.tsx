import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { EmptyState, IconCircle, PrimaryButton } from "@/components/accounting-ui";
import { categories, categoryMeta, formatAmount, useAccounting } from "@/lib/accounting";

export default function HomeScreen() {
  const router = useRouter();
  const { state, summary, netIncome, financialPosition, isReady } = useAccounting();
  if (!isReady) return <ScreenContainer className="items-center justify-center"><Text style={styles.loading}>يتم تجهيز بياناتك...</Text></ScreenContainer>;

  const hasData = state.entries.length > 0 || state.accounts.length > 0;
  return (
    <ScreenContainer className="px-4" containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="الإعدادات" onPress={() => router.push("/settings" as never)} style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}><MaterialIcons name="settings" size={22} color="#154C79" /></Pressable>
          <View style={styles.headerCopy}><Text style={styles.eyebrow}>نظرة مالية</Text><Text style={styles.title}>المحاسب الذكي</Text></View>
        </View>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}><IconCircle icon="account-balance" color="#FFFFFF" background="rgba(255,255,255,0.18)" /><View style={styles.heroCopy}><Text style={styles.heroLabel}>صافي المركز المالي</Text><Text style={styles.heroAmount}>{formatAmount(financialPosition, state.currency)}</Text></View></View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStats}><View style={styles.heroStat}><Text style={styles.heroStatLabel}>صافي الربح</Text><Text style={styles.heroStatValue}>{formatAmount(netIncome, state.currency)}</Text></View><View style={styles.heroStat}><Text style={styles.heroStatLabel}>الحركات المسجلة</Text><Text style={styles.heroStatValue}>{state.entries.length.toLocaleString("ar-LY")}</Text></View></View>
        </View>
        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>ملخص الحسابات</Text><Text style={styles.sectionHint}>وفق بياناتك الفعلية</Text></View>
        <View style={styles.categoryGrid}>
          {categories.map((category) => { const meta = categoryMeta[category]; return <Pressable key={category} onPress={() => router.push({ pathname: "/reports" as never, params: { category } })} style={({ pressed }) => [styles.categoryCard, pressed && styles.pressed]}><IconCircle icon={meta.icon as "account-balance-wallet"} color={meta.color} background={meta.softColor} /><Text style={styles.categoryName}>{meta.label}</Text><Text style={[styles.categoryValue, { color: meta.color }]}>{formatAmount(summary[category], state.currency)}</Text></Pressable>; })}
        </View>
        {!hasData ? <View style={styles.emptyCard}><EmptyState icon="playlist-add" title="ميزانيتك تبدأ من الصفر" description="أضف حسابك أو أول حركة مالية، وستظهر ملخصاتك وتقاريرك هنا فوراً." /></View> : null}
        <View style={styles.quickSection}><Text style={styles.sectionTitle}>إجراء سريع</Text><PrimaryButton label="إضافة حركة مالية" icon="add" onPress={() => router.push("/add")} /></View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18, paddingBottom: 28, paddingTop: 10 }, loading: { color: "#65737E", fontSize: 15 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 54 }, headerCopy: { alignItems: "flex-end" }, eyebrow: { color: "#65737E", fontSize: 12, fontWeight: "600", writingDirection: "rtl" }, title: { color: "#14212B", fontSize: 25, fontWeight: "800", lineHeight: 34, writingDirection: "rtl" }, settingsButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 14, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  heroCard: { backgroundColor: "#154C79", borderRadius: 24, padding: 20, shadowColor: "#154C79", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 18 }, heroTop: { alignItems: "center", flexDirection: "row", gap: 12 }, heroCopy: { alignItems: "flex-end", flex: 1 }, heroLabel: { color: "#DCEAF7", fontSize: 13, fontWeight: "600", writingDirection: "rtl" }, heroAmount: { color: "#FFFFFF", fontSize: 27, fontWeight: "800", lineHeight: 39, writingDirection: "rtl" }, heroDivider: { backgroundColor: "rgba(255,255,255,0.2)", height: 1, marginVertical: 17 }, heroStats: { flexDirection: "row-reverse", justifyContent: "space-between" }, heroStat: { alignItems: "flex-end", gap: 4 }, heroStatLabel: { color: "#DCEAF7", fontSize: 12, writingDirection: "rtl" }, heroStatValue: { color: "#FFFFFF", fontSize: 15, fontWeight: "700", writingDirection: "rtl" },
  sectionHeading: { alignItems: "baseline", flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 4 }, sectionTitle: { color: "#14212B", fontSize: 18, fontWeight: "800", writingDirection: "rtl" }, sectionHint: { color: "#65737E", fontSize: 12, writingDirection: "rtl" }, categoryGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 }, categoryCard: { alignItems: "flex-end", backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 18, borderWidth: 1, gap: 7, minHeight: 142, padding: 14, width: "48.5%" }, categoryName: { color: "#65737E", fontSize: 13, fontWeight: "600", writingDirection: "rtl" }, categoryValue: { fontSize: 15, fontWeight: "800", writingDirection: "rtl" }, emptyCard: { backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 20, borderWidth: 1 }, quickSection: { gap: 12, marginTop: 4 }, pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
