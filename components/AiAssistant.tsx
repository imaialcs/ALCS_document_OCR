import React, { useCallback, useEffect, useRef } from "react";
import { PaperAirplaneIcon } from "./icons";
import botAvatar from "../assets/ai-assistant-avatar.png";
import userAvatar from "../User.png"; // User.pngをインポート
import { SuggestedOperation, ChatMessage } from "../types";

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
  <div className="flex items-center gap-1.5 py-1">
    <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:-0.28s]" />
    <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:-0.14s]" />
    <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-emerald-400" />
  </div>
);

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

  // Auto-scrolling disabled based on user feedback
  // const scrollToBottom = useCallback(() => {
  //   messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  // }, []);

  // useEffect(() => {
  //   scrollToBottom();
  // }, [messages, isLoading, scrollToBottom]);

  useEffect(() => {
    if (!textareaRef.current) {
      return;
    }
    const element = textareaRef.current;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [userInput]);

  const handleSuggestionClick = (operation: SuggestedOperation) => {
    onExecuteOperation(operation);
  };

  return (
    <section className="relative flex h-[700px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-lg">
      {/* Decorative background gradients */}
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div className="absolute -top-24 right-[-18%] h-60 w-60 rounded-full bg-gradient-to-br from-sky-100 to-transparent blur-3xl" />
        <div className="absolute bottom-[-30%] left-[-12%] h-60 w-60 rounded-full bg-gradient-to-br from-indigo-100 to-transparent blur-3xl" />
      </div>

      <header className="relative flex flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10">
            <img src={botAvatar} alt="AIアシスタントのアイコン" className="h-full w-full rounded-full object-cover" />
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">AIアシスタント</h2>
            <p className="text-xs text-slate-500">オンライン | 通常3分以内に応答</p>
          </div>
        </div>
      </header>

      <div className="relative flex-1 space-y-6 overflow-y-auto p-6">
        {messages.map((msg, index) => {
          const isUser = msg.role === "user";
          const messageTime = new Date().toLocaleTimeString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit",
          });

          if (isUser) {
            return (
              <div key={`${msg.role}-${index}`} className="flex items-end justify-end gap-2">
                <span className="text-xs text-gray-400">{messageTime}</span>
                <div className="max-w-md rounded-2xl rounded-br-none bg-sky-100 px-4 py-3 text-gray-800 shadow-md">
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                </div>
                <img src={userAvatar} alt="ユーザーアイコン" className="h-8 w-8 rounded-full object-cover" />
              </div>
            );
          }

          return (
            <div key={`${msg.role}-${index}`} className="flex items-start gap-3">
              <img src={botAvatar} alt="AIアシスタントのアイコン" className="h-8 w-8 rounded-full object-cover" />
              <div className="flex items-end gap-2">
                <div className="max-w-md rounded-2xl rounded-bl-none bg-white px-4 py-3 text-gray-800 shadow-md">
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                </div>
                <span className="text-xs text-gray-400">{messageTime}</span>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start gap-3">
            <img src={botAvatar} alt="AIアシスタントのアイコン" className="h-8 w-8 rounded-full object-cover" />
            <div className="max-w-sm rounded-2xl rounded-bl-none bg-white px-5 py-3 shadow-md">
              <TypingIndicator />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {!isLoading && suggestedOperations.length > 0 && (
        <div className="border-t border-gray-200 bg-white/50 px-6 py-4 backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-2">
            {suggestedOperations.map((operation, index) => (
              <button
                key={`${operation.operation}-${index}`}
                onClick={() => handleSuggestionClick(operation)}
                className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-sky-600 shadow-sm transition hover:bg-gray-50"
              >
                <span className="truncate">{operation.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <footer className="flex-shrink-0 border-t border-gray-200 bg-white px-6 py-4">
        <div className="flex w-full items-end gap-3">
          <textarea
            ref={textareaRef}
            className="flex-1 w-full min-h-[48px] max-h-48 resize-none rounded-xl border border-emerald-100 bg-white/80 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            value={userInput}
            onChange={(event) => onUserInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSendMessage();
              }
            }}
            placeholder="メッセージを入力..."
          />
          <button
            type="button"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md transition hover:bg-emerald-600 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-gray-300"
            onClick={onSendMessage}
            disabled={isLoading || !userInput.trim()}
            aria-label="メッセージを送信"
          >
            <PaperAirplaneIcon className="h-5 w-5 -rotate-45" />
          </button>
        </div>
      </footer>
    </section>
  );
};

