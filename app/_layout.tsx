import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import { AppProvider } from '@/src/context/AppContext';
import { StatsProvider } from '@/src/context/StatsContext';
import { DeckCacheProvider } from '@/src/context/DeckCacheContext';
import { Colors } from '@/constants/Colors';

LogBox.ignoreLogs([
  'TNodeChildrenRenderer: Support for defaultProps',
  'MemoizedTnodeRenderer: Support for defaultProps',
  'TRenderEngineProvider: Support for defaultProps',
  'Support for defaultProps will be removed from function components',
  'Support for defaultProps will be removed from memo components',
]);

export default function RootLayout() {
  return (
    <AppProvider>
      <StatsProvider>
        <DeckCacheProvider>
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
          <Stack.Screen name="import/apkg" options={{ title: 'Import Anki Deck' }} />
        </Stack>
        </DeckCacheProvider>
      </StatsProvider>
    </AppProvider>
  );
}
