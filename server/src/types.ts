export type Memory = {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  date: string;
  milestoneTag?: string;
  imageUrl: string;
  imageAlt: string;
  updatedAt: string;
};

export type Workspace = {
  id: string;
  name: string;
  partnerInviteCode: string;
  members: string[];
};
