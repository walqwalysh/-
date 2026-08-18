import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { PrimaryButton } from "@/components/accounting-ui";
import { useAccounting } from "@/lib/accounting";

export default function SettingsScreen() {
  const router = useRouter();
  const { state, updateCurrency, clearAllData } = useAccounting();
  const [currency, setCurrency] = useState(state.currency);
  async function saveCurrency() { await updateCurrency(currency); Alert.alert("تم الحفظ", "تم تحديث رمز العملة."); }
  function confirmReset() {
    Alert.alert("مسح البيانات المالية", "سيُحذف كل ما أضفته من حسابات وحركات من هذا الجهاز. لا يمكن التراجع عن هذه العملية.", [
      { text: "إلغاء", style: "cancel" }, { text: "مسح البيانات", style: "destructive", onPress: () => void clearAllData() },
    ]);
  }
  return <ScreenContainer className="px-4" edges={["top", "bottom", "left", "right"]} containerClassName="bg-background"><View style={styles.header}><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-forward" size={22} color="#154C79" /></Pressable><Text style={styles.title}>الإعدادات</Text></View><View style={styles.card}><Text style={styles.sectionTitle}>العملة</Text><Text style={styles.description}>يظهر الرمز بجانب القيم المالية داخل التطبيق.</Text><TextInput value={currency} onChangeText={setCurrency} style={styles.input} textAlign="right" maxLength={10} /><PrimaryButton label="حفظ العملة" icon="check" onPress={saveCurrency} /></View><View style={styles.dangerCard}><View style={styles.dangerTitleRow}><MaterialIcons name="delete-outline" size={20} color="#C44747" /><Text style={styles.dangerTitle}>إعادة الميزانية للصفر</Text></View><Text style={styles.dangerCopy}>تمسح هذه العملية جميع الحسابات والقيود التي أضفتها بنفسك، ولا تنشئ أي بيانات بديلة.</Text><Pressable onPress={confirmReset} style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}><Text style={styles.dangerButtonText}>مسح جميع البيانات</Text></Pressable></View></ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 20, paddingTop: 10 }, back: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 14, borderWidth: 1, height: 44, justifyContent: "center", width: 44 }, title: { color: "#14212B", fontSize: 25, fontWeight: "800", writingDirection: "rtl" }, card: { backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 20, borderWidth: 1, gap: 12, padding: 16 }, sectionTitle: { color: "#14212B", fontSize: 17, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, description: { color: "#65737E", fontSize: 13, lineHeight: 20, textAlign: "right", writingDirection: "rtl" }, input: { backgroundColor: "#F6F8FA", borderColor: "#E1E8EE", borderRadius: 14, borderWidth: 1, color: "#14212B", fontSize: 16, minHeight: 50, paddingHorizontal: 14, writingDirection: "rtl" }, dangerCard: { backgroundColor: "#FFF8F8", borderColor: "#F0C6C6", borderRadius: 20, borderWidth: 1, gap: 12, marginTop: 16, padding: 16 }, dangerTitleRow: { alignItems: "center", flexDirection: "row-reverse", gap: 8 }, dangerTitle: { color: "#A63131", fontSize: 17, fontWeight: "800", writingDirection: "rtl" }, dangerCopy: { color: "#8D5353", fontSize: 13, lineHeight: 20, textAlign: "right", writingDirection: "rtl" }, dangerButton: { alignItems: "center", borderColor: "#C44747", borderRadius: 14, borderWidth: 1, justifyContent: "center", minHeight: 48 }, dangerButtonText: { color: "#C44747", fontSize: 15, fontWeight: "800", writingDirection: "rtl" }, pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
