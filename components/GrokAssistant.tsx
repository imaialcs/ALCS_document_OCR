import React, { useCallback, useEffect, useRef } from 'react';
import { ArrowUpIcon, SparklesIcon } from './icons';
import { SuggestedOperation, ChatMessage } from '../types';

interface GrokAssistantProps {
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

export const GrokAssistant: React.FC<GrokAssistantProps> = ({
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
    <div className="grok-assistant bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-2xl shadow-lg flex flex-col h-full min-h-[400px]">
      <h2 className="text-xl font-bold mb-4 border-b border-gray-200 dark:border-gray-700 pb-2 flex items-center gap-2">
        <SparklesIcon className="w-6 h-6 text-blue-500" />
        <span>Grok アシスタント</span>
      </h2>

      {isLoading && messages.length === 0 && (
        <div className="w-full flex justify-center items-center p-4">
          <div className="flex flex-col items-center gap-2">
            <TypingIndicator />
            <p className="text-sm text-gray-500">スプレッドシートを分析中...</p>
          </div>
        </div>
      )}

      {!isLoading && suggestedOperations.length > 0 && (
        <div className="mb-4 p-3 border rounded-lg border-gray-200 dark:border-gray-700">
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

      <div className="flex-grow overflow-y-auto mb-4 p-3 space-y-4 border-t border-gray-200 dark:border-gray-700 mt-4">
        {messages.map((msg, index) => (
          <div key={`${msg.role}-${index}`} className={`w-full flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <span className="text-xs text-gray-500 dark:text-gray-400 px-2">
              {msg.role === 'user' ? 'あなた' : 'Grok アシスタント'}
            </span>
            <div
              className={`px-4 py-2 rounded-2xl max-w-xl break-words shadow-md ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'}`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {isLoading && messages.length > 0 && (
          <div className="w-full flex justify-start">
            <div className="px-4 py-2 rounded-lg bg-white dark:bg-gray-700 shadow-sm">
              <TypingIndicator />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area relative mt-auto">
        <textarea
          ref={textareaRef}
          className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-3 pr-14 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 max-h-40"
          value={userInput}
          onChange={(event) => onUserInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSendMessage();
            }
          }}
          placeholder="AIに操作を依頼... (例: 1つ目の文書の勘定科目を入力)"
          rows={1}
        />
        <button
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors disabled:opacity-50 enabled:hover:bg-blue-100 enabled:dark:hover:bg-gray-600"
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