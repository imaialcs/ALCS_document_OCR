import React, { useCallback, useEffect, useRef } from 'react';
import { ArrowUpIcon, SparklesIcon } from './icons';
import { SuggestedOperation, ChatMessage } from '../types';

interface AiAssistantProps {
  suggestedOperations: SuggestedOperation[];
  isLoading: boolean;
  messages: ChatMessage[];
  userInput: string;
  onUserInput: (input: string) => void;
  onSendMessage: () => void;
  onExecuteOperation: (operation: SuggestedOperation) => void;
}

const TypingIndicator: React.FC = () => (
  <div className="flex items-center space-x-1.5 py-2 px-3">
    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
  </div>
);

import { UserCircleIcon } from './icons';

export const AiAssistant: React.FC<AiAssistantProps> = ({
  suggestedOperations,
  isLoading,
  messages,
  userInput,
  onUserInput,
  onSendMessage,
  onExecuteOperation,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (!textareaRef.current) {
      return;
    }
    const element = textareaRef.current;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, [userInput]);

  const handleSuggestionClick = (op: SuggestedOperation) => {
    onExecuteOperation(op);
  };

  return (
    <div className="ai-assistant bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl shadow-lg flex flex-col h-full min-h-[400px]">
      <h2 className="text-xl font-bold mb-2 p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <SparklesIcon className="w-6 h-6 text-blue-500" />
        <span>AI アシスタント</span>
      </h2>

      <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-slate-100 dark:bg-slate-800">
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <div key={`${msg.role}-${index}`} className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {/* AI Avatar */}
              {!isUser && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
                  <SparklesIcon className="h-5 w-5" />
                </div>
              )}

              <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {isUser ? 'あなた' : 'AIアシスタント'}
                </span>
                <div className={`relative max-w-lg rounded-xl px-4 py-2 text-gray-700 shadow-sm ${isUser ? 'bg-blue-500 text-white rounded-br-none' : 'bg-white dark:bg-gray-700 dark:text-gray-200 rounded-bl-none'}`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>

              {/* User Avatar */}
              {isUser && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-300 text-gray-600">
                  <UserCircleIcon className="h-6 w-6" />
                </div>
              )}
            </div>
          );
        })}
        {isLoading && messages.length > 0 && (
          <div className="flex items-start gap-3 justify-start">
             <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
                <SparklesIcon className="h-5 w-5" />
              </div>
              <div className="flex flex-col gap-1 items-start">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">AIアシスタント</span>
                <div className="relative max-w-lg rounded-xl px-4 py-2 text-gray-700 bg-white dark:bg-gray-700 dark:text-gray-200 shadow-sm rounded-bl-none">
                  <TypingIndicator />
                </div>
              </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions Area */}
      {!isLoading && suggestedOperations.length > 0 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold mb-2 text-gray-600 dark:text-gray-300">AIからの提案</h3>
          <div className="flex flex-col gap-2">
            {suggestedOperations.map((op, index) => (
              <button
                key={`${op.operation}-${index}`}
                onClick={() => handleSuggestionClick(op)}
                className="w-full text-left px-4 py-3 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
              >
                {op.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="input-area relative mt-auto p-4 border-t border-gray-200 dark:border-gray-700">
        <textarea
          ref={textareaRef}
          className="w-full bg-slate-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-3 pr-14 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 max-h-40"
          value={userInput}
          onChange={(event) => onUserInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSendMessage();
            }
          }}
          placeholder="AIに操作を依頼..."
          rows={1}
        />
        <button
          className="absolute right-6 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors disabled:opacity-50 enabled:hover:bg-blue-100 enabled:dark:hover:bg-gray-600"
          onClick={onSendMessage}
          disabled={isLoading || !userInput.trim()}
          aria-label="メッセージを送信"
        >
          <ArrowUpIcon className="w-5 h-5 text-blue-600 dark:text-blue-500" />
        </button>
      </div>
    </div>
  );
};