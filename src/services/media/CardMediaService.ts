import { getMediaByCardId } from '@/src/db/repositories';
import { CardMedia, ContentFormat } from '@/src/models/types';
import { ttsService } from '@/src/services/tts/TtsService';
import {
  extractSoundFilenames,
  stripHtmlForTts,
  textForSideTts,
} from '@/src/services/media/ankiHtmlParser';

export interface PlaySideOptions {
  rate?: number;
  volume?: number;
  side?: 'front' | 'back';
  frontText?: string;
}

type AvSound = {
  stopAsync(): Promise<void>;
  unloadAsync(): Promise<void>;
  setOnPlaybackStatusUpdate(
    listener: (status: { isLoaded: boolean; didJustFinish?: boolean }) => void,
  ): void;
  playAsync(): Promise<void>;
};

type AvModule = {
  Sound: {
    createAsync(src: { uri: string }): Promise<{ sound: AvSound }>;
  };
  setAudioModeAsync(opts: {
    playsInSilentModeIOS?: boolean;
    allowsRecordingIOS?: boolean;
  }): Promise<void>;
};

class CardMediaServiceImpl {
  private currentSound: AvSound | null = null;
  private avModule: AvModule | null | undefined;

  private async getAv(): Promise<AvModule | null> {
    if (this.avModule !== undefined) return this.avModule;
    try {
      const mod = await import('expo-av');
      this.avModule = mod.Audio as unknown as AvModule;
    } catch {
      this.avModule = null;
    }
    return this.avModule;
  }

  async stop(): Promise<void> {
    if (this.currentSound) {
      try {
        await this.currentSound.stopAsync();
        await this.currentSound.unloadAsync();
      } catch {
        // ignore
      }
      this.currentSound = null;
    }
    await ttsService.stop();
  }

  async playMediaByFilename(cardId: string, filename: string): Promise<void> {
    await this.stop();
    const media = await getMediaByCardId(cardId);
    const normalized = filename.normalize('NFC');
    const item = media.find(
      (m) => m.mediaType === 'audio' && m.sourceName.normalize('NFC') === normalized,
    );
    const av = await this.getAv();
    if (!item?.localUri || !av) return;

    try {
      await av.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
      });
      await this.playFile(av, item.localUri);
    } catch {
      // ignore playback errors
    }
  }

  async playSide(
    cardId: string,
    text: string,
    locale: string,
    contentFormat: ContentFormat,
    options: PlaySideOptions = {},
  ): Promise<void> {
    await this.stop();

    const speakText =
      options.side === 'back' && options.frontText != null
        ? textForSideTts('back', options.frontText, text, contentFormat)
        : text;

    const media = await getMediaByCardId(cardId);
    const sounds = this.resolveSoundsInOrder(speakText, media);
    const av = await this.getAv();

    if (sounds.length > 0 && av) {
      try {
        await av.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
        });
        for (const uri of sounds) {
          await this.playFile(av, uri);
        }
        return;
      } catch {
        // fall through to TTS
      }
    }

    const plain = contentFormat === 'html' ? stripHtmlForTts(speakText) : speakText;
    if (!plain.trim()) return;

    await ttsService.speak(plain, locale, {
      rate: options.rate,
      volume: options.volume ?? 60,
    });
  }

  private resolveSoundsInOrder(text: string, media: CardMedia[]): string[] {
    const filenames = extractSoundFilenames(text);
    if (filenames.length === 0) return [];

    const byName = new Map(
      media
        .filter((m) => m.mediaType === 'audio')
        .map((m) => [m.sourceName.normalize('NFC'), m.localUri]),
    );
    const uris: string[] = [];
    for (const name of filenames) {
      const uri = byName.get(name);
      if (uri) uris.push(uri);
    }
    return uris;
  }

  private async playFile(av: AvModule, uri: string): Promise<void> {
    const { sound } = await av.Sound.createAsync({ uri });
    this.currentSound = sound;
    await new Promise<void>((resolve, reject) => {
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          sound.unloadAsync().then(() => resolve()).catch(reject);
        }
      });
      sound.playAsync().catch(reject);
    });
    if (this.currentSound === sound) {
      this.currentSound = null;
    }
  }
}

export const cardMediaService = new CardMediaServiceImpl();
