import { Tabs } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HapticTab } from "@/components/haptic-tab";
import { useColors } from "@/hooks/use-colors";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 58 + bottomPadding;

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.tint, headerShown: false, tabBarButton: HapticTab, tabBarStyle: { paddingTop: 8, paddingBottom: bottomPadding, height: tabBarHeight, backgroundColor: colors.background, borderTopColor: colors.border, borderTopWidth: 0.5 } }}>
      <Tabs.Screen name="index" options={{ title: "الرئيسية", tabBarIcon: ({ color }) => <MaterialIcons size={24} name="home" color={color} /> }} />
      <Tabs.Screen name="accounts" options={{ title: "الحسابات", tabBarIcon: ({ color }) => <MaterialIcons size={24} name="account-balance-wallet" color={color} /> }} />
      <Tabs.Screen name="add" options={{ title: "إضافة", tabBarIcon: ({ color }) => <MaterialIcons size={28} name="add-circle" color={color} /> }} />
      <Tabs.Screen name="entries" options={{ title: "القيود", tabBarIcon: ({ color }) => <MaterialIcons size={24} name="receipt-long" color={color} /> }} />
      <Tabs.Screen name="reports" options={{ title: "التقارير", tabBarIcon: ({ color }) => <MaterialIcons size={24} name="assessment" color={color} /> }} />
    </Tabs>
  );
}
