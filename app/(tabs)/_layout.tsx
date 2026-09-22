import { Redirect, Tabs } from "expo-router";

import { TabBar } from "@/components/TabBar";
import { LiveExperience } from "@/components/health/Experience";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/ui";

export default function TabsLayout() {
  const { session, isLoading } = useAuth();
  const { colors } = useTheme();

  if (isLoading) return null;
  if (session === null) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <LiveExperience key={session.user.id}>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="records" options={{ title: "Documents" }} />
        <Tabs.Screen name="chat" options={{ title: "Ask" }} />
        <Tabs.Screen name="profile" options={{ title: "You" }} />
      </Tabs>
    </LiveExperience>
  );
}
