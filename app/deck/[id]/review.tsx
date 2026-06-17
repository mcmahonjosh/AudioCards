import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, FontSize } from '@/constants/Colors';
import { Button } from '@/src/components/Button';
import { CardDisplay } from '@/src/components/CardDisplay';
import { RatingButtons } from '@/src/components/RatingButtons';
import { VoiceStatusBar } from '@/src/components/VoiceStatusBar';
import { ReviewSessionController } from '@/src/review/ReviewSessionController';
import { ReviewPhase, VoiceActivity } from '@/src/review/types';
import { Rating, IntervalPreview, CardWithScheduling } from '@/src/models/types';
import { useAppContext } from '@/src/context/AppContext';
import {
  useSpeechRecognitionEvent,
  voiceCommandService,
} from '@/src/services/voice/VoiceCommandService';

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { settings } = useAppContext();
  const controllerRef = useRef<ReviewSessionController | null>(null);

  const [phase, setPhase] = useState<ReviewPhase>('loading');
  const [voiceActivity, setVoiceActivity] = useState<VoiceActivity>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalCards, setTotalCards] = useState(0);
  const [cardsReviewed, setCardsReviewed] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentCard, setCurrentCard] = useState<CardWithScheduling | null>(null);
  const [previews, setPreviews] = useState<Partial<Record<Rating, IntervalPreview>> | null>(null);

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript ?? '';
    const isFinal = event.isFinal ?? false;
    voiceCommandService.handleResult(transcript, isFinal);
  });

  useSpeechRecognitionEvent('end', () => {
    voiceCommandService.handleEnd();
  });

  useEffect(() => {
    if (!id) return;

    const controller = new ReviewSessionController({
      deckId: id,
      includeNewCards: true,
      speechRate: settings.speechRate,
      autoPlayFront: settings.autoPlayFront,
      autoPlayBack: settings.autoPlayBack,
      handsFreeMode: settings.handsFreeMode,
    });

    controllerRef.current = controller;

    const unsub = controller.onStateChange((state) => {
      setPhase(state.phase);
      setVoiceActivity(state.voiceActivity);
      setCurrentIndex(state.currentIndex);
      setTotalCards(state.totalCards);
      setCardsReviewed(state.cardsReviewed);
      setIsFlipped(state.isFlipped);
      setCurrentCard(state.currentCard);
      setPreviews(state.previews);
    });

    controller.initialize().catch(() => {
      Alert.alert('Error', 'Failed to start review session');
      router.back();
    });

    return () => {
      unsub();
      controller.destroy();
    };
  }, [id, settings]);

  const handleFlip = () => controllerRef.current?.flip();
  const handleRepeat = () => controllerRef.current?.repeat();
  const handlePause = () => controllerRef.current?.pause();
  const handleResume = () => controllerRef.current?.resume();
  const handleEnd = () => {
    Alert.alert('End Session', 'Are you sure you want to end this review session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End',
        style: 'destructive',
        onPress: async () => {
          await controllerRef.current?.endSession();
        },
      },
    ]);
  };
  const handleRate = (rating: Rating) => controllerRef.current?.rate(rating);

  if (phase === 'loading') {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading cards...</Text>
      </View>
    );
  }

  if (phase === 'complete') {
    return (
      <View style={styles.center}>
        <Text style={styles.completeTitle}>Session Complete!</Text>
        <Text style={styles.completeSubtitle}>
          Reviewed {cardsReviewed} of {totalCards} cards
        </Text>
        <Button title="Done" onPress={() => router.back()} style={styles.doneBtn} />
      </View>
    );
  }

  const displayText = currentCard
    ? isFlipped
      ? currentCard.backText
      : currentCard.frontText
    : '';
  const displayLocale = currentCard
    ? isFlipped
      ? currentCard.backLocale
      : currentCard.frontLocale
    : '';

  return (
    <View style={styles.container}>
      <View style={styles.progress}>
        <Text style={styles.progressText}>
          {currentIndex + 1} / {totalCards}
        </Text>
        <Text style={styles.reviewedText}>{cardsReviewed} reviewed</Text>
      </View>

      <VoiceStatusBar activity={voiceActivity} handsFreeMode={settings.handsFreeMode} />

      <View style={styles.cardArea}>
        {currentCard && (
          <CardDisplay
            text={displayText}
            side={isFlipped ? 'back' : 'front'}
            locale={displayLocale}
            isFlipped={isFlipped}
          />
        )}
      </View>

      {phase === 'paused' && (
        <Text style={styles.pausedText}>Paused — say "resume" or tap Resume</Text>
      )}

      {!isFlipped && phase !== 'paused' && (
        <Button title="Flip" onPress={handleFlip} style={styles.flipBtn} />
      )}

      <RatingButtons
        visible={isFlipped && phase !== 'paused'}
        onRate={handleRate}
        previews={previews}
      />

      <View style={styles.toolbar}>
        <Button title="Repeat" variant="secondary" onPress={handleRepeat} style={styles.toolBtn} />
        {phase === 'paused' ? (
          <Button title="Resume" variant="secondary" onPress={handleResume} style={styles.toolBtn} />
        ) : (
          <Button title="Pause" variant="secondary" onPress={handlePause} style={styles.toolBtn} />
        )}
        <Button title="End" variant="ghost" onPress={handleEnd} style={styles.toolBtn} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  center: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  loadingText: { color: Colors.textMuted, fontSize: FontSize.md },
  completeTitle: { color: Colors.text, fontSize: FontSize.xxl, fontWeight: '700', marginBottom: Spacing.sm },
  completeSubtitle: { color: Colors.textMuted, fontSize: FontSize.md, marginBottom: Spacing.lg },
  doneBtn: { minWidth: 200 },
  progress: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  progressText: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
  reviewedText: { color: Colors.textMuted, fontSize: FontSize.sm },
  cardArea: { flex: 1, justifyContent: 'center', marginVertical: Spacing.md },
  pausedText: { color: Colors.hard, textAlign: 'center', marginBottom: Spacing.sm },
  flipBtn: { marginBottom: Spacing.md },
  toolbar: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  toolBtn: { flex: 1, paddingVertical: Spacing.sm },
});
