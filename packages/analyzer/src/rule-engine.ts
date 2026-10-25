import type { AnalyzerRule, Finding } from '@valorasec/shared';
import type { RustSourceFile } from './parser';

export interface RuleContext {
  file: RustSourceFile;
  options?: Record<string, unknown>;
}

export interface AnalyzerRuleInterface extends AnalyzerRule {
  /**
   * Run the rule against parsed Rust AST.
   * Returns findings discovered in the source file.
   */
  evaluate(context: RuleContext): Finding[];
}

export class RuleEngine {
  private rules: Map<string, AnalyzerRuleInterface> = new Map();

  /**
   * Register a new or custom security rule into the engine.
   * Enables runtime extensibility without modifying core code.
   */
  registerRule(rule: AnalyzerRuleInterface): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Unregister a rule by ID.
   */
  unregisterRule(id: string): boolean {
    return this.rules.delete(id);
  }

  /**
   * Return metadata for all registered rules.
   */
  getRules(): AnalyzerRule[] {
    return Array.from(this.rules.values()).map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      severity: r.severity,
      description: r.description,
      recommendation: r.recommendation,
      references: [...r.references],
    }));
  }

  /**
   * Retrieve a specific rule by ID.
   */
  getRule(id: string): AnalyzerRuleInterface | undefined {
    return this.rules.get(id);
  }

  /**
   * Execute all registered rules against the provided Rust AST.
   */
  execute(file: RustSourceFile, options?: Record<string, unknown>): Finding[] {
    const findings: Finding[] = [];
    const context: RuleContext = { file, options };

    for (const rule of this.rules.values()) {
      try {
        const results = rule.evaluate(context);
        findings.push(...results);
      } catch (err) {
        console.error(`Error executing rule ${rule.id} (${rule.name}):`, err);
      }
    }

    return findings;
  }
}
