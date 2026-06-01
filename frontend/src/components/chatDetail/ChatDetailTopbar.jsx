import { Link } from "react-router-dom";
import { HiOutlineMoon, HiOutlineSun } from "react-icons/hi2";
import SettingsDropdown from "../ui/SettingsDropdown";
import UserAvatar from "../ui/UserAvatar";
import { useEffect, useState } from "react";
import { TiDocumentAdd } from "react-icons/ti";

/**
 * ChatDetailTopbar — minimal topbar for the chat detail page.
 * Left: Clara. logo | Center: project title | Right: New chat + controls
 *
 * Props:
 * @param {string}   projectTitle  — displayed in center
 * @param {object}   user          — for UserAvatar
 * @param {Function} onCreateNew   — creates a new project and navigates to fresh ChatDetail
 */
const ChatDetailTopbar = ({
  projectTitle = "Untitled Project",
  user,
  onCreateNew,
}) => {
  const [isDark, setIsDark] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Theme init
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");

    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  }, []);

  // Scroll detection
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }

    setIsDark(!isDark);
  };

  return (
    <header className="relative flex items-center justify-between gap-4 px-4 md:px-6 lg:px-10 py-3 bg-white dark:bg-backgroundBlack border-b border-gray-300 dark:border-border shrink-0 z-40">
      {/* Left — Logo */}
      <div className="shrink-0">
        <Link to="/workspace">
          <span className="text-lg md:text-xl font-semibold tracking-tight bg-linear-to-b from-secondary to-primary bg-clip-text text-transparent">
            Clara.
          </span>
        </Link>
      </div>

      {/* Center — Project title */}
      <div className="absolute left-1/2 transform -translate-x-1/2 px-2 min-w-0">
        <span className="dark:text-textPrimary text-xs md:text-sm font-medium truncate">
          {projectTitle}
        </span>
      </div>

      {/* Right — Controls */}
      <div className="flex items-center gap-1 md:gap-2 shrink-0">
        {/* Create New Chat */}
        <button
          onClick={() => window.location.href = "/workspace"}
          className={`flex items-center cursor-pointer gap-2 px-2 md:px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
            dark:text-textSecondary hover:text-textPrimary hover:bg-surface`}
          title="Create New Chat"
        >
          <TiDocumentAdd className="text-base md:text-lg shrink-0" />
          <span className="hidden sm:inline text-xs md:text-sm">New Chat</span>
        </button>

        <div className="w-px h-4 md:h-5 bg-border" />

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-1.5 md:p-2 rounded-lg cursor-pointer hover:bg-surface transition duration-200"
          title={isDark ? "Light mode" : "Dark mode"}
        >
          {isDark ? (
            <HiOutlineMoon className="text-gray-700 text-base md:text-lg" />
          ) : (
            <HiOutlineSun className="text-yellow-400 text-base md:text-lg" />
          )}
        </button>

        <div className="hidden md:block">
          <SettingsDropdown />
        </div>

        <div className="w-px h-4 md:h-5 bg-border" />

        <UserAvatar user={user} />
      </div>
    </header>
  );
};

export default ChatDetailTopbar;
