# LLM Context Generation Prompt Template

Use this prompt to create comprehensive LLM context files for web3 coding projects:

---

## Prompt:

**Create a comprehensive LLM_CONTEXT.md file for this project that enables AI assistants to provide accurate integration guidance. Follow this structure:**

### 1. PROJECT HEADER
- Package name and version
- Alternative package names (if any)
- License
- Brief 2-3 line summary of what the project does

### 2. PROJECT SUMMARY  
- 3-5 bullet points of key features/capabilities
- Target use cases
- Technology stack highlights

### 3. ARCHITECTURE OVERVIEW
- Simple ASCII diagram showing component relationships
- High-level data flow or interaction patterns
- Key contracts/modules and their roles

### 4. PACKAGE STRUCTURE
Organize exports into clear categories:

#### Main Exports
- Contract types & factories (TypeChain/generated types)
- Core utilities and functions
- Configuration/deployment helpers
- TypeScript types

#### Subpath Exports  
- Contract ABIs (`/contracts`)
- Deployment utilities (`/deployments`) 
- Type-only imports (`/types`)
- Other specialized paths

### 5. INTERFACE DOCUMENTATION
For each major contract/interface:
- Complete TypeScript interface definition
- Method signatures with proper types
- Clear comments explaining what each method does
- Parameter and return type documentation

### 6. DEPLOYMENT/CONFIGURATION
- Network/chain information (chain IDs, addresses)
- Configuration utilities and helpers
- Environment setup requirements
- Supported networks list

### 7. COMPLETE INTEGRATION EXAMPLES

#### Basic Usage Pattern
- Minimal working example
- Connection setup
- Simple operation demonstration

#### Advanced Usage
- Complex scenarios
- Error handling
- Performance considerations
- Real-world usage patterns

#### External Tool Integration
- Using with popular libraries (ethers, viem, wagmi)
- ABI usage examples
- Framework-specific patterns

### 8. TYPE SAFETY GUIDELINES
- Proper TypeScript usage patterns
- Type assertions and narrowing
- Generic types and overrides
- Best practices for type safety

### 9. COMMON INTEGRATION PATTERNS
- Error handling strategies
- Event listening examples
- Multi-chain/network support
- State management patterns
- Performance optimization

### 10. KEY IMPLEMENTATION NOTES
- Important technical details
- Security considerations  
- Gas optimization tips
- Protocol-specific behaviors
- Upgrade/migration considerations

### 11. QUICK REFERENCE
- Summary table of key functions/methods
- Contract/component ownership
- Cost/fee information
- Common parameter patterns

---

## Requirements:

1. **Accuracy**: Base all information on actual exported interfaces and implementations
2. **Completeness**: Cover all major usage patterns and exported functionality  
3. **Clarity**: Use clear, concise language with practical examples
4. **TypeScript-First**: Emphasize proper TypeScript usage throughout
5. **Real Examples**: Provide complete, runnable code examples
6. **Developer-Focused**: Address common developer needs and pain points
7. **Maintenance**: Structure information for easy updates as the project evolves

## Output Format:
- Use markdown with clear headings and code blocks
- Include TypeScript syntax highlighting
- Organize with consistent section structure
- Add practical code examples for every major concept
- Create reusable patterns that developers can copy-paste

## Analysis Steps:
1. Examine package.json exports and scripts
2. Review dist/ folder structure for available modules
3. Analyze TypeScript declaration files for complete interfaces
4. Check deployment/configuration files
5. Identify all exported functions, types, and utilities
6. Document the complete public API surface
7. Create examples covering basic to advanced usage scenarios

---

**Goal**: Create a single file that enables any AI assistant to provide complete, accurate integration guidance without needing to examine the source code. Save the file as LLM_CONTEXT.md if possible and ensure this file makes it's way into the published, build or dist files.