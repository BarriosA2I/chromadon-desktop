/**
 * Analytics Data Fetching Hook
 *
 * Fetches analytics data from Brain API endpoints.
 * Uses Promise.allSettled for graceful degradation.
 *
 * @author Barrios A2I
 */

import { useCallback, useEffect, useRef } from 'react'
import axios from 'axios'
import { useChromadonStore } from '../store/chromadonStore'
import type { AnalyticsPeriod, AnalyticsPlatform } from '../store/analyticsTypes'

const BRAIN_API = 'http://127.0.0.1:3001'

function periodToDays(period: AnalyticsPeriod): number {
  switch (period) {
    case '24h': return 1
    case '7d': return 7
    case '30d': return 30
    case '90d': return 90
  }
}

export function useAnalytics() {
  const {
    showAnalyticsDashboard,
    selectedPeriod,
    selectedPlatforms,
    setAnalyticsData,
    setAnalyticsLoading,
    setAnalyticsError,
  } = useChromadonStore()

  const abortRef = useRef<AbortController | null>(null)

  const fetchAnalytics = useCallback(async () => {
    // Cancel any in-flight requests
    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    setAnalyticsLoading(true)
    setAnalyticsError(null)

    const days = periodToDays(selectedPeriod)
    const signal = controller.signal

    try {
      const results = await Promise.allSettled([
        axios.get(`${BRAIN_API}/api/analytics/overview`, { params: { days }, signal }),
        axios.get(`${BRAIN_API}/api/analytics/content`, { params: { days }, signal }),
        axios.get(`${BRAIN_API}/api/analytics/competitors`, { signal }),
      ])

      if (signal.aborted) return

      const [overviewRes, contentRes, competitorsRes] = results

      const update: Record<string, any> = {}

      if (overviewRes.status === 'fulfilled' && overviewRes.value.data?.success) {
        update.overview = overviewRes.value.data.data
      }
      if (contentRes.status === 'fulfilled' && contentRes.value.data?.success) {
        update.content = contentRes.value.data.data
      }
      if (competitorsRes.status === 'fulfilled' && competitorsRes.value.data?.success) {
        update.competitors = competitorsRes.value.data.data
      }

      // Fetch platform-specific data for selected platforms (or all from overview)
      const platforms = selectedPlatforms.length > 0
        ? selectedPlatforms
        : (update.overview?.platformBreakdown?.map((p: any) => p.platform) || []) as AnalyticsPlatform[]

      if (platforms.length > 0) {
        const platformResults = await Promise.allSettled(
          platforms.map(p =>
            axios.get(`${BRAIN_API}/api/analytics/platform/${p}`, { params: { days }, signal })
          )
        )

        const audienceResults = await Promise.allSettled(
          platforms.map(p =>
            axios.get(`${BRAIN_API}/api/analytics/audience/${p}`, { params: { days }, signal })
          )
        )

        if (signal.aborted) return

        const platformsMap: Record<string, any> = {}
        const audienceMap: Record<string, any> = {}

        platforms.forEach((p, i) => {
          if (platformResults[i].status === 'fulfilled') {
            const res = (platformResults[i] as PromiseFulfilledResult<any>).value
            if (res.data?.success) platformsMap[p] = res.data.data
          }
          if (audienceResults[i].status === 'fulfilled') {
            const res = (audienceResults[i] as PromiseFulfilledResult<any>).value
            if (res.data?.success) audienceMap[p] = res.data.data
          }
        })

        update.platforms = platformsMap
        update.audience = audienceMap
      }

      setAnalyticsData(update)
    } catch (error: any) {
      if (error?.name === 'CanceledError' || signal.aborted) return
      setAnalyticsError(error?.message || 'Failed to fetch analytics')
    } finally {
      if (!signal.aborted) {
        setAnalyticsLoading(false)
      }
    }
  }, [selectedPeriod, selectedPlatforms, setAnalyticsData, setAnalyticsLoading, setAnalyticsError])

  // Auto-fetch when dashboard opens or filters change
  useEffect(() => {
    if (showAnalyticsDashboard) {
      fetchAnalytics()
    }
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [showAnalyticsDashboard, fetchAnalytics])

  return { fetchAnalytics }
}
