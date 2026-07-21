'use client';

import { motion } from 'framer-motion';
import { useAuth } from '@/components/auth-provider';
import { Sparkles, Hand } from 'lucide-react';

export function WelcomeHeader({ isFirstTime }: { isFirstTime: boolean }) {
  const { user } = useAuth();
  const firstName = user?.displayName?.split(' ')[0] || 'there';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="mb-8"
    >
      <div className="flex items-center gap-3 mb-2">
        {isFirstTime ? (
          <Sparkles className="w-6 h-6 text-primary" />
        ) : (
          <Hand className="w-6 h-6 text-primary" />
        )}
        <h1 className="text-3xl font-bold text-white">
          {isFirstTime ? `Welcome aboard, ${firstName}` : `Welcome back, ${firstName}`}
        </h1>
      </div>
      <p className="text-neutral-400 text-base max-w-xl">
        {isFirstTime
          ? "Let's get you set up. Aiscern detects AI-generated content across text, images, audio, and video. Ready to run your first scan?"
          : "Here's everything at a glance. Your recent scans, active workflows, and quick actions are below."}
      </p>
    </motion.div>
  );
}
