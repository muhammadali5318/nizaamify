export const mapExpenseSubtypes = (expenseType?: any) =>
  expenseType?.expense_subtypes?.map((subtype: any) => ({
    expense_subtype: subtype.expense_subtype,
    total_amount: subtype.total_amount,
    expense_sub_categories: subtype.expense_sub_categories.map((item: any) => {
      const [name, amount] = Object.entries(item)[0]
      return { name, amount }
    })
  })) ?? []
