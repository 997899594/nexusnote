/**
 * Editor Feature - Flat Export
 */

// Components
export { Editor } from "./Editor";
export { CollaborationEditor } from "./CollaborationEditor";
export { SuggestionProvider, SuggestionPanel, useSuggestions } from "./AISuggestions";
export type { AISuggestion } from "./AISuggestions";
export { AIMenu, AIQuickActions } from "./AIMenu";
export type { AIAction, AIMenuState } from "./AIMenu";
export { SnapshotProvider, SnapshotPanel, SnapshotItem, useSnapshots } from "./Snapshot";
export type { Snapshot } from "./Snapshot";
export { ExportButton, ImportButton, exportDocument, importDocument } from "./ExportImport";
export type { ExportFormat, ExportOptions } from "./ExportImport";
export { CommentsProvider, CommentsPanel, CommentThread, useComments } from "./Comments";
export type { Comment, CommentReply } from "./Comments";

// Extensions
export { Callout } from "./Callout";

// Stores
export { useEditorStore } from "./useEditorStore";
