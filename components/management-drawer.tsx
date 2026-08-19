import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";

type ManagementDrawerProps = { visible: boolean; onClose: () => void };
type DrawerItem = { id: string; label: string; description: string; icon: keyof typeof MaterialIcons.glyphMap; color: string; softColor: string; path: string };

const items: DrawerItem[] = [
  { id: "customers", label: "العملاء", description: "الأسماء، الهواتف والأرصدة", icon: "people", color: "#247AAE", softColor: "#E4F1F9", path: "/contacts?type=customer" },
  { id: "debtors", label: "المدينون", description: "متابعة الذمم المدينة", icon: "account-balance", color: "#168A63", softColor: "#E3F5EE", path: "/contacts?type=debtor" },
  { id: "creditors", label: "الدائنون", description: "متابعة الذمم الدائنة", icon: "balance", color: "#B97512", softColor: "#FFF4DD", path: "/contacts?type=creditor" },
  { id: "installments", label: "الأقساط", description: "قيود شهرية مستحقة تلقائياً", icon: "schedule", color: "#7357C8", softColor: "#EEE9FE", path: "/installments" },
  { id: "vouchers", label: "سندات القبض والصرف", description: "سندات قابلة للطباعة وقيود متوازنة", icon: "receipt", color: "#168A63", softColor: "#E3F5EE", path: "/vouchers" },
  { id: "controls", label: "الرقابة المالية", description: "ميزان مراجعة وذمم وسجل تدقيق", icon: "verified-user", color: "#7357C8", softColor: "#EEE9FE", path: "/controls" },
  { id: "business", label: "التشغيل التجاري", description: "فواتير ومخزون ورواتب وأصول", icon: "business-center", color: "#154C79", softColor: "#E4F1F9", path: "/business" },
  { id: "operations-reports", label: "تقارير التشغيل", description: "مبيعات وضريبة ومخزون ورواتب وأصول", icon: "insights", color: "#7357C8", softColor: "#EEE9FE", path: "/operations-reports" },
  { id: "financial-management", label: "الصندوق والبنوك والميزانيات", description: "سيولة، تحويلات وخطط مالية", icon: "account-balance-wallet", color: "#168A63", softColor: "#E3F5EE", path: "/financial-management" },
  { id: "bank-reconciliation", label: "المطابقة المصرفية", description: "كشف البنك ومطابقة الحركات بالقيود", icon: "compare-arrows", color: "#7357C8", softColor: "#EEE9FE", path: "/bank-reconciliation" },
  { id: "ledger", label: "دفتر الأستاذ", description: "حركات الحسابات والأرصدة الجارية", icon: "menu-book", color: "#168A63", softColor: "#E3F5EE", path: "/ledger" },
  { id: "items", label: "البنود المحاسبية", description: "قوالب بنود مرتبطة بالحسابات", icon: "receipt-long", color: "#C44747", softColor: "#FCEAEA", path: "/accounting-items" },
];

export function ManagementDrawer({ visible, onClose }: ManagementDrawerProps) {
  const router = useRouter();
  const open = (path: string) => {
    onClose();
    router.push(path as never);
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable accessibilityLabel="إغلاق لوحة الإدارة" onPress={onClose} style={styles.backdrop} />
        <View style={styles.panel}>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={<View style={styles.header}><View style={styles.headerIcon}><MaterialIcons name="grid-view" size={22} color="#154C79" /></View><View style={styles.headerCopy}><Text style={styles.eyebrow}>إدارة الأعمال</Text><Text style={styles.title}>لوحة جانبية</Text></View><Pressable accessibilityLabel="إغلاق" onPress={onClose} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}><MaterialIcons name="close" size={22} color="#154C79" /></Pressable></View>}
            renderItem={({ item }) => <Pressable onPress={() => open(item.path)} style={({ pressed }) => [styles.item, pressed && styles.pressed]}><View style={[styles.itemIcon, { backgroundColor: item.softColor }]}><MaterialIcons name={item.icon} size={23} color={item.color} /></View><View style={styles.itemCopy}><Text style={styles.itemTitle}>{item.label}</Text><Text style={styles.itemDescription}>{item.description}</Text></View><MaterialIcons name="chevron-left" size={22} color="#91A1AF" /></Pressable>}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListFooterComponent={<Text style={styles.footer}>تُسجّل الأقساط كقيود داخلية متوازنة فقط، ولا تُنفّذ أي سحوبات بنكية.</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: "row" },
  backdrop: { backgroundColor: "rgba(15, 34, 48, 0.36)", flex: 1 },
  panel: { backgroundColor: "#FFFFFF", borderBottomLeftRadius: 28, borderTopLeftRadius: 28, maxWidth: 370, minWidth: 310, shadowColor: "#14212B", shadowOffset: { width: -8, height: 0 }, shadowOpacity: 0.16, shadowRadius: 22, width: "85%" },
  listContent: { paddingBottom: 28, paddingHorizontal: 16, paddingTop: 18 },
  header: { alignItems: "center", flexDirection: "row-reverse", gap: 10, marginBottom: 22 },
  headerIcon: { alignItems: "center", backgroundColor: "#E4F1F9", borderRadius: 13, height: 42, justifyContent: "center", width: 42 },
  headerCopy: { alignItems: "flex-end", flex: 1 },
  eyebrow: { color: "#65737E", fontSize: 11, fontWeight: "700", writingDirection: "rtl" },
  title: { color: "#14212B", fontSize: 20, fontWeight: "800", lineHeight: 29, writingDirection: "rtl" },
  closeButton: { alignItems: "center", borderColor: "#E1E8EE", borderRadius: 12, borderWidth: 1, height: 40, justifyContent: "center", width: 40 },
  item: { alignItems: "center", flexDirection: "row-reverse", gap: 12, minHeight: 72, paddingVertical: 8 },
  itemIcon: { alignItems: "center", borderRadius: 14, height: 44, justifyContent: "center", width: 44 },
  itemCopy: { alignItems: "flex-end", flex: 1, gap: 3 },
  itemTitle: { color: "#14212B", fontSize: 14, fontWeight: "800", writingDirection: "rtl" },
  itemDescription: { color: "#65737E", fontSize: 11, lineHeight: 16, textAlign: "right", writingDirection: "rtl" },
  separator: { backgroundColor: "#EDF1F4", height: 1 },
  footer: { backgroundColor: "#F6F9FB", borderRadius: 14, color: "#65737E", fontSize: 11, lineHeight: 18, marginTop: 20, padding: 12, textAlign: "right", writingDirection: "rtl" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
