import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from '@/src/context/AppContext';
import { Colors } from '@/constants/Colors';

export default function RootLayout() {
  return (
    <AppProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.text,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="deck/[id]" options={{ title: 'Deck' }} />
        <Stack.Screen name="deck/[id]/review" options={{ title: 'Review', headerBackVisible: false }} />
        <Stack.Screen name="deck/new" options={{ title: 'New Deck', presentation: 'modal' }} />
        <Stack.Screen name="card/new" options={{ title: 'Add Card', presentation: 'modal' }} />
        <Stack.Screen name="card/[id]/edit" options={{ title: 'Edit Card', presentation: 'modal' }} />
      </Stack>
    </AppProvider>
  );
}
