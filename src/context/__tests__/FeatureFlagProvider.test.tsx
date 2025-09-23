import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import {
  FeatureFlagProvider,
  useFeatureFlagContext
} from '../FeatureFlagProvider'

// Test component to interact with the context
const TestComponent = () => {
  const { userContext, updateUserContext, setContextValue, getContextValue } =
    useFeatureFlagContext()

  return (
    <div>
      <div data-testid='context'>{JSON.stringify(userContext)}</div>
      <button
        onClick={() => updateUserContext({ testKey: 'updated' })}
        data-testid='update-context'
      >
        Update Context
      </button>
      <button
        onClick={() => setContextValue('singleKey', 'singleValue')}
        data-testid='set-single-value'
      >
        Set Single Value
      </button>
      <div data-testid='get-value'>{getContextValue('testKey')}</div>
    </div>
  )
}

describe('FeatureFlagProvider', () => {
  it('provides initial context correctly', () => {
    const initialContext = { testKey: 'testValue', otherKey: 123 }

    render(
      <FeatureFlagProvider initialContext={initialContext}>
        <TestComponent />
      </FeatureFlagProvider>
    )

    const contextDisplay = screen.getByTestId('context')
    expect(contextDisplay).toHaveTextContent(JSON.stringify(initialContext))
  })

  it('provides empty context when no initial context provided', () => {
    render(
      <FeatureFlagProvider>
        <TestComponent />
      </FeatureFlagProvider>
    )

    const contextDisplay = screen.getByTestId('context')
    expect(contextDisplay).toHaveTextContent('{}')
  })

  it('updates context using updateUserContext', () => {
    render(
      <FeatureFlagProvider initialContext={{ testKey: 'initial' }}>
        <TestComponent />
      </FeatureFlagProvider>
    )

    fireEvent.click(screen.getByTestId('update-context'))

    const contextDisplay = screen.getByTestId('context')
    expect(contextDisplay).toHaveTextContent(
      JSON.stringify({ testKey: 'updated' })
    )
  })

  it('sets single context value using setContextValue', () => {
    render(
      <FeatureFlagProvider initialContext={{ existingKey: 'existing' }}>
        <TestComponent />
      </FeatureFlagProvider>
    )

    fireEvent.click(screen.getByTestId('set-single-value'))

    const contextDisplay = screen.getByTestId('context')
    const expectedContext = {
      existingKey: 'existing',
      singleKey: 'singleValue'
    }
    expect(contextDisplay).toHaveTextContent(JSON.stringify(expectedContext))
  })

  it('gets context value using getContextValue', () => {
    render(
      <FeatureFlagProvider initialContext={{ testKey: 'retrieveMe' }}>
        <TestComponent />
      </FeatureFlagProvider>
    )

    const valueDisplay = screen.getByTestId('get-value')
    expect(valueDisplay).toHaveTextContent('retrieveMe')
  })

  it('merges context updates correctly', () => {
    const TestMergeComponent = () => {
      const { userContext, updateUserContext } = useFeatureFlagContext()

      return (
        <div>
          <div data-testid='context'>{JSON.stringify(userContext)}</div>
          <button
            onClick={() => updateUserContext({ newKey: 'newValue' })}
            data-testid='add-key'
          >
            Add Key
          </button>
          <button
            onClick={() => updateUserContext({ testKey: 'modified' })}
            data-testid='modify-key'
          >
            Modify Key
          </button>
        </div>
      )
    }

    render(
      <FeatureFlagProvider
        initialContext={{ testKey: 'original', keepMe: 'intact' }}
      >
        <TestMergeComponent />
      </FeatureFlagProvider>
    )

    // Add new key
    fireEvent.click(screen.getByTestId('add-key'))
    let contextDisplay = screen.getByTestId('context')
    expect(contextDisplay).toHaveTextContent(
      JSON.stringify({
        testKey: 'original',
        keepMe: 'intact',
        newKey: 'newValue'
      })
    )

    // Modify existing key
    fireEvent.click(screen.getByTestId('modify-key'))
    contextDisplay = screen.getByTestId('context')
    expect(contextDisplay).toHaveTextContent(
      JSON.stringify({
        testKey: 'modified',
        keepMe: 'intact',
        newKey: 'newValue'
      })
    )
  })

  it('throws error when used outside provider', () => {
    // Mock console.error to avoid noise in test output
    const originalError = console.error
    console.error = vi.fn()

    expect(() => {
      render(<TestComponent />)
    }).toThrow(
      'useFeatureFlagContext must be used within a FeatureFlagProvider'
    )

    console.error = originalError
  })

  it('handles undefined and null values correctly', () => {
    const TestNullComponent = () => {
      const { setContextValue, getContextValue } = useFeatureFlagContext()

      return (
        <div>
          <button
            onClick={() => setContextValue('nullKey', null)}
            data-testid='set-null'
          >
            Set Null
          </button>
          <button
            onClick={() => setContextValue('undefinedKey', undefined)}
            data-testid='set-undefined'
          >
            Set Undefined
          </button>
          <div data-testid='null-value'>
            {String(getContextValue('nullKey'))}
          </div>
          <div data-testid='undefined-value'>
            {String(getContextValue('undefinedKey'))}
          </div>
        </div>
      )
    }

    render(
      <FeatureFlagProvider>
        <TestNullComponent />
      </FeatureFlagProvider>
    )

    fireEvent.click(screen.getByTestId('set-null'))
    fireEvent.click(screen.getByTestId('set-undefined'))

    expect(screen.getByTestId('null-value')).toHaveTextContent('null')
    expect(screen.getByTestId('undefined-value')).toHaveTextContent('undefined')
  })
})
