import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Files from "./pages/Files";
import ChatDetail from "./pages/ChatDetail";
import AuthCallback from "./pages/AuthCallback";
import LandingPage from "./pages/LandingPage";

const App = () => {
  return (
    <Routes>
      <Route path="/workspace" element={<Home />} />
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<Login />} />
      <Route path="/my-files" element={<Files />} />
      <Route path="/chat/:id" element={<ChatDetail />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
    </Routes>
  );
};

export default App;
