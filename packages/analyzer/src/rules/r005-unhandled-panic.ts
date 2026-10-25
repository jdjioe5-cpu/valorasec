import type { Finding, Severity } from '@valorasec/shared';
import { BaseRule } from './base';
import type { RuleContext } from '../rule-engine';

export class R005UnhandledPanicRule extends BaseRule {
  readonly id = 'R005';
  readonly name = 'unhandled-panic';
  readonly category = 'panic-safety';
  readonly severity: Severity = 'medium';
  readonly description =
    'Code contains `unwrap()` or `expect()` calls that may cause the contract to panic.';
  readonly recommendation =
    'Replace `unwrap()` with proper error handling using `?` operator, `unwrap_or`, or pattern matching.';
  readonly references = ['https://doc.rust-lang.org/book/ch09-00-error-handling.html'];

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { functions, unhandledCalls } = context.file;

    // Report calls found inside parsed functions
    const reportedKeys = new Set<string>();

    for (const fn of functions) {
      for (const call of fn.unwrapsOrExpects) {
        const key = `${call.line}:${call.col}`;
        if (!reportedKeys.has(key)) {
          reportedKeys.add(key);
          findings.push(
            this.createFinding(
              context,
              call.line,
              call.col,
              `Unhandled Panic via \`.${call.name}()\` in \`${fn.name}\``,
              `Calling \`.${call.name}()\` on line ${call.line} can cause unhandled transaction reverts. Use explicit \`Result\` error propagation instead.`,
            ),
          );
        }
      }
    }

    // Also catch any top-level unhandled calls
    for (const call of unhandledCalls) {
      const key = `${call.line}:${call.col}`;
      if (!reportedKeys.has(key)) {
        reportedKeys.add(key);
        findings.push(
          this.createFinding(
            context,
            call.line,
            call.col,
            `Unhandled Panic via \`.${call.name}()\``,
            `Calling \`.${call.name}()\` on line ${call.line} may trigger sudden panics.`,
          ),
        );
      }
    }

    return findings;
  }
}
