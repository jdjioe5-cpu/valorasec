import type { Finding, Severity } from '@valorasec/shared';
import { BaseRule } from './base';
import type { RuleContext } from '../rule-engine';

export class R001MissingAuthRule extends BaseRule {
  readonly id = 'R001';
  readonly name = 'missing-authorization-check';
  readonly category = 'authorization';
  readonly severity: Severity = 'critical';
  readonly description =
    'Contract function does not verify caller authorization before executing privileged operations.';
  readonly recommendation =
    'Add `require_auth()` or `require_auth_for_args()` to verify the caller before executing sensitive operations.';
  readonly references = ['https://soroban.stellar.org/docs/authorization'];

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { functions } = context.file;

    for (const fn of functions) {
      // Check public contract methods that receive caller Address or modify state
      if (!fn.isPublic) continue;

      // Read-only getters like name(), symbol(), decimals(), balance() don't strictly require auth
      const isReadOnlyGetter =
        /^(?:get_|name$|symbol$|decimals$|balance$|allowance$|version$|is_|has_)/i.test(fn.name);
      if (isReadOnlyGetter) continue;

      // Methods like init, transfer, mint, burn, set_admin, withdraw, etc. need authorization
      const hasAddressParam = fn.params.some(
        (p) =>
          p.type.includes('Address') ||
          p.name.includes('from') ||
          p.name.includes('owner') ||
          p.name.includes('admin'),
      );

      // If function performs state mutations or has address params, but missing require_auth
      if (!fn.hasRequireAuth) {
        // High confidence vulnerability if function takes an address param or mutating name
        const isMutatingName =
          /^(?:transfer|mint|burn|set_|update_|withdraw|upgrade|claim|execute|deposit)/i.test(
            fn.name,
          );
        if (hasAddressParam || isMutatingName) {
          findings.push(
            this.createFinding(
              context,
              fn.startLine,
              fn.startCol,
              `Missing Authorization Check in \`${fn.name}\``,
              `Function \`${fn.name}\` performs privileged operations or takes address parameters without calling \`require_auth()\` or \`require_auth_for_args()\`.`,
            ),
          );
        }
      }
    }

    return findings;
  }
}
