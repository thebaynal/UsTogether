import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { MotionPressable as Pressable, MotionView, motion } from '@/components/Motion';
import { useSpaceTheme } from '@/features/spaces/useSpaceTheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { BrandHeader } from '@/components/BrandHeader';
import { Notice } from '@/components/Notice';
import { Page } from '@/components/Page';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/features/auth/AuthProvider';
import { addComment, listDiscussion, removeComment, toggleReaction, updateComment } from '@/features/comments/discussionService';
import { deleteMemory, getMemory, updateMemory } from '@/features/memories/memoryService';
import { formatMemoryDate, isValidMemoryDate } from '@/features/memories/logic';
import { getSpace } from '@/features/spaces/spaceService';
import type { Comment, Memory, Reaction, Space } from '@/types/domain';
import { getPalette, palettes } from '@/theme/palettes';
import { requireSupabase } from '@/lib/supabase';

const emojiOptions = ['💛', '❤️', '🥹', '😂', '✨', '🙌'];

export default function MemoryDetailScreen() {
  const { memoryId, spaceId } = useLocalSearchParams<{ memoryId: string; spaceId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [space, setSpace] = useState<Space | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [commentText, setCommentText] = useState('');
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [isEditingMemory, setIsEditingMemory] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', date: '', caption: '', milestoneTag: '' });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);

  const themeKey = useSpaceTheme(spaceId, space?.themeKey ?? null);
  const palette = getPalette(space?.kind ?? 'couple', themeKey);
  const myReaction = reactions.find((reaction) => reaction.userId === user?.id)?.emoji;
  const counts = useMemo(() => {
    const values = new Map<string, number>();
    for (const reaction of reactions) values.set(reaction.emoji, (values.get(reaction.emoji) ?? 0) + 1);
    return values;
  }, [reactions]);

  async function refreshDiscussion() {
    const next = await listDiscussion(memoryId);
    setComments(next.comments);
    setReactions(next.reactions);
  }

  useEffect(() => {
    let active = true;
    void Promise.all([getMemory(memoryId), getSpace(spaceId), listDiscussion(memoryId)])
      .then(([nextMemory, nextSpace, discussion]) => {
        if (!active) return;
        setMemory(nextMemory);
        setEditForm({ title: nextMemory.title, date: nextMemory.date, caption: nextMemory.caption ?? '', milestoneTag: nextMemory.milestoneTag ?? '' });
        setSpace(nextSpace);
        setComments(discussion.comments);
        setReactions(discussion.reactions);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'This memory could not be opened.'); })
      .finally(() => { if (active) setIsLoading(false); });

    const client = requireSupabase();
    const channel = client.channel(`memory:${memoryId}:discussion:${Date.now()}:${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `memory_id=eq.${memoryId}` }, () => { void refreshDiscussion(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions', filter: `memory_id=eq.${memoryId}` }, () => { void refreshDiscussion(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spaces', filter: `id=eq.${spaceId}` }, () => { void getSpace(spaceId).then(setSpace).catch((cause) => setError(cause.message)); })
      .subscribe();

    return () => { active = false; void client.removeChannel(channel); };
  }, [memoryId, spaceId]);

  async function submitComment() {
    if (!user) return;
    setIsSaving(true);
    setError(null);
    try {
      if (editingComment) await updateComment(editingComment, commentText);
      else await addComment(memoryId, user.id, commentText);
      setCommentText('');
      setEditingComment(null);
      await refreshDiscussion();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Comment could not be saved.');
    } finally { setIsSaving(false); }
  }

  async function react(emoji: string) {
    if (!user) return;
    setError(null);
    try {
      await toggleReaction(memoryId, user.id, emoji);
      await refreshDiscussion();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Reaction could not be saved.');
    }
  }

  async function deleteOwnComment(comment: Comment) {
    setError(null);
    try {
      await removeComment(comment.id);
      await refreshDiscussion();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Comment could not be removed.');
    }
  }

  async function confirmMemoryDelete() {
    setIsSaving(true);
    setError(null);
    try {
      await deleteMemory(memoryId);
      router.replace(`/spaces/${spaceId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Memory could not be deleted.');
      setIsSaving(false);
    }
  }

  async function saveMemoryEdit() {
    if (!editForm.title.trim()) { setError('Add a title for this moment.'); return; }
    if (!isValidMemoryDate(editForm.date)) { setError('Enter a real date in YYYY-MM-DD format.'); return; }
    setIsSaving(true);
    setError(null);
    try {
      setMemory(await updateMemory(memoryId, editForm));
      setIsEditingMemory(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Memory could not be updated.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Page palette={palette}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Text style={{ color: palette.primaryPressed, fontWeight: '800' }}>‹  Back to timeline</Text></Pressable>
      {isLoading ? <ActivityIndicator color={palette.primary} style={styles.loading} /> : null}
      {error ? <View style={styles.notice}><Notice palette={palette} tone="error">{error}</Notice></View> : null}
      {memory ? (
        <>
          <View style={[styles.heroCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            {memory.imageUrl && !photoFailed ? <Image source={{ uri: memory.imageUrl }} style={[styles.photo, { backgroundColor: palette.surfaceSoft }]} resizeMode="cover" accessibilityLabel={memory.title} onError={() => setPhotoFailed(true)} /> : <View style={[styles.photo, { backgroundColor: palette.surfaceSoft, justifyContent: 'center', padding: 24 }]}><Notice palette={palette}>Your memory is saved, but the photo preview is unavailable. Reopen this memory to retry.</Notice></View>}
            <View style={styles.memoryWords}>
              {!isEditingMemory ? (
                <>
                  <Text style={[styles.date, { color: palette.primaryPressed }]}>{formatMemoryDate(memory.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</Text>
                  <Text accessibilityRole="header" style={[styles.title, { color: palette.ink }]}>{memory.title}</Text>
                  {memory.milestoneTag ? <Text style={[styles.tag, { color: palette.primaryPressed, backgroundColor: palette.surfaceSoft }]}>{memory.milestoneTag}</Text> : null}
                  {memory.caption ? <Text style={[styles.caption, { color: palette.muted }]}>{memory.caption}</Text> : null}
                  <Pressable accessibilityRole="button" onPress={() => setIsEditingMemory(true)} style={styles.editMemoryButton}><Text style={{ color: palette.primaryPressed, fontWeight: '800' }}>Edit memory</Text></Pressable>
                </>
              ) : (
                <MotionView duration={motion.content} style={styles.editFields}>
                  <TextField label="Title" palette={palette} value={editForm.title} onChangeText={(title) => setEditForm((current) => ({ ...current, title }))} maxLength={50} />
                  <TextField label="Date · YYYY-MM-DD" palette={palette} value={editForm.date} onChangeText={(date) => setEditForm((current) => ({ ...current, date }))} maxLength={10} />
                  <TextField label="Milestone tag · optional" palette={palette} value={editForm.milestoneTag} onChangeText={(milestoneTag) => setEditForm((current) => ({ ...current, milestoneTag }))} maxLength={40} />
                  <TextField label="A few words · optional" palette={palette} value={editForm.caption} onChangeText={(caption) => setEditForm((current) => ({ ...current, caption }))} maxLength={250} multiline />
                  <AppButton label="Save changes" palette={palette} onPress={() => void saveMemoryEdit()} loading={isSaving} />
                  <AppButton label="Cancel" palette={palette} variant="outline" compact onPress={() => { setIsEditingMemory(false); setEditForm({ title: memory.title, date: memory.date, caption: memory.caption ?? '', milestoneTag: memory.milestoneTag ?? '' }); }} />
                </MotionView>
              )}
            </View>
          </View>

          <View style={styles.discussionSection}>
            <BrandHeader palette={palette} eyebrow="Keep the moment going" title="Leave a little love" subtitle="Comments and reactions are shared with everyone in this space." />
            <View style={styles.reactionRow}>
              {emojiOptions.map((emoji) => {
                const selected = myReaction === emoji;
                return (
                  <Pressable
                    key={emoji}
                    accessibilityRole="button"
                    accessibilityLabel={`${emoji} reaction, ${counts.get(emoji) ?? 0}. ${selected ? 'Remove' : 'Add'} reaction.`}
                    accessibilityState={{ selected }}
                    onPress={() => void react(emoji)}
                    style={[styles.reaction, { backgroundColor: selected ? palette.primary : palette.surface, borderColor: selected ? palette.primary : palette.border }]}
                  >
                    <Text style={styles.emoji}>{emoji}</Text>
                    <Text style={[styles.reactionCount, { color: selected ? '#FFFFFF' : palette.ink }]}>{counts.get(emoji) ?? 0}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.commentComposer}>
              <TextField
                label={editingComment ? 'Edit your note' : 'Write a note'}
                palette={palette}
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
                placeholder="Add a kind word or a detail you remember…"
              />
              <AppButton label={editingComment ? 'Save note' : 'Post note'} palette={palette} onPress={() => void submitComment()} loading={isSaving} />
              {editingComment ? <AppButton label="Cancel edit" palette={palette} variant="outline" compact onPress={() => { setEditingComment(null); setCommentText(''); }} /> : null}
            </View>

            <View style={styles.comments}>
              <Text style={[styles.commentHeading, { color: palette.ink }]}>Notes from your people <Text style={{ color: palette.muted }}>({comments.length})</Text></Text>
              {comments.length === 0 ? <Text style={[styles.noComments, { color: palette.muted }]}>Be the first to leave a note for this memory.</Text> : null}
              {comments.map((comment) => (
                <View key={comment.id} style={[styles.comment, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  <View style={styles.commentHeader}>
                    <View style={[styles.avatar, { backgroundColor: palette.surfaceSoft }]}><Text style={[styles.avatarText, { color: palette.primaryPressed }]}>{comment.authorName.slice(0, 1).toUpperCase()}</Text></View>
                    <View style={styles.commentBy}>
                      <Text style={[styles.author, { color: palette.ink }]}>{comment.authorName}{comment.userId === user?.id ? ' · you' : ''}</Text>
                      <Text style={[styles.commentDate, { color: palette.muted }]}>{new Date(comment.createdAt).toLocaleDateString()}</Text>
                    </View>
                    {comment.userId === user?.id ? (
                      <View style={styles.commentActions}>
                        <Pressable accessibilityRole="button" onPress={() => { setEditingComment(comment.id); setCommentText(comment.body); }}><Text style={[styles.commentAction, { color: palette.primaryPressed }]}>Edit</Text></Pressable>
                        <Pressable accessibilityRole="button" onPress={() => void deleteOwnComment(comment)}><Text style={[styles.commentAction, { color: palette.danger }]}>Delete</Text></Pressable>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.commentBody, { color: palette.ink }]}>{comment.body}</Text>
                </View>
              ))}
            </View>
          </View>

          {!isEditingMemory ? <View style={[styles.deleteArea, { borderColor: palette.border }]}>
            {!confirmDelete ? (
              <Pressable accessibilityRole="button" onPress={() => setConfirmDelete(true)} style={styles.deleteButton}><Text style={{ color: palette.danger, fontWeight: '800' }}>Delete this memory</Text></Pressable>
            ) : (
              <MotionView duration={motion.content} style={styles.deleteConfirm}>
                <Text style={{ color: palette.ink, fontSize: 14, fontWeight: '700' }}>Delete this memory and its photo?</Text>
                <View style={styles.deleteActions}>
                  <AppButton label="Keep it" palette={palette} variant="outline" compact onPress={() => setConfirmDelete(false)} />
                  <AppButton label="Delete memory" palette={palette} variant="danger" compact loading={isSaving} onPress={() => void confirmMemoryDelete()} />
                </View>
              </MotionView>
            )}
          </View> : null}
        </>
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 15 },
  loading: { marginTop: 35 },
  notice: { marginBottom: 14 },
  heroCard: { borderRadius: 32, borderWidth: 1, padding: 12, overflow: 'hidden', maxWidth: 760, width: '100%', alignSelf: 'center' },
  photo: { width: '100%', aspectRatio: 1.1, borderRadius: 24 },
  memoryWords: { padding: 20, gap: 12 },
  editFields: { gap: 13 },
  editMemoryButton: { alignSelf: 'flex-start', paddingVertical: 7 },
  date: { textTransform: 'uppercase', letterSpacing: 1, fontSize: 12, fontWeight: '900' },
  title: { fontFamily: Platform.OS === 'web' ? 'Georgia' : undefined, fontSize: 32, lineHeight: 39, fontWeight: '700', letterSpacing: -0.8 },
  tag: { alignSelf: 'flex-start', borderRadius: 10, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5, fontSize: 12, fontWeight: '800' },
  caption: { fontSize: 15, lineHeight: 23 },
  discussionSection: { marginTop: 29 },
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  reaction: { flexGrow: 1, minWidth: 64, minHeight: 52, borderWidth: 1, borderRadius: 28, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  emoji: { fontSize: 18 },
  reactionCount: { fontSize: 12, fontWeight: '800' },
  commentComposer: { gap: 10 },
  comments: { gap: 11, marginTop: 25 },
  commentHeading: { fontSize: 16, fontWeight: '900', marginBottom: 2 },
  noComments: { fontSize: 14, lineHeight: 20, paddingVertical: 7 },
  comment: { padding: 13, borderRadius: 18, borderWidth: 1, gap: 10 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '900' },
  commentBy: { flex: 1, gap: 1 },
  author: { fontSize: 13, fontWeight: '800' },
  commentDate: { fontSize: 11 },
  commentActions: { flexDirection: 'row', gap: 12 },
  commentAction: { fontSize: 12, fontWeight: '800', padding: 4 },
  commentBody: { fontSize: 14, lineHeight: 21 },
  deleteArea: { borderTopWidth: 1, marginTop: 27, paddingTop: 16 },
  deleteButton: { alignSelf: 'flex-start', paddingVertical: 8 },
  deleteConfirm: { gap: 12 },
  deleteActions: { flexDirection: 'row', gap: 9 }
});
