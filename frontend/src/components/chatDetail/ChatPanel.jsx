import { useEffect, useRef } from "react";
import ChatBubble, { TypingBubble } from "./ChatBubble";
import ChatInput from "./ChatInput";

/**
 * ChatPanel — center panel with scrollable messages and fixed input.
 *
 * Props:
 *  @param {Array}    messages      — from useChat
 *  @param {boolean}  isLoading     — shows typing bubble while AI responds
 *  @param {Function} onSend        — (message: string) => void
 *  @param {number}   selectedCount — passed to ChatInput for sources badge
 * @param {Object}   user           — for future use; can be used to show different avatars for multiple users
 */
const ChatPanel = ({
  messages,
  isLoading,
  onSend,
  selectedCount,
  user,
  activeMode,
}) => {
  const bottomRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 flex flex-col min-w-0 border bg-white dark:bg-background border-gray-200 dark:border-border rounded-2xl overflow-hidden h-full">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="px-5 py-3.5 border-b border-gray-200 dark:border-border shrink-0">
        <span className="text-gray-800 dark:text-textPrimary text-sm font-semibold">
          Chat
        </span>
      </div>

      {/* ── Messages ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-5 flex flex-col gap-4">
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} user={user} />
        ))}
        {isLoading && <TypingBubble />}
        <div ref={bottomRef} />
      </div>

      {/* ── Input (sticky bottom inside the panel) ───────────────────── */}
      <ChatInput
        onSend={onSend}
        isLoading={isLoading}
        selectedCount={selectedCount}
        activeMode={activeMode}
      />
    </div>
  );
};

export default ChatPanel;
