import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    try {
      const token = searchParams.get("token");

      if (!token) {
        console.log("No token found");
        navigate("/auth", { replace: true });
        return;
      }

      localStorage.setItem("token", token);

      setTimeout(() => {
        navigate("/workspace", { replace: true });
      }, 100);
    } catch (error) {
      console.error("AUTH CALLBACK ERROR:", error);
    }
  }, [searchParams, navigate]);

  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-lg">Logging you in...</p>
    </div>
  );
}
