import { useState } from "react";
import { fetchChatHistory, sendMessage } from "../Services/chatService";
import { reviewContract } from "../Services/reviewService";
import { drafterChat } from "../Services/drafterService";
import toast from "react-hot-toast";

const INITIAL_MESSAGE = {
  id: "init",
  role: "assistant",
  content:
    "Welcome! I'm CLARA AI, your Contract Legal Analysis & Review Assistant. Upload a legal contract on the left panel and provide context, then choose a feature from the right panel to get started.",
  timestamp: new Date().toISOString(),
};

/**
 * Generate a unique session ID untuk semua mode
 */
const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const useChat = () => {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [activeMode, setActiveModeState] = useState(null);

  // Menggunakan nama sessionId karena berlaku untuk semua mode
  const [sessionId, setSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const addMessage = (role, content, extras = {}) =>
    setMessages((prev) => [
      ...prev,
      {
        id: `${role[0]}-${Date.now()}`,
        role,
        content,
        timestamp: new Date().toISOString(),
        ...extras,
      },
    ]);

  const setActiveMode = (mode) => {
    setActiveModeState(mode);
    // Kita hapus reset sessionId di sini agar session ID tetap bertahan
    // meski user berganti-ganti mode di tengah percakapan.
  };

  const buildDraftHistory = () => {
    return messages
      .filter((msg) => msg.id !== "init")
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));
  };

  const sendChatMessage = async ({
    message,
    selectedSourceIds = [],
    selectedFile = null,
    mode,
  }) => {
    // ── Validation ───────────────────────────────────────────────
    if (mode === "review") {
      if (!selectedFile) {
        toast.error(
          "Review mode: please select one file from the Sources panel first.",
        );
        return;
      }
      if (!message?.trim()) {
        toast.error("Review mode: please type your review question first.");
        return;
      }
    }

    if (mode === "draft" && !message?.trim()) {
      toast.error(
        "Draft mode: please describe the contract you want to create.",
      );
      return;
    }

    // ── Generate Session ID jika ini adalah pesan pertama ────────
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      currentSessionId = generateSessionId();
      setSessionId(currentSessionId);
      console.log(
        "[sendChatMessage] Generated new session_id on first message:",
        currentSessionId,
      );
    }

    addMessage("user", message.trim(), {
      attachment:
        mode === "review" && selectedFile
          ? { name: selectedFile.name, size: selectedFile.size }
          : null,
    });
    setIsLoading(true);

    try {
      if (mode === "review") {
        const { content, confidenceScore, citations, label, rationale } =
          await reviewContract({
            file: selectedFile,
            question: message.trim(),
            session_id: currentSessionId, // <-- SEKARANG DIKIRIM KE BACKEND
          });

        addMessage("assistant", content, {
          confidenceScore: confidenceScore ?? null,
          citations: citations ?? [],
          label: label ?? null,
          rationale: rationale ?? null,
        });
      } else if (mode === "draft") {
        const history = buildDraftHistory();
        const {
          content,
          status,
          documentType,
          documentNumber,
          bindingWarning,
          clarifyingQuestions,
          draft,
          pdfBase64,
        } = await drafterChat({
          session_id: currentSessionId,
          message: message.trim(),
          history,
        });

        addMessage("assistant", content, {
          status: status ?? null,
          documentType: documentType ?? null,
          documentNumber: documentNumber ?? null,
          bindingWarning: bindingWarning ?? false,
          clarifyingQuestions: clarifyingQuestions ?? [],
          draft: draft ?? null,
          pdfBase64: pdfBase64 ?? null,
        });
      } else {
        const { content, confidenceScore, citations } = await sendMessage({
          message,
          fileIds: selectedSourceIds,
          mode,
          session_id: currentSessionId, // <-- SEKARANG DIKIRIM KE BACKEND
        });

        addMessage("assistant", content, {
          confidenceScore: confidenceScore ?? null,
          citations: citations ?? [],
        });
      }
    } catch (err) {
      console.error("[useChat] Error:", err?.response?.data ?? err.message);
      const errMsg =
        err?.response?.status === 401
          ? "Session expired. Please log in again."
          : err?.response?.status === 400
            ? "Invalid request. Please ensure the file and question are correct."
            : "Something went wrong while contacting the server. Please try again.";

      addMessage("assistant", errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const queryOnly = async ({
    message,
    selectedSourceIds = [],
    mode = null,
    skipHistory = false, // <--- 1. Tambahkan parameter ini
  }) => {
    // ── Generate Session ID jika ini adalah pesan pertama ────────
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      currentSessionId = generateSessionId();
      setSessionId(currentSessionId);
    }

    try {
      if (mode === "draft") {
        const history = buildDraftHistory();
        const response = await drafterChat({
          session_id: skipHistory ? null : currentSessionId, // Jangan kirim ID jika skipHistory true
          message: message.trim(),
          history,
        });

        return response;
      } else {
        const { content } = await sendMessage({
          message,
          fileIds: selectedSourceIds,
          mode,
          // Gunakan ID statis jika skipHistory agar tidak nyampah di database
          session_id: skipHistory ? "temp_title_gen" : currentSessionId,
        });

        return { content };
      }
    } catch (err) {
      console.error("[queryOnly] Error:", err);
      return null;
    }
  };
  const loadSession = async (existingSessionId) => {
    setIsLoading(true);
    try {
      // 1. Set Session ID langsung agar hook tahu ini room milik ID tersebut
      setSessionId(existingSessionId);

      const data = await fetchChatHistory(existingSessionId);

      // 2. Load pesan JIKA ada history-nya
      if (data && data.history && data.history.length > 0) {
        const loadedMessages = data.history.map((msg, index) => ({
          id: `${msg.role[0]}-${Date.now()}-${index}`,
          role: msg.role === "model" ? "assistant" : msg.role,
          content: msg.content,
          timestamp: new Date().toISOString(),
        }));

        setMessages([INITIAL_MESSAGE, ...loadedMessages]);
      }
    } catch (err) {
      // Jika error 404 (karena chat benar-benar baru), kita bisa abaikan toast error-nya
      console.log("History kosong atau sesi baru");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    messages,
    activeMode,
    setActiveMode,
    isLoading,
    sendChatMessage,
    queryOnly,
    loadSession,
  };
};

export default useChat;
