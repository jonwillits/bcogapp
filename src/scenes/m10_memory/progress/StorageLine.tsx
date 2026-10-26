import { Content } from '../../m09_rat/ui'

/**
 * The two lines about where results live (spec §11, lines 3 and 13): saved
 * in this browser on this computer only, and nothing sent anywhere; or,
 * when the storage cannot be used, that results will be lost if the page is
 * closed.
 */

export const SAVED_HERE_LINE = 'Results are saved in this browser on this computer only. Nothing is sent anywhere.'
export const STORAGE_UNAVAILABLE_LINE = 'Storage is unavailable in this browser, so results will be lost if this page is closed.'

export function StorageLine({ available }: { available: boolean }) {
  return <Content>{available ? SAVED_HERE_LINE : STORAGE_UNAVAILABLE_LINE}</Content>
}
