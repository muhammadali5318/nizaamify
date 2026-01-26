# Feature Flag System

A flag system for controlling module access with robust caching, type safety, and error handling.

## Overview

The feature flag system provides:
- **Type-safe** rule evaluation with strict TypeScript interfaces
- **High-performance** caching with stable key generation
- **Enterprise-grade** error handling and validation
- **Developer-friendly** hooks and service layer architecture
- **Production-ready** monitoring and fail-safe defaults

## Architecture

### Core Components

#### 1. **Service Layer** (`src/services/FeatureFlagService.ts`)
- **Centralized rule evaluation** with comprehensive error handling
- **Intelligent caching** with 5-second TTL and stable key generation
- **Configuration validation** to catch misconfigurations early
- **Fail-safe defaults** ensuring system reliability

#### 2. **Enhanced Types** (`src/types/feature-flags.ts`)
- **Strict UserContext** interface with known properties (`onboardingCompleted`)
- **Type-safe FeatureRuleId** for better compile-time checks
- **Extensible design** allowing future property additions

#### 3. **Constants** (`src/constants/feature-rules.ts`)
- **Centralized rule IDs** preventing typos and inconsistencies
- **Single source of truth** for all feature rule references
- **TypeScript auto-completion** for better developer experience

#### 4. **Specialized Hooks**
- **`useFeatureRule`** (`src/hooks/useFeatureRule.ts`) - Single rule evaluation with error handling
- **`useFeatureFlags`** (`src/hooks/useFeatureFlags.ts`) - Module permissions using service layer
- **Context Provider** (`src/context/FeatureFlagProvider.tsx`) - Global state management

#### 5. **Validation & Monitoring** (`src/utils/validateFeatureFlags.ts`)
- **Startup validation** in development mode
- **Configuration integrity** checks
- **Developer warnings** for misconfigurations

## Usage Examples

### 1. **Using useFeatureRule Hook** (Recommended)

```tsx
import { useFeatureRule } from 'src/hooks/useFeatureRule'
import { FEATURE_RULE_IDS } from 'src/constants/feature-rules'

function OnboardingBanner() {
  const { isEnabled: onboardingComplete, error } = useFeatureRule(
    FEATURE_RULE_IDS.ONBOARDING_COMPLETED
  )

  // Show banner when onboarding is NOT completed, or if there's an error (fail-safe)
  const shouldShowBanner = !onboardingComplete || !!error

  if (!shouldShowBanner) return null

  return (
    <Alert severity="warning">
      <AlertTitle>Complete your onboarding to unlock all features</AlertTitle>
    </Alert>
  )
}
```

### 2. **Adding New Feature Rules**

```tsx
// 1. Add to constants
export const FEATURE_RULE_IDS = {
  ONBOARDING_COMPLETED: 'onboarding-completed',
  PREMIUM_SUBSCRIPTION: 'premium-subscription', // New rule
} as const

// 2. Add to configuration
const rules: FeatureRule[] = [
  {
    id: FEATURE_RULE_IDS.PREMIUM_SUBSCRIPTION,
    description: 'Premium subscription required',
    evaluate: (context) => {
      return context.subscriptionTier === 'premium' // Add to UserContext type
    }
  }
]

// 3. Use in modules
{
  id: 'reports',
  name: 'Reports',
  requiredRules: [FEATURE_RULE_IDS.PREMIUM_SUBSCRIPTION]
}
```

### 3. **Service Layer Direct Usage**

```tsx
import { FeatureFlagService } from 'src/services/FeatureFlagService'
import { FEATURE_RULE_IDS } from 'src/constants/feature-rules'

// Advanced usage - direct service access
function someUtilityFunction(userContext: UserContext) {
  const isOnboardingComplete = FeatureFlagService.evaluateRule(
    FEATURE_RULE_IDS.ONBOARDING_COMPLETED,
    userContext
  )

  if (!isOnboardingComplete) {
    // Handle onboarding incomplete logic
  }
}
```

### 4. **Module Permissions**

```tsx
import { useFeatureFlags } from 'src/hooks/useFeatureFlags'
import { useFeatureFlagContext } from 'src/context/FeatureFlagProvider'

function Sidebar() {
  const { userContext } = useFeatureFlagContext()
  const { isModuleEnabled, getDisabledReason } = useFeatureFlags(userContext)

  return (
    <nav>
      {menuItems.map(item => (
        <MenuItem
          key={item.id}
          disabled={!isModuleEnabled(item.moduleId)}
          tooltip={getDisabledReason(item.moduleId)}
        >
          {item.name}
        </MenuItem>
      ))}
    </nav>
  )
}
```

## Key Features

### **Intelligent Caching**
- **Stable cache keys** - Same context data always generates same cache key
- **5-second TTL** - Automatic cache expiration prevents stale data
- **Memory management** - Auto-cleanup prevents memory leaks

```tsx
// These now create the same cache key (order doesn't matter):
{onboardingCompleted: true, userId: "123"}
{userId: "123", onboardingCompleted: true}
```

### **Error Handling & Validation**
- **Fail-safe defaults** - Rules default to `false` on error
- **Configuration validation** - Catches invalid rules at startup
- **Comprehensive logging** - Detailed error messages for debugging

### **Type Safety**
- **Strict interfaces** - Known properties like `onboardingCompleted`
- **Compile-time checks** - TypeScript catches rule ID typos
- **Extensible design** - Easy to add new context properties

## Integration Points

### **Sidebar Integration** (`src/layouts/applayout/AppLayout.tsx`)
- Disabled modules show with visual feedback (opacity, grayscale)
- Tooltips display reasons for disabled state
- Navigation is conditionally rendered based on permissions

### **Route Protection** (`src/components/FeatureProtectedRoute.tsx`)
- Prevents direct URL access to disabled modules
- Redirects users away from inaccessible pages
- Integrates seamlessly with React Router

### **Component Examples**
- **OnboardingBanner** - Shows when onboarding is incomplete
- **FeatureProtectedRoute** - Wraps routes with access control
- **Sidebar** - Dynamically enables/disables menu items

## API Reference

### **FeatureFlagService**
```tsx
class FeatureFlagService {
  // Evaluate a specific rule with caching
  static evaluateRule(ruleId: FeatureRuleId, context: UserContext): boolean

  // Find a rule by ID
  static findRule(ruleId: FeatureRuleId): FeatureRule | undefined

  // Validate entire configuration
  static validateConfiguration(): { isValid: boolean; errors: string[] }

  // Clear evaluation cache
  static clearCache(): void
}
```

### **useFeatureRule Hook**
```tsx
function useFeatureRule(ruleId: FeatureRuleId): {
  isEnabled: boolean
  loading: boolean
  error?: string
}
```

### **useFeatureFlags Hook**
```tsx
function useFeatureFlags(userContext: UserContext): {
  modulePermissions: ModulePermission[]
  isModuleEnabled(moduleId: ModuleId): boolean
  getDisabledReason(moduleId: ModuleId): string | undefined
  getEnabledModules(): ModuleId[]
  getDisabledModules(): ModulePermission[]
}
```

### **FeatureFlagProvider**
```tsx
type FeatureFlagContextType = {
  userContext: UserContext
  updateUserContext: (updates: Partial<UserContext>) => void
  setContextValue: (key: string, value: any) => void
  getContextValue: (key: string) => any
}
```

## Best Practices

### **✅ Do:**
- Use `useFeatureRule` for single rule evaluation
- Import rule IDs from `FEATURE_RULE_IDS` constants
- Handle error states with fail-safe behavior
- Validate configuration in development
- Use descriptive rule descriptions
- Keep UserContext properties typed and minimal

### **❌ Don't:**
- Access `featureFlagConfig` directly in components
- Hard-code rule ID strings
- Ignore error states from hooks
- Skip configuration validation
- Mix business logic with feature flag evaluation

### **Performance Tips:**
- Rules are cached automatically - no need for manual memoization
- Context changes invalidate cache - keep context updates minimal
- Use `useFeatureRule` for single rules, `useFeatureFlags` for modules

### **Testing Tips:**
- Configuration validation catches issues early
- Service layer is easily mockable for tests
- Clear cache between test runs if needed

## Module IDs

Available module IDs:
- `dashboard` - Main dashboard
- `documents` - Document management
- `reports` - Analytics and reports (requires onboarding)
- `benchmarks` - Benchmarking tools
- `team-management` - Team and user management
- `practice-settings` - Practice configuration
- `billing` - Billing and payments
- `settings` - User settings
- `help-support` - Help and support

## Future Enhancements

The system is designed for extensibility. Planned improvements:
- **Dynamic configuration** - Load rules from remote API
- **A/B testing support** - Percentage-based rule evaluation
- **Analytics integration** - Track feature usage and performance
- **Advanced targeting** - User segments, geographic rules
- **Testing utilities** - Mock rules for unit/integration tests