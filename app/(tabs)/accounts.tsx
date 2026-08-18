import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { EmptyState, IconCircle, PrimaryButton } from "@/components/accounting-ui";
import { AccountCategory, accountNatureLabel, categories, categoryMeta, formatAmount, useAccounting } from "@/lib/accounting";
import { AccountNumberingRule } from "@/lib/account-numbering";

export default function AccountsScreen() {
  const { state, accountBalances, addAccount, suggestAccountCode, updateAccountNumbering } = useAccounting();
  const [modalOpen, setModalOpen] = useState(false);
  const [numberingOpen, setNumberingOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [scope, setScope] = useState("عام");
  const [category, setCategory] = useState<AccountCategory>("asset");
  const [codeEdited, setCodeEdited] = useState(false);
  const [ruleCategory, setRuleCategory] = useState<AccountCategory>("asset");
  const [rule, setRule] = useState<AccountNumberingRule>(state.numbering.asset);
  const [saving, setSaving] = useState(false);

  function openNewAccount() {
    const initialCategory: AccountCategory = "asset";
    setName(""); setScope("عام"); setCategory(initialCategory); setCode(suggestAccountCode(initialCategory)); setCodeEdited(false); setModalOpen(true);
  }
  function changeCategory(nextCategory: AccountCategory) {
    setCategory(nextCategory);
    if (!codeEdited) setCode(suggestAccountCode(nextCategory));
  }
  function openNumbering() {
    const initialCategory: AccountCategory = "asset";
    setRuleCategory(initialCategory); setRule(state.numbering[initialCategory]); setNumberingOpen(true);
  }
  function changeRuleCategory(nextCategory: AccountCategory) { setRuleCategory(nextCategory); setRule(state.numbering[nextCategory]); }
  async function saveAccount() {
    try {
      setSaving(true);
      await addAccount({ name, code, category, scope });
      setModalOpen(false);
    } catch (error) { Alert.alert("تعذر حفظ الحساب", error instanceof Error ? error.message : "يرجى المحاولة مرة أخرى"); }
    finally { setSaving(false); }
  }
  async function saveNumbering() {
    if (!/^[A-Za-z0-9._-]*$/.test(rule.prefix.trim())) { Alert.alert("بادئة غير صالحة", "استخدم أحرفاً أو أرقاماً أو نقاطاً أو شرطات فقط في البادئة."); return; }
    const start = Math.max(1, Math.floor(Number(rule.start) || 1));
    const padding = Math.min(8, Math.max(1, Math.floor(Number(rule.padding) || 1)));
    await updateAccountNumbering({ ...state.numbering, [ruleCategory]: { prefix: rule.prefix.trim(), start, padding } });
    setNumberingOpen(false);
  }

  return <ScreenContainer className="px-4" containerClassName="bg-background">
    <View style={styles.header}><View><Text style={styles.eyebrow}>شجرة الأستاذ العام</Text><Text style={styles.title}>دليل الحسابات</Text></View><View style={styles.headerActions}><Pressable accessibilityLabel="إعدادات الترقيم" onPress={openNumbering} style={({ pressed }) => [styles.tuneSquare, pressed && styles.pressed]}><MaterialIcons name="tune" size={21} color="#154C79" /></Pressable><Pressable accessibilityLabel="إضافة حساب" onPress={openNewAccount} style={({ pressed }) => [styles.addSquare, pressed && styles.pressed]}><MaterialIcons name="add" size={24} color="#FFFFFF" /></Pressable></View></View>
    <FlatList data={state.accounts} keyExtractor={(item) => item.id} showsVerticalScrollIndicator={false} contentContainerStyle={state.accounts.length ? styles.list : styles.emptyList} ListEmptyComponent={<EmptyState icon="account-tree" title="دليل الحسابات فارغ" description="اضبط الترقيم من زر الإعدادات، ثم أضف أول حساب دون أي أرصدة ابتدائية." />} renderItem={({ item }) => { const meta = categoryMeta[item.category]; return <View style={styles.accountCard}><IconCircle icon={meta.icon as "account-balance-wallet"} color={meta.color} background={meta.softColor} /><View style={styles.accountInfo}><View style={styles.nameRow}><Text style={styles.accountName}>{item.name}</Text><Text style={[styles.codeBadge, { color: meta.color, backgroundColor: meta.softColor }]}>{item.code || "بدون كود"}</Text></View><Text style={styles.accountMeta}>{meta.label} · {accountNatureLabel(item.nature)} · {item.scope}</Text></View><Text style={[styles.balance, { color: meta.color }]}>{formatAmount(accountBalances[item.id] ?? 0, state.currency)}</Text></View>; }} />
    <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}><View style={styles.overlay}><ScrollView contentContainerStyle={styles.sheet}><View style={styles.sheetHeader}><Pressable accessibilityLabel="إغلاق" onPress={() => setModalOpen(false)}><MaterialIcons name="close" size={24} color="#65737E" /></Pressable><Text style={styles.sheetTitle}>إضافة حساب جديد</Text></View><Text style={styles.fieldLabel}>كود الحساب المقترح</Text><TextInput value={code} onChangeText={(value) => { setCode(value); setCodeEdited(true); }} placeholder="مثال: 100" placeholderTextColor="#98A5AE" style={styles.input} textAlign="right" autoCapitalize="characters" returnKeyType="next" /><Text style={styles.suggestion}>اقتراح تلقائي: {suggestAccountCode(category)}. يمكنك تعديله قبل الحفظ.</Text><Text style={styles.fieldLabel}>اسم الحساب</Text><TextInput value={name} onChangeText={setName} placeholder="مثال: صندوق النقد" placeholderTextColor="#98A5AE" style={styles.input} textAlign="right" returnKeyType="next" /><Text style={styles.fieldLabel}>تصنيف الحساب</Text><View style={styles.chips}>{categories.map((item) => <Pressable key={item} onPress={() => changeCategory(item)} style={[styles.chip, category === item && { backgroundColor: categoryMeta[item].softColor, borderColor: categoryMeta[item].color }]}><Text style={[styles.chipText, category === item && { color: categoryMeta[item].color }]}>{categoryMeta[item].label}</Text></Pressable>)}</View><Text style={styles.fieldLabel}>التصنيف المطبق</Text><TextInput value={scope} onChangeText={setScope} placeholder="مثال: عام أو شركة" placeholderTextColor="#98A5AE" style={styles.input} textAlign="right" returnKeyType="done" /><Text style={styles.natureNote}>تُحدد طبيعة الحساب تلقائياً وفق التصنيف: الأصول والمصروفات مدينة، وبقية الحسابات دائنة.</Text><PrimaryButton label={saving ? "جارٍ الحفظ..." : "حفظ الحساب"} icon="check" onPress={saveAccount} disabled={saving} /></ScrollView></View></Modal>
    <Modal visible={numberingOpen} animationType="slide" transparent onRequestClose={() => setNumberingOpen(false)}><View style={styles.overlay}><ScrollView contentContainerStyle={styles.sheet}><View style={styles.sheetHeader}><Pressable accessibilityLabel="إغلاق" onPress={() => setNumberingOpen(false)}><MaterialIcons name="close" size={24} color="#65737E" /></Pressable><Text style={styles.sheetTitle}>تخصيص الترقيم</Text></View><Text style={styles.description}>يُقترح أول كود متاح ضمن النطاق تلقائياً، ولن يُستخدم كود مكرر.</Text><Text style={styles.fieldLabel}>فئة الحساب</Text><View style={styles.chips}>{categories.map((item) => <Pressable key={item} onPress={() => changeRuleCategory(item)} style={[styles.chip, ruleCategory === item && { backgroundColor: categoryMeta[item].softColor, borderColor: categoryMeta[item].color }]}><Text style={[styles.chipText, ruleCategory === item && { color: categoryMeta[item].color }]}>{categoryMeta[item].label}</Text></Pressable>)}</View><Text style={styles.fieldLabel}>بادئة الكود</Text><TextInput value={rule.prefix} onChangeText={(prefix) => setRule({ ...rule, prefix })} placeholder="مثال: AST-" placeholderTextColor="#98A5AE" style={styles.input} textAlign="right" autoCapitalize="characters" /><Text style={styles.fieldLabel}>أول رقم</Text><TextInput value={String(rule.start)} onChangeText={(value) => setRule({ ...rule, start: Number(value) })} keyboardType="number-pad" style={styles.input} textAlign="right" /><Text style={styles.fieldLabel}>عدد الخانات</Text><TextInput value={String(rule.padding)} onChangeText={(value) => setRule({ ...rule, padding: Number(value) })} keyboardType="number-pad" style={styles.input} textAlign="right" /><View style={styles.preview}><Text style={styles.previewLabel}>الكود المقترح التالي</Text><Text style={styles.previewCode}>{suggestAccountCode(ruleCategory)}</Text></View><PrimaryButton label="حفظ إعدادات الترقيم" icon="check" onPress={saveNumbering} /></ScrollView></View></Modal>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 15, paddingTop: 10 }, headerActions: { flexDirection: "row", gap: 8 }, eyebrow: { color: "#65737E", fontSize: 12, fontWeight: "600", textAlign: "right", writingDirection: "rtl" }, title: { color: "#14212B", fontSize: 26, fontWeight: "800", lineHeight: 35, textAlign: "right", writingDirection: "rtl" }, addSquare: { alignItems: "center", backgroundColor: "#154C79", borderRadius: 14, height: 44, justifyContent: "center", width: 44 }, tuneSquare: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#C9D8E5", borderRadius: 14, borderWidth: 1, height: 44, justifyContent: "center", width: 44 }, list: { gap: 10, paddingBottom: 20 }, emptyList: { flexGrow: 1, justifyContent: "center", paddingBottom: 80 }, accountCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 18, borderWidth: 1, flexDirection: "row-reverse", gap: 12, padding: 14 }, accountInfo: { alignItems: "flex-end", flex: 1 }, nameRow: { alignItems: "center", flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 }, accountName: { color: "#14212B", fontSize: 16, fontWeight: "700", writingDirection: "rtl" }, codeBadge: { borderRadius: 7, fontSize: 11, fontWeight: "800", overflow: "hidden", paddingHorizontal: 6, paddingVertical: 3, writingDirection: "ltr" }, accountMeta: { color: "#65737E", fontSize: 11, marginTop: 4, textAlign: "right", writingDirection: "rtl" }, balance: { fontSize: 13, fontWeight: "800", writingDirection: "rtl" }, overlay: { backgroundColor: "rgba(20,33,43,0.35)", flex: 1, justifyContent: "flex-end" }, sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 10, padding: 20, paddingBottom: 34 }, sheetHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }, sheetTitle: { color: "#14212B", fontSize: 20, fontWeight: "800", writingDirection: "rtl" }, description: { color: "#65737E", fontSize: 12, lineHeight: 19, textAlign: "right", writingDirection: "rtl" }, fieldLabel: { color: "#33454F", fontSize: 13, fontWeight: "700", textAlign: "right", writingDirection: "rtl" }, input: { backgroundColor: "#F6F8FA", borderColor: "#E1E8EE", borderRadius: 14, borderWidth: 1, color: "#14212B", fontSize: 16, minHeight: 52, paddingHorizontal: 14, writingDirection: "rtl" }, chips: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 3 }, chip: { borderColor: "#E1E8EE", borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 }, chipText: { color: "#65737E", fontSize: 13, fontWeight: "700", writingDirection: "rtl" }, suggestion: { color: "#247AAE", fontSize: 11, lineHeight: 17, textAlign: "right", writingDirection: "rtl" }, natureNote: { color: "#65737E", fontSize: 11, lineHeight: 17, textAlign: "right", writingDirection: "rtl" }, preview: { alignItems: "center", backgroundColor: "#EAF3FA", borderRadius: 14, flexDirection: "row-reverse", justifyContent: "space-between", padding: 13 }, previewLabel: { color: "#154C79", fontSize: 13, fontWeight: "700", writingDirection: "rtl" }, previewCode: { color: "#154C79", fontSize: 17, fontWeight: "800", writingDirection: "ltr" }, pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
