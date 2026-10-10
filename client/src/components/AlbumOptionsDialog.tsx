import { useRef } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AppButton } from './AppButton';
import { MotionPressable, MotionView, motion, type MotionPressableHandle } from './Motion';
import { Notice } from './Notice';
import { focusControl } from './PhotoTimeline';
import type { Palette } from '@/theme/palettes';
import type { Space } from '@/types/domain';
import { spaceKindLabels } from '@/theme/palettes';

type Props = {
  visible: boolean;
  space: Space;
  memoryCount: number;
  palette: Palette;
  pendingExit: boolean;
  isExiting: boolean;
  error: string | null;
  onClose: () => void;
  onChangeTheme: () => void;
  onRequestExit: () => void;
  onCancelExit: () => void;
  onConfirmExit: () => void;
};

export function AlbumOptionsDialog({ visible, space, memoryCount, palette, pendingExit, isExiting, error, onClose, onChangeTheme, onRequestExit, onCancelExit, onConfirmExit }: Props) {
  const close = useRef<MotionPressableHandle>(null);
  const { height } = useWindowDimensions();
  const alone = space.memberCount === 1;
  return <Modal visible={visible} transparent animationType="none" accessibilityLabel="Album options"
    onShow={() => focusControl(close.current)} onRequestClose={() => { if (!isExiting) onClose(); }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdrop}>
      <MotionView duration={motion.content} style={[styles.dialogWrap, { maxHeight: Math.max(120, height - 40) }]}>
        <View accessibilityViewIsModal role={Platform.OS === 'web' ? undefined : 'dialog'} accessibilityLabel={Platform.OS === 'web' ? undefined : 'Album options'}
          style={[styles.dialog, { maxHeight: Math.max(120, height - 40), backgroundColor: palette.surface, borderColor: palette.border, shadowColor: palette.shadow }]}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={[styles.title, { color: palette.ink }]}>Album options</Text>
            <MotionPressable ref={close} accessibilityRole="button" accessibilityLabel="Close album options" disabled={isExiting}
              onPress={onClose} style={[styles.close, { backgroundColor: palette.surfaceSoft }]}><Text style={{ color: palette.primaryPressed, fontSize: 25 }}>×</Text></MotionPressable>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.albumName, { color: palette.primaryPressed }]}>{space.name}</Text>
          <Text style={[styles.metadata, { color: palette.muted }]}>{spaceKindLabels[space.kind]} album · {space.memberCount} {space.memberCount === 1 ? 'member' : 'members'} · {memoryCount} {memoryCount === 1 ? 'memory' : 'memories'}</Text>
          {!pendingExit ? <>
            <Text style={[styles.copy, { color: palette.muted }]}>Everyone here can add and care for the shared memories. Your palette is shared too.</Text>
            <AppButton label="Change space theme" palette={palette} variant="soft" onPress={onChangeTheme} />
            <View style={[styles.membership, { borderColor: palette.border }]}>
              <AppButton label={alone ? 'Delete space' : 'Leave space'} palette={palette} variant="outline" compact onPress={onRequestExit} />
            </View>
          </> : <MotionView duration={motion.content} style={styles.confirmation}>
            <Text style={[styles.confirmTitle, { color: palette.ink }]}>{alone ? 'Delete this album?' : 'Leave this album?'}</Text>
            <Text style={[styles.copy, { color: palette.muted }]}>{alone ? 'This removes the space and its memories.' : 'You’ll lose access to this timeline.'}</Text>
            <View style={styles.buttons}>
              <View style={styles.button}><AppButton label="Cancel" palette={palette} variant="outline" compact disabled={isExiting} onPress={onCancelExit} /></View>
              <View style={styles.button}><AppButton label={alone ? 'Delete' : 'Leave'} palette={palette} variant="danger" compact loading={isExiting} onPress={onConfirmExit} /></View>
            </View>
          </MotionView>}
          {error ? <Notice palette={palette} tone="error">{error}</Notice> : null}
          </ScrollView>
        </View>
      </MotionView>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(35, 22, 31, 0.36)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  dialogWrap: { width: '100%', maxWidth: 460, flexShrink: 1 },
  dialog: { flexShrink: 1, borderWidth: 1, borderRadius: 30, padding: 24, gap: 18, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 32, elevation: 8 },
  scroll: { flexShrink: 1 },
  content: { gap: 18, paddingBottom: 4 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontFamily: Platform.OS === 'web' ? 'Georgia' : undefined, fontSize: 27, lineHeight: 34, letterSpacing: -0.6, fontWeight: '700', flexShrink: 1 },
  close: { height: 44, width: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  albumName: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  metadata: { fontSize: 13, lineHeight: 20 },
  copy: { fontSize: 14, lineHeight: 22 },
  membership: { borderTopWidth: 1, paddingTop: 18 },
  confirmation: { gap: 13 },
  confirmTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 5 },
  button: { flex: 1 }
});
