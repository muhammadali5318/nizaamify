// src/pages/non-pl-items/dummyNonPLData.ts

export const dummyNonPLData = {
  total: 36000,
  categories: [
    {
      parent_category: 'Owner, Tax & Capital Movement',
      amount: 18000
    }
  ],
  non_pl_type: [
    {
      non_pl_type: 'Owner, Tax & Capital Movement',
      non_pl_subtypes: [
        {
          name: 'Owner Pay & Withdrawals',
          amount: 12000,
          line_items: [
            { name: 'Owner Salary', amount: 3000 },
            { name: 'Dividend Pay', amount: 3000 },
            { name: 'Drawings', amount: 2000 },
            { name: 'Directors Loan - Repayment', amount: 2000 },
            { name: 'Other (owner pay & withdrawals)', amount: 2000 }
          ]
        },
        {
          name: 'Taxes',
          amount: 4000,
          line_items: [
            { name: 'Corporation Tax', amount: 2500 },
            { name: 'Dividend Tax', amount: 1000 },
            { name: 'Other (taxes)', amount: 500 }
          ]
        },
        {
          name: 'Financing & Capital',
          amount: 2000,
          line_items: [
            { name: 'Capital Introduced by Owner', amount: 1000 },
            { name: 'Directors Loan', amount: 500 },
            { name: 'Intercompany Loan', amount: 500 }
          ]
        }
      ]
    }
  ]
}
