import { useMemo } from 'react';
import type { AustralianState } from '@sbg/shared';
import { useInstallers } from './useInstallers';

// Everything after the first space, so a multi-word surname (e.g. "Te Rangi") stays whole.
const getSurname = (name: string) => name.slice(name.indexOf(' ') + 1);

// Installers don't cross state lines (tech-stack.md) — the rule engine already rejects a state
// mismatch server-side, but there's no point offering an installer here who'd just trigger that
// violation. Sorted by surname for the picker.
export function useEligibleInstallers(state: AustralianState) {
  const { data: installers } = useInstallers();

  return useMemo(
    () =>
      (installers ?? [])
        .filter((installer) => installer.state === state)
        .sort((a, b) => getSurname(a.name).localeCompare(getSurname(b.name))),
    [installers, state],
  );
}
