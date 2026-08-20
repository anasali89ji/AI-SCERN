"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="technical-label mb-4">{children}</p>;
}

export function SectionHeading({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`text-display-lg font-bold tracking-tight text-aiscern-text-primary ${className}`}>{children}</h2>;
}

export function SectionSubheading({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-lg text-aiscern-text-secondary max-w-2xl">{children}</p>;
}

export function PrimaryCTA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center justify-center px-6 py-3 bg-aiscern-accent-cyan text-aiscern-bg-primary font-semibold rounded-lg hover:bg-aiscern-accent-cyan/90 transition-all hover:shadow-lg hover:shadow-aiscern-accent-cyan/20">
      {children}
    </Link>
  );
}

export function SecondaryCTA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center justify-center px-6 py-3 border border-aiscern-border-strong text-aiscern-text-primary font-medium rounded-lg hover:bg-aiscern-bg-surface transition-all">
      {children}
    </Link>
  );
}

export function AnimatedSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }} transition={{ duration: 0.7, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}
