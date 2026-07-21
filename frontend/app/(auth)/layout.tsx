import type { Metadata } from 'next';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Authentication | Aiscern',
  description: 'Sign in or create your Aiscern account.',
  robots: { index: false, follow: false },
};

function AiscernLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Aiscern"
      width={40}
      height={40}
      className={className}
      priority
    />
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-neutral-950 overflow-hidden">
      {/* Ambient background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-cyan-500/15 rounded-full blur-[100px] pointer-events-none" />

      {/* Auth card container */}
      <div className="relative z-10 w-full max-w-[420px] mx-4">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <AiscernLogo className="w-10 h-10" />
        </div>

        {/* Card */}
        <div className="bg-neutral-900/80 backdrop-blur-xl border border-neutral-800 rounded-2xl shadow-2xl p-8">
          {children}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-neutral-500">
          <a href="/" className="hover:text-neutral-300 transition-colors">← Back to home</a>
        </p>
      </div>
    </div>
  );
}
