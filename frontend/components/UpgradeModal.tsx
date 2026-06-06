'use client'
import { useEffect } from 'react'
interface Props { onClose: () => void; feature?: string; requiredPlan?: 'starter' | 'pro' | 'enterprise' }
export default function UpgradeModal({ onClose }: Props) {
  useEffect(() => { onClose() }, [onClose])
  return null
}
