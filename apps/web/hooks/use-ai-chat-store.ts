"use client";

import type { UIMessage } from "ai";
import { create } from "zustand";
import type { ConfirmToolCall } from "@/lib/ai/types";
import { confirmAiToolCall, submitAiChatMessage } from "@/lib/ai/chat-client";

type AiChatStore = {
  isOpen: boolean;
  messages: UIMessage[];
  isStreaming: boolean;
  error: string | null;
  open: () => void;
  close: () => void;
  clearError: () => void;
  submitMessage: (input: string) => Promise<boolean>;
  confirmToolCall: (confirmToolCall: ConfirmToolCall) => Promise<boolean>;
};

export const useAiChatStore = create<AiChatStore>((set) => ({
  isOpen: false,
  messages: [],
  isStreaming: false,
  error: null,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  clearError: () => set({ error: null }),
  submitMessage: async (input) => {
    const trimmedInput = input.trim();
    if (!trimmedInput) {
      return false;
    }

    set({ isStreaming: true, error: null });

    try {
      const messages = await submitAiChatMessage({
        input: trimmedInput,
        messages: useAiChatStore.getState().messages,
        onProgress: (progress) => {
          set({ messages: progress.slice(-50) });
        },
      });

      set({
        messages: messages.slice(-50),
        isStreaming: false,
      });
      return true;
    } catch (error) {
      set({
        isStreaming: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to complete request.",
      });
      return false;
    }
  },
  confirmToolCall: async (confirmToolCall) => {
    set({ isStreaming: true, error: null });

    try {
      const messages = await confirmAiToolCall({
        messages: useAiChatStore.getState().messages,
        confirmToolCall,
        onProgress: (progress) => {
          set({ messages: progress.slice(-50) });
        },
      });

      set({
        messages: messages.slice(-50),
        isStreaming: false,
      });
      return true;
    } catch (error) {
      set({
        isStreaming: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to complete request.",
      });
      return false;
    }
  },
}));
