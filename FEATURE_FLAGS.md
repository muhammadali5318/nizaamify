# Feature Flag System

A flexible feature flag system for controlling module access based on custom conditions like subscription tiers, onboarding status, or any other business logic.

## Overview

The feature flag system allows you to:
- Enable/disable sidebar modules based on custom conditions
- Display helpful messages when modules are disabled
- Dynamically update user context to enable/disable features
- Support complex evaluation logic

## Core Components

### 1. Types (`src/types/feature-flags.ts`)
- `UserContext`: Flexible object that can hold any user-related data
- `FeatureRule`: Defines conditions for enabling features
- `ModuleConfig`: Maps modules to their access rules
- `ModulePermission`: Result of permission evaluation
- `ModuleId`: TypeScript union type for all available module IDs

### 2. Context Provider (`src/context/FeatureFlagProvider.tsx`)
- Manages user context state globally
- Provides methods to update context values
- Wraps the entire application for consistent access
- Initialized without initial context (empty by default)

### 3. Hook (`src/hooks/useFeatureFlags.ts`)
- Evaluates module permissions based on current user context
- Provides utilities to check if modules are enabled
- Returns comprehensive permission information for all modules

### 4. Configuration (`src/config/feature-flag-config.ts`)
- Central place to define rules and module configurations
- Pre-configured with all application modules
- Easily customizable for your business logic

### 5. Route Protection (`src/components/FeatureProtectedRoute.tsx`)
- Wraps components to enforce feature-based access control
- Redirects to appropriate pages when access is denied
- Integrates seamlessly with React Router

## Usage Examples

### Basic Setup

```tsx
import { FeatureFlagProvider } from './context/FeatureFlagProvider'
import { AuthProvider } from './context/AuthProvider'
import Router from './router'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FeatureFlagProvider>
          <ErrorBoundary>
            <ThemeProvider theme={theme}>
              <NotificationProvider>
                <Router />
                <IdleSessionHandler />
              </NotificationProvider>
            </ThemeProvider>
          </ErrorBoundary>
        </FeatureFlagProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
```

### Adding Subscription Tier Rules

```tsx
import { featureFlagConfig } from './config/feature-flag-config'

// Add rules to the global configuration
featureFlagConfig.rules.push(
  {
    id: 'is-premium',
    description: 'Premium subscription required',
    evaluate: (context) => context.subscriptionTier === 'premium'
  },
  {
    id: 'is-enterprise',
    description: 'Enterprise subscription required',
    evaluate: (context) => context.subscriptionTier === 'enterprise'
  }
)

// Configure modules to use the rules
const reportsModule = featureFlagConfig.modules.find(m => m.id === 'reports')
if (reportsModule) {
  reportsModule.requiredRules = ['is-premium']
  reportsModule.disabledMessage = 'Upgrade to Premium to access Reports'
}
```

### Adding Onboarding Rules

```tsx
featureFlagConfig.rules.push(
  {
    id: 'email-verified',
    description: 'Email verification required',
    evaluate: (context) => context.onboarding?.emailVerified === true
  },
  {
    id: 'profile-complete',
    description: 'Profile setup required',
    evaluate: (context) => context.onboarding?.profileComplete === true
  }
)

// Apply to modules
const documentsModule = featureFlagConfig.modules.find(m => m.id === 'documents')
if (documentsModule) {
  documentsModule.requiredRules = ['email-verified', 'profile-complete']
  documentsModule.disabledMessage = 'Complete your profile to access Documents'
}
```

### Dynamic Context Updates

```tsx
function UserDashboard() {
  const { setContextValue, updateUserContext } = useFeatureFlagContext()

  const handleSubscriptionUpgrade = () => {
    setContextValue('subscriptionTier', 'premium')
  }

  const handleOnboardingComplete = () => {
    updateUserContext({
      onboarding: {
        emailVerified: true,
        profileComplete: true
      }
    })
  }

  return (
    <div>
      <button onClick={handleSubscriptionUpgrade}>Upgrade to Premium</button>
      <button onClick={handleOnboardingComplete}>Complete Onboarding</button>
    </div>
  )
}
```

### Complex Custom Rules

```tsx
featureFlagConfig.rules.push({
  id: 'advanced-feature-access',
  description: 'Complex access logic',
  evaluate: (context) => {
    const { user, subscription, trial, permissions } = context

    // Premium users always have access
    if (subscription?.tier === 'premium') return true

    // Trial users with specific conditions
    if (trial?.isActive && trial?.daysLeft > 3) {
      return user?.completedTutorial === true
    }

    // Custom permission override
    return permissions?.includes('advanced-features')
  }
})
```

## Integration with Sidebar and Routing

The system automatically integrates with your application:

### Sidebar Integration (`src/layouts/applayout/AppLayout.tsx`)
- Disabled modules show with reduced opacity (50%) and grayscale icons
- Tooltips display disabled reasons when hovering over disabled items
- Click behavior is disabled for restricted modules (`cursor: not-allowed`)
- Navigation links are conditionally rendered based on module access
- Visual feedback shows module state with proper styling

### Route Protection (`src/router/index.tsx`)
- All routes are wrapped with `FeatureProtectedRoute` component
- Prevents direct URL access to disabled modules
- Redirects users away from inaccessible pages
- Each route specifies its required `moduleId` for access control

### Menu Configuration (`src/layouts/applayout/applayout-config.ts`)
- Each menu item now includes a `moduleId` property
- Links sidebar navigation to feature flag system
- Supports proper TypeScript typing with `ModuleId` type

## API Reference

### FeatureFlagProvider Props
- `initialContext`: Initial user context object
- `children`: React components to wrap

### useFeatureFlagContext() Returns
- `userContext`: Current user context
- `updateUserContext(updates)`: Merge updates with current context
- `setContextValue(key, value)`: Set specific context value
- `getContextValue(key)`: Get specific context value

### useFeatureFlags(userContext) Returns
- `modulePermissions`: Array of all module permissions
- `isModuleEnabled(moduleId)`: Check if specific module is enabled
- `getDisabledReason(moduleId)`: Get reason why module is disabled
- `getEnabledModules()`: Get list of enabled module IDs
- `getDisabledModules()`: Get list of disabled modules with reasons

## Module IDs

Available module IDs:
- `dashboard`
- `documents`
- `reports`
- `benchmarks`
- `team-management`
- `practice-settings`
- `billing`
- `settings`
- `help-support`

## Best Practices

1. **Define rules early**: Set up your feature rules before configuring modules
2. **Use descriptive IDs**: Make rule IDs self-explanatory
3. **Provide helpful messages**: Always include `disabledMessage` for better UX
4. **Test thoroughly**: Verify all permission combinations work as expected
5. **Keep context minimal**: Only include necessary data in user context
6. **Update context reactively**: Update permissions when user state changes

## Testing

A test component (`src/test-feature-flags.tsx`) is available to demonstrate and test the feature flag system:
- Shows current user context state
- Provides buttons to simulate different user scenarios
- Displays real-time module permission updates
- Helps verify feature flag behavior during development

To use the test component, import and render it in your development environment to see how different context changes affect module permissions.