import { ttsService } from '@/src/services/tts/TtsService';
import { configureLoudSpeakerAudio } from '@/src/services/audio/audioSession';

export { configureLoudSpeakerAudio, configurePlaybackAudio } from '@/src/services/audio/audioSession';

/** Prepare TTS and audio session on app launch (no mic permission prompt). */
export async function setupAudioOnLaunch(): Promise<void> {
  configureLoudSpeakerAudio();
  await ttsService.initialize();
}
