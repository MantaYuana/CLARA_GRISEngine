import { useEffect, useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
} from "framer-motion";
import { Link } from "react-router-dom";

// ─── Floating Orb Component ───────────────────────────────────────────────────
function FloatingOrb({ style, delay = 0, size = 400, color = "#3b004d" }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 40% 40%, ${color}cc, transparent 70%)`,
        filter: "blur(60px)",
        ...style,
      }}
      animate={{
        x: [0, 30, -20, 0],
        y: [0, -40, 20, 0],
        scale: [1, 1.1, 0.95, 1],
      }}
      transition={{
        duration: 10 + delay * 2,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
    />
  );
}

// ─── Animated Badge ───────────────────────────────────────────────────────────
function AnimatedBadge() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.2, type: "spring", stiffness: 200 }}
      className="mb-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/30 bg-purple-900/20 backdrop-blur-md relative overflow-hidden"
    >
      {/* Moving shimmer */}
      <motion.div
        className="absolute inset-0 bg-linear-to-r from-transparent via-purple-400/10 to-transparent"
        animate={{ x: ["-100%", "200%"] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "linear", repeatDelay: 1.5 }}
      />
      {/* Pulsing dot */}
      <motion.span
        className="w-2 h-2 rounded-full bg-purple-400"
        animate={{ opacity: [1, 0.3, 1], scale: [1, 0.8, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className="text-sm font-medium text-gray-300 relative z-10">Welcome to</span>
      <span className="text-sm font-bold bg-linear-to-r from-purple-400 to-purple-300 bg-clip-text text-transparent relative z-10">
        Clara.
      </span>
    </motion.div>
  );
}

// ─── Typewriter Component ─────────────────────────────────────────────────────
function TypewriterText({ text, className, delay = 0 }) {
  const words = text.split(" ");
  return (
    <motion.span className={className}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.5, delay: delay + i * 0.08 }}
          style={{ display: "inline-block", marginRight: "0.25em" }}
        >
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
}

// ─── Particle Dot ─────────────────────────────────────────────────────────────
function Particle({ x, y, delay }) {
  return (
    <motion.div
      className="absolute w-1 h-1 rounded-full bg-purple-400/50 pointer-events-none"
      style={{ left: `${x}%`, top: `${y}%` }}
      animate={{
        y: [0, -30, 0],
        opacity: [0, 0.8, 0],
        scale: [0.5, 1.2, 0.5],
      }}
      transition={{
        duration: 4 + Math.random() * 3,
        repeat: Infinity,
        delay,
        ease: "easeInOut",
      }}
    />
  );
}

// ─── Scroll Progress Bar ──────────────────────────────────────────────────────
function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-0.5 bg-linear-to-r from-purple-600 via-purple-400 to-purple-600 origin-left z-50"
      style={{ scaleX }}
    />
  );
}

// ─── Feature Card Counter ─────────────────────────────────────────────────────
function StatBadge({ icon, label }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ scale: 1.05, y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-900/30 border border-purple-500/20 text-sm text-purple-300"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LandingPage() {
  // Finisher Header script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/finisher-header.es5.min.js";
    script.async = true;
    script.onload = () => {
      if (window.FinisherHeader) {
        new window.FinisherHeader({
          count: 6,
          size: { min: 1300, max: 1500, pulse: 0 },
          speed: { x: { min: 0.6, max: 2 }, y: { min: 0.6, max: 2 } },
          colors: { background: "#000000", particles: ["#3b004d", "#56076e"] },
          blending: "lighten",
          opacity: { center: 0.6, edge: 0 },
          skew: 0,
          shapes: ["c"],
        });
      }
    };
    document.body.appendChild(script);
    return () => {
      const existingScript = document.querySelector('script[src="/finisher-header.es5.min.js"]');
      if (existingScript) document.body.removeChild(existingScript);
    };
  }, []);

  // Parallax refs
  const section1Ref = useRef(null);
  const section2Ref = useRef(null);
  const section3Ref = useRef(null);

  const { scrollYProgress: scroll1 } = useScroll({ target: section1Ref, offset: ["start end", "end start"] });
  const { scrollYProgress: scroll2 } = useScroll({ target: section2Ref, offset: ["start end", "end start"] });
  const { scrollYProgress: scroll3 } = useScroll({ target: section3Ref, offset: ["start end", "end start"] });

  const y1 = useSpring(useTransform(scroll1, [0, 1], [120, -120]), { stiffness: 100, damping: 30 });
  const y2 = useSpring(useTransform(scroll2, [0, 1], [120, -120]), { stiffness: 100, damping: 30 });
  const y3 = useSpring(useTransform(scroll3, [0, 1], [120, -120]), { stiffness: 100, damping: 30 });

  const rotate1 = useTransform(scroll1, [0, 1], [-3, 3]);
  const rotate2 = useTransform(scroll2, [0, 1], [3, -3]);
  const imgScale1 = useTransform(scroll1, [0, 0.5, 1], [0.9, 1, 0.9]);
  const imgScale2 = useTransform(scroll2, [0, 0.5, 1], [0.9, 1, 0.9]);
  const imgScale3 = useTransform(scroll3, [0, 0.5, 1], [0.9, 1, 0.9]);

  // Mouse parallax for Hero
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const heroOrbX = useSpring(useTransform(mouseX, [0, 1], [-30, 30]), { stiffness: 50, damping: 20 });
  const heroOrbY = useSpring(useTransform(mouseY, [0, 1], [-20, 20]), { stiffness: 50, damping: 20 });

  const handleMouseMove = (e) => {
    mouseX.set(e.clientX / window.innerWidth);
    mouseY.set(e.clientY / window.innerHeight);
  };

  // Particles
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    delay: Math.random() * 5,
  }));

  // Stagger container variants
  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.15 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 30, filter: "blur(4px)" },
    visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease: [0.25, 0.4, 0.25, 1] } },
  };

  return (
    <div className="w-full min-h-screen bg-black overflow-hidden font-sans" onMouseMove={handleMouseMove}>
      {/* --- NAVBAR --- */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-4 bg-black/40 backdrop-blur-md border-b border-white/10">
        <Link to="/workspace" className="text-2xl font-bold tracking-tight hover:opacity-80 transition-opacity">
          <span className="bg-linear-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">Clara.</span>
        </Link>
        <Link to="/workspace" className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-full transition-all shadow-[0_0_20px_rgba(124,58,237,0.3)]">
          Create New
        </Link>
      </nav>
      
      {/* Scroll Progress */}
      <ScrollProgressBar />

      {/* ── HERO SECTION ───────────────────────────────────────────────── */}
      <div className="header relative z-10 finisher-header flex flex-col w-full justify-center items-center min-h-screen px-4 md:px-6 m-0 overflow-hidden">
        {/* Mouse-reactive background orbs */}
        <motion.div style={{ x: heroOrbX, y: heroOrbY }} className="absolute inset-0 pointer-events-none">
          <FloatingOrb style={{ top: "10%", left: "5%", opacity: 0.5 }} size={500} delay={0} color="#3b004d" />
          <FloatingOrb style={{ top: "60%", right: "0%", opacity: 0.4 }} size={350} delay={2} color="#56076e" />
          <FloatingOrb style={{ top: "20%", right: "20%", opacity: 0.3 }} size={280} delay={4} color="#7c3aed" />
        </motion.div>

        {/* Floating particles */}
        {particles.map((p) => (
          <Particle key={p.id} x={p.x} y={p.y} delay={p.delay} />
        ))}

        {/* Grid lines background */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(124,58,237,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Content */}
        <AnimatedBadge />

        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="text-4xl sm:text-5xl md:text-7xl lg:text-[80px] text-white font-bold max-w-5xl text-center tracking-tight leading-[1.1] md:leading-[1.05]"
        >
          <TypewriterText text="Contract & Legal" delay={0.4} />
          <br className="hidden md:block" />
          <TypewriterText
            text="AI Reasoning Assistant"
            delay={0.9}
            className="bg-linear-to-r from-purple-400 via-purple-300 to-purple-500 bg-clip-text text-transparent"
          />
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.5 }}
          className="mt-6 max-w-5xl text-center text-gray-400 text-sm md:text-lg leading-relaxed"
        >
          Discover how to create legal contracts with AI. Clara is your intelligent assistant for analyzing, drafting,
          and understanding legal documents. Experience the future of legal work with Clara's powerful AI capabilities.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 1.8 }}
          className="mt-10 flex flex-col sm:flex-row gap-4"
        >
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(124,58,237,0.6)" }}
            whileTap={{ scale: 0.97 }}
            className="px-8 py-3 rounded-full bg-linear-to-r from-purple-600 to-purple-500 text-white font-semibold text-sm shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all"
          >
            Get Started Free
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05, borderColor: "rgba(167,139,250,0.5)" }}
            whileTap={{ scale: 0.97 }}
            className="px-8 py-3 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-gray-300 font-semibold text-sm hover:text-white transition-all"
          >
            Watch Demo ↗
          </motion.button>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5, duration: 1 }}
          className="absolute bottom-10 flex flex-col items-center gap-2"
        >
          <span className="text-xs text-gray-600 tracking-widest uppercase">Scroll</span>
          <motion.div
            className="w-px h-10 bg-linear-to-b from-purple-400/60 to-transparent"
            animate={{ scaleY: [0, 1, 0], originY: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </div>

      {/* ── SECTION 1 ──────────────────────────────────────────────────── */}
      <div
        ref={section1Ref}
        className="bg-black relative min-h-screen flex flex-col md:flex-row justify-between items-center px-8 md:gap-12 overflow-hidden"
      >
        {/* Section background glow */}
        <motion.div
          className="absolute -left-40 top-1/2 -translate-y-1/2 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)", filter: "blur(40px)" }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Text side */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="w-full flex flex-col items-center md:items-start text-center md:text-left pt-16 pb-10 px-4 relative z-10"
        >
          <motion.div variants={itemVariants} className="mb-4">
            <StatBadge icon="📄" label="Smart Document Processing" />
          </motion.div>
          <motion.h1
            variants={itemVariants}
            className="text-2xl md:text-5xl text-white font-bold max-w-xl tracking-tight leading-[1.1] md:leading-[1.05]"
          >
            Upload & Analyze{" "}
            <span className="font-bold bg-linear-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
              Document
            </span>
          </motion.h1>
          <motion.p variants={itemVariants} className="mt-6 max-w-xl text-gray-400 text-sm md:text-lg leading-relaxed">
            Securely upload your legal documents to our platform for instant processing. Our advanced AI instantly scans
            the text to extract key clauses, terms, and critical data points.
          </motion.p>
          {/* Feature bullets */}
          <motion.ul variants={containerVariants} className="mt-6 space-y-3">
            {["Instant text extraction", "Key clause detection", "Multi-format support (PDF, DOCX)"].map((item, i) => (
              <motion.li
                key={i}
                variants={itemVariants}
                className="flex items-center gap-3 text-sm text-gray-400"
              >
                <motion.span
                  className="w-5 h-5 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-400 text-xs shrink-0"
                  whileInView={{ scale: [0, 1.2, 1] }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 + i * 0.1, duration: 0.4 }}
                >
                  ✓
                </motion.span>
                {item}
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>

        {/* Image side with parallax + hover */}
        <motion.div style={{ y: y1, rotate: rotate1, scale: imgScale1 }} className="w-full relative z-10">
          <motion.div
            whileHover={{ scale: 1.03 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="relative rounded-2xl overflow-hidden"
          >
            {/* Glow border */}
            <div className="absolute inset-0 rounded-2xl border border-purple-500/20 z-10 pointer-events-none" />
            <div className="absolute -inset-1 rounded-2xl bg-linear-to-r from-purple-600/20 to-purple-900/20 blur-xl pointer-events-none" />
            <img
              src="/src/assets/first-feature.png"
              alt="Document Analysis"
              className="w-full h-auto mt-4 rounded-2xl shadow-[0_20px_60px_rgba(124,58,237,0.3)] relative z-0"
            />
          </motion.div>
        </motion.div>
      </div>

      {/* ── SECTION 2 ──────────────────────────────────────────────────── */}
      <div
        ref={section2Ref}
        className="bg-black relative min-h-screen flex flex-col-reverse md:flex-row justify-between items-center px-8 md:gap-12 overflow-hidden"
      >
        {/* Section background glow right */}
        <motion.div
          className="absolute -right-40 top-1/2 -translate-y-1/2 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(88,28,135,0.2) 0%, transparent 70%)", filter: "blur(40px)" }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />

        {/* Image side */}
        <motion.div style={{ y: y2, rotate: rotate2, scale: imgScale2 }} className="w-full relative z-10">
          <motion.div
            whileHover={{ scale: 1.03 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="relative rounded-2xl overflow-hidden"
          >
            <div className="absolute inset-0 rounded-2xl border border-purple-500/20 z-10 pointer-events-none" />
            <div className="absolute -inset-1 rounded-2xl bg-linear-to-l from-purple-600/20 to-purple-900/20 blur-xl pointer-events-none" />
            <img
              src="/src/assets/second-feature.png"
              alt="Document Review"
              className="w-full h-auto mt-4 rounded-2xl shadow-[0_20px_60px_rgba(124,58,237,0.3)] relative z-0"
            />
          </motion.div>
        </motion.div>

        {/* Text side */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="w-full flex flex-col items-center md:items-start text-center md:text-left pt-16 pb-10 px-4 relative z-10"
        >
          <motion.div variants={itemVariants} className="mb-4">
            <StatBadge icon="🔍" label="AI-Powered Review" />
          </motion.div>
          <motion.h1
            variants={itemVariants}
            className="text-2xl md:text-5xl text-white font-bold max-w-xl tracking-tight leading-[1.1] md:leading-[1.05]"
          >
            Make a Review from{" "}
            <span className="font-bold bg-linear-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
              Document
            </span>
          </motion.h1>
          <motion.p variants={itemVariants} className="mt-6 max-w-xl text-gray-400 text-sm md:text-lg leading-relaxed">
            Transform complex legal text into clear, actionable insights with a comprehensive AI-driven review. Identify
            potential risks, missing clauses, or unfavorable terms seamlessly.
          </motion.p>
          <motion.ul variants={containerVariants} className="mt-6 space-y-3">
            {["Risk identification", "Clause suggestion", "Unfavorable term detection"].map((item, i) => (
              <motion.li key={i} variants={itemVariants} className="flex items-center gap-3 text-sm text-gray-400">
                <motion.span
                  className="w-5 h-5 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-400 text-xs shrink-0"
                  whileInView={{ scale: [0, 1.2, 1] }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 + i * 0.1, duration: 0.4 }}
                >
                  ✓
                </motion.span>
                {item}
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>
      </div>

      {/* ── SECTION 3 ──────────────────────────────────────────────────── */}
      <div
        ref={section3Ref}
        className="bg-black relative min-h-screen flex flex-col md:flex-row justify-between items-center px-8 md:gap-12 overflow-hidden"
      >
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)", filter: "blur(60px)" }}
          animate={{ scale: [1, 1.4, 1], rotate: [0, 90, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Text side */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="w-full flex flex-col items-center md:items-start text-center md:text-left pt-16 pb-10 px-4 relative z-10"
        >
          <motion.div variants={itemVariants} className="mb-4">
            <StatBadge icon="✍️" label="Instant Draft Generation" />
          </motion.div>
          <motion.h1
            variants={itemVariants}
            className="text-2xl md:text-5xl text-white font-bold max-w-xl tracking-tight leading-[1.1] md:leading-[1.05]"
          >
            Create Draft Contract with{" "}
            <span className="font-bold bg-linear-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
              AI Assistant
            </span>
          </motion.h1>
          <motion.p variants={itemVariants} className="mt-6 max-w-xl text-gray-400 text-sm md:text-lg leading-relaxed">
            Instantly generate customized legal contracts tailored to your specific needs using our intelligent AI
            assistant. Simply provide your core requirements, and let the system draft it.
          </motion.p>
          <motion.ul variants={containerVariants} className="mt-6 space-y-3">
            {["Custom contract templates", "Requirement-based generation", "Editable AI drafts"].map((item, i) => (
              <motion.li key={i} variants={itemVariants} className="flex items-center gap-3 text-sm text-gray-400">
                <motion.span
                  className="w-5 h-5 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-400 text-xs shrink-0"
                  whileInView={{ scale: [0, 1.2, 1] }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 + i * 0.1, duration: 0.4 }}
                >
                  ✓
                </motion.span>
                {item}
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>

        {/* Image side */}
        <motion.div style={{ y: y3, scale: imgScale3 }} className="w-full relative z-10">
          <motion.div
            whileHover={{ scale: 1.03, rotateY: 3 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="relative rounded-2xl overflow-hidden"
          >
            <div className="absolute inset-0 rounded-2xl border border-purple-500/20 z-10 pointer-events-none" />
            <div className="absolute -inset-1 rounded-2xl bg-linear-to-r from-purple-600/20 to-purple-900/20 blur-xl pointer-events-none" />
            <img
              src="/src/assets/third-feature.png"
              alt="Draft Contract"
              className="w-full h-auto mt-4 rounded-2xl shadow-[0_20px_60px_rgba(124,58,237,0.3)] relative z-0"
            />
          </motion.div>
        </motion.div>
      </div>

      {/* ── FOOTER / GET STARTED ───────────────────────────────────────── */}
      <div className="header relative z-10 finisher-header flex flex-col w-full justify-center items-center min-h-screen px-4 md:px-6 m-0 overflow-hidden">
        {/* Decorative orbs */}
        <FloatingOrb style={{ bottom: "10%", left: "10%", opacity: 0.4 }} size={400} delay={1} color="#3b004d" />
        <FloatingOrb style={{ top: "10%", right: "5%", opacity: 0.3 }} size={300} delay={3} color="#56076e" />

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="flex flex-col items-center text-center px-4 relative z-10"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-4 w-12 h-12 rounded-2xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(124,58,237,0.4)]"
          >
            ⚡
          </motion.div>
          <h1 className="text-3xl md:text-5xl font-bold mt-2 text-white leading-tight">
            Let's Get Started with{" "}
            <motion.span
              className="bg-linear-to-b from-purple-400 to-purple-600 bg-clip-text text-transparent"
              animate={{
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            >
              Clara.
            </motion.span>
          </h1>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="mt-4 text-gray-500 text-sm md:text-base max-w-md"
          >
            Ask anything about your legal documents. Clara answers instantly.
          </motion.p>
        </motion.div>

        {/* Chat input */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
          whileHover={{ boxShadow: "0 0 40px rgba(124,58,237,0.25)" }}
          className="mt-8 w-full max-w-2xl backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex items-center shadow-2xl transition-all hover:border-purple-500/30 relative z-10"
        >
          <motion.button
            whileHover={{ scale: 1.1, color: "#a78bfa" }}
            whileTap={{ scale: 0.9 }}
            className="p-3 text-gray-400 hover:text-purple-400 transition-colors rounded-xl hover:bg-purple-900/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </motion.button>
          <input
            type="text"
            placeholder="How to create legal contract with ai..."
            className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 px-2 text-sm md:text-base"
            readOnly
          />
          <motion.button
            whileHover={{ scale: 1.1, boxShadow: "0 0 20px rgba(124,58,237,0.7)" }}
            whileTap={{ scale: 0.9 }}
            animate={{
              boxShadow: ["0 0 10px rgba(124,58,237,0.3)", "0 0 20px rgba(124,58,237,0.6)", "0 0 10px rgba(124,58,237,0.3)"],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="p-3 bg-[#7C3AED] rounded-xl text-white hover:bg-[#6D28D9] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </motion.button>
        </motion.div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="mt-10 flex flex-wrap gap-3 justify-center relative z-10"
        >
          {[
            { icon: "🔒", label: "Bank-level security" },
            { icon: "⚡", label: "Instant results" },
            { icon: "🌐", label: "Multi-language" },
            { icon: "📋", label: "100+ templates" },
          ].map((badge, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.08, y: -3 }}
              transition={{ delay: 0.7 + i * 0.1, duration: 0.4, type: "spring", stiffness: 300 }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-gray-400 text-xs backdrop-blur-sm hover:border-purple-500/30 hover:text-purple-300 transition-colors cursor-default"
            >
              <span>{badge.icon}</span>
              <span>{badge.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* --- FOOTER --- */}
      <footer className="bg-black border-t border-white/10 pt-16 pb-8 px-8 md:px-20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand Col */}
          <div className="md:col-span-2">
            <Link to="/workspace" className="text-2xl font-bold tracking-tight">
              <span className="bg-linear-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">Clara.</span>
            </Link>
            <p className="mt-4 text-gray-500 max-w-sm leading-relaxed">
              Your intelligent AI partner for contract reasoning and legal document analysis. Drafting and reviewing contracts has never been this simple.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold mb-6">Product</h4>
            <ul className="space-y-4 text-gray-500">
              <li><Link to="/workspace" className="hover:text-purple-400 transition-colors">Features</Link></li>
              <li><Link to="/workspace" className="hover:text-purple-400 transition-colors">Legal AI</Link></li>
              <li><Link to="/workspace" className="hover:text-purple-400 transition-colors">Security</Link></li>
            </ul>
          </div>

          {/* Contact & Social */}
          <div>
            <h4 className="text-white font-semibold mb-6">Connect</h4>
            <ul className="space-y-4 text-gray-500">
              <li><a href="#" className="hover:text-purple-400 transition-colors">Twitter</a></li>
              <li><a href="#" className="hover:text-purple-400 transition-colors">LinkedIn</a></li>
              <li><a href="#" className="hover:text-purple-400 transition-colors">Support</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-600">
          <p>© {new Date().getFullYear()} Clara AI. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-gray-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-gray-400 transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
