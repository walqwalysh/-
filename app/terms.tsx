import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { PrimaryButton } from "@/components/accounting-ui";
import { useAccounting } from "@/lib/accounting";

const clauses = [
  ["الغرض من التطبيق", "المحاسب الذكي أداة لتنظيم القيود والتقارير التي يُدخلها المستخدم؛ ولا يحل محل المراجع أو المستشار المحاسبي أو الضريبي المؤهل."],
  ["دقة البيانات", "تقع مسؤولية صحة الحسابات والقيود والمستندات المدخلة على المستخدم. يمنع التطبيق حفظ القيد غير المتوازن، لكنه لا يضمن صحة تصنيفك المحاسبي."],
  ["البيانات والخصوصية", "تحفظ السجلات المحاسبية محلياً على جهازك في هذه النسخة. لا تدخل بياناتك إلى المساعد الذكي إلا عند اختيارك طلب تحليل له."],
  ["استخدام الذكاء الاصطناعي", "المساعد يقدم شروحاً وتحليلات عامة بناءً على الملخص الذي ترسله؛ لا يقدم قراراً استثمارياً أو ضريبياً أو قانونياً ملزماً."],
];
export default function TermsScreen() { const router = useRouter(); const { acceptTerms } = useAccounting(); async function approve() { await acceptTerms(); router.replace("/(tabs)"); } return <ScreenContainer className="px-4" edges={["top", "bottom", "left", "right"]} containerClassName="bg-background"><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.icon}><MaterialIcons name="gavel" size={28} color="#7357C8" /></View><Text style={styles.title}>اتفاقية استخدام التطبيق</Text><Text style={styles.intro}>يرجى مراجعة البنود التالية قبل متابعة استخدام المحاسب الذكي.</Text>{clauses.map(([title, body]) => <View key={title} style={styles.clause}><Text style={styles.clauseTitle}>{title}</Text><Text style={styles.clauseBody}>{body}</Text></View>)}<PrimaryButton label="أوافق وأتابع" icon="check" onPress={() => void approve()} /></ScrollView></ScreenContainer>; }
const styles = StyleSheet.create({ content: { gap: 13, paddingBottom: 28, paddingTop: 20 }, icon: { alignItems: "center", alignSelf: "center", backgroundColor: "#EEE9FE", borderRadius: 18, height: 58, justifyContent: "center", width: 58 }, title: { color: "#14212B", fontSize: 25, fontWeight: "800", marginTop: 4, textAlign: "right", writingDirection: "rtl" }, intro: { color: "#65737E", fontSize: 13, lineHeight: 21, textAlign: "right", writingDirection: "rtl" }, clause: { backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 17, borderWidth: 1, gap: 6, padding: 14 }, clauseTitle: { color: "#14212B", fontSize: 15, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, clauseBody: { color: "#65737E", fontSize: 12, lineHeight: 19, textAlign: "right", writingDirection: "rtl" },
});
