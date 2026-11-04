import { unitsOfPart, type Part, type UnitId } from '../parts'
import { SCHEMA, type Flag, type SavedState } from './state'
import { makeTransfer, type ImportResult as GenericImportResult } from '../../progress/transfer'

/**
 * Lab 11's Export and Load (spec §4): the shared layer with Lab 11's kind,
 * name and parts. Export writes a local file and Load reads one; neither
 * uploads; a loaded file never replaces saved results without the in-page
 * confirmation.
 */

export type ImportResult = GenericImportResult<UnitId, Flag>

export const LAB11_TRANSFER = makeTransfer<UnitId, Part, Flag>({
  kind: 'bcogapp.m11 saved results',
  labName: 'Lab 11',
  fileStem: 'lab11-results',
  schema: SCHEMA,
  parts: [
    { part: 1, name: 'Part 1' },
    { part: 3, name: 'Part 3' },
    { part: 5, name: 'Part 5' },
  ],
  unitsOfPart,
})

export const EXPORT_KIND = LAB11_TRANSFER.EXPORT_KIND
export const IMPORT_REASONS = LAB11_TRANSFER.IMPORT_REASONS
export const exportText = (state: SavedState): string => LAB11_TRANSFER.exportText(state)
export const exportFileName = (seed: number): string => LAB11_TRANSFER.exportFileName(seed)
export const parseImport = (text: string): ImportResult => LAB11_TRANSFER.parseImport(text)
export const describeReplacement = (current: SavedState, incoming: SavedState): string[] => LAB11_TRANSFER.describeReplacement(current, incoming)
