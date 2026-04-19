import React, { createContext, useContext, useState, useCallback } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  action?: PageAction;
}

export interface PageAction {
  type: 'filter' | 'navigate' | 'highlight';
  filters?: Record<string, any>;
  url?: string;
  elementId?: string;
}

export interface PageContext {
  id: string;
  name: string;
  queryHandler: (question: string) => Promise<{ content: string; action?: PageAction }>;
  suggestedQuestions?: string[];
  onAction?: (action: PageAction) => void;
}

interface ChatContextValue {
  messages: ChatMessage[];
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  currentPage: PageContext | null;
  setCurrentPage: (page: PageContext | null) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentPage, setCurrentPage] = useState<PageContext | null>(null);

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages(prev => [
      ...prev,
      {
        ...message,
        id: Date.now().toString(),
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return (
    <ChatContext.Provider value={{ messages, addMessage, clearMessages, currentPage, setCurrentPage }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
};
