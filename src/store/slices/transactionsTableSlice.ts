// src/store/transactionsTableSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type CategoryObj = {
  category: string
  type: string
  subtype: string
  lineItem: string
  // allow extra fields if needed
  [key: string]: any
}

type CategoriesState = {
  // keyed by row id
  categories: Record<string, CategoryObj>
}

const initialState: CategoriesState = {
  categories: {}
}

const transactionsTableSlice = createSlice({
  name: 'transactionsTable',
  initialState,
  reducers: {
    /**
     * Sets or merges a category for a given row id.
     * If a category already exists for id, it will be shallow-merged.
     */
    setCategory(
      state,
      action: PayloadAction<{ id: string; category: CategoryObj }>
    ) {
      const { id, category } = action.payload
      const existing = state.categories[id] ?? {}
      state.categories[id] = { ...existing, ...category }
    },

    /**
     * Replace/merge multiple categories at once.
     * Useful for hydrating or bulk updates.
     */
    setCategories(state, action: PayloadAction<Record<string, CategoryObj>>) {
      state.categories = { ...state.categories, ...action.payload }
    },

    /**
     * Remove a single category by row id.
     */
    removeCategory(state, action: PayloadAction<string>) {
      delete state.categories[action.payload]
    },

    /**
     * Clear everything.
     */
    clearCategories(state) {
      state.categories = {}
    }
  }
})

export const { setCategory, setCategories, removeCategory, clearCategories } =
  transactionsTableSlice.actions

export default transactionsTableSlice.reducer

// --- Selectors (easy getters) ---
export const selectAllCategories = (state: any) =>
  state.transactionsTable?.categories ?? ({} as Record<string, CategoryObj>)

export const selectCategoryById = (state: any, id: string) =>
  state.transactionsTable?.categories?.[id] ?? null
