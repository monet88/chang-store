```markdown
# chang-store Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns and conventions used in the `chang-store` TypeScript codebase. While the repository does not use a specific framework, it emphasizes clear file organization, consistent import/export styles, and a straightforward approach to testing. This guide will help you contribute code that aligns with the project's standards.

## Coding Conventions

### File Naming
- **Pattern:** PascalCase  
  Example:  
  ```
  ShoppingCart.ts
  UserProfile.ts
  ```

### Import Style
- **Pattern:** Relative imports  
  Example:  
  ```typescript
  import { CartItem } from './CartItem';
  import { calculateTotal } from '../utils/PriceUtils';
  ```

### Export Style
- **Pattern:** Named exports  
  Example:  
  ```typescript
  // In ShoppingCart.ts
  export function addItem(item: CartItem) { ... }
  export const CART_LIMIT = 10;
  ```

### Commit Messages
- **Pattern:** Freeform, no enforced prefixes  
  Example:  
  ```
  Fix bug in cart total calculation
  Add support for discount codes
  ```

## Workflows

### Adding a New Module
**Trigger:** When you need to add a new feature or logical unit  
**Command:** `/add-module`

1. Create a new file using PascalCase (e.g., `NewFeature.ts`).
2. Use relative imports to include dependencies.
3. Export functions, constants, or types using named exports.
4. If applicable, add a corresponding test file named `NewFeature.test.ts`.

### Writing and Running Tests
**Trigger:** When you need to validate functionality  
**Command:** `/run-tests`

1. Create a test file alongside the module, using the pattern `*.test.ts` (e.g., `ShoppingCart.test.ts`).
2. Write tests using the project's chosen (but currently unknown) testing framework.
3. Run tests using the project's test runner (refer to project documentation or scripts).

### Refactoring Code
**Trigger:** When improving or restructuring existing code  
**Command:** `/refactor`

1. Rename files using PascalCase if needed.
2. Update all relative imports to match new file paths.
3. Ensure all exports remain named.
4. Update or add tests to cover refactored code.

## Testing Patterns

- **Test File Naming:**  
  Use the pattern `*.test.ts` for test files. Place them alongside the module they test.
  ```
  ShoppingCart.ts
  ShoppingCart.test.ts
  ```
- **Framework:**  
  The specific testing framework is not detected; follow existing patterns or consult the team.
- **Test Example:**  
  ```typescript
  // ShoppingCart.test.ts
  import { addItem } from './ShoppingCart';

  test('adds item to cart', () => {
    // test implementation
  });
  ```

## Commands
| Command        | Purpose                                   |
|----------------|-------------------------------------------|
| /add-module    | Scaffold a new module with conventions    |
| /run-tests     | Run all test files in the repository      |
| /refactor      | Guide for refactoring code and structure  |
```
