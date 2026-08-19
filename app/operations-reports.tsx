import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/accounting-ui";
import { ScreenContainer } from "@/components/screen-container";
import { createReportsWorkbook, reportExportFilename } from "@/lib/excel-reports";
import { calculateOperationalReports } from "@/lib/operational-reports";
import { useAccounting } from "@/lib/accounting";
import * as XLSX from "xlsx";

type ReportSection = "overview" | "inventory" | "assets";
const tabs: { id: ReportSection; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { id: "overview", label: "الملخص", icon: "insights" },
  { id: "inventory", label: "المخزون", icon: "inventory-2" },
  { id: "assets", label: "الأصول", icon: "account-balance" },
];

const amount = (value: number, currency: string) => `${value.toLocaleString("ar-LY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

export default function OperationsReportsScreen() {
  const router = useRouter();
  const { state } = useAccounting();
  const reports = calculateOperationalReports({
    documents: state.commercialDocuments,
    inventoryItems: state.inventoryItems,
    inventoryMovements: state.inventoryMovements,
    payrollRuns: state.payrollRuns,
    fixedAssets: state.fixedAssets,
    depreciationRecords: state.depreciationRecords,
    vouchers: state.vouchers,
  });
  const [active, setActive] = useState<ReportSection>("overview");
  async function exportReports() {
    try {
      if (Platform.OS === "web") { Alert.alert("التصدير على الويب", "استخدم التطبيق على Android أو iOS لمشاركة ملف Excel من جهازك."); return; }
      const directory = FileSystem.cacheDirectory;
      if (!directory) throw new Error("لا يتوفر مسار لحفظ الملف على الجهاز.");
      const base64 = XLSX.write(createReportsWorkbook(state), { bookType: "xlsx", type: "base64" });
      const uri = `${directory}${reportExportFilename()}`;
      await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
      if (!(await Sharing.isAvailableAsync())) throw new Error("المشاركة غير متاحة على هذا الجهاز.");
      await Sharing.shareAsync(uri, { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", dialogTitle: "تصدير تقارير المحاسب الذكي" });
    } catch (error) { Alert.alert("تعذر التصدير", error instanceof Error ? error.message : "حاول مرة أخرى."); }
  }

  const overview = <View style={styles.section}>
    <MetricRow title="المبيعات المرحّلة" value={amount(reports.sales.total, state.currency)} detail={`${reports.sales.count} فاتورة • صافي ${amount(reports.sales.net, state.currency)}`} icon="trending-up" color="#168A63" soft="#E3F5EE" />
    <MetricRow title="المشتريات المرحّلة" value={amount(reports.purchases.total, state.currency)} detail={`${reports.purchases.count} فاتورة • صافي ${amount(reports.purchases.net, state.currency)}`} icon="shopping-cart" color="#B97512" soft="#FFF4DD" />
    <MetricRow title="صافي الضريبة" value={amount(reports.tax.netPayable, state.currency)} detail={`ضريبة مخرجات ${amount(reports.tax.outputTax, state.currency)} • مدخلات ${amount(reports.tax.inputTax, state.currency)}`} icon="receipt-long" color="#7357C8" soft="#EEE9FE" />
    <MetricRow title="تدفق السندات النقدي" value={amount(reports.cashFlow.net, state.currency)} detail={`تحصيل ${amount(reports.cashFlow.inflow, state.currency)} • صرف ${amount(reports.cashFlow.outflow, state.currency)}`} icon="payments" color="#247AAE" soft="#E4F1F9" />
    <MetricRow title="رواتب مرحّلة" value={amount(reports.payroll.net, state.currency)} detail={`${reports.payroll.count} مسير • إجمالي ${amount(reports.payroll.gross, state.currency)} • استقطاعات ${amount(reports.payroll.deductions, state.currency)}`} icon="badge" color="#C44747" soft="#FCEAEA" />
  </View>;

  const inventory = reports.inventory.length ? <View style={styles.section}>{reports.inventory.map((item) => <View key={item.itemId} style={styles.line}><View style={styles.itemIcon}><MaterialIcons name="inventory-2" size={20} color="#154C79" /></View><View style={styles.lineCopy}><Text style={styles.lineTitle}>{item.name}</Text><Text style={styles.lineDetail}>{item.quantity.toLocaleString("ar-LY")} {item.unit} • {amount(item.value, state.currency)}</Text></View>{item.isBelowReorderLevel ? <View style={styles.alertBadge}><Text style={styles.alertBadgeText}>إعادة طلب</Text></View> : <MaterialIcons name="check-circle" size={20} color="#168A63" />}</View>)}</View> : <EmptyState message="أضف أصنافاً وحركات مخزون لعرض الكمية والقيمة الفعلية." icon="inventory-2" />;
  const assets = reports.assets.length ? <View style={styles.section}>{reports.assets.map((asset) => <View key={asset.assetId} style={styles.line}><View style={styles.itemIcon}><MaterialIcons name="account-balance" size={20} color="#154C79" /></View><View style={styles.lineCopy}><Text style={styles.lineTitle}>{asset.name}</Text><Text style={styles.lineDetail}>التكلفة {amount(asset.cost, state.currency)} • الإهلاك {amount(asset.accumulatedDepreciation, state.currency)}</Text></View><Text style={styles.lineValue}>{amount(asset.carryingAmount, state.currency)}</Text></View>)}</View> : <EmptyState message="أضف أصلاً ثابتاً وسجلات إهلاك لعرض القيمة الدفترية." icon="account-balance" />;
  const body = active === "overview" ? overview : active === "inventory" ? inventory : assets;

  return <ScreenContainer className="px-4" edges={["top", "bottom", "left", "right"]}>
    <FlatList
      data={[active]}
      keyExtractor={(section) => section}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
      ListHeaderComponent={<>
        <View style={styles.header}><Pressable accessibilityLabel="رجوع" onPress={() => router.back()} style={styles.back}><MaterialIcons name="arrow-forward" size={22} color="#154C79" /></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>تقارير تشغيلية</Text><Text style={styles.title}>الأعمال والمستندات</Text><Text style={styles.subtitle}>نتائج مشتقة من السجلات المرحّلة والسندات الفعلية فقط.</Text></View></View>
        <PrimaryButton label="تصدير Excel شامل" icon="file-download" onPress={() => void exportReports()} />
        <FlatList data={tabs} horizontal inverted keyExtractor={(tab) => tab.id} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => setActive(item.id)} style={[styles.tab, item.id === active && styles.activeTab]}><MaterialIcons name={item.icon} size={18} color={item.id === active ? "#FFFFFF" : "#65737E"} /><Text style={[styles.tabText, item.id === active && styles.activeTabText]}>{item.label}</Text></Pressable>} />
      </>}
      renderItem={() => <View style={styles.reportBody}>{body}<Text style={styles.disclaimer}>لا تدخل المسودات أو المستندات الملغاة في المبيعات والمشتريات والضريبة. ويعرض التدفق النقدي سندات القبض والصرف المسجلة فقط.</Text></View>}
    />
  </ScreenContainer>;
}

function MetricRow({ title, value, detail, icon, color, soft }: { title: string; value: string; detail: string; icon: keyof typeof MaterialIcons.glyphMap; color: string; soft: string }) {
  return <View style={styles.metric}><View style={[styles.metricIcon, { backgroundColor: soft }]}><MaterialIcons name={icon} size={22} color={color} /></View><View style={styles.metricCopy}><Text style={styles.metricTitle}>{title}</Text><Text style={styles.metricDetail}>{detail}</Text></View><Text style={[styles.metricValue, { color }]}>{value}</Text></View>;
}

function EmptyState({ message, icon }: { message: string; icon: keyof typeof MaterialIcons.glyphMap }) {
  return <View style={styles.empty}><MaterialIcons name={icon} size={32} color="#91A1AF" /><Text style={styles.emptyText}>{message}</Text></View>;
}

const styles = StyleSheet.create({
  header: { alignItems: "flex-start", flexDirection: "row-reverse", gap: 12, paddingBottom: 18, paddingTop: 6 },
  content: { paddingBottom: 30 },
  back: { alignItems: "center", backgroundColor: "#E4F1F9", borderRadius: 13, height: 42, justifyContent: "center", width: 42 },
  headerCopy: { alignItems: "flex-end", flex: 1 },
  eyebrow: { color: "#168A63", fontSize: 12, fontWeight: "800", writingDirection: "rtl" },
  title: { color: "#14212B", fontSize: 25, fontWeight: "900", lineHeight: 35, writingDirection: "rtl" },
  subtitle: { color: "#65737E", fontSize: 12, lineHeight: 19, textAlign: "right", writingDirection: "rtl" },
  tabs: { gap: 8, paddingBottom: 18 },
  tab: { alignItems: "center", backgroundColor: "#F1F5F8", borderRadius: 14, flexDirection: "row-reverse", gap: 6, paddingHorizontal: 13, paddingVertical: 10 },
  activeTab: { backgroundColor: "#154C79" },
  tabText: { color: "#65737E", fontSize: 12, fontWeight: "800", writingDirection: "rtl" },
  activeTabText: { color: "#FFFFFF" },
  reportBody: { paddingBottom: 30 },
  section: { gap: 10 },
  metric: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 18, borderWidth: 1, flexDirection: "row-reverse", gap: 10, padding: 14 },
  metricIcon: { alignItems: "center", borderRadius: 13, height: 42, justifyContent: "center", width: 42 },
  metricCopy: { alignItems: "flex-end", flex: 1 },
  metricTitle: { color: "#14212B", fontSize: 14, fontWeight: "900", writingDirection: "rtl" },
  metricDetail: { color: "#65737E", fontSize: 10, lineHeight: 16, textAlign: "right", writingDirection: "rtl" },
  metricValue: { fontSize: 12, fontWeight: "900", maxWidth: 105, textAlign: "left" },
  line: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 16, borderWidth: 1, flexDirection: "row-reverse", gap: 10, padding: 13 },
  itemIcon: { alignItems: "center", backgroundColor: "#E4F1F9", borderRadius: 12, height: 38, justifyContent: "center", width: 38 },
  lineCopy: { alignItems: "flex-end", flex: 1 },
  lineTitle: { color: "#14212B", fontSize: 14, fontWeight: "900", writingDirection: "rtl" },
  lineDetail: { color: "#65737E", fontSize: 10, lineHeight: 16, textAlign: "right", writingDirection: "rtl" },
  lineValue: { color: "#168A63", fontSize: 11, fontWeight: "900", maxWidth: 90, textAlign: "left" },
  alertBadge: { backgroundColor: "#FFF4DD", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  alertBadgeText: { color: "#B97512", fontSize: 10, fontWeight: "900", writingDirection: "rtl" },
  empty: { alignItems: "center", backgroundColor: "#F6F9FB", borderColor: "#E1E8EE", borderRadius: 18, borderStyle: "dashed", borderWidth: 1, gap: 10, padding: 28 },
  emptyText: { color: "#65737E", fontSize: 13, lineHeight: 21, textAlign: "center", writingDirection: "rtl" },
  disclaimer: { color: "#65737E", fontSize: 10, lineHeight: 17, marginTop: 18, textAlign: "right", writingDirection: "rtl" },
});
