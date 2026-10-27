import { invoke } from '@tauri-apps/api/core';
import { useQuery } from '@tanstack/react-query';
import { UserRound } from 'lucide-react';
import { useState } from 'react';
export interface TelegramProfile { id: string; fullName: string; username?: string; phone?: string; avatar?: string }
export function useTelegramProfile(ownerId: string | null) {
  return useQuery({ queryKey: ['telegram-profile', ownerId], enabled: !!ownerId, staleTime: 300_000, retry: 1,
    queryFn: () => invoke<TelegramProfile>('cmd_get_account_profile', { ownerId }),
  }).data;
}
export function profileSubtitle(profile: TelegramProfile | undefined, ownerId: string | null) {
  return profile?.username ? `@${profile.username}` : profile?.phone ? `+${profile.phone.replace(/^\+/, '')}` : ownerId ?? '—';
}
export function TelegramAvatar({ profile, children }: { profile?: TelegramProfile; children?: React.ReactNode }) {
  const [failed, setFailed] = useState<string>();
  const initials = profile?.fullName?.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  return <span className="cloud-avatar">{profile?.avatar && failed !== profile.avatar ? <img src={profile.avatar} alt="" onError={() => setFailed(profile.avatar)} /> : initials ? <span aria-hidden="true">{initials}</span> : <UserRound size={20} aria-hidden="true" />}{children}</span>;
}
