import { R001MissingAuthRule } from './r001-missing-auth';
import { R002UnsafeStorageRule } from './r002-unsafe-storage';
import { R003InputValidationRule } from './r003-input-validation';
import { R004DeadCodeRule } from './r004-dead-code';
import { R005UnhandledPanicRule } from './r005-unhandled-panic';
import { R006GasLoopRule } from './r006-gas-loop';
import { R007UnsafeRandomnessRule } from './r007-unsafe-randomness';
import { R008AuthMisuseRule } from './r008-auth-misuse';
import type { AnalyzerRuleInterface } from '../rule-engine';

export * from './base';
export * from './r001-missing-auth';
export * from './r002-unsafe-storage';
export * from './r003-input-validation';
export * from './r004-dead-code';
export * from './r005-unhandled-panic';
export * from './r006-gas-loop';
export * from './r007-unsafe-randomness';
export * from './r008-auth-misuse';

/**
 * Instantiate standard built-in rules (R001 - R008).
 */
export function createDefaultRules(): AnalyzerRuleInterface[] {
  return [
    new R001MissingAuthRule(),
    new R002UnsafeStorageRule(),
    new R003InputValidationRule(),
    new R004DeadCodeRule(),
    new R005UnhandledPanicRule(),
    new R006GasLoopRule(),
    new R007UnsafeRandomnessRule(),
    new R008AuthMisuseRule(),
  ];
}
