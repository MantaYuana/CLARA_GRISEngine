import { useState, useRef, useEffect } from "react";
import {
  HiOutlineCog6Tooth,
  HiOutlineQuestionMarkCircle,
  HiOutlineLanguage,
  HiChevronRight,
} from "react-icons/hi2";

const MENU_ITEMS = [
  {
    id: "help",
    label: "Help",
    icon: <HiOutlineQuestionMarkCircle className="text-lg" />,
  },
  {
    id: "settings",
    label: "Settings",
    icon: <HiOutlineCog6Tooth className="text-lg" />,
  },
  {
    id: "output-language",
    label: "Output Language",
    icon: <HiOutlineLanguage className="text-lg" />,
    hasArrow: true,
  },
];

/**
 * SettingsDropdown — gear button + popover menu.
 *
 * Props:
 *  @param {Function} [onSelect] - called with menu item id when clicked
 */
const SettingsDropdown = ({ onSelect }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (id) => {
    setOpen(false);
    onSelect?.(id);
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`flex cursor-pointer items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                    transition-all duration-200 border
                    ${
                      open
                        ? "bg-surfaceLight dark:text-primary text-white border-primary/40"
                        : "dark:text-textSecondary border-border hover:text-textPrimary hover:bg-surface"
                    }`}
      >
        <HiOutlineCog6Tooth
          className={`text-base transition-transform duration-300 ${open ? "rotate-90" : ""}`}
        />
        <span className="hidden xl:inline">Settings</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border
                     bg-surface shadow-xl shadow-black/40 z-50 overflow-hidden
                     animate-fadeIn"
        >
          <ul className="py-1">
            {MENU_ITEMS.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => handleSelect(item.id)}
                  className="w-full flex items-center justify-between gap-3
                             px-4 py-2.5 text-sm text-textSecondary
                             hover:text-textPrimary hover:bg-surfaceLight
                             transition-colors duration-150"
                >
                  <span className="flex items-center gap-3">
                    <span className="text-textSecondary">{item.icon}</span>
                    {item.label}
                  </span>
                  {item.hasArrow && (
                    <HiChevronRight className="text-textSecondary text-sm" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SettingsDropdown;
