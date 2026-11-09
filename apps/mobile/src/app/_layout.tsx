import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold, DMSans_800ExtraBold, useFonts } from "@expo-google-fonts/dm-sans";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { LettorePdfProvider } from "../lib/lettore";
import { StatoProvider } from "../lib/stato";
import { C, F } from "../lib/tema";

SplashScreen.preventAutoHideAsync();

export default function Layout() {
  const [caricati] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold, DMSans_800ExtraBold });
  useEffect(() => {
    if (caricati) SplashScreen.hideAsync();
  }, [caricati]);
  if (!caricati) return null;
  return (
    <StatoProvider>
      <LettorePdfProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: C.surface },
            headerTintColor: C.ink,
            headerTitleStyle: { fontFamily: F.bold, fontSize: 17 },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: C.surface },
            headerBackButtonDisplayMode: "minimal",
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="lettura" options={{ title: "La tua bolletta" }} />
          <Stack.Screen name="risultati" options={{ title: "Offerte per te" }} />
          <Stack.Screen name="guidato" options={{ title: "I tuoi dati" }} />
          <Stack.Screen name="dati" options={{ title: "I tuoi dati", presentation: "modal" }} />
          <Stack.Screen name="metodo" options={{ title: "Come calcoliamo" }} />
        </Stack>
      </LettorePdfProvider>
    </StatoProvider>
  );
}
