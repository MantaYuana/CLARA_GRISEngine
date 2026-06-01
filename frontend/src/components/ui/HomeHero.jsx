const HomeHero = () => {
  return (
    <div className="flex flex-col items-center text-center pt-16 pb-10 px-4 animate-fadeIn">
      <h1 className="text-3xl md:text-4xl font-bold mt-4 dark:text-textPrimary leading-tight">
        Welcome to{" "}
        <span className="bg-linear-to-b from-secondary to-primary bg-clip-text text-transparent">
          Clara.
        </span>
      </h1>

      <p className="mt-3 dark:text-textSecondary text-black text-sm md:text-base">
        Analyze and create legal contracts with AI
      </p>
    </div>
  );
};

export default HomeHero;