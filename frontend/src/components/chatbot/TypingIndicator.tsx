import { motion } from "framer-motion";

export function TypingIndicator() {
  const dotVariants = {
    initial: { y: 0 },
    animate: { y: -4 },
  };

  const transition = {
    duration: 0.5,
    repeat: Infinity,
    repeatType: "reverse" as const,
    ease: "easeInOut",
  };

  return (
    <div className="flex items-center space-x-1.5 p-4 py-3 bg-muted/50 rounded-2xl w-16">
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className="h-2 w-2 rounded-full bg-muted-foreground/60"
          variants={dotVariants}
          initial="initial"
          animate="animate"
          transition={{ ...transition, delay: index * 0.15 }}
        />
      ))}
    </div>
  );
}
