import { unitsOfPart, type Part, type UnitId } from '../parts'
import { SCHEMA, type Flag, type SavedState } from './state'
import { makeTransfer, type ImportResult as GenericImportResult } from '../../progress/transfer'

/**
 * Lab 13's Export and Load (spec §4): the shared layer with Lab 13's kind,
 * name and parts. Export writes a local file and Load reads one; neither
 * uploads; a loaded file never replaces saved results without the in-page
 * confirmation.
 */

export type ImportResult = GenericImportResult<UnitId, Flag>

export const LAB13_TRANSFER = makeTransfer<UnitId, Part, Flag>({
  kind: 'bcogapp.m13 saved results',
  labName: 'Lab 13',
  fileStem: 'lab13-results',
  schema: SCHEMA,
  parts: [
    { part: 1, name: 'Part 1' },
    { part: 2, name: 'Part 2' },
    { part: 3, name: 'Part 3' },
  ],
  unitsOfPart,
})

export const EXPORT_KIND = LAB13_TRANSFER.EXPORT_KIND
export const IMPORT_REASONS = LAB13_TRANSFER.IMPORT_REASONS
export const exportText = (state: SavedState): string => LAB13_TRANSFER.exportText(state)
export const exportFileName = (seed: number): string => LAB13_TRANSFER.exportFileName(seed)
export const parseImport = (text: string): ImportResult => LAB13_TRANSFER.parseImport(text)
export const describeReplacement = (current: SavedState, incoming: SavedState): string[] => LAB13_TRANSFER.describeReplacement(current, incoming)
