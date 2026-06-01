import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import ChatDetailTopbar from "../components/chatDetail/ChatDetailTopbar";
import SourcesPanel from "../components/chatDetail/SourcesPanel";
import ChatPanel from "../components/chatDetail/ChatPanel";
import StudioPanel from "../components/chatDetail/StudioPanel";
import useSources from "../hooks/useSources";
import useChat from "../hooks/useChat";
import { useAuth } from "../hooks/useAuth";
import useProjects from "../hooks/useProjects";
import { HiOutlineXMark } from "react-icons/hi2";

const TABS = ["Sources", "Chat", "Studio"];

/**
 * ChatDetail — full-page 3-panel layout with mobile tab navigation.
 * URL param: /chat/:id  — used to fetch project data when backend is ready
 */
const ChatDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [mobileTab, setMobileTab] = useState("Chat");
  const { user, loading, logout } = useAuth();
  const [projectTitle, setProjectTitle] = useState("Untitled Project");
  const hasGeneratedTitle = useRef(false);
  const { sources, selectedCount, processFiles, toggleSelect, removeSource } =
    useSources();
  const {
    messages,
    activeMode,
    setActiveMode,
    isLoading,
    sendChatMessage,
    queryOnly,
    loadSession,
  } = useChat();

  const { handleCreate } = useProjects();

  // Load chat history ketika membuka session yang sudah ada
  useEffect(() => {
    if (id) {
      loadSession(id);
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- ONBOARDING TUTORIAL STATE ---
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem("hasSeenUploadTutorial");
    if (!hasSeenTutorial && sources.length === 0) {
      if (window.innerWidth < 1024) {
        setMobileTab("Sources");
      }
      setShowTutorial(true);
    }
  }, [sources.length]);

  useEffect(() => {
    if (sources.length > 0 && showTutorial) {
      setShowTutorial(false);
      localStorage.setItem("hasSeenUploadTutorial", "true");

      if (window.innerWidth < 1024) {
        setMobileTab(activeMode ? "Chat" : "Studio");
      }
    }
  }, [sources.length, showTutorial, activeMode]);

  const dismissTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem("hasSeenUploadTutorial", "true");
  };
  // ---------------------------------------

  const handleCreateNewChat = async () => {
    try {
      const newProject = await handleCreate();
      navigate(`/chat/${newProject.id}`);
    } catch {}
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, loading, navigate]);

  // AI-generated project title based on the first prompt
  useEffect(() => {
    if (messages.length <= 1) return;
    if (hasGeneratedTitle.current) return;

    const firstUserMessage = messages.find((m) => m.role === "user");
    if (!firstUserMessage) return;

    hasGeneratedTitle.current = true;

    const generateTitle = async () => {
      try {
        const response = await queryOnly({
          message: `Provide a short title (maximum 5 words) summarizing the following prompt:\n\n"${firstUserMessage.content}"`,
          skipHistory: true,
        });

        if (response?.content) {
          setProjectTitle(response.content.trim());
        }
      } catch (err) {
        console.error("Failed to generate title", err);
      }
    };

    generateTitle();
  }, [messages, queryOnly]);

  const handleSend = (message) => {
    const selectedSources = sources.filter(
      (s) => s.selected && s.status === "ready",
    );

    const selectedFile =
      selectedSources.length > 0 ? selectedSources[0].file : null;

    const selectedSourceIds = selectedSources
      .filter((s) => s.documentId)
      .map((s) => s.documentId);

    sendChatMessage({
      message,
      selectedSourceIds,
      selectedFile,
      mode: activeMode,
    });
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-backgroundBlack font-poppins overflow-hidden">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#1a1721",
            color: "#f0edf5",
            border: "1px solid #3a3444",
            maxWidth: "360px",
            wordBreak: "break-word",
            overflowWrap: "break-word",
          },
        }}
      />

      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <ChatDetailTopbar
        projectTitle={projectTitle}
        user={user}
        onLogout={logout}
        onCreateNew={handleCreateNewChat}
      />

      {/* ── Mobile Tab Bar (Hidden on lg+) ──────────────────────────────────── */}
      <div className="flex lg:hidden border-b border-gray-200 dark:border-border bg-white dark:bg-backgroundBlack px-4 shrink-0 relative">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors duration-150 relative
                        ${
                          mobileTab === tab
                            ? "text-primary border-b-2 border-primary"
                            : "text-gray-500 dark:text-textSecondary hover:text-gray-800 dark:hover:text-textPrimary"
                        }`}
          >
            {tab}
            {/* Red dot indicator on mobile tab if tutorial is active and not on Sources tab */}
            {showTutorial && tab === "Sources" && mobileTab !== "Sources" && (
              <span className="absolute top-2 right-4 w-2 h-2 rounded-full bg-primary animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* ── 3-Panel Area ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex gap-3 py-3 px-3 md:px-4 lg:px-8 pb-4 overflow-hidden min-h-0 relative">
        {/* Left — Sources (Now stretched fully downwards with h-full) */}
        <div
          className={`lg:flex flex-col shrink-0 min-h-0 h-full relative ${
            mobileTab === "Sources" ? "flex" : "hidden"
          } w-full lg:w-auto`}
        >
          {/* Tooltip Overlay */}
          {showTutorial && (
            <div className="absolute z-50 top-16 left-4 lg:left-full lg:ml-4 w-64 bg-primary text-white p-4 rounded-xl shadow-2xl animate-bounce border border-primary/20">
              <div className="absolute -left-2 top-4 hidden lg:block w-4 h-4 bg-primary rotate-45" />{" "}
              {/* Desktop Arrow */}
              <div className="absolute -top-2 left-8 lg:hidden w-4 h-4 bg-primary rotate-45" />{" "}
              {/* Mobile Arrow */}
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h4 className="font-semibold text-sm mb-1">Start here! 🚀</h4>
                  <p className="text-xs text-white/90 leading-relaxed">
                    Upload your contract documents or references in this panel
                    for AI analysis.
                  </p>
                </div>
                <button
                  onClick={dismissTutorial}
                  className="text-white/60 hover:text-white p-1 transition-colors"
                  aria-label="Dismiss tutorial"
                >
                  <HiOutlineXMark className="text-lg" />
                </button>
              </div>
            </div>
          )}

          {/* Added h-full to the wrapper so it pushes all the way down */}
          <div
            className={`h-full flex flex-col w-full ${showTutorial ? "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-2xl transition-all" : ""}`}
          >
            <SourcesPanel
              sources={sources}
              selectedCount={selectedCount}
              onProcessFiles={processFiles}
              onToggleSelect={toggleSelect}
              onRemoveSource={removeSource}
              activeMode={activeMode}
              fullWidth={false}
            />
          </div>
        </div>

        {/* Center — Chat */}
        <div
          className={`lg:flex flex-1 flex-col min-w-0 min-h-0 h-full ${
            mobileTab === "Chat" ? "flex" : "hidden"
          }`}
        >
          <ChatPanel
            messages={messages}
            isLoading={isLoading}
            onSend={handleSend}
            selectedCount={selectedCount}
            user={user}
            activeMode={activeMode}
          />
        </div>

        {/* Right — Studio */}
        <div
          className={`lg:flex flex-col shrink-0 min-h-0 h-full ${
            mobileTab === "Studio" ? "flex" : "hidden"
          } w-full lg:w-auto`}
        >
          <StudioPanel activeMode={activeMode} onSetMode={setActiveMode} />
        </div>
      </div>
    </div>
  );
};

export default ChatDetail;
