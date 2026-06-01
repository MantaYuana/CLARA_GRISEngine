import React, { useEffect } from "react";
import { FcGoogle } from "react-icons/fc";
import { LuArrowRightLeft } from "react-icons/lu";
const apiURL = import.meta.env.VITE_API_URL;

const Login = () => {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/finisher-header.es5.min.js";
    script.async = true;

    script.onload = () => {
      if (window.FinisherHeader) {
        new window.FinisherHeader({
          count: 6,
          size: {
            min: 1300,
            max: 1500,
            pulse: 0,
          },
          speed: {
            x: { min: 0.6, max: 2 },
            y: { min: 0.6, max: 2 },
          },
          colors: {
            background: "#000000",
            particles: ["#3b004d", "#56076e"],
          },
          blending: "lighten",
          opacity: {
            center: 0.6,
            edge: 0,
          },
          skew: 0,
          shapes: ["c"],
        });
      }
    };

    document.body.appendChild(script);

    return () => {
      const existingScript = document.querySelector(
        'script[src="/finisher-header.es5.min.js"]',
      );
      if (existingScript) {
        document.body.removeChild(existingScript);
      }
    };
  }, []);

  const handleGoogleLogin = () => {
    window.location.href = `${apiURL}/auth/google`;
  };

  return (
    <div className="header finisher-header h-screen p-4 flex items-center">
      {/* RIGHT SIDE */}
      <div className="w-full h-full text-white flex flex-col items-center justify-center">
        <div className="flex items-center gap-4 mb-6">
          <span className="font-bold text-2xl bg-linear-to-b from-secondary to-primary bg-clip-text text-transparent">
            Clara
          </span>
          <LuArrowRightLeft />
          <FcGoogle size={40} />
        </div>

        <div className="text-center gap-2 mb-6 flex flex-col">
          <h2 className="text-xl font-semibold">Sign In your Google Account</h2>
          <p className="text-sm text-gray-400 w-96">
            By signing in, you can track your projects, tasks, and progress.
            Let's get started!
          </p>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="px-6 py-3 border border-gray-600 rounded-lg font-medium cursor-pointer hover:bg-primary hover:border-primary duration-300 transition-colors"
        >
          <div className="flex items-center gap-4">
            <FcGoogle size={24} />
            Continue with Google
          </div>
        </button>
      </div>
    </div>
  );
};

export default Login;
