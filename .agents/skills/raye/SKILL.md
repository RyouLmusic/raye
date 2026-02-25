# Raye Monorepo Project Management Skill

## Purpose
Manage the Raye monorepo project structure, enforce file organization standards, and guide development workflows for packages under `packges/`.

## Project Structure

### Root Structure
```
raye/
├── packges/           # Monorepo packages (note: typo preserved for consistency)
│   ├── core/         # Core package
│   └── ui/           # UI package
├── index.ts          # Root entry point
├── package.json      # Root package configuration
├── tsconfig.json     # Root TypeScript config
└── README.md         # Project documentation
```

### Package Structure Standard
Each package under `packges/` follows this structure:

```
packges/<package-name>/
├── src/              # Source code directory
│   ├── index.ts     # Package entry point
│   ├── types/       # Type definitions
│   ├── utils/       # Utility functions
│   └── ...          # Feature modules
├── test/            # Test files
│   └── *.test.ts   # Test cases
├── docx/            # Documentation
├── index.ts         # Package entry (re-exports from src/)
├── package.json     # Package configuration
├── tsconfig.json    # Package TypeScript config
├── README.md        # Package documentation
└── .gitignore       # Package-specific ignores
```

## Package Configuration Standards

### package.json Template
```json
{
  "name": "<package-name>",
  "module": "index.ts",
  "type": "module",
  "private": true,
  "devDependencies": {
    "@types/bun": "latest"
  },
  "peerDependencies": {
    "typescript": "^5"
  }
}
```

### tsconfig.json Settings
- Target: ESNext
- Module: Preserve
- Module Resolution: bundler
- Strict mode enabled
- No emit (bundler handles compilation)
- Allow importing TypeScript extensions

## File Creation Rules

### 1. Creating a New Package
When creating a new package under `packges/`:

**REQUIRED STEPS:**
1. Create package directory: `packges/<package-name>/`
2. Initialize with these files:
   - `package.json` (use template above)
   - `index.ts` (entry point)
   - `tsconfig.json` (copy from core)
   - `README.md` (package description)
   - `.gitignore` (node_modules, etc.)
3. Create structure directories:
   - `src/` (source code)
   - `test/` (tests)
   - `docx/` (documentation)
4. Add package reference in root if needed

**Example:**
```bash
mkdir -p packges/new-package/{src,test,docx}
cd packges/new-package
# Create files from templates
```

### 2. Creating Source Files
**Location Rules:**
- Main source code → `packges/<package>/src/`
- Type definitions → `packges/<package>/src/types/`
- Utilities → `packges/<package>/src/utils/`
- Feature modules → `packges/<package>/src/<feature>/`
- Tests → `packges/<package>/test/`
- Documentation → `packges/<package>/docx/`

**Naming Conventions:**
- Use kebab-case for directories: `user-service/`, `data-provider/`
- Use camelCase for TypeScript files: `userService.ts`, `dataProvider.ts`
- Use PascalCase for component files: `UserCard.tsx`, `DataTable.tsx`
- Use `.test.ts` suffix for test files: `userService.test.ts`
- Use descriptive names: `parseDocument.ts` not `parse.ts`

### 3. Creating Entry Points
Each package MUST have an `index.ts` at the root that re-exports from `src/`:

```typescript
// packges/<package>/index.ts
export * from './src/index.js'
export type * from './src/types/index.js'
```

The `src/index.ts` should export all public APIs:

```typescript
// packges/<package>/src/index.ts
export { functionName } from './module.js'
export type { TypeName } from './types/index.js'
```

## Development Workflows

### Adding a New Feature to a Package

1. **Determine Feature Location**
   - Simple utility → `src/utils/<feature>.ts`
   - Complex feature → `src/<feature>/index.ts` (with subdirectory)
   - Type definitions → `src/types/<feature>.ts`

2. **Create Files**
   ```bash
   # For complex feature
   mkdir -p packges/<package>/src/<feature>
   touch packges/<package>/src/<feature>/index.ts
   touch packges/<package>/test/<feature>.test.ts
   ```

3. **Export from Package**
   - Add exports to `src/index.ts`
   - Ensure types are exported separately
   - Update package README if needed

4. **Add Tests**
   - Create corresponding test file in `test/`
   - Use descriptive test names
   - Follow Bun test conventions

### Modifying Existing Code

**ALWAYS:**
- Check if file is in correct location per standards
- Maintain export structure in index files
- Update tests when changing functionality
- Keep README.md synchronized with changes

**File Location Validation:**
```
✅ packges/core/src/parser.ts
❌ packges/core/parser.ts (should be in src/)

✅ packges/core/test/parser.test.ts
❌ packges/core/src/parser.test.ts (tests in test/)

✅ packges/core/src/types/document.ts
❌ packges/core/types/document.ts (types in src/types/)
```

## Cross-Package Dependencies

### Internal Dependencies
When one package depends on another:

```typescript
// In packges/ui/src/component.ts
import { coreFunction } from '../../core/index.js'
```

### Managing Dependencies
- Use workspace references for monorepo packages
- Keep dependencies minimal and explicit
- Document cross-package dependencies in README

## Best Practices

### 1. Module Organization
- One primary export per file (exceptions for tightly coupled code)
- Group related functionality in subdirectories
- Keep files focused and under 300 lines

### 2. Type Safety
- Define types in `src/types/` directory
- Export types separately: `export type { ... }`
- Use strict TypeScript settings
- **ALWAYS explicitly declare types - never rely on type inference**

**Function Return Types:**
- ✅ `function getName(): string { return 'name' }`
- ✅ `const getData = (): Promise<Data> => fetchData()`
- ✅ `async function process(): Promise<void> { ... }`
- ❌ `function getName() { return 'name' }` (missing return type)
- ❌ `const getData = async () => fetchData()` (missing return type)

**Variable Types:**
- ✅ `const count: number = 0`
- ✅ `let user: User | null = null`
- ✅ `const items: string[] = []`
- ❌ `const count = 0` (missing type annotation)
- ❌ `let user = null` (missing type annotation)

**Function Parameters:**
- ✅ `function process(data: Data, options: Options): Result { ... }`
- ✅ `const handler = (event: Event, context: Context): void => { ... }`
- ❌ `function process(data, options) { ... }` (missing parameter types)

**Object Properties:**
- ✅ `const config: Config = { timeout: 5000, retry: true }`
- ✅ `const user: { name: string; age: number } = { name: 'John', age: 30 }`
- ❌ `const config = { timeout: 5000, retry: true }` (missing type)

**Array Types:**
- ✅ `const names: string[] = []`
- ✅ `const users: Array<User> = []`
- ❌ `const names = []` (missing type annotation)

**Class Properties and Methods:**
```typescript
// ✅ Correct
class UserService {
  private users: User[] = []
  
  constructor(private config: Config) {}
  
  getUser(id: string): User | undefined {
    return this.users.find(u => u.id === id)
  }
}

// ❌ Wrong
class UserService {
  private users = []  // missing type
  
  getUser(id) {  // missing parameter and return types
    return this.users.find(u => u.id === id)
  }
}
```

**Generic Types:**
- ✅ `function map<T, U>(items: T[], fn: (item: T) => U): U[] { ... }`
- ✅ `const cache: Map<string, Data> = new Map()`
- ❌ `function map(items, fn) { ... }` (missing generic and parameter types)

### 3. Testing
- Co-locate test files in `test/` directory
- Mirror source structure in test directory
- Name tests descriptively: `describe()` and `it()` blocks

### 4. Documentation
- Maintain package-level README.md
- Document public APIs with JSDoc comments
- Keep examples in `docx/` directory

## Common Tasks

### Task: Add a new utility function
**Location:** `packges/<package>/src/utils/<utility-name>.ts`
**Steps:**
1. Create file in utils directory
2. Export from `src/index.ts`
3. Add test in `test/<utility-name>.test.ts`

### Task: Add a new feature module
**Location:** `packges/<package>/src/<feature>/`
**Steps:**
1. Create feature directory
2. Add `index.ts` as module entry
3. Export from package `src/index.ts`
4. Create test file
5. Update package README

### Task: Create a new package
**Location:** `packges/<new-package>/`
**Steps:**
1. Create directory structure (see "Creating a New Package")
2. Copy and customize package.json, tsconfig.json
3. Set up src/, test/, docx/ directories
4. Create package README
5. Add to root workspace if using workspace features

## Runtime: Bun

This project uses Bun as the JavaScript runtime and package manager.

**Key Commands:**
```bash
bun install          # Install dependencies
bun test            # Run tests
bun run <script>    # Run package.json script
bun <file.ts>       # Execute TypeScript directly
```

**Features Used:**
- Native TypeScript support
- Fast package management
- Built-in test runner
- Module resolution with bundler mode

## When to Use This Skill

Use this skill when:
- Creating new packages in the monorepo
- Adding features or utilities to existing packages
- Organizing source code files
- Setting up tests or documentation
- Managing package structure and exports
- Enforcing project conventions
- Answering questions about file placement

## Quick Reference

| Task | Location | File Pattern |
|------|----------|--------------|
| New package | `packges/<name>/` | Full structure |
| Source code | `src/` | `*.ts` |
| Types | `src/types/` | `*.ts` |
| Utils | `src/utils/` | `*.ts` |
| Tests | `test/` | `*.test.ts` |
| Docs | `docx/` | `*.md` |
| Entry point | Root of package | `index.ts` |
| Config | Root of package | `package.json`, `tsconfig.json` |

---

**Remember:** Consistency in structure enables better tooling, clearer navigation, and easier maintenance across the entire monorepo.
