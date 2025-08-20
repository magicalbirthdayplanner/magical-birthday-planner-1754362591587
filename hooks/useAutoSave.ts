"use client"

import { useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface AutoSaveData {
  [key: string]: any
}

export function useAutoSave<T extends AutoSaveData>(
  data: T,
  storageKey: string,
  intervalMs: number = 5000,
  onSave?: (data: T) => Promise<void>
) {
  const { user } = useAuth()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedDataRef = useRef<string>('')
  const isSavingRef = useRef(false)

  const saveData = useCallback(async (dataToSave: T) => {
    if (isSavingRef.current) return
    
    const dataString = JSON.stringify(dataToSave)
    
    // Only save if data has changed
    if (dataString === lastSavedDataRef.current) return
    
    isSavingRef.current = true
    
    try {
      if (user && onSave) {
        // Try to save to database if user is authenticated
        await onSave(dataToSave)
      } else {
        // Fallback to localStorage
        localStorage.setItem(storageKey, dataString)
      }
      
      lastSavedDataRef.current = dataString
      console.log(`Auto-saved ${storageKey} at ${new Date().toLocaleTimeString()}`)
    } catch (error) {
      console.error('Auto-save failed, falling back to localStorage:', error)
      // Fallback to localStorage on API failure
      localStorage.setItem(storageKey, dataString)
      lastSavedDataRef.current = dataString
    } finally {
      isSavingRef.current = false
    }
  }, [user, onSave, storageKey])

  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    // Set up auto-save interval
    intervalRef.current = setInterval(() => {
      saveData(data)
    }, intervalMs)

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [data, intervalMs, saveData])

  // Manual save function
  const manualSave = useCallback(() => {
    saveData(data)
  }, [saveData, data])

  return { manualSave }
}