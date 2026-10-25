import type { AnalyzerRuleCategory, Finding, Severity } from '@valorasec/shared';
import type { AnalyzerRuleInterface, RuleContext } from '../rule-engine';

export abstract class BaseRule implements AnalyzerRuleInterface {
  abstract id: string;
  abstract name: string;
  abstract category: AnalyzerRuleCategory;
  abstract severity: Severity;
  abstract description: string;
  abstract recommendation: string;
  abstract references: string[];

  abstract evaluate(context: RuleContext): Finding[];

  protected createFinding(
    context: RuleContext,
    line: number,
    column: number,
    customTitle?: string,
    customDescription?: string,
  ): Finding {
    const title =
      customTitle ??
      this.name
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

    return {
      id: `FND-${this.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ruleId: this.id,
      title,
      description: customDescription ?? this.description,
      severity: this.severity,
      location: {
        file: context.file.filePath,
        line,
        column,
      },
      recommendation: this.recommendation,
      references: [...this.references],
    };
  }
}
