import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useRouter } from "expo-router";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as XLSX from "xlsx";
import { ScreenContainer } from "@/components/screen-container";
import { PrimaryButton } from "@/components/accounting-ui";
import { AccountCategory, accountNatureLabel, categoryMeta, useAccounting } from "@/lib/accounting";
import { createReportsWorkbook, reportExportFilename } from "@/lib/excel-reports";

const categoryByLabel = Object.entries(categoryMeta).reduce<Record<string, AccountCategory>>((map, [key, value]) => ({ ...map, [key]: key as AccountCategory, [value.label]: key as AccountCategory }), {});
const text = (value: unknown) => String(value ?? "").trim();
const money = (value: unknown) => Number(String(value ?? "0").replace(",", ".")) || 0;

export default function SpreadsheetsScreen() {
  const router = useRouter();
  const { state, accountBalances, summary, balanceSheet, importJournalEntries } = useAccounting();
  async function exportWorkbook() {
    try {
      const journalRows = state.journalEntries.flatMap((entry, index) => entry.lines.map((line) => { const account = state.accounts.find((item) => item.id === line.accountId); return { "رقم القيد": index + 1, "تاريخ القيد": entry.date.slice(0, 10), "وصف القيد": entry.description, "كود الحساب": account?.code ?? "", "الحساب": account?.name ?? "", "الفئة": categoryMeta[line.category].label, "مدين": line.debit, "دائن": line.credit }; }));
      const accountRows = state.accounts.map((account) => ({ "كود الحساب": account.code, "الحساب": account.name, "الفئة": categoryMeta[account.category].label, "طبيعة الحساب": accountNatureLabel(account.nature), "التصنيف المطبق": account.scope, "الرصيد": accountBalances[account.id] ?? 0 }));
      const reportRows = [{ "البند": "إجمالي الأصول", "القيمة": balanceSheet.totalAssets }, { "البند": "إجمالي الخصوم", "القيمة": balanceSheet.totalLiabilities }, { "البند": "إجمالي حقوق الملكية", "القيمة": balanceSheet.totalEquity }, { "البند": "إجمالي الخصوم وحقوق الملكية", "القيمة": balanceSheet.totalLiabilitiesAndEquity }, { "البند": "صافي الربح", "القيمة": summary.revenue - summary.expense }, { "البند": "فارق التوازن", "القيمة": balanceSheet.difference }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(journalRows), "القيود");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(accountRows), "الحسابات");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(reportRows), "الميزانية العمومية");
      const base64 = XLSX.write(workbook, { bookType: "xlsx", type: "base64" });
      if (Platform.OS === "web") { Alert.alert("التصدير على الويب", "استخدم التطبيق على Android أو iOS لمشاركة ملف Excel من جهازك."); return; }
      const directory = FileSystem.cacheDirectory;
      if (!directory) throw new Error("لا يتوفر مسار لحفظ الملف على الجهاز.");
      const uri = `${directory}smart-accountant-${Date.now()}.xlsx`;
      await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
      if (!(await Sharing.isAvailableAsync())) throw new Error("المشاركة غير متاحة على هذا الجهاز.");
      await Sharing.shareAsync(uri, { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", dialogTitle: "تصدير تقرير المحاسب الذكي" });
    } catch (error) { Alert.alert("تعذر التصدير", error instanceof Error ? error.message : "حاول مرة أخرى."); }
  }
  async function exportComprehensiveReports() {
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
  async function importWorkbook() {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"], copyToCacheDirectory: true });
      if (picked.canceled) return;
      const base64 = await FileSystem.readAsStringAsync(picked.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
      const workbook = XLSX.read(base64, { type: "base64" });
      const sheet = workbook.Sheets[workbook.SheetNames.find((name) => name === "القيود") ?? workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const groups = new Map<string, { description: string; date: string; lines: { accountName: string; accountCode: string; category: AccountCategory; debit: number; credit: number }[] }>();
      rows.forEach((row, index) => { const key = text(row["رقم القيد"]) || `${text(row["وصف القيد"])}-${text(row["تاريخ القيد"])}-${index}`; const category = categoryByLabel[text(row["الفئة"])]; if (!category) return; const journal = groups.get(key) ?? { description: text(row["وصف القيد"]) || "قيد مستورد", date: text(row["تاريخ القيد"]) || new Date().toISOString(), lines: [] }; journal.lines.push({ accountName: text(row["الحساب"]), accountCode: text(row["كود الحساب"]), category, debit: money(row["مدين"]), credit: money(row["دائن"]) }); groups.set(key, journal); });
      const result = await importJournalEntries([...groups.values()]);
      Alert.alert("اكتمل الاستيراد", `تم استيراد ${result.imported.toLocaleString("ar-LY")} قيد متوازن. تم تجاوز ${result.skipped.toLocaleString("ar-LY")} قيد غير صالح أو غير متوازن.`);
    } catch (error) { Alert.alert("تعذر الاستيراد", error instanceof Error ? error.message : "تأكد من أن ملف Excel يستخدم أعمدة القيود الصحيحة."); }
  }
  return <ScreenContainer className="px-4" edges={["top", "bottom", "left", "right"]} containerClassName="bg-background"><View style={styles.header}><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-forward" size={22} color="#154C79" /></Pressable><Text style={styles.title}>ملفات Excel</Text></View><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}><View style={styles.hero}><MaterialIcons name="table-chart" size={30} color="#168A63" /><Text style={styles.heroTitle}>بياناتك في ملف منظم</Text><Text style={styles.heroText}>يتضمن التصدير دفتر القيود بأكواد الحسابات، ودليل الحسابات، والميزانية العمومية. وتُستورد القيود المتوازنة المطابقة لدليلك فقط.</Text></View><View style={styles.card}><Text style={styles.cardTitle}>تصدير التقرير</Text><Text style={styles.cardText}>أنشئ ملف Excel يمكن مشاركته أو حفظه خارج التطبيق، ويحوي الأكواد والطبيعة والتصنيف والأرصدة.</Text><PrimaryButton label="تصدير ملف Excel" icon="file-download" onPress={() => void exportWorkbook()} /></View><View style={styles.card}><Text style={styles.cardTitle}>تصدير Excel شامل</Text><Text style={styles.cardText}>يضم ميزان المراجعة ودفتر الأستاذ والميزانية العمومية والمبيعات والمشتريات والمخزون والرواتب والأصول والتدفق النقدي والضرائب.</Text><PrimaryButton label="تصدير التقارير الشاملة" icon="assessment" onPress={() => void exportComprehensiveReports()} /></View><View style={styles.card}><Text style={styles.cardTitle}>استيراد قيود Excel</Text><Text style={styles.cardText}>استخدم ورقة «القيود» بالأعمدة: رقم القيد، تاريخ القيد، وصف القيد، كود الحساب، الحساب، الفئة، مدين، دائن. أنشئ الحسابات بالأكواد المطابقة قبل الاستيراد.</Text><Pressable onPress={() => void importWorkbook()} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><MaterialIcons name="file-upload" size={19} color="#154C79" /><Text style={styles.secondaryText}>اختيار ملف واستيراد القيود</Text></Pressable></View><View style={styles.note}><MaterialIcons name="info-outline" size={18} color="#154C79" /><Text style={styles.noteText}>لا يُسمح باستيراد القيود غير المتوازنة أو الحسابات غير المعرفة، لحماية دقة الميزانية.</Text></View></ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 20, paddingTop: 10 }, back: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 14, borderWidth: 1, height: 44, justifyContent: "center", width: 44 }, title: { color: "#14212B", fontSize: 25, fontWeight: "800", writingDirection: "rtl" }, content: { gap: 14, paddingBottom: 25 }, hero: { alignItems: "center", backgroundColor: "#E7F6EF", borderRadius: 22, gap: 8, padding: 18 }, heroTitle: { color: "#168A63", fontSize: 18, fontWeight: "800", writingDirection: "rtl" }, heroText: { color: "#427560", fontSize: 12, lineHeight: 19, textAlign: "center", writingDirection: "rtl" }, card: { backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 20, borderWidth: 1, gap: 11, padding: 16 }, cardTitle: { color: "#14212B", fontSize: 16, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, cardText: { color: "#65737E", fontSize: 12, lineHeight: 19, textAlign: "right", writingDirection: "rtl" }, secondaryButton: { alignItems: "center", borderColor: "#154C79", borderRadius: 14, borderWidth: 1, flexDirection: "row-reverse", gap: 8, justifyContent: "center", minHeight: 48 }, secondaryText: { color: "#154C79", fontSize: 14, fontWeight: "800", writingDirection: "rtl" }, note: { alignItems: "flex-start", backgroundColor: "#EAF3FA", borderRadius: 14, flexDirection: "row-reverse", gap: 8, padding: 13 }, noteText: { color: "#154C79", flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 18, textAlign: "right", writingDirection: "rtl" }, pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] } });
