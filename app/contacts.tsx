import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { EmptyState, IconCircle, PrimaryButton } from "@/components/accounting-ui";
import { ScreenContainer } from "@/components/screen-container";
import { formatAmount, type ContactType, useAccounting } from "@/lib/accounting";

type ContactTypeMeta = { label: string; icon: keyof typeof MaterialIcons.glyphMap; color: string; soft: string };
type ContactFormState = { name: string; phone: string; type: ContactType; accountCode: string; notes: string };

const contactMeta: Record<ContactType, ContactTypeMeta> = {
  customer: { label: "عميل", icon: "person", color: "#247AAE", soft: "#E4F1F9" },
  supplier: { label: "مورد", icon: "local-shipping", color: "#7357C8", soft: "#EEE9FE" },
  debtor: { label: "مدين", icon: "account-balance", color: "#168A63", soft: "#E3F5EE" },
  creditor: { label: "دائن", icon: "balance", color: "#B97512", soft: "#FFF4DD" },
};
const labels: Record<"all" | ContactType, string> = { all: "جهات التعامل", customer: "العملاء", supplier: "الموردون", debtor: "المدينون", creditor: "الدائنون" };
const filterValues: ("all" | ContactType)[] = ["all", "customer", "supplier", "debtor", "creditor"];

function emptyForm(type: "all" | ContactType): ContactFormState {
  return { name: "", phone: "", type: type === "all" ? "customer" : type, accountCode: "", notes: "" };
}

export default function ContactsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const parameterType = Array.isArray(params.type) ? params.type[0] : params.type;
  const activeFilter: "all" | ContactType = parameterType && parameterType in contactMeta ? parameterType as ContactType : "all";
  const { state, accountBalances, addContact, deleteContact, isReady } = useAccounting();
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<ContactFormState>(() => emptyForm(activeFilter));
  const contacts = useMemo(() => activeFilter === "all" ? state.contacts : state.contacts.filter((contact) => contact.type === activeFilter), [activeFilter, state.contacts]);

  const openForm = () => { setForm(emptyForm(activeFilter)); setModalVisible(true); };
  const selectFilter = (type: "all" | ContactType) => router.replace(type === "all" ? "/contacts" as never : `/contacts?type=${type}` as never);
  const submit = async () => {
    try {
      setSubmitting(true);
      await addContact(form);
      setModalVisible(false);
    } catch (error) {
      Alert.alert("تعذر الحفظ", error instanceof Error ? error.message : "تحقق من البيانات ثم حاول مرة أخرى.");
    } finally { setSubmitting(false); }
  };
  const confirmDelete = (id: string, name: string) => Alert.alert("حذف جهة تعامل", `هل تريد حذف «${name}»؟`, [
    { text: "إلغاء", style: "cancel" },
    { text: "حذف", style: "destructive", onPress: () => { void deleteContact(id).catch((error) => Alert.alert("تعذر الحذف", error instanceof Error ? error.message : "حاول مرة أخرى.")); } },
  ]);

  if (!isReady) return <ScreenContainer className="items-center justify-center"><Text style={styles.loading}>يتم تجهيز جهات التعامل...</Text></ScreenContainer>;

  return (
    <ScreenContainer className="px-4">
      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        style={styles.list}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<View style={styles.headerWrap}>
          <View style={styles.topRow}>
            <Pressable accessibilityLabel="رجوع" onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><MaterialIcons name="arrow-forward" size={22} color="#154C79" /></Pressable>
            <View style={styles.headerCopy}><Text style={styles.eyebrow}>إدارة العلاقات</Text><Text style={styles.title}>{labels[activeFilter]}</Text></View>
            <Pressable accessibilityLabel="إضافة جهة تعامل" onPress={openForm} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}><MaterialIcons name="person-add" size={23} color="#FFFFFF" /></Pressable>
          </View>
          <FlatList horizontal inverted data={filterValues} keyExtractor={(item) => item} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} renderItem={({ item }) => <Pressable onPress={() => selectFilter(item)} style={({ pressed }) => [styles.filter, activeFilter === item && styles.filterActive, pressed && styles.pressed]}><Text style={[styles.filterText, activeFilter === item && styles.filterTextActive]}>{labels[item]}</Text></Pressable>} />
        </View>}
        ListEmptyComponent={<View style={styles.emptyCard}><EmptyState icon="people" title={`لا توجد ${labels[activeFilter]}`} description="أضف بيانات الجهة ورقم هاتفها، ثم اربطها بحساب اختياري لعرض رصيدها من القيود المتوازنة." /></View>}
        renderItem={({ item }) => {
          const meta = contactMeta[item.type];
          const account = state.accounts.find((candidate) => candidate.code.toLocaleLowerCase() === item.accountCode?.toLocaleLowerCase());
          const balance = account ? accountBalances[account.id] ?? 0 : 0;
          return <View style={styles.card}>
            <View style={styles.cardTop}>
              <IconCircle icon={meta.icon} color={meta.color} background={meta.soft} />
              <View style={styles.cardCopy}><View style={styles.nameRow}><Text style={styles.name}>{item.name}</Text><View style={[styles.typeChip, { backgroundColor: meta.soft }]}><Text style={[styles.typeText, { color: meta.color }]}>{meta.label}</Text></View></View><Text style={styles.phone}>{item.phone}</Text></View>
              <Pressable accessibilityLabel={`حذف ${item.name}`} onPress={() => confirmDelete(item.id, item.name)} style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}><MaterialIcons name="delete-outline" size={21} color="#C44747" /></Pressable>
            </View>
            <View style={styles.cardDivider} />
            <View style={styles.cardBottom}><View style={styles.balanceBlock}><Text style={styles.balanceLabel}>{item.accountCode ? `رصيد الحساب ${item.accountCode}` : "لا يوجد حساب مرتبط"}</Text><Text style={[styles.balance, { color: meta.color }]}>{formatAmount(balance, state.currency)}</Text></View>{item.notes ? <Text numberOfLines={2} style={styles.notes}>{item.notes}</Text> : null}</View>
          </View>;
        }}
      />
      <ContactFormModal visible={modalVisible} form={form} submitting={submitting} onClose={() => setModalVisible(false)} onChange={setForm} onSubmit={() => void submit()} />
    </ScreenContainer>
  );
}

function ContactFormModal({ visible, form, submitting, onClose, onChange, onSubmit }: { visible: boolean; form: ContactFormState; submitting: boolean; onClose: () => void; onChange: (value: ContactFormState) => void; onSubmit: () => void }) {
  const set = <K extends keyof ContactFormState>(key: K, value: ContactFormState[K]) => onChange({ ...form, [key]: value });
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
      <Pressable style={styles.modalDismiss} onPress={onClose} />
      <View style={styles.sheet}>
        <FlatList
          data={[] as string[]}
          keyExtractor={(item) => item}
          renderItem={null}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.sheetContent}
          ListHeaderComponent={<View>
            <View style={styles.sheetHeader}><Pressable accessibilityLabel="إغلاق" onPress={onClose} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><MaterialIcons name="close" size={22} color="#154C79" /></Pressable><View style={styles.sheetTitleCopy}><Text style={styles.sheetEyebrow}>جهة تعامل جديدة</Text><Text style={styles.sheetTitle}>إضافة بيانات أساسية</Text></View></View>
            <Field label="الاسم"><TextInput value={form.name} onChangeText={(value) => set("name", value)} placeholder="مثال: شركة الأفق" placeholderTextColor="#91A1AF" style={styles.input} textAlign="right" /></Field>
            <Field label="رقم الهاتف"><TextInput value={form.phone} onChangeText={(value) => set("phone", value)} placeholder="مثال: +218 91 000 0000" placeholderTextColor="#91A1AF" style={styles.input} textAlign="right" keyboardType="phone-pad" /></Field>
            <Text style={styles.fieldLabel}>النوع</Text><View style={styles.typeGrid}>{(["customer", "supplier", "debtor", "creditor"] as ContactType[]).map((type) => <Pressable key={type} onPress={() => set("type", type)} style={({ pressed }) => [styles.typeOption, form.type === type && styles.typeOptionSelected, pressed && styles.pressed]}><Text style={[styles.typeOptionText, form.type === type && styles.typeOptionTextSelected]}>{contactMeta[type].label}</Text></Pressable>)}</View>
            <Field label="كود الحساب المرتبط" optional><TextInput value={form.accountCode} onChangeText={(value) => set("accountCode", value)} placeholder="مثال: 1101" placeholderTextColor="#91A1AF" style={styles.input} textAlign="right" autoCapitalize="characters" /></Field>
            <Text style={styles.helpText}>أدخل كود حساب موجود من دليل الحسابات لعرض الرصيد الفعلي للجهة.</Text>
            <Field label="ملاحظات" optional><TextInput value={form.notes} onChangeText={(value) => set("notes", value)} placeholder="معلومة داخلية عن جهة التعامل" placeholderTextColor="#91A1AF" style={[styles.input, styles.notesInput]} textAlign="right" multiline /></Field>
          </View>}
          ListFooterComponent={<PrimaryButton label={submitting ? "جارٍ الحفظ..." : "حفظ جهة التعامل"} icon="check" onPress={onSubmit} disabled={submitting} />}
        />
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

function Field({ label, optional = false, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}{optional ? <Text style={styles.optional}> اختياري</Text> : null}</Text>{children}</View>;
}

const styles = StyleSheet.create({
  list: { flex: 1 }, content: { gap: 12, paddingBottom: 32, paddingTop: 10 }, loading: { color: "#65737E", fontSize: 15 }, headerWrap: { gap: 16, marginBottom: 6 }, topRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 52 }, headerCopy: { alignItems: "flex-end", flex: 1, marginHorizontal: 12 }, eyebrow: { color: "#65737E", fontSize: 12, fontWeight: "700", writingDirection: "rtl" }, title: { color: "#14212B", fontSize: 24, fontWeight: "800", lineHeight: 33, writingDirection: "rtl" }, iconButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 14, borderWidth: 1, height: 44, justifyContent: "center", width: 44 }, addButton: { alignItems: "center", backgroundColor: "#154C79", borderRadius: 14, height: 44, justifyContent: "center", width: 44 }, filters: { gap: 8, paddingVertical: 2 }, filter: { backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 }, filterActive: { backgroundColor: "#154C79", borderColor: "#154C79" }, filterText: { color: "#65737E", fontSize: 12, fontWeight: "700", writingDirection: "rtl" }, filterTextActive: { color: "#FFFFFF" }, emptyCard: { backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 20, borderWidth: 1, marginTop: 18 }, card: { backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 19, borderWidth: 1, padding: 14 }, cardTop: { alignItems: "center", flexDirection: "row-reverse", gap: 11 }, cardCopy: { alignItems: "flex-end", flex: 1, gap: 4 }, nameRow: { alignItems: "center", flexDirection: "row-reverse", gap: 7 }, name: { color: "#14212B", fontSize: 16, fontWeight: "800", writingDirection: "rtl" }, typeChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }, typeText: { fontSize: 10, fontWeight: "800", writingDirection: "rtl" }, phone: { color: "#65737E", fontSize: 12 }, deleteButton: { alignItems: "center", height: 38, justifyContent: "center", width: 38 }, cardDivider: { backgroundColor: "#EDF1F4", height: 1, marginVertical: 12 }, cardBottom: { alignItems: "flex-start", flexDirection: "row-reverse", gap: 12, justifyContent: "space-between" }, balanceBlock: { alignItems: "flex-end", gap: 3 }, balanceLabel: { color: "#65737E", fontSize: 10, writingDirection: "rtl" }, balance: { fontSize: 14, fontWeight: "800", writingDirection: "rtl" }, notes: { color: "#65737E", flex: 1, fontSize: 11, lineHeight: 16, textAlign: "right", writingDirection: "rtl" }, modalBackdrop: { backgroundColor: "rgba(15, 34, 48, 0.32)", flex: 1, justifyContent: "flex-end" }, modalDismiss: { flex: 1 }, sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 27, borderTopRightRadius: 27, maxHeight: "91%", minHeight: "55%" }, sheetContent: { gap: 10, padding: 20, paddingBottom: 28 }, sheetHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }, sheetTitleCopy: { alignItems: "flex-end" }, sheetEyebrow: { color: "#65737E", fontSize: 11, fontWeight: "700", writingDirection: "rtl" }, sheetTitle: { color: "#14212B", fontSize: 19, fontWeight: "800", lineHeight: 27, writingDirection: "rtl" }, field: { gap: 6, marginTop: 4 }, fieldLabel: { color: "#344554", fontSize: 12, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, optional: { color: "#91A1AF", fontWeight: "600" }, input: { backgroundColor: "#F7F9FA", borderColor: "#E1E8EE", borderRadius: 13, borderWidth: 1, color: "#14212B", fontSize: 14, minHeight: 48, paddingHorizontal: 13, writingDirection: "rtl" }, notesInput: { minHeight: 78, paddingTop: 12, textAlignVertical: "top" }, typeGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }, typeOption: { alignItems: "center", borderColor: "#D7E0E7", borderRadius: 12, borderWidth: 1, flexGrow: 1, paddingHorizontal: 12, paddingVertical: 10 }, typeOptionSelected: { backgroundColor: "#E4F1F9", borderColor: "#154C79" }, typeOptionText: { color: "#65737E", fontSize: 12, fontWeight: "700", writingDirection: "rtl" }, typeOptionTextSelected: { color: "#154C79" }, helpText: { color: "#65737E", fontSize: 11, lineHeight: 16, textAlign: "right", writingDirection: "rtl" }, pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
