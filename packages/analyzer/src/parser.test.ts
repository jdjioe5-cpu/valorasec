import { describe, it, expect } from 'vitest';
import { RustParser } from './parser';

describe('RustParser', () => {
  it('should parse contract functions, visibility, and parameters', () => {
    const code = `
      #[contractimpl]
      impl TokenContract {
          pub fn transfer(env: Env, from: Address, to: Address, amount: i128) -> Result<(), Error> {
              from.require_auth();
              if amount <= 0 { panic!("invalid"); }
          }
      }
    `;

    const ast = RustParser.parse(code, 'src/token.rs');
    expect(ast.functions).toHaveLength(1);

    const fn = ast.functions[0]!;
    expect(fn.name).toBe('transfer');
    expect(fn.isPublic).toBe(true);
    expect(fn.params).toEqual([
      { name: 'env', type: 'Env' },
      { name: 'from', type: 'Address' },
      { name: 'to', type: 'Address' },
      { name: 'amount', type: 'i128' },
    ]);
    expect(fn.hasRequireAuth).toBe(true);
    expect(fn.hasInputValidation).toBe(true);
  });

  it('should detect unwrap and expect method calls with accurate locations', () => {
    const code = `
      fn process(x: Option<i32>) -> i32 {
          let a = x.unwrap();
          let b = x.expect("missing value");
          a + b
      }
    `;

    const ast = RustParser.parse(code);
    expect(ast.functions).toHaveLength(1);
    const fn = ast.functions[0]!;

    expect(fn.unwrapsOrExpects).toHaveLength(2);
    expect(fn.unwrapsOrExpects[0]!.name).toBe('unwrap');
    expect(fn.unwrapsOrExpects[0]!.line).toBe(3);
    expect(fn.unwrapsOrExpects[1]!.name).toBe('expect');
    expect(fn.unwrapsOrExpects[1]!.line).toBe(4);
  });

  it('should detect storage accesses', () => {
    const code = `
      fn store_test(env: Env, key: Symbol, val: i32) {
          if env.storage().instance().has(&key) {
              let old: i32 = env.storage().instance().get(&key).unwrap();
          }
          env.storage().instance().set(&key, &val);
      }
    `;

    const ast = RustParser.parse(code);
    expect(ast.functions).toHaveLength(1);
    const accesses = ast.functions[0]!.storageAccesses;
    expect(accesses.some((a) => a.type === 'has')).toBe(true);
    expect(accesses.some((a) => a.type === 'get')).toBe(true);
    expect(accesses.some((a) => a.type === 'set')).toBe(true);
  });

  it('should detect unbounded loops', () => {
    const code = `
      fn busy_loop() {
          loop {
              // infinite
          }
      }
    `;

    const ast = RustParser.parse(code);
    expect(ast.functions[0]!.loops).toHaveLength(1);
    expect(ast.functions[0]!.loops[0]!.isInfinite).toBe(true);
  });
});
