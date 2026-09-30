export type SpaceKind = 'couple' | 'group' | 'team';
export type ThemeKey = 'rose' | 'lavender' | 'peach' | 'mint' | 'sky';
export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export type Space = {
  id: string;
  name: string;
  kind: SpaceKind;
  themeKey: ThemeKey | null;
  createdAt: string;
  memberCount: number;
};

export type SpaceMember = {
  userId: string;
  displayName: string;
  joinedAt: string;
};

export type Memory = {
  id: string;
  spaceId: string;
  createdBy: string | null;
  title: string;
  date: string;
  caption: string | null;
  milestoneTag: string | null;
  imagePath: string;
  imageUrl: string;
  imageMimeType: ImageMimeType;
  createdAt: string;
};

export type Comment = {
  id: string;
  memoryId: string;
  userId: string;
  authorName: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type Reaction = {
  id: string;
  memoryId: string;
  userId: string;
  emoji: string;
};
