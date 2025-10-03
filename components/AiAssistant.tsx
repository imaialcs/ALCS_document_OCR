import React, { useCallback, useEffect, useRef } from "react";
import { ArrowUpIcon, UserCircleIcon } from "./icons";
import botAvatar from "../assets/ai-assistant-avatar.png";
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

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

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
    <section className="relative flex min-h-[560px] flex-col overflow-hidden rounded-[28px] bg-[#f5f7fb] shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -top-24 right-[-18%] h-60 w-60 rounded-full bg-gradient-to-br from-emerald-200 to-transparent blur-3xl" />
        <div className="absolute bottom-[-30%] left-[-12%] h-60 w-60 rounded-full bg-gradient-to-br from-teal-100 to-transparent blur-3xl" />
      </div>

      <header className="relative flex items-center justify-between border-b border-white/70 bg-gradient-to-r from-white via-white to-emerald-50 px-6 py-5">
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
        <button
          type="button"
          className="rounded-full p-1 text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-600"
          aria-label="チャット設定"
        >
          <span className="sr-only">設定</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      <div className="relative flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {messages.map((msg, index) => {
          const isUser = msg.role === "user";

          if (isUser) {
            return (
              <div key={`${msg.role}-${index}`} className="flex w-full justify-end gap-3">
                <div className="max-w-xl text-right">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-slate-400/90">あなた</span>
                  <div className="mt-1 rounded-3xl bg-gradient-to-br from-teal-500 via-emerald-500 to-green-500 px-5 py-3 text-sm font-medium leading-relaxed text-white shadow-[0_18px_30px_-18px_rgba(20,184,166,0.55)]">
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-white shadow-slate-900/30">
                  <UserCircleIcon className="h-5 w-5" />
                </div>
              </div>
            );
          }

          return (
            <div key={`${msg.role}-${index}`} className="flex w-full items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-400 text-xs font-bold text-white">
                AI
              </div>
              <div className="max-w-xl text-left">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-slate-400/90">AIアシスタント</span>
                <div className="mt-1 rounded-3xl border border-slate-200 bg-white px-5 py-3 text-sm leading-relaxed text-slate-800 shadow-sm">
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-400 text-xs font-bold text-white">
              AI
            </div>
            <div className="max-w-sm rounded-3xl border border-slate-200 bg-slate-100 px-5 py-3 text-sm text-slate-700 shadow-sm">
              <TypingIndicator />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {!isLoading && suggestedOperations.length > 0 && (
        <div className="border-t border-white/60 bg-white px-6 py-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">おすすめアクション</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestedOperations.map((operation, index) => (
              <button
                key={`${operation.operation}-${index}`}
                onClick={() => handleSuggestionClick(operation)}
                className="inline-flex min-w-[12rem] items-center justify-center gap-2 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_-18px_rgba(22,163,74,0.6)] transition hover:bg-green-700"
              >
                <span className="truncate">{operation.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <footer className="border-t border-white/70 bg-slate-50 px-6 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-3 shadow-inner focus-within:border-emerald-500 focus-within:shadow-[0_0_0_1px_rgba(16,185,129,0.35)]">
            <textarea
              ref={textareaRef}
              className="min-h-[52px] w-full resize-none bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none"
              value={userInput}
              onChange={(event) => onUserInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onSendMessage();
                }
              }}
              placeholder="AIにメッセージを入力..."
              rows={1}
            />
            <p className="mt-1 text-xs text-slate-400">Enterで送信 / Shift+Enterで改行</p>
          </div>
          <button
            type="button"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-green-600 px-6 text-base font-semibold text-white shadow-[0_16px_32px_-18px_rgba(22,163,74,0.65)] transition hover:-translate-y-0.5 hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 sm:w-auto"
            onClick={onSendMessage}
            disabled={isLoading || !userInput.trim()}
            aria-label="メッセージを送信"
          >
            <span>送信</span>
            <ArrowUpIcon className="h-5 w-5" />
          </button>
        </div>
      </footer>
    </section>
  );
};
