import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconCircle, PrimaryButton } from "@/components/accounting-ui";
import { AccountCategory, categories, categoryMeta, useAccounting } from "@/lib/accounting";

export default function AddEntryScreen() {
  const { state, addAccount, addEntry } = useAccounting();
  const [category, setCategory] = useState<AccountCategory>("asset");
  const [accountName, setAccountName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveEntry() {
    try {
      setSaving(true);
      const numericAmount = Number(amount.replace(",", "."));
      if (!accountName.trim()) throw new Error("أدخل اسم الحساب");
      const account = await addAccount(accountName, category);
      await addEntry({ accountId: account.id, category, amount: numericAmount, note: note.trim(), date: new Date().toISOString() });
      setAccountName(""); setAmount(""); setNote(""); setCategory("asset");
      Alert.alert("تم الحفظ", "أُضيفت الحركة إلى سجلك المالي بنجاح.");
    } catch (error) {
      Alert.alert("تعذر حفظ الحركة", error instanceof Error ? error.message : "تحقق من البيانات المدخلة.");
    } finally { setSaving(false); }
  }

  const recentAccounts = state.accounts.filter((item) => item.category === category).slice(0, 3);
  const selectedMeta = categoryMeta[category];
  return (
    <ScreenContainer className="px-4" containerClassName="bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.header}><IconCircle icon="edit-note" color="#154C79" background="#DCEAF7" size={46} /><View style={styles.headerCopy}><Text style={styles.eyebrow}>إدخال يدوي</Text><Text style={styles.title}>إضافة حركة</Text></View></View>
          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>نوع الحركة</Text>
            <View style={styles.categoryList}>
              {categories.map((item) => { const meta = categoryMeta[item]; const selected = category === item; return <Pressable key={item} onPress={() => setCategory(item)} style={[styles.categoryOption, selected && { backgroundColor: meta.softColor, borderColor: meta.color }]}><MaterialIcons name={meta.icon as "account-balance-wallet"} size={20} color={selected ? meta.color : "#65737E"} /><Text style={[styles.categoryOptionText, selected && { color: meta.color }]}>{meta.label}</Text></Pressable>; })}
            </View>
            <Text style={styles.fieldLabel}>اسم الحساب</Text>
            <TextInput value={accountName} onChangeText={setAccountName} placeholder="مثال: المبيعات النقدية" placeholderTextColor="#98A5AE" style={styles.input} textAlign="right" returnKeyType="next" />
            {recentAccounts.length ? <View style={styles.suggestions}>{recentAccounts.map((account) => <Pressable key={account.id} onPress={() => setAccountName(account.name)} style={styles.suggestion}><Text style={styles.suggestionText}>{account.name}</Text></Pressable>)}</View> : null}
            <Text style={styles.fieldLabel}>المبلغ</Text>
            <TextInput value={amount} onChangeText={setAmount} placeholder="0.00" placeholderTextColor="#98A5AE" keyboardType="decimal-pad" style={styles.input} textAlign="right" returnKeyType="next" />
            <Text style={styles.fieldLabel}>ملاحظة اختيارية</Text>
            <TextInput value={note} onChangeText={setNote} placeholder="أضف وصفاً مختصراً" placeholderTextColor="#98A5AE" style={[styles.input, styles.noteInput]} textAlign="right" multiline />
            <View style={[styles.infoStrip, { backgroundColor: selectedMeta.softColor }]}><MaterialIcons name="info-outline" size={18} color={selectedMeta.color} /><Text style={[styles.infoText, { color: selectedMeta.color }]}>سيتم إدراجها ضمن {selectedMeta.label} في التقارير.</Text></View>
            <PrimaryButton label={saving ? "جارٍ الحفظ..." : "حفظ الحركة"} icon="save" onPress={saveEntry} disabled={saving} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { gap: 18, paddingBottom: 28, paddingTop: 10 }, header: { alignItems: "center", flexDirection: "row", gap: 12 }, headerCopy: { alignItems: "flex-end", flex: 1 }, eyebrow: { color: "#65737E", fontSize: 12, fontWeight: "600", writingDirection: "rtl" }, title: { color: "#14212B", fontSize: 26, fontWeight: "800", lineHeight: 35, writingDirection: "rtl" },
  formCard: { backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 22, borderWidth: 1, gap: 10, padding: 16 }, fieldLabel: { color: "#33454F", fontSize: 13, fontWeight: "800", marginTop: 4, textAlign: "right", writingDirection: "rtl" }, categoryList: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }, categoryOption: { alignItems: "center", borderColor: "#E1E8EE", borderRadius: 14, borderWidth: 1, flexDirection: "row-reverse", gap: 6, paddingHorizontal: 10, paddingVertical: 9 }, categoryOptionText: { color: "#65737E", fontSize: 13, fontWeight: "700", writingDirection: "rtl" },
  input: { backgroundColor: "#F6F8FA", borderColor: "#E1E8EE", borderRadius: 14, borderWidth: 1, color: "#14212B", fontSize: 16, minHeight: 52, paddingHorizontal: 14, writingDirection: "rtl" }, noteInput: { minHeight: 82, paddingTop: 12, textAlignVertical: "top" }, suggestions: { flexDirection: "row-reverse", gap: 8, marginTop: -3 }, suggestion: { backgroundColor: "#F0F5F8", borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7 }, suggestionText: { color: "#154C79", fontSize: 12, fontWeight: "700", writingDirection: "rtl" }, infoStrip: { alignItems: "center", borderRadius: 12, flexDirection: "row-reverse", gap: 8, marginTop: 4, padding: 12 }, infoText: { flex: 1, fontSize: 12, fontWeight: "600", textAlign: "right", writingDirection: "rtl" },
});
