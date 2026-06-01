import { useState, useRef, useEffect } from "react";
import { HiOutlineXMark } from "react-icons/hi2";

/**
 * UserAvatar — circular photo/initials button with Google-style user dropdown.
 *
 * Props:
 *  @param {Object} user
 *  @param {string} user.name
 *  @param {string} user.email
 *  @param {string|null} user.photoURL
 *  @param {Function} [onSignOut]
 */
const UserAvatar = ({ user, onSignOut }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) return null;

  const name = user.name || "User";
  const email = user.email || "";
  const photoURL = user.photoURL || user.photoUrl || null;

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div ref={ref} className="relative">
      {/* Avatar trigger button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative w-9 h-9 cursor-pointer rounded-full overflow-hidden
                   ring-2 ring-primary/50 hover:ring-primary
                   transition-all duration-200 shrink-0"
        aria-label="Open user menu"
      >
        {photoURL ? (
          <img
            src={photoURL}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center
                          bg-linear-to-br from-secondary to-primary text-white
                          text-sm font-semibold"
          >
            {initials}
          </div>
        )}
      </button>

      {/* Google-style user dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-72 rounded-2xl border bg-white dark:border-border
                     dark:bg-surface shadow-2xl shadow-black/50 z-50 overflow-hidden
                     animate-fadeIn"
        >
          {/* Header — email + close */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <span className="dark:text-textSecondary text-xs truncate">
              {email}
            </span>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-full cursor-pointer dark:text-textSecondary dark:hover:text-textPrimary
                         dark:hover:bg-surfaceLight hover:bg-gray-200 transition-colors"
            >
              <HiOutlineXMark className="text-base" />
            </button>
          </div>

          {/* User info section */}
          <div className="flex flex-col items-center gap-3 px-6 py-6">
            {/* Large avatar with Google-style rainbow ring */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center
                         bg-linear-to-br from-secondary to-primary text-white
                         text-2xl font-bold
                         ring-4 ring-offset-2 dark:ring-offset-surface ring-primary/60"
              style={{
                background: photoURL
                  ? undefined
                  : "linear-gradient(135deg, #f0a4fe, #bb11ee)",
              }}
            >
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={name}
                  className="w-full h-full rounded-full object-cover shrink-0"
                />
              ) : (
                initials
              )}
            </div>

            {/* Greeting */}
            <div className="text-center">
              <p className="dark:text-textPrimary font-semibold text-base">
                Hi, {name.split(" ")[0]}!
              </p>
              <p className="dark:text-textSecondary text-xs mt-0.5">{email}</p>
            </div>

            {/* Manage account button */}
            <a
              href="https://myaccount.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 w-full py-2 px-4 cursor-pointer rounded-full border border-primary/40
                         dark:text-primary text-xs font-medium text-center block
                         hover:bg-primary/10 transition-colors duration-200"
              onClick={() => setOpen(false)}
            >
              Manage your Google Account
            </a>
          </div>

          {/* Footer — Sign out */}
          <div className="border-t border-border/60 px-4 py-3">
            <button
              onClick={() => {
                setOpen(false);
                setConfirmOpen(true);
              }}
              className="w-full cursor-pointer text-center text-xs text-textSecondary
               hover:text-red-500 transition-colors duration-150"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
      {/* Logout Confirmation Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setConfirmOpen(false)}
          />

          {/* Modal Box */}
          <div
            className="relative bg-white dark:bg-surface rounded-2xl
                 shadow-2xl w-[90%] max-w-sm p-6 animate-fadeIn"
          >
            <h3 className="text-lg font-semibold dark:text-textPrimary">
              Sign out?
            </h3>

            <p className="mt-2 text-sm dark:text-textSecondary">
              Are you sure you want to sign out from your account?
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 cursor-pointer rounded-lg text-sm
                     dark:text-textSecondary hover:bg-gray-200
                     dark:hover:bg-surfaceLight transition"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  setConfirmOpen(false);
                  onSignOut?.();
                }}
                className="px-4 py-2 cursor-pointer rounded-lg text-sm font-medium
                     bg-red-500 text-white
                     hover:bg-red-600 transition"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAvatar;
