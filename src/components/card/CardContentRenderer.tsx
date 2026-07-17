import React, { useMemo } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import RenderHTML, {
  CustomRendererProps,
  HTMLElementModel,
  HTMLContentModel,
} from 'react-native-render-html';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize } from '@/constants/Colors';
import { ContentFormat, CardMedia } from '@/src/models/types';
import {
  preprocessAnkiHtml,
  sanitizeAnkiHtmlForRender,
} from '@/src/services/media/ankiHtmlParser';

interface Props {
  text: string;
  contentFormat?: ContentFormat;
  media?: CardMedia[];
  onPlaySound?: (filename: string) => void;
  maxHeight?: number;
}

type SoundRendererProps = CustomRendererProps<any> & { onPlaySound?: (filename: string) => void };
type ImgRendererProps = CustomRendererProps<any> & { mediaBySource?: Record<string, string> };

function SoundRenderer({ tnode, onPlaySound }: SoundRendererProps) {
  const filename = tnode.domNode?.attribs?.['data-filename'] ?? '';
  return (
    <TouchableOpacity
      style={styles.soundBtn}
      onPress={() => onPlaySound?.(filename)}
      accessibilityLabel={`Play ${filename}`}
    >
      <Ionicons name="volume-high" size={20} color={Colors.primary} />
      <Text style={styles.soundLabel} numberOfLines={1}>
        {filename}
      </Text>
    </TouchableOpacity>
  );
}

function ImgRenderer({ tnode, mediaBySource = {} }: ImgRendererProps) {
  const src = tnode.domNode?.attribs?.src ?? '';
  const resolved = mediaBySource[src] ?? mediaBySource[src.normalize('NFC')] ?? src;
  if (!resolved || resolved.startsWith('about:')) return null;
  return (
    <Image
      source={{ uri: resolved }}
      style={styles.image}
      resizeMode="contain"
      accessibilityLabel="Card image"
    />
  );
}

const customHTMLElementModels = {
  'anki-sound': HTMLElementModel.fromCustomModel({
    tagName: 'anki-sound',
    contentModel: HTMLContentModel.block,
  }),
};

const htmlRenderers = {
  'anki-sound': SoundRenderer,
  img: ImgRenderer,
};

const ignoredDomTags = [
  'link',
  'button',
  'script',
  'style',
  'head',
  'meta',
  'title',
  'a',
  'form',
  'input',
  'iframe',
];

export function CardContentRenderer({
  text,
  contentFormat = 'plain',
  media = [],
  onPlaySound,
  maxHeight,
}: Props) {
  const { width } = useWindowDimensions();
  const contentWidth = width - Spacing.lg * 4;
  const onPlaySoundRef = React.useRef(onPlaySound);
  onPlaySoundRef.current = onPlaySound;

  const mediaBySource = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of media) {
      map[m.sourceName] = m.localUri;
      map[m.sourceName.normalize('NFC')] = m.localUri;
    }
    return map;
  }, [media]);

  const html = useMemo(
    () => sanitizeAnkiHtmlForRender(preprocessAnkiHtml(text)),
    [text],
  );

  const stableOnPlaySound = useMemo(
    () => (filename: string) => {
      onPlaySoundRef.current?.(filename);
    },
    [],
  );

  const renderersProps = useMemo(
    () => ({
      'anki-sound': { onPlaySound: stableOnPlaySound },
      img: { mediaBySource },
    }),
    [mediaBySource, stableOnPlaySound],
  );

  if (contentFormat === 'plain') {
    return (
      <ScrollView
        style={maxHeight ? { maxHeight } : undefined}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.plainText}>{text}</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={maxHeight ? { maxHeight } : undefined}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      <RenderHTML
        contentWidth={contentWidth}
        source={{ html }}
        baseStyle={styles.htmlBase}
        tagsStyles={htmlTagStyles}
        customHTMLElementModels={customHTMLElementModels}
        renderers={htmlRenderers}
        renderersProps={renderersProps as React.ComponentProps<typeof RenderHTML>['renderersProps']}
        ignoredDomTags={ignoredDomTags}
        defaultTextProps={{ selectable: true }}
      />
    </ScrollView>
  );
}

const htmlTagStyles = {
  body: { color: Colors.text },
  p: { marginVertical: 4 },
  div: { marginVertical: 2 },
  b: { fontWeight: '700' as const },
  strong: { fontWeight: '700' as const },
  i: { fontStyle: 'italic' as const },
  em: { fontStyle: 'italic' as const },
  ul: { marginVertical: 4 },
  li: { marginVertical: 2 },
};

const styles = StyleSheet.create({
  plainText: {
    color: Colors.text,
    fontSize: FontSize.lg,
    lineHeight: 28,
    textAlign: 'left',
  },
  htmlBase: {
    color: Colors.text,
    fontSize: FontSize.lg,
    lineHeight: 28,
  },
  image: {
    width: '100%',
    minHeight: 120,
    maxHeight: 280,
    marginVertical: Spacing.sm,
    borderRadius: 8,
  },
  soundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    alignSelf: 'flex-start',
  },
  soundLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    maxWidth: 200,
  },
});
