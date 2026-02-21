/**
 * Editor Store - 文档编辑器状态管理
 */

import { create } from "zustand";

export interface Document {
  id: string;
  title: string;
  content: string;
  plainText: string;
  createdAt: Date;
  updatedAt: Date;
}

interface EditorState {
  document: Document | null;
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  lastSaved: Date | null;

  setDocument: (doc: Document | null) => void;
  updateContent: (content: string, plainText?: string) => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setDirty: (dirty: boolean) => void;
  markSaved: () => void;
  reset: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  document: null,
  isLoading: false,
  isSaving: false,
  isDirty: false,
  lastSaved: null,

  setDocument: (document) =>
    set({
      document,
      isDirty: false,
      isLoading: false,
    }),

  updateContent: (content, plainText) =>
    set((state) => ({
      document: state.document
        ? { ...state.document, content, plainText: plainText ?? state.document.plainText }
        : null,
      isDirty: true,
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setSaving: (isSaving) => set({ isSaving }),

  setDirty: (isDirty) => set({ isDirty }),

  markSaved: () =>
    set({
      isDirty: false,
      isSaving: false,
      lastSaved: new Date(),
    }),

  reset: () =>
    set({
      document: null,
      isLoading: false,
      isSaving: false,
      isDirty: false,
      lastSaved: null,
    }),
}));
