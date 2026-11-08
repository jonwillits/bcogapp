import { unitsOfPart, type Part, type UnitId } from '../parts'
import { SCHEMA, type Flag, type SavedState } from './state'
import { makeTransfer, type ImportResult as GenericImportResult } from '../../progress/transfer'

/**
 * Lab 12's Export and Load (spec §4): the shared layer with Lab 12's kind,
 * name and parts. Export writes a local file and Load reads one; neither
 * uploads; a loaded file never replaces saved results without the in-page
 * confirmation.
 */

export type ImportResult = GenericImportResult<UnitId, Flag>

export const LAB12_TRANSFER = makeTransfer<UnitId, Part, Flag>({
  kind: 'bcogapp.m12 saved results',
  labName: 'Lab 12',
  fileStem: 'lab12-results',
  schema: SCHEMA,
  parts: [
    { part: 1, name: 'Part 1' },
    { part: 2, name: 'Part 2' },
    { part: 3, name: 'Part 3' },
  ],
  unitsOfPart,
})

export const EXPORT_KIND = LAB12_TRANSFER.EXPORT_KIND
export const IMPORT_REASONS = LAB12_TRANSFER.IMPORT_REASONS
export const exportText = (state: SavedState): string => LAB12_TRANSFER.exportText(state)
export const exportFileName = (seed: number): string => LAB12_TRANSFER.exportFileName(seed)
export const parseImport = (text: string): ImportResult => LAB12_TRANSFER.parseImport(text)
export const describeReplacement = (current: SavedState, incoming: SavedState): string[] => LAB12_TRANSFER.describeReplacement(current, incoming)
