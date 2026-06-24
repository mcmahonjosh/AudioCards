import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { Colors, Spacing, FontSize } from '@/constants/Colors';
import { plainTextPreview } from '@/src/services/media/ankiHtmlParser';
import {
  ColSeparatorKind,
  PastedTextParseOptions,
  PastedTextParseResult,
  RowSeparatorKind,
  parsePastedText,
} from '@/src/services/import/pastedTextImporter';

const PREVIEW_LIMIT = 20;

export interface PasteCardsState {
  pasteText: string;
  options: PastedTextParseOptions;
  parseResult: PastedTextParseResult;
  hasText: boolean;
}

export interface PasteCardsPanelProps {
  frontLabel?: string;
  backLabel?: string;
  onChange?: (state: PasteCardsState) => void;
}

function ChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.optionGroup}>
      <Text style={styles.optionLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            style={[styles.chip, value === opt.id && styles.chipActive]}
            onPress={() => onChange(opt.id)}
          >
            <Text style={[styles.chipText, value === opt.id && styles.chipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export function PasteCardsPanel({
  frontLabel = 'Front',
  backLabel = 'Back',
  onChange,
}: PasteCardsPanelProps) {
  const [pasteText, setPasteText] = useState('');
  const [colSeparator, setColSeparator] = useState<ColSeparatorKind>('comma');
  const [customColSeparator, setCustomColSeparator] = useState('\\t');
  const [rowSeparator, setRowSeparator] = useState<RowSeparatorKind>('newline');
  const [customRowSeparator, setCustomRowSeparator] = useState('');
  const [skipFirstRow, setSkipFirstRow] = useState(false);

  const options: PastedTextParseOptions = useMemo(
    () => ({
      colSeparator,
      customColSeparator:
        colSeparator === 'custom' ? decodeCustomSeparator(customColSeparator) : undefined,
      rowSeparator,
      customRowSeparator:
        rowSeparator === 'custom' ? decodeCustomSeparator(customRowSeparator) : undefined,
      skipFirstRow,
    }),
    [
      colSeparator,
      customColSeparator,
      rowSeparator,
      customRowSeparator,
      skipFirstRow,
    ],
  );

  const parseResult = useMemo(
    () => parsePastedText(pasteText, options),
    [pasteText, options],
  );

  const hasText = pasteText.trim().length > 0;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    onChangeRef.current?.({ pasteText, options, parseResult, hasText });
  }, [pasteText, options, parseResult, hasText]);

  const previewRows = parseResult.rows.slice(0, PREVIEW_LIMIT);
  const remaining = parseResult.rows.length - previewRows.length;

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        Paste two-column text (e.g. hello,world). For Excel, use column Custom with \t.
      </Text>

      <TextInput
        style={styles.pasteInput}
        value={pasteText}
        onChangeText={setPasteText}
        placeholder={`${frontLabel},${backLabel}\nword,translation`}
        placeholderTextColor={Colors.textMuted}
        multiline
        textAlignVertical="top"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <ChipRow
        label="Column separator"
        value={colSeparator}
        onChange={setColSeparator}
        options={[
          { id: 'comma', label: 'Comma' },
          { id: 'custom', label: 'Custom' },
        ]}
      />
      {colSeparator === 'custom' && (
        <TextInput
          style={styles.customInput}
          value={customColSeparator}
          onChangeText={setCustomColSeparator}
          placeholder="e.g. \\t for tab"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}

      <ChipRow
        label="Row separator"
        value={rowSeparator}
        onChange={setRowSeparator}
        options={[
          { id: 'newline', label: 'New line' },
          { id: 'semicolon', label: 'Semicolon' },
          { id: 'custom', label: 'Custom' },
        ]}
      />
      {rowSeparator === 'custom' && (
        <TextInput
          style={styles.customInput}
          value={customRowSeparator}
          onChangeText={setCustomRowSeparator}
          placeholder="Custom row separator"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>First row is a header</Text>
        <Switch
          value={skipFirstRow}
          onValueChange={setSkipFirstRow}
          trackColor={{ false: Colors.border, true: Colors.primary }}
        />
      </View>

      {parseResult.configError && (
        <Text style={styles.errorText}>{parseResult.configError}</Text>
      )}

      {hasText && !parseResult.configError && (
        <View style={styles.previewSection}>
          <Text style={styles.previewSummary}>
            {parseResult.rows.length} card{parseResult.rows.length === 1 ? '' : 's'} ready
            {parseResult.skippedEmpty > 0
              ? ` · ${parseResult.skippedEmpty} row${parseResult.skippedEmpty === 1 ? '' : 's'} skipped`
              : ''}
          </Text>

          {parseResult.errors.slice(0, 3).map((err) => (
            <Text key={err} style={styles.warnText}>
              {err}
            </Text>
          ))}

          {previewRows.map((row, index) => (
            <View key={`${row.lineNumber}-${index}`} style={styles.previewRow}>
              <Text style={styles.previewFront} numberOfLines={2}>
                {plainTextPreview(row.front, 'plain')}
              </Text>
              <Text style={styles.previewArrow}>→</Text>
              <Text style={styles.previewBack} numberOfLines={2}>
                {plainTextPreview(row.back, 'plain')}
              </Text>
            </View>
          ))}

          {remaining > 0 && (
            <Text style={styles.moreText}>and {remaining} more…</Text>
          )}
        </View>
      )}
    </View>
  );
}

function decodeCustomSeparator(value: string): string {
  return value.replace(/\\t/g, '\t').replace(/\\n/g, '\n');
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  hint: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 20 },
  pasteInput: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.sm,
    fontFamily: 'monospace',
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  optionGroup: { marginTop: Spacing.xs },
  optionLabel: { color: Colors.textMuted, fontSize: FontSize.sm, marginBottom: Spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    backgroundColor: Colors.surfaceLight,
  },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { color: Colors.text, fontWeight: '600', fontSize: FontSize.sm },
  chipTextActive: { color: Colors.background },
  customInput: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: FontSize.sm,
    fontFamily: 'monospace',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  toggleLabel: { color: Colors.text, fontSize: FontSize.sm },
  errorText: { color: Colors.again, fontSize: FontSize.sm },
  warnText: { color: Colors.hard, fontSize: FontSize.sm },
  previewSection: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  previewSummary: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  previewFront: { flex: 1, color: Colors.text, fontSize: FontSize.sm },
  previewArrow: { color: Colors.textMuted, fontSize: FontSize.sm },
  previewBack: { flex: 1, color: Colors.textMuted, fontSize: FontSize.sm },
  moreText: { color: Colors.textMuted, fontSize: FontSize.sm, fontStyle: 'italic' },
});
