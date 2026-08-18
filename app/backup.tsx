import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/accounting-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useAccounting } from "@/lib/accounting";

function backupFilename() {
  return `smart-accountant-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

export default function BackupScreen() {
  const router = useRouter();
  const { exportBackup, restoreBackup } = useAccounting();
  const [working, setWorking] = useState<"export" | "restore" | null>(null);

  const exportFile = async () => {
    try {
      setWorking("export");
      const content = await exportBackup();
      const filename = backupFilename();
      if (Platform.OS === "web") {
        const blob = new Blob([content], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url; anchor.download = filename; anchor.click();
        URL.revokeObjectURL(url);
        Alert.alert("تم التصدير", "تم تنزيل النسخة الاحتياطية على جهازك.");
      } else {
        const uri = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/json", dialogTitle: "حفظ النسخة الاحتياطية" });
        else Alert.alert("تم إنشاء النسخة", "تم إنشاء ملف النسخة الاحتياطية محلياً.");
      }
    } catch (error) {
      Alert.alert("تعذر التصدير", error instanceof Error ? error.message : "حاول مرة أخرى.");
    } finally { setWorking(null); }
  };

  const restoreFile = async () => {
    try {
      setWorking("restore");
      const result = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/json", "text/plain"], copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      const raw = Platform.OS === "web" && asset.file ? await asset.file.text() : await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
      Alert.alert("استعادة النسخة الاحتياطية", "سيجري استبدال البيانات المحاسبية المحلية الحالية بالنسخة المحددة. تأكد من إنشاء نسخة حديثة قبل المتابعة.", [
        { text: "إلغاء", style: "cancel" },
        { text: "استعادة الآن", style: "destructive", onPress: () => void restoreBackup(raw).then(() => Alert.alert("تمت الاستعادة", "تمت استعادة بيانات النسخة الاحتياطية بنجاح.")).catch((error) => Alert.alert("تعذرت الاستعادة", error instanceof Error ? error.message : "تحقق من الملف وحاول مرة أخرى.")) },
      ]);
    } catch (error) {
      Alert.alert("تعذر فتح الملف", error instanceof Error ? error.message : "اختر ملف نسخة احتياطية صالحاً.");
    } finally { setWorking(null); }
  };

  return <ScreenContainer className="px-4" edges={["top", "bottom", "left", "right"]}>
    <View style={styles.header}><Pressable accessibilityLabel="رجوع" onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-forward" size={22} color="#154C79" /></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>حماية البيانات</Text><Text style={styles.title}>النسخ الاحتياطي</Text></View></View>
    <View style={styles.hero}><View style={styles.heroIcon}><MaterialIcons name="backup" size={31} color="#154C79" /></View><Text style={styles.heroTitle}>بياناتك محفوظة بيدك</Text><Text style={styles.heroCopy}>يحتوي الملف على الحسابات والقيود وجهات التعامل والأقساط وسجل التدقيق الموجود على هذا الجهاز فقط. لا تُنشأ أي بيانات أو أرصدة خلال التصدير أو الاستعادة.</Text></View>
    <View style={styles.card}><View style={styles.cardHeading}><View style={styles.cardIcon}><MaterialIcons name="file-download" size={21} color="#168A63" /></View><View style={styles.cardCopy}><Text style={styles.cardTitle}>تصدير نسخة احتياطية</Text><Text style={styles.cardDescription}>أنشئ ملف JSON واحفظه في مكان موثوق.</Text></View></View><PrimaryButton label={working === "export" ? "جارٍ تجهيز الملف..." : "تصدير النسخة الاحتياطية"} icon="download" onPress={() => void exportFile()} disabled={working !== null} /></View>
    <View style={styles.card}><View style={styles.cardHeading}><View style={[styles.cardIcon, styles.restoreIcon]}><MaterialIcons name="settings-backup-restore" size={21} color="#B97512" /></View><View style={styles.cardCopy}><Text style={styles.cardTitle}>استعادة نسخة احتياطية</Text><Text style={styles.cardDescription}>اختر ملفاً أُنشئ من المحاسب الذكي لإرجاع بياناته المحلية.</Text></View></View><PrimaryButton label={working === "restore" ? "جارٍ فتح الملف..." : "اختيار ملف واستعادة"} icon="upload" onPress={() => void restoreFile()} disabled={working !== null} /></View>
    <View style={styles.notice}><MaterialIcons name="privacy-tip" size={20} color="#7357C8" /><Text style={styles.noticeText}>احتفظ بالنسخة في مكان خاص؛ لأنها قد تتضمن تفاصيل حساباتك وحركاتك المالية.</Text></View>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", gap: 12, marginBottom: 22, paddingTop: 10 }, back: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 14, borderWidth: 1, height: 44, justifyContent: "center", width: 44 }, headerCopy: { alignItems: "flex-end", flex: 1 }, eyebrow: { color: "#65737E", fontSize: 12, fontWeight: "700", writingDirection: "rtl" }, title: { color: "#14212B", fontSize: 24, fontWeight: "800", writingDirection: "rtl" }, hero: { alignItems: "flex-end", backgroundColor: "#EAF3FA", borderRadius: 22, gap: 10, padding: 18 }, heroIcon: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 16, height: 57, justifyContent: "center", width: 57 }, heroTitle: { color: "#154C79", fontSize: 18, fontWeight: "800", writingDirection: "rtl" }, heroCopy: { color: "#345264", fontSize: 13, lineHeight: 20, textAlign: "right", writingDirection: "rtl" }, card: { backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 20, borderWidth: 1, gap: 16, marginTop: 14, padding: 16 }, cardHeading: { alignItems: "center", flexDirection: "row-reverse", gap: 11 }, cardIcon: { alignItems: "center", backgroundColor: "#E3F5EE", borderRadius: 12, height: 41, justifyContent: "center", width: 41 }, restoreIcon: { backgroundColor: "#FFF4DD" }, cardCopy: { alignItems: "flex-end", flex: 1 }, cardTitle: { color: "#14212B", fontSize: 16, fontWeight: "800", writingDirection: "rtl" }, cardDescription: { color: "#65737E", fontSize: 12, lineHeight: 18, marginTop: 3, textAlign: "right", writingDirection: "rtl" }, notice: { alignItems: "flex-start", backgroundColor: "#F7F4FE", borderColor: "#E5DCF9", borderRadius: 17, borderWidth: 1, flexDirection: "row-reverse", gap: 10, marginTop: 16, padding: 14 }, noticeText: { color: "#5F4B91", flex: 1, fontSize: 12, lineHeight: 19, textAlign: "right", writingDirection: "rtl" }, pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
