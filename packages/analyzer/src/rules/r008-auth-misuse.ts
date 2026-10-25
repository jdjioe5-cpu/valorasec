import type { Finding, Severity } from '@valorasec/shared';
import { BaseRule } from './base';
import type { RuleContext } from '../rule-engine';

export class R008AuthMisuseRule extends BaseRule {
  readonly id = 'R008';
  readonly name = 'authorization-misuse';
  readonly category = 'authorization';
  readonly severity: Severity = 'critical';
  readonly description =
    'Authorization checks are present but incorrectly implemented, potentially allowing unauthorized access.';
  readonly recommendation =
    'Review authorization logic to ensure all edge cases are handled and authorization cannot be bypassed.';
  readonly references = ['https://soroban.stellar.org/docs/authorization'];

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { functions } = context.file;

    for (const fn of functions) {
      if (!fn.isPublic) continue;

      let seenStateChange = false;

      for (const lineObj of fn.rawLines) {
        const text = lineObj.text;
        if (text.includes('require_auth()') || text.includes('require_auth_for_args(')) {
          // If state modification occurred before require_auth
          if (seenStateChange) {
            findings.push(
              this.createFinding(
                context,
                lineObj.line,
                1,
                `Late Authorization Check in \`${fn.name}\``,
                `State modifications or storage writes were executed before verifying authorization on line ${lineObj.line}. Checks must come first.`,
              ),
            );
          }
        }

        if (text.includes('.set(') || text.includes('.remove(') || text.includes('.transfer(')) {
          seenStateChange = true;
        }
      }
    }

    return findings;
  }
}
