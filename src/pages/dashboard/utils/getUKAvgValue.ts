export const getUKAvgValue = (
  expense_type: string,
  practiceType: string
): string => {
  const table: Record<string, Record<string, string>> = {
    'Staff Costs': {
      PRIVATE: '18 - 20%',
      MIXED: '19 - 21%',
      'NHS-DOMINANT': '20 - 22%',
      'Squat / Start-up': '22 - 24%'
    },
    'Clinician Costs': {
      PRIVATE: '38 - 40%',
      MIXED: '39 - 41%',
      'NHS-DOMINANT': '40 - 42%',
      'SQUAT/START-UP': '42 - 50%'
    },
    'Materials & Equipment': {
      PRIVATE: '6 - 8%',
      MIXED: '5 - 7%',
      'NHS-DOMINANT': '4 - 6%',
      'SQUAT/START-UP': '8 - 10%'
    },
    'Lab Fees': {
      PRIVATE: '6 - 7%',
      MIXED: '5 - 6%',
      'NHS-DOMINANT': '4 - 6%',
      'SQUAT/START-UP': '6 - 10%'
    },
    Premises: {
      PRIVATE: '4 - 5%',
      MIXED: '3 - 5%',
      'NHS-DOMINANT': '3 - 5%',
      'SQUAT/START-UP': '6 - 8%'
    },
    Marketing: {
      PRIVATE: '3 - 6%',
      MIXED: '3 - 5%',
      'NHS-DOMINANT': '0 - 2%',
      'SQUAT/START-UP': '10 - 20%'
    },
    'Net profit margin': {
      PRIVATE: '9 - 13%',
      MIXED: '8 - 12%',
      'NHS-DOMINANT': '6 - 8%',
      'SQUAT/START-UP': '-5% to -2%'
    },
    'Business Operations': {
      PRIVATE: '14 - 16%',
      MIXED: '14 - 16%',
      'NHS-DOMINANT': '14 - 16%',
      'SQUAT/START-UP': '14 - 16%'
    }
  }

  const type = practiceType?.trim() || 'NHS-DOMINANT'
  return table[expense_type]?.[type] ?? '—'
}
