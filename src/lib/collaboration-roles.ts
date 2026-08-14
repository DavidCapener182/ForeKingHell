export const collaborationRoles = ["coach", "viewer", "editor"] as const;

export type CollaborationRole = (typeof collaborationRoles)[number];
