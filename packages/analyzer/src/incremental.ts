import { createHash } from 'crypto';
import type { Finding, IncrementalScanStats } from '@valorasec/shared';

export interface FunctionChunk {
  name: string;
  startLine: number;
  endLine: number;
  body: string;
  hash: string;
}

export interface IncrementalDiffResult {
  isIdentical: boolean;
  changedFunctions: string[];
  addedFunctions: string[];
  deletedFunctions: string[];
  unchangedFunctions: string[];
  lineOffsets: Map<string, number>;
}

/**
 * Computes deterministic SHA-256 hash of a string.
 */
export function computeSha256(content: string): string {
  return createHash('sha256').update(content.trim()).digest('hex');
}

/**
 * Extracts function signatures, line boundaries, and hashes from Rust / Soroban code.
 */
export function extractFunctionChunks(sourceCode: string): Map<string, FunctionChunk> {
  const chunks = new Map<string, FunctionChunk>();
  if (!sourceCode) return chunks;

  const lines = sourceCode.split('\n');
  const fnRegex = /^\s*(?:pub\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)\s*\(/;

  let currentFn: {
    name: string;
    startLine: number;
    braceDepth: number;
    bodyLines: string[];
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (!currentFn) {
      const match = line.match(fnRegex);
      if (match && match[1]) {
        const name = match[1];
        let braceCount = 0;
        for (const char of line) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }

        const fnData = {
          name,
          startLine: lineNum,
          braceDepth: braceCount,
          bodyLines: [line],
        };
        currentFn = fnData;

        if (braceCount === 0 && line.includes('{')) {
          // One-liner function
          const body = fnData.bodyLines.join('\n');
          chunks.set(name, {
            name,
            startLine: fnData.startLine,
            endLine: lineNum,
            body,
            hash: computeSha256(body),
          });
          currentFn = null;
        }
      }
    } else {
      currentFn.bodyLines.push(line);
      for (const char of line) {
        if (char === '{') currentFn.braceDepth++;
        if (char === '}') currentFn.braceDepth--;
      }

      if (currentFn.braceDepth <= 0) {
        const body = currentFn.bodyLines.join('\n');
        chunks.set(currentFn.name, {
          name: currentFn.name,
          startLine: currentFn.startLine,
          endLine: lineNum,
          body,
          hash: computeSha256(body),
        });
        currentFn = null;
      }
    }
  }

  return chunks;
}

/**
 * Computes difference between previous function chunks and current function chunks.
 */
export function diffFunctionChunks(
  previousChunks: Map<string, FunctionChunk>,
  currentChunks: Map<string, FunctionChunk>,
  previousSourceHash?: string,
  currentSourceHash?: string,
): IncrementalDiffResult {
  if (previousSourceHash && currentSourceHash && previousSourceHash === currentSourceHash) {
    const allNames = Array.from(currentChunks.keys());
    return {
      isIdentical: true,
      changedFunctions: [],
      addedFunctions: [],
      deletedFunctions: [],
      unchangedFunctions: allNames,
      lineOffsets: new Map(),
    };
  }

  const changedFunctions: string[] = [];
  const addedFunctions: string[] = [];
  const deletedFunctions: string[] = [];
  const unchangedFunctions: string[] = [];
  const lineOffsets = new Map<string, number>();

  // Check current functions against previous
  for (const [name, currentChunk] of currentChunks.entries()) {
    const prevChunk = previousChunks.get(name);
    if (!prevChunk) {
      addedFunctions.push(name);
    } else if (prevChunk.hash !== currentChunk.hash) {
      changedFunctions.push(name);
      lineOffsets.set(name, currentChunk.startLine - prevChunk.startLine);
    } else {
      unchangedFunctions.push(name);
      lineOffsets.set(name, currentChunk.startLine - prevChunk.startLine);
    }
  }

  // Check deleted functions
  for (const prevName of previousChunks.keys()) {
    if (!currentChunks.has(prevName)) {
      deletedFunctions.push(prevName);
    }
  }

  const isIdentical =
    changedFunctions.length === 0 && addedFunctions.length === 0 && deletedFunctions.length === 0;

  return {
    isIdentical,
    changedFunctions,
    addedFunctions,
    deletedFunctions,
    unchangedFunctions,
    lineOffsets,
  };
}

/**
 * Preserves unchanged findings from previous scan and rebases their line numbers
 * if vertical code offsets occurred.
 */
export function preserveAndRebaseFindings(
  previousFindings: Finding[],
  previousChunks: Map<string, FunctionChunk>,
  diff: IncrementalDiffResult,
): Finding[] {
  const preserved: Finding[] = [];
  const unchangedSet = new Set(diff.unchangedFunctions);

  for (const finding of previousFindings) {
    if (!finding.location || typeof finding.location.line !== 'number') continue;
    const line = finding.location.line;

    // Determine which function contained this finding
    let matchedFn: FunctionChunk | undefined;
    for (const chunk of previousChunks.values()) {
      if (line >= chunk.startLine && line <= chunk.endLine) {
        matchedFn = chunk;
        break;
      }
    }

    // If finding belongs to an unchanged function, preserve it with rebased line number
    if (matchedFn && unchangedSet.has(matchedFn.name)) {
      const offset = diff.lineOffsets.get(matchedFn.name) ?? 0;
      preserved.push({
        ...finding,
        location: {
          file: finding.location.file,
          column: finding.location.column,
          line: Math.max(1, line + offset),
        },
      });
    }
  }

  return preserved;
}

/**
 * Builds incremental scan statistics report.
 */
export function buildIncrementalStats(
  diff: IncrementalDiffResult,
  totalFunctions: number,
  inheritedCount: number,
  newFindingsCount: number,
  cacheHit = false,
): IncrementalScanStats {
  const scannedCount = diff.changedFunctions.length + diff.addedFunctions.length;
  const skippedCount = diff.unchangedFunctions.length;

  let timeSavedPercent = 0;
  if (cacheHit) {
    timeSavedPercent = 99;
  } else if (totalFunctions > 0) {
    timeSavedPercent = Math.round((skippedCount / totalFunctions) * 100);
  }

  return {
    isIncremental: true,
    cacheHit,
    totalFunctions,
    changedFunctions: diff.changedFunctions,
    unchangedFunctions: diff.unchangedFunctions,
    scannedFunctionCount: scannedCount,
    skippedFunctionCount: skippedCount,
    inheritedFindingsCount: inheritedCount,
    newFindingsCount: newFindingsCount,
    timeSavedPercent,
  };
}
