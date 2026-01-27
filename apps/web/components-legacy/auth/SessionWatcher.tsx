'use client'

import { useSession } from "next-auth/react"
import { useEffect } from "react"

/**
 * 监听 Session 变化，并将 accessToken 同步到 localStorage
 * 这样非组件代码（如 SyncEngine）也能通过 getAuthToken() 获取最新的 Token
 */
export function SessionWatcher() {
    const { data: session } = useSession()

    useEffect(() => {
        if ((session as any)?.accessToken) {
            localStorage.setItem('nexusnote_token', (session as any).accessToken)
            console.log('[Auth] Token synced to localStorage')
        } else if (session === null) {
            localStorage.removeItem('nexusnote_token')
            console.log('[Auth] Token removed from localStorage')
        }
    }, [session])

    return null
}
