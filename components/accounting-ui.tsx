import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type IconName = ComponentProps<typeof MaterialIcons>["name"];

export function IconCircle({ icon, color, background, size = 42 }: { icon: IconName; color: string; background: string; size?: number }) {
  return <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: background }]}><MaterialIcons name={icon} size={Math.round(size * 0.5)} color={color} /></View>;
}

export function EmptyState({ icon, title, description }: { icon: IconName; title: string; description: string }) {
  return <View style={styles.emptyState}><IconCircle icon={icon} color="#154C79" background="#DCEAF7" size={56} /><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyDescription}>{description}</Text></View>;
}

export function PrimaryButton({ label, icon, onPress, disabled = false }: { label: string; icon?: IconName; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, (pressed || disabled) && styles.pressed, disabled && styles.disabled]}>{icon ? <MaterialIcons name={icon} size={20} color="#FFFFFF" /> : null}<Text style={styles.primaryButtonText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center" },
  emptyState: { alignItems: "center", paddingHorizontal: 28, paddingVertical: 32, gap: 10 },
  emptyTitle: { color: "#14212B", fontSize: 17, fontWeight: "700", textAlign: "center", writingDirection: "rtl" },
  emptyDescription: { color: "#65737E", fontSize: 14, lineHeight: 21, maxWidth: 300, textAlign: "center", writingDirection: "rtl" },
  primaryButton: { alignItems: "center", backgroundColor: "#154C79", borderRadius: 16, flexDirection: "row-reverse", gap: 8, justifyContent: "center", minHeight: 52, paddingHorizontal: 18 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", writingDirection: "rtl" },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] }, disabled: { opacity: 0.45 },
});
