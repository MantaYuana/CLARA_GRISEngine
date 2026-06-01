import { Link, useLocation } from "react-router-dom";
import { HiOutlineDocumentText, HiOutlineFolder } from "react-icons/hi2";
import { HiOutlineSun, HiOutlineMoon } from "react-icons/hi";
import { useEffect, useState } from "react";
import SettingsDropdown from "../ui/SettingsDropdown";
import UserAvatar from "../ui/UserAvatar";
import { DUMMY_USER } from "../../constants/dummyUser";
import { useAuth } from "../../hooks/useAuth";

const Navbar = () => {
  const location = useLocation();
  const [isDark, setIsDark] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");

    if (!savedTheme || savedTheme === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    } else {
      document.documentElement.classList.remove("dark");
      setIsDark(false);
    }
  }, []);

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
    <nav
      className={`flex items-center justify-between px-6 md:px-10 py-3 
      fixed left-0 right-0 z-50 
      bg-white dark:bg-backgroundBlack 
      transition-all duration-300
      ${isScrolled ? "shadow-md" : "shadow-none"}
      `}
    >
      {/* Logo */}
      <Link to="/workspace" className="flex items-center gap-2">
        <span className="text-xl md:text-2xl font-semibold tracking-tight bg-linear-to-b from-secondary to-primary bg-clip-text text-transparent">
          Clara.
        </span>
      </Link>

      <div className="flex items-center gap-2">
        {/* Projects */}
        <Link
          to="/workspace"
          className={`flex items-center cursor-pointer gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            location.pathname === "/"
              ? "dark:bg-surfaceLight border-surfaceLight border text-primary"
              : "dark:text-textSecondary hover:bg-secondary/25 border-secondary dark:hover:bg-surface"
          }`}
        >
          <HiOutlineDocumentText className="text-base" />
          <span className="hidden sm:inline">Projects</span>
        </Link>

        {/* My Files */}
        <Link
          to="/my-files"
          className={`flex items-center cursor-pointer gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            location.pathname === "/my-files"
              ? "dark:bg-surfaceLight border-surfaceLight border text-primary"
              : "dark:text-textSecondary hover:bg-secondary/25 border-secondary dark:hover:bg-surface"
          }`}
        >
          <HiOutlineFolder className="text-base" />
          <span className="hidden sm:inline">My Files</span>
        </Link>

        <div className="w-px h-5 bg-border mx-2" />

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg cursor-pointer hover:bg-secondary/25 dark:hover:bg-surface transition duration-200"
        >
          {isDark ? (
            <HiOutlineMoon className="text-gray-700 text-xl" />
          ) : (
            <HiOutlineSun className="text-yellow-400 text-xl" />
          )}
        </button>

        <SettingsDropdown />

        <div className="w-px h-5 bg-border mx-2" />

        {!loading &&
          (user ? (
            <UserAvatar user={user} onSignOut={logout} />
          ) : (
            <Link
              to="/auth"
              className="ml-2 px-4 py-2 rounded-lg text-sm font-medium
                   bg-primary border-primary border text-white
                   hover:bg-primary/90
                   transition-all duration-200"
            >
              Login
            </Link>
          ))}
      </div>
    </nav>
  );
};

export default Navbar;
