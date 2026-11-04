import { unitsOfPart, type Part, type UnitId } from '../parts'
import { SCHEMA, type Flag, type SavedState } from './state'
import { makeTransfer, type ExportFile as GenericExportFile, type ImportResult as GenericImportResult } from '../../progress/transfer'

/**
 * Lab 10's Export and Load (spec §4.2; Jon's answer 4 of 2026-10-25): the
 * shared layer in `src/sim/progress/transfer.ts` with Lab 10's kind, name
 * and parts. Export writes a small file to the student's own device; Load
 * reads one back; nothing is uploaded, and a loaded file never replaces
 * saved results without the in-page confirmation the scene shows from
 * `describeReplacement`.
 */

export type ExportFile = GenericExportFile<UnitId, Flag>
export type ImportResult = GenericImportResult<UnitId, Flag>

const transfer = makeTransfer<UnitId, Part, Flag>({
  kind: 'bcogapp.m10 saved results',
  labName: 'Lab 10',
  fileStem: 'lab10-results',
  schema: SCHEMA,
  parts: [
    { part: 1, name: 'Part 1' },
    { part: 2, name: 'Part 2' },
    { part: 3, name: 'Part 3' },
    { part: 4, name: 'Part 4' },
  ],
  unitsOfPart,
})

export const EXPORT_KIND = transfer.EXPORT_KIND
export const IMPORT_REASONS = transfer.IMPORT_REASONS
export const exportText = (state: SavedState): string => transfer.exportText(state)
export const exportFileName = (seed: number): string => transfer.exportFileName(seed)
export const parseImport = (text: string): ImportResult => transfer.parseImport(text)
export const describeReplacement = (current: SavedState, incoming: SavedState): string[] => transfer.describeReplacement(current, incoming)
export { transfer as LAB10_TRANSFER }
