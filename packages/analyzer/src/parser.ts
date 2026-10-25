/**
 * High-performance Rust source code parser and AST builder for Soroban smart contracts.
 * Designed to accurately parse contractimpl blocks, public entry points, function signatures,
 * method call expressions, storage accesses, panic triggers, and loops with exact source locations.
 */

export interface RustCall {
  name: string;
  callee?: string;
  args: string;
  line: number;
  col: number;
}

export interface RustStorageAccess {
  type: 'get' | 'set' | 'has' | 'remove';
  scope: 'instance' | 'persistent' | 'temporary';
  key?: string;
  line: number;
  col: number;
}

export interface RustLoop {
  kind: 'loop' | 'while' | 'for';
  isInfinite: boolean;
  hasBreak: boolean;
  line: number;
  col: number;
}

export interface RustFunctionParam {
  name: string;
  type: string;
}

export interface RustFunction {
  name: string;
  isPublic: boolean;
  isContractImpl: boolean;
  attributes: string[];
  params: RustFunctionParam[];
  returnType?: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  body: string;
  calls: RustCall[];
  hasRequireAuth: boolean;
  hasInputValidation: boolean;
  unwrapsOrExpects: RustCall[];
  loops: RustLoop[];
  storageAccesses: RustStorageAccess[];
  rawLines: { line: number; text: string }[];
}

export interface RustSourceFile {
  filePath: string;
  lines: string[];
  totalLines: number;
  functions: RustFunction[];
  unhandledCalls: RustCall[];
  hasContractAttribute: boolean;
}

export class RustParser {
  /**
   * Parse raw Rust source code string into a structured RustSourceFile AST.
   */
  static parse(source: string, filePath = 'src/lib.rs'): RustSourceFile {
    const lines = source.split(/\r?\n/);
    const totalLines = lines.length;
    const functions: RustFunction[] = [];
    const allUnhandledCalls: RustCall[] = [];

    let hasContractAttribute = false;
    let inContractImpl = false;
    let pendingAttributes: string[] = [];

    let currentFunction: Partial<RustFunction> | null = null;
    let braceDepth = 0;
    let fnStartBraceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const rawLine = lines[i];
      if (rawLine === undefined) continue;

      const trimmed = rawLine.trim();

      // Check for comments or empty lines
      if (trimmed.startsWith('//') || trimmed.length === 0) {
        continue;
      }

      if (trimmed.includes('#[contract]') || trimmed.includes('#[contractimpl]')) {
        hasContractAttribute = true;
      }

      if (trimmed.startsWith('#[contractimpl]')) {
        inContractImpl = true;
      }

      // Collect attributes like #[doc], #[allow(...)]
      if (trimmed.startsWith('#[')) {
        pendingAttributes.push(trimmed);
        continue;
      }

      // Scan for global unwrap/expect across all lines
      const callMatches = this.findCallsInLine(rawLine, lineNum);
      for (const call of callMatches) {
        if (call.name === 'unwrap' || call.name === 'expect') {
          allUnhandledCalls.push(call);
        }
      }

      // Detect function declaration
      const fnMatch = rawLine.match(
        /(pub\s+)?fn\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)(?:\s*->\s*([^{]+))?/,
      );
      if (fnMatch && !currentFunction) {
        const isPublic = Boolean(fnMatch[1]);
        const fnName = fnMatch[2] ?? 'unknown_fn';
        const rawParams = fnMatch[3] ?? '';
        const returnType = fnMatch[4]?.trim();

        const params: RustFunctionParam[] = [];
        if (rawParams.trim().length > 0) {
          const paramParts = rawParams.split(',');
          for (const part of paramParts) {
            const p = part.trim();
            if (p === '&self' || p === 'self') continue;
            const colonIdx = p.indexOf(':');
            if (colonIdx !== -1) {
              const pName = p.slice(0, colonIdx).trim();
              const pType = p.slice(colonIdx + 1).trim();
              params.push({ name: pName, type: pType });
            }
          }
        }

        const colIdx = rawLine.indexOf('fn ' + fnName) + 1;

        currentFunction = {
          name: fnName,
          isPublic,
          isContractImpl: inContractImpl,
          attributes: [...pendingAttributes],
          params,
          returnType,
          startLine: lineNum,
          startCol: Math.max(1, colIdx),
          body: '',
          calls: [],
          unwrapsOrExpects: [],
          loops: [],
          storageAccesses: [],
          rawLines: [],
        };
        pendingAttributes = [];
        fnStartBraceDepth = braceDepth;
      }

      // Track braces to delineate function bodies
      const openBraces = (rawLine.match(/\{/g) || []).length;
      const closeBraces = (rawLine.match(/\}/g) || []).length;
      braceDepth += openBraces - closeBraces;

      if (currentFunction) {
        currentFunction.rawLines?.push({ line: lineNum, text: rawLine });
        currentFunction.body = (currentFunction.body ?? '') + rawLine + '\n';

        // Collect calls inside function
        const calls = this.findCallsInLine(rawLine, lineNum);
        for (const call of calls) {
          currentFunction.calls?.push(call);
          if (call.name === 'unwrap' || call.name === 'expect') {
            currentFunction.unwrapsOrExpects?.push(call);
          }
        }

        // Storage accesses
        const storageAccesses = this.findStorageAccessesInLine(rawLine, lineNum);
        if (storageAccesses.length > 0) {
          currentFunction.storageAccesses?.push(...storageAccesses);
        }

        // Loop detection
        const loopMatch = this.findLoopsInLine(rawLine, lineNum);
        if (loopMatch) {
          currentFunction.loops?.push(loopMatch);
        }

        // Function complete when brace depth returns to entry depth
        if (braceDepth <= fnStartBraceDepth && (openBraces > 0 || closeBraces > 0)) {
          currentFunction.endLine = lineNum;
          currentFunction.endCol = rawLine.length;

          const bodyText = currentFunction.body ?? '';
          const hasRequireAuth =
            bodyText.includes('require_auth()') ||
            bodyText.includes('require_auth_for_args(') ||
            currentFunction.calls?.some(
              (c) => c.name === 'require_auth' || c.name === 'require_auth_for_args',
            ) ||
            false;

          // Check if function checks parameter bounds
          const hasInputValidation =
            bodyText.includes('assert!') ||
            bodyText.includes('panic!') ||
            /if\s+[a-zA-Z0-9_]+\s*(?:<=|<|==|>|>=)\s*[0-9]+/.test(bodyText) ||
            /if\s*!\s*[a-zA-Z0-9_]+/.test(bodyText);

          currentFunction.hasRequireAuth = hasRequireAuth;
          currentFunction.hasInputValidation = hasInputValidation;

          functions.push(currentFunction as RustFunction);
          currentFunction = null;
        }
      }

      // Reset inContractImpl if impl block closes
      if (inContractImpl && braceDepth === 0) {
        inContractImpl = false;
      }
    }

    return {
      filePath,
      lines,
      totalLines,
      functions,
      unhandledCalls: allUnhandledCalls,
      hasContractAttribute,
    };
  }

  private static findCallsInLine(line: string, lineNum: number): RustCall[] {
    const calls: RustCall[] = [];
    // Matches .methodName(args) reliably across any chained calls
    const callRegex = /\.([a-zA-Z0-9_]+)\s*\(([^)]*)\)/g;
    let match: RegExpExecArray | null;

    while ((match = callRegex.exec(line)) !== null) {
      const methodName = match[1];
      const args = match[2] ?? '';
      if (methodName !== undefined) {
        calls.push({
          name: methodName,
          args,
          line: lineNum,
          col: match.index + 2, // 1-based column of method start
        });
      }
    }

    // Also match standalone macro calls like require_auth!() or panic!()
    const macroRegex = /([a-zA-Z0-9_]+)!\s*\(([^)]*)\)/g;
    while ((match = macroRegex.exec(line)) !== null) {
      const macroName = match[1];
      const args = match[2] ?? '';
      if (macroName !== undefined) {
        calls.push({
          name: macroName + '!',
          args,
          line: lineNum,
          col: match.index + 1,
        });
      }
    }

    return calls;
  }

  private static findStorageAccessesInLine(line: string, lineNum: number): RustStorageAccess[] {
    const accesses: RustStorageAccess[] = [];
    const storageRegex =
      /storage\(\)\.(instance|persistent|temporary)\(\)\.(get|set|has|remove)\s*(?:<[^>]+>)?\s*\(([^)]*)\)/g;
    let match: RegExpExecArray | null;

    while ((match = storageRegex.exec(line)) !== null) {
      const scope = match[1] as 'instance' | 'persistent' | 'temporary';
      const type = match[2] as 'get' | 'set' | 'has' | 'remove';
      accesses.push({
        scope,
        type,
        key: match[3]?.trim(),
        line: lineNum,
        col: match.index + 1,
      });
    }

    return accesses;
  }

  private static findLoopsInLine(line: string, lineNum: number): RustLoop | null {
    if (/^\s*loop\s*\{/.test(line)) {
      return {
        kind: 'loop',
        isInfinite: true,
        hasBreak: false,
        line: lineNum,
        col: line.indexOf('loop') + 1,
      };
    }
    if (/^\s*while\s+true\s*\{/.test(line)) {
      return {
        kind: 'while',
        isInfinite: true,
        hasBreak: false,
        line: lineNum,
        col: line.indexOf('while') + 1,
      };
    }
    if (/^\s*for\s+/.test(line)) {
      return {
        kind: 'for',
        isInfinite: false,
        hasBreak: true,
        line: lineNum,
        col: line.indexOf('for') + 1,
      };
    }
    return null;
  }
}
