export type VoiceCommand =
  | 'flip'
  | 'repeat'
  | 'again'
  | 'hard'
  | 'good'
  | 'easy'
  | 'pause'
  | 'resume'
  | 'end';

export interface CommandDefinition {
  command: VoiceCommand;
  aliases: string[];
}

export const VOICE_COMMANDS: CommandDefinition[] = [
  { command: 'flip', aliases: ['flip', 'turn', 'turn over', 'show answer', 'answer', 'back'] },
  { command: 'repeat', aliases: ['repeat', 'again please', 'say again', 'replay', 'read again'] },
  { command: 'again', aliases: ['again', 'wrong', 'no', 'fail', 'forgot'] },
  { command: 'hard', aliases: ['hard', 'difficult', 'tough'] },
  { command: 'good', aliases: ['good', 'ok', 'okay', 'correct', 'yes', 'got it'] },
  { command: 'easy', aliases: ['easy', 'simple', 'trivial', 'know it'] },
  { command: 'pause', aliases: ['pause', 'stop', 'hold', 'wait'] },
  { command: 'resume', aliases: ['resume', 'continue', 'go', 'start'] },
  { command: 'end', aliases: ['end', 'end session', 'quit', 'exit', 'done', 'finish'] },
];

export const CONTEXTUAL_STRINGS = VOICE_COMMANDS.flatMap((c) => c.aliases);
