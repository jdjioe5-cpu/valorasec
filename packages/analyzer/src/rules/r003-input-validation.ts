import type { Finding, Severity } from '@valorasec/shared';
import { BaseRule } from './base';
import type { RuleContext } from '../rule-engine';

export class R003InputValidationRule extends BaseRule {
  readonly id = 'R003';
  readonly name = 'input-validation-missing';
  readonly category = 'input-validation';
  readonly severity: Severity = 'high';
  readonly description =
    'Function parameters are not validated, potentially allowing malicious or malformed inputs.';
  readonly recommendation =
    'Add input validation checks at the beginning of each public function to ensure parameters are within expected ranges.';
  readonly references = ['https://soroban.stellar.org/docs/best-practices'];

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { functions } = context.file;

    for (const fn of functions) {
      if (!fn.isPublic) continue;

      // Find numeric/amount parameters that typically require positive/bounds validation
      const numericParams = fn.params.filter(
        (p) =>
          /^(?:amount|value|fee|rate|count|limit|balance|shares|nonce)/i.test(p.name) ||
          /^(?:i128|u128|i64|u64|i32|u32)/.test(p.type),
      );

      if (numericParams.length === 0) continue;

      // If function body doesn't validate bounds on these parameters
      if (!fn.hasInputValidation) {
        findings.push(
          this.createFinding(
            context,
            fn.startLine,
            fn.startCol,
            `Missing Input Validation in \`${fn.name}\``,
            `Public function \`${fn.name}\` takes numeric parameters (${numericParams.map((p) => p.name).join(', ')}) without bounds or sanity checks.`,
          ),
        );
      }
    }

    return findings;
  }
}
