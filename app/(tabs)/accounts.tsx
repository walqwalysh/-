import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { EmptyState, IconCircle, PrimaryButton } from "@/components/accounting-ui";
import { AccountCategory, accountNatureLabel, categories, categoryMeta, formatAmount, useAccounting } from "@/lib/accounting";

export default function AccountsScreen() {
  const { state, accountBalances, addAccount } = useAccounting();
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [scope, setScope] = useState("عام");
  const [category, setCategory] = useState<AccountCategory>("asset");
  const [saving, setSaving] = useState(false);

  async function saveAccount() {
    try {
      setSaving(true);
      await addAccount({ name, code, category, scope });
      setName("");
      setCode("");
      setScope("عام");
      setCategory("asset");
      setModalOpen(false);
    } catch (error) {
      Alert.alert("تعذر حفظ الحساب", error instanceof Error ? error.message : "يرجى المحاولة مرة أخرى");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenContainer className="px-4" containerClassName="bg-background">
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>شجرة الأستاذ العام</Text>
          <Text style={styles.title}>دليل الحسابات</Text>
        </View>
        <Pressable accessibilityLabel="إضافة حساب" onPress={() => setModalOpen(true)} style={({ pressed }) => [styles.addSquare, pressed && styles.pressed]}>
          <MaterialIcons name="add" size={24} color="#FFFFFF" />
        </Pressable>
      </View>
      <FlatList
        data={state.accounts}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={state.accounts.length ? styles.list : styles.emptyList}
        ListEmptyComponent={<EmptyState icon="account-tree" title="دليل الحسابات فارغ" description="أضف حساباتك بأكوادها، مثل 101 للنقدية أو 301 لرأس المال، دون أي أرصدة ابتدائية." />}
        renderItem={({ item }) => {
          const meta = categoryMeta[item.category];
          return (
            <View style={styles.accountCard}>
              <IconCircle icon={meta.icon as "account-balance-wallet"} color={meta.color} background={meta.softColor} />
              <View style={styles.accountInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.accountName}>{item.name}</Text>
                  <Text style={[styles.codeBadge, { color: meta.color, backgroundColor: meta.softColor }]}>{item.code || "بدون كود"}</Text>
                </View>
                <Text style={styles.accountMeta}>{meta.label} · {accountNatureLabel(item.nature)} · {item.scope}</Text>
              </View>
              <Text style={[styles.balance, { color: meta.color }]}>{formatAmount(accountBalances[item.id] ?? 0, state.currency)}</Text>
            </View>
          );
        }}
      />
      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Pressable accessibilityLabel="إغلاق" onPress={() => setModalOpen(false)}><MaterialIcons name="close" size={24} color="#65737E" /></Pressable>
              <Text style={styles.sheetTitle}>إضافة حساب جديد</Text>
            </View>
            <Text style={styles.fieldLabel}>كود الحساب</Text>
            <TextInput value={code} onChangeText={setCode} placeholder="مثال: 101" placeholderTextColor="#98A5AE" style={styles.input} textAlign="right" autoCapitalize="characters" returnKeyType="next" />
            <Text style={styles.fieldLabel}>اسم الحساب</Text>
            <TextInput value={name} onChangeText={setName} placeholder="مثال: صندوق النقد" placeholderTextColor="#98A5AE" style={styles.input} textAlign="right" returnKeyType="next" />
            <Text style={styles.fieldLabel}>تصنيف الحساب</Text>
            <View style={styles.chips}>
              {categories.map((item) => (
                <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, category === item && { backgroundColor: categoryMeta[item].softColor, borderColor: categoryMeta[item].color }]}>
                  <Text style={[styles.chipText, category === item && { color: categoryMeta[item].color }]}>{categoryMeta[item].label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>التصنيف المطبق</Text>
            <TextInput value={scope} onChangeText={setScope} placeholder="مثال: عام أو شركة" placeholderTextColor="#98A5AE" style={styles.input} textAlign="right" returnKeyType="done" />
            <Text style={styles.natureNote}>تُحدد طبيعة الحساب تلقائياً وفق التصنيف: الأصول والمصروفات مدينة، وبقية الحسابات دائنة.</Text>
            <PrimaryButton label={saving ? "جارٍ الحفظ..." : "حفظ الحساب"} icon="check" onPress={saveAccount} disabled={saving} />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 15, paddingTop: 10 },
  eyebrow: { color: "#65737E", fontSize: 12, fontWeight: "600", textAlign: "right", writingDirection: "rtl" },
  title: { color: "#14212B", fontSize: 26, fontWeight: "800", lineHeight: 35, textAlign: "right", writingDirection: "rtl" },
  addSquare: { alignItems: "center", backgroundColor: "#154C79", borderRadius: 14, height: 44, justifyContent: "center", width: 44 },
  list: { gap: 10, paddingBottom: 20 },
  emptyList: { flexGrow: 1, justifyContent: "center", paddingBottom: 80 },
  accountCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 18, borderWidth: 1, flexDirection: "row-reverse", gap: 12, padding: 14 },
  accountInfo: { alignItems: "flex-end", flex: 1 },
  nameRow: { alignItems: "center", flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 },
  accountName: { color: "#14212B", fontSize: 16, fontWeight: "700", writingDirection: "rtl" },
  codeBadge: { borderRadius: 7, fontSize: 11, fontWeight: "800", overflow: "hidden", paddingHorizontal: 6, paddingVertical: 3, writingDirection: "ltr" },
  accountMeta: { color: "#65737E", fontSize: 11, marginTop: 4, textAlign: "right", writingDirection: "rtl" },
  balance: { fontSize: 13, fontWeight: "800", writingDirection: "rtl" },
  overlay: { backgroundColor: "rgba(20,33,43,0.35)", flex: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 10, padding: 20, paddingBottom: 34 },
  sheetHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  sheetTitle: { color: "#14212B", fontSize: 20, fontWeight: "800", writingDirection: "rtl" },
  fieldLabel: { color: "#33454F", fontSize: 13, fontWeight: "700", textAlign: "right", writingDirection: "rtl" },
  input: { backgroundColor: "#F6F8FA", borderColor: "#E1E8EE", borderRadius: 14, borderWidth: 1, color: "#14212B", fontSize: 16, minHeight: 52, paddingHorizontal: 14, writingDirection: "rtl" },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 3 },
  chip: { borderColor: "#E1E8EE", borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { color: "#65737E", fontSize: 13, fontWeight: "700", writingDirection: "rtl" },
  natureNote: { color: "#65737E", fontSize: 11, lineHeight: 17, textAlign: "right", writingDirection: "rtl" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
