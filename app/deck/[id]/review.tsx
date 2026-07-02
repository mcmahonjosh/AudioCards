import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, ActivityIndicator, InteractionManager } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, FontSize } from '@/constants/Colors';
import { Button } from '@/src/components/Button';
import { CardDisplay } from '@/src/components/CardDisplay';
import { RatingButtons } from '@/src/components/RatingButtons';
import { VoiceStatusBar } from '@/src/components/VoiceStatusBar';
import { ReviewSessionController } from '@/src/review/ReviewSessionController';
import { ReviewPhase, VoiceActivity } from '@/src/review/types';
import { Rating, IntervalPreview, CardWithScheduling, CardMedia } from '@/src/models/types';
import { SessionCounts } from '@/src/scheduler/sessionQueue';
import { useAppContext } from '@/src/context/AppContext';
import { getMediaByCardId } from '@/src/db/repositories';
import { cardMediaService } from '@/src/services/media/CardMediaService';
import {
  useSpeechRecognitionEvent,
  voiceCommandService,
} from '@/src/services/voice/VoiceCommandService';
import { invalidateStatsData } from '@/src/context/statsInvalidation';
import { invalidateDeck } from '@/src/context/deckInvalidation';
import { useDeckCache } from '@/src/context/DeckCacheContext';

const EMPTY_COUNTS: SessionCounts = { new: 0, learning: 0, review: 0 };

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { settings } = useAppContext();
  const { getReviewInitialSnapshot, refreshDeckData } = useDeckCache();
  const controllerRef = useRef<ReviewSessionController | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const getSnapshotRef = useRef(getReviewInitialSnapshot);
  getSnapshotRef.current = getReviewInitialSnapshot;
  const refreshDeckRef = useRef(refreshDeckData);
  refreshDeckRef.current = refreshDeckData;
  const sessionCompleteRef = useRef(false);

  const [phase, setPhase] = useState<ReviewPhase>('loading');
  const [voiceActivity, setVoiceActivity] = useState<VoiceActivity>('idle');
  const [sessionCounts, setSessionCounts] = useState<SessionCounts>(EMPTY_COUNTS);
  const [cardsReviewed, setCardsReviewed] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentCard, setCurrentCard] = useState<CardWithScheduling | null>(null);
  const [cardMedia, setCardMedia] = useState<CardMedia[]>([]);
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

    let cancelled = false;
    let unsub: (() => void) | null = null;
    let controller: ReviewSessionController | null = null;

    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        const s = settingsRef.current;
        let initialSnapshot = getSnapshotRef.current(id) ?? undefined;
        if (!initialSnapshot) {
          const refreshed = await refreshDeckRef.current(id);
          if (refreshed) {
            initialSnapshot = {
              deck: refreshed.deck,
              cards: refreshed.cards,
              newCardsIntroducedToday: refreshed.newCardsIntroducedToday,
            };
          }
        }
        if (cancelled) return;

        controller = new ReviewSessionController({
          deckId: id,
          includeNewCards: true,
          defaultNewCardsPerDay: s.defaultNewCardsPerDay,
          speechRate: s.speechRate,
          speechVolume: s.speechVolume,
          autoPlayFront: s.autoPlayFront,
          autoPlayBack: s.autoPlayBack,
          handsFreeMode: s.handsFreeMode,
          initialSnapshot,
        });

        controllerRef.current = controller;
        sessionCompleteRef.current = false;

        unsub = controller.onStateChange((state) => {
          if (cancelled) return;
          if (sessionCompleteRef.current && state.phase !== 'complete') return;
          if (state.phase === 'complete') sessionCompleteRef.current = true;
          setPhase(state.phase);
          setVoiceActivity(state.voiceActivity);
          setSessionCounts(state.sessionCounts);
          setCardsReviewed(state.cardsReviewed);
          setIsFlipped(state.isFlipped);
          setCurrentCard(state.currentCard);
          setPreviews(state.previews);
        });

        try {
          await controller.initialize();
        } catch {
          if (!cancelled) {
            Alert.alert('Error', 'Failed to start review session');
            router.back();
          }
        }
      })();
    });

    return () => {
      cancelled = true;
      task.cancel();
      unsub?.();
      controller?.destroy();
      controllerRef.current = null;
      invalidateStatsData();
      invalidateDeck(id);
    };
  }, [id]);

  useEffect(() => {
    if (!currentCard) {
      setCardMedia([]);
      return;
    }
    getMediaByCardId(currentCard.id).then(setCardMedia);
  }, [currentCard?.id]);

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
  const handleRate = async (rating: Rating) => {
    try {
      await controllerRef.current?.rate(rating);
    } catch {
      Alert.alert('Error', 'Could not save your rating. Please try again.');
    }
  };

  const totalInQueue =
    sessionCounts.new + sessionCounts.learning + sessionCounts.review;

  if (phase === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading cards...</Text>
      </View>
    );
  }

  if (phase === 'complete') {
    return (
      <View style={styles.center}>
        <Text style={styles.completeTitle} testID="session-complete-title">Session Complete!</Text>
        <Text style={styles.completeSubtitle}>
          Reviewed {cardsReviewed} card{cardsReviewed === 1 ? '' : 's'}
        </Text>
        <Button title="Done" testID="review-done-button" onPress={() => router.back()} style={styles.doneBtn} />
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
  const displayFormat = currentCard?.contentFormat ?? 'plain';

  const handlePlaySound = async (filename: string) => {
    if (!currentCard) return;
    await cardMediaService.playMediaByFilename(currentCard.id, filename);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.queueCounts}>
          <QueueCount label="New" value={sessionCounts.new} color={Colors.primary} />
          <QueueCount label="Learning" value={sessionCounts.learning} color={Colors.hard} />
          <QueueCount label="Review" value={sessionCounts.review} color={Colors.accent} />
        </View>

        <View style={styles.progress}>
          <Text style={styles.progressText}>{totalInQueue} left in session</Text>
          <Text style={styles.reviewedText}>{cardsReviewed} reviewed</Text>
        </View>

        <VoiceStatusBar activity={voiceActivity} handsFreeMode={settings.handsFreeMode} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cardArea}>
          {currentCard && (
            <CardDisplay
              text={displayText}
              contentFormat={displayFormat}
              media={cardMedia}
              side={isFlipped ? 'back' : 'front'}
              locale={displayLocale}
              isFlipped={isFlipped}
              phase={currentCard.scheduling.phase}
              onPlaySound={handlePlaySound}
            />
          )}
        </View>

        {phase === 'paused' && (
          <Text style={styles.pausedText}>Paused — say "resume" or tap Resume</Text>
        )}

        {!isFlipped && phase !== 'paused' && (
          <Button title="Flip" testID="review-flip-button" onPress={handleFlip} style={styles.flipBtn} />
        )}

        <RatingButtons
          visible={isFlipped && phase !== 'paused'}
          onRate={handleRate}
          previews={previews}
        />
      </ScrollView>

      <View style={styles.toolbar}>
        <Button title="Repeat" variant="secondary" onPress={handleRepeat} style={styles.toolBtn} />
        {phase === 'paused' ? (
          <Button title="Resume" variant="secondary" onPress={handleResume} style={styles.toolBtn} />
        ) : (
          <Button title="Pause" variant="secondary" onPress={handlePause} style={styles.toolBtn} />
        )}
        <Button title="End" testID="review-end-button" variant="ghost" onPress={handleEnd} style={styles.toolBtn} />
      </View>
    </View>
  );
}

function QueueCount({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.queueCount}>
      <Text style={[styles.queueCountValue, { color }]}>{value}</Text>
      <Text style={styles.queueCountLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  loadingText: { color: Colors.textMuted, fontSize: FontSize.md },
  completeTitle: { color: Colors.text, fontSize: FontSize.xxl, fontWeight: '700', marginBottom: Spacing.sm },
  completeSubtitle: { color: Colors.textMuted, fontSize: FontSize.md, marginBottom: Spacing.lg },
  doneBtn: { minWidth: 200 },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  queueCounts: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  queueCount: { alignItems: 'center', minWidth: 72 },
  queueCountValue: { fontSize: FontSize.xl, fontWeight: '700' },
  queueCountLabel: { color: Colors.textMuted, fontSize: FontSize.sm, marginTop: 2 },
  progress: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  progressText: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
  reviewedText: { color: Colors.textMuted, fontSize: FontSize.sm },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  cardArea: {
    flexGrow: 1,
    minHeight: 160,
    justifyContent: 'center',
    marginVertical: Spacing.md,
  },
  pausedText: { color: Colors.hard, textAlign: 'center', marginBottom: Spacing.sm },
  flipBtn: { marginBottom: Spacing.md },
  toolbar: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  toolBtn: { flex: 1, paddingVertical: Spacing.sm },
});
