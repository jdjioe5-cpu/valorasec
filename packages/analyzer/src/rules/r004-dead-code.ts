import type { Finding, Severity } from '@valorasec/shared';
import { BaseRule } from './base';
import type { RuleContext } from '../rule-engine';

export class R004DeadCodeRule extends BaseRule {
  readonly id = 'R004';
  readonly name = 'dead-code';
  readonly category = 'code-quality';
  readonly severity: Severity = 'low';
  readonly description = 'Unreachable code detected that will never execute.';
  readonly recommendation = 'Remove dead code to improve readability and reduce contract size.';
  readonly references = [];

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { functions } = context.file;

    for (const fn of functions) {
      let sawUnconditionalReturn = false;
      for (const lineObj of fn.rawLines) {
        const text = lineObj.text.trim();
        if (sawUnconditionalReturn) {
          // If statement after return is not a closing brace
          if (text !== '}' && !text.startsWith('//') && text.length > 0) {
            findings.push(
              this.createFinding(
                context,
                lineObj.line,
                1,
                `Unreachable Code Detected in \`${fn.name}\``,
                `Statement \`${text.slice(0, 40)}\` appears after an unconditional return in \`${fn.name}\`.`,
              ),
            );
            break;
          }
        }

        if (/^\s*return\s+[^;]+;/.test(text) || /^\s*panic!\s*\(/.test(text)) {
          sawUnconditionalReturn = true;
        }
      }
    }

    return findings;
  }
}
