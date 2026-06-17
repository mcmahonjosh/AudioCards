export type ReviewPhase =
  | 'loading'
  | 'front'
  | 'speaking_front'
  | 'back'
  | 'speaking_back'
  | 'rating'
  | 'paused'
  | 'complete';

export type VoiceActivity = 'idle' | 'speaking' | 'listening';

export interface ReviewSessionState {
  phase: ReviewPhase;
  voiceActivity: VoiceActivity;
  currentIndex: number;
  totalCards: number;
  cardsReviewed: number;
  sessionId: string;
  isFlipped: boolean;
}
